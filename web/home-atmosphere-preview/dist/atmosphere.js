/** Standalone, monochrome atmosphere. All textures are generated locally. */
export function startAtmosphere({ canvas, glow, halo, grain } = {}) {
  const context = canvas?.getContext('2d', { alpha: true });
  if (!context) return { dispose() {} };

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const grainContext = grain?.getContext('2d', { alpha: false });
  const random = (low, high) => low + Math.random() * (high - low);
  const tau = Math.PI * 2;
  let width = 1, height = 1, ratio = 1;
  let frameId = 0, disposed = false, previous = 0, elapsed = 0;
  let grainAt = -1, sparkAt = .2;
  const pointer = { x: .5, y: .45, targetX: .5, targetY: .45 };
  const sparks = [];

  function makeCloud() {
    const texture = document.createElement('canvas');
    texture.width = texture.height = 192;
    const paint = texture.getContext('2d');
    for (let i = 0; i < 11; i++) {
      const x = random(55, 137), y = random(55, 137), radius = random(28, 65);
      const gradient = paint.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, 'rgba(255,255,255,.22)');
      gradient.addColorStop(.48, 'rgba(255,255,255,.055)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      paint.fillStyle = gradient;
      paint.fillRect(0, 0, 192, 192);
    }
    paint.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 3; i++) {
      const x = random(45, 147), y = random(45, 147), radius = random(18, 42);
      const cutout = paint.createRadialGradient(x, y, 0, x, y, radius);
      cutout.addColorStop(0, 'rgba(0,0,0,.52)');
      cutout.addColorStop(1, 'rgba(0,0,0,0)');
      paint.fillStyle = cutout;
      paint.fillRect(0, 0, 192, 192);
    }
    paint.globalCompositeOperation = 'destination-in';
    const edge = paint.createRadialGradient(96, 96, 25, 96, 96, 96);
    edge.addColorStop(0, '#000');
    edge.addColorStop(1, 'transparent');
    paint.fillStyle = edge;
    paint.fillRect(0, 0, 192, 192);
    return texture;
  }

  const textures = Array.from({ length: 4 }, makeCloud);
  const clouds = [];

  function createCloud(plume = false, prefill = false) {
    const lifetime = plume ? random(12, 20) : random(22, 36);
    const age = prefill ? random(0, lifetime * .9) : 0;
    return {
      plume, lifetime, age,
      x: plume ? width * random(.40, .60) : width * random(-.1, 1.1),
      y: plume ? height * .43 - age * 15 : height + 100 - age * 24,
      radius: plume ? random(30, 57) + age * 3 : random(95, 170) + age * 2,
      phase: random(0, tau), rotation: random(0, tau),
      speed: plume ? random(14, 23) : random(5, 12),
      shape: Math.floor(random(0, textures.length)),
      turn: random(-.065, .065), weight: random(.65, 1),
    };
  }

  function populate() {
    clouds.length = 0;
    const ambientCount = width < 600 ? 8 : 13;
    for (let i = 0; i < ambientCount; i++) clouds.push(createCloud(false, true));
    for (let i = 0; i < 11; i++) clouds.push(createCloud(true, true));
    sparks.length = 0;
    for (let i = 0; i < (width < 600 ? 12 : 20); i++) sparks.push(createSpark(true));
  }
  function createSpark(prefill = false) {
    const life = random(5, 7);
    const age = prefill ? random(0, life * .7) : 0;
    const speed = -random(height * .22, height * .30);
    return {x:width * random(.08,.92), y:height + 3 + speed * age + 4 * age * age,
      vx:random(-13,13), vy:speed + 8 * age, age, life, radius:random(.6,1.2)};
  }

  let noisePattern;
  if (grainContext) {
    const noise = document.createElement('canvas');
    noise.width = noise.height = 128;
    const painter = noise.getContext('2d');
    const data = painter.createImageData(128, 128);
    for (let index = 0; index < data.data.length; index += 4) {
      const value = Math.floor(Math.pow(Math.random(), 2.1) * 49);
      data.data[index] = data.data[index + 1] = data.data[index + 2] = value;
      data.data[index + 3] = 255;
    }
    painter.putImageData(data, 0, 0);
    noisePattern = grainContext.createPattern(noise, 'repeat');
  }

  function renderGrain() {
    if (!grainContext || !noisePattern) return;
    const offsetX = Math.floor(random(-128, 0)), offsetY = Math.floor(random(-128, 0));
    grainContext.save();
    grainContext.translate(offsetX, offsetY);
    grainContext.fillStyle = noisePattern;
    grainContext.fillRect(-offsetX, -offsetY, grain.width, grain.height);
    grainContext.restore();
  }

  function updateLight() {
    if (!glow) return;
    glow.style.setProperty('--pointer-x', `${(pointer.x * width).toFixed(2)}px`);
    glow.style.setProperty('--pointer-y', `${(pointer.y * height).toFixed(2)}px`);
  }

  function resize() {
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (grain) {
      grain.width = Math.ceil(width);
      grain.height = Math.ceil(height);
      renderGrain();
    }
    populate();
    updateLight();
    if (motion.matches) renderScene(0);
  }

  function drawLight(x, y, radius, strength) {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(255,255,255,${strength})`);
    gradient.addColorStop(.36, `rgba(255,255,255,${strength * .34})`);
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, height);
  }

  function renderScene(delta) {
    elapsed += delta;
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    const flicker = .66 + Math.sin(elapsed * 1.8) * .13 + Math.sin(elapsed * 4.1 + 1.2) * .08;
    const lean = pointer.x - .5;
    drawLight(width * (.5 + lean * .18), height * 1.08, height * .78, .16 * flicker);
    drawLight(width * (.5 + lean * .25 + Math.sin(elapsed * .6) * .075), height * 1.08, height * .43, .075 * flicker);

    for (let index = 0; index < clouds.length; index++) {
      let cloud = clouds[index];
      if (cloud.age > cloud.lifetime || cloud.y < -cloud.radius * 2) {
        cloud = clouds[index] = createCloud(cloud.plume);
      }
      const life = cloud.age / cloud.lifetime;
      const fade = Math.sin(Math.PI * life) * (1 - life * .35);
      const wind = Math.sin(elapsed * .31 + cloud.phase) * 5 + lean * 14;
      const eddy = Math.sin(cloud.y * .008 + elapsed * .7) * 8;
      cloud.age += delta;
      cloud.x += (wind + eddy) * delta;
      cloud.y -= cloud.speed * delta;
      cloud.radius += (cloud.plume ? 3 : 2.7) * delta;
      cloud.rotation += cloud.turn * delta;
      const distance = Math.hypot(cloud.x - pointer.x * width, cloud.y - pointer.y * height);
      const illumination = Math.max(0, 1 - distance / 450) * .018;
      context.save();
      context.translate(cloud.x, cloud.y);
      context.rotate(cloud.rotation);
      context.globalAlpha = fade * cloud.weight * ((cloud.plume ? .11 : .075) + illumination) * (.7 + flicker * .3);
      context.scale(1, cloud.plume ? 1.2 : .88);
      context.drawImage(textures[cloud.shape], -cloud.radius, -cloud.radius, cloud.radius * 2, cloud.radius * 2);
      context.restore();
    }

    if (delta && elapsed > sparkAt) {
      if (sparks.length < 80) sparks.push(createSpark());
      // A gentle independent pulse keeps the embers alive with sound off too.
      sparkAt = elapsed + random(.08, .18) * (1 + Math.sin(elapsed * 1.1) * .16);
    }
    for (let index = sparks.length - 1; index >= 0; index--) {
      const spark = sparks[index];
      spark.age += delta;
      if (spark.age > spark.life || spark.y < -20) { sparks.splice(index, 1); continue; }
      const oldX = spark.x, oldY = spark.y;
      spark.vy += 8 * delta;
      spark.x += (spark.vx + lean * 8) * delta;
      spark.y += spark.vy * delta;
      const alpha = Math.pow(1 - spark.age / spark.life, .65) * .95;
      context.shadowColor = `rgba(255,255,255,${alpha * .65})`;
      context.shadowBlur = 4;
      context.strokeStyle = `rgba(255,255,255,${alpha})`;
      context.lineWidth = spark.radius;
      context.lineCap = 'round';
      context.beginPath();
      context.moveTo(oldX, oldY);
      context.lineTo(spark.x, spark.y - 1);
      context.stroke();
    }
    context.shadowBlur = 0;
    context.globalCompositeOperation = 'source-over';
    context.globalAlpha = 1;
    if (halo) halo.style.opacity = motion.matches ? '.82' : String(.86 + Math.sin(elapsed * .9) * .14);
  }

  function frame(now) {
    frameId = 0;
    if (disposed || document.hidden || motion.matches) return;
    const delta = previous ? Math.min((now - previous) / 1000, .06) : 0;
    previous = now;
    const blend = 1 - Math.exp(-12 * delta);
    pointer.x += (pointer.targetX - pointer.x) * blend;
    pointer.y += (pointer.targetY - pointer.y) * blend;
    updateLight();
    renderScene(delta);
    if (elapsed - grainAt > .15) { renderGrain(); grainAt = elapsed; }
    frameId = requestAnimationFrame(frame);
  }

  function syncMotion() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    previous = 0;
    if (disposed || document.hidden) return;
    if (motion.matches) {
      pointer.x = pointer.targetX = .5;
      pointer.y = pointer.targetY = .45;
      updateLight();
      renderScene(0);
      renderGrain();
    } else frameId = requestAnimationFrame(frame);
  }

  function move(event) {
    if (motion.matches) return;
    pointer.targetX = Math.min(1, Math.max(0, event.clientX / width));
    pointer.targetY = Math.min(1, Math.max(0, event.clientY / height));
  }

  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('visibilitychange', syncMotion);
  motion.addEventListener('change', syncMotion);
  resize();
  syncMotion();

  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', move);
      document.removeEventListener('visibilitychange', syncMotion);
      motion.removeEventListener('change', syncMotion);
      context.clearRect(0, 0, width, height);
    },
  };
}
