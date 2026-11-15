// Temporary listening reference, not a redistributed or licensed application asset.
export const AUDIO_SOURCE = Object.freeze({
  origin: 'https://chef.com/',
  intro: 'https://chef.com/intro.mp3',
  loop: 'https://chef.com/loop.mp3',
});

export function createAudioController({ button, label, bars, status, analyze = false, volume: initialVolume = .5, onStateChange }) {
  if (!button || !label) throw new TypeError('Ses düğmesi ve etiketi gerekli.');
  const barElements = Array.from(bars?.children || bars || []);
  const abort = new AbortController();
  let disposed = false;
  let wanted = false;
  let volume = Number.isFinite(initialVolume) ? Math.max(0, Math.min(1, initialVolume)) : .5;
  let generation = 0;
  let startTicket = 0;
  let context = null;
  let analyser = null;
  let frequencyData = null;
  let buffers = null;
  let loading = null;
  let sequence = null;
  let media = null;
  let nextLoop = null;
  let meterFrame = 0;
  // chef.com currently sends no Access-Control-Allow-Origin: normal playback is
  // the default, avoiding a known-to-fail cross-origin fetch on localhost.
  // Set analyze only when an authorized same-origin/CORS-enabled source exists.
  let fallback = !analyze;
  const disconnectTimers = new Set();
  const isCurrent = (id) => !disposed && wanted && generation === id;

  function setStatus(message = '') { if (status) status.textContent = message; }
  function resetBars() { barElements.forEach((bar) => { bar.style.height = '3px'; }); }
  function setState(state) {
    if (disposed) return;
    button.dataset.state = state;
    button.setAttribute('aria-pressed', String(state === 'playing'));
    button.setAttribute('aria-busy', String(state === 'loading'));
    label.textContent = state === 'loading' ? 'Yükleniyor…' : wanted ? 'Sesi kapat' : 'Sesi aç';
    button.setAttribute('aria-label', label.textContent);
    if (state !== 'playing' || !sequence || !analyser || document.hidden) {
      cancelAnimationFrame(meterFrame);
      meterFrame = 0;
      resetBars();
    } else if (!meterFrame) meterFrame = requestAnimationFrame(meter);
    onStateChange?.({state, wanted, volume});
  }

  function meter() {
    meterFrame = 0;
    if (disposed) return;
    if (wanted && sequence && context?.state === 'running' && !document.hidden && analyser) {
      analyser.getByteFrequencyData(frequencyData);
      const bands = [[1, 4], [4, 10], [10, 35], [35, 90]];
      barElements.forEach((bar, index) => {
        const band = bands[index % bands.length];
        let peak = 0;
        for (let i = band[0]; i < Math.min(band[1], frequencyData.length); i++) peak = Math.max(peak, frequencyData[i]);
        bar.style.height = `${3 + Math.pow(peak / 255, 1.45) * 12}px`;
      });
      meterFrame = requestAnimationFrame(meter);
    } else resetBars();
  }

  function stopSequence(immediate = false) {
    const old = sequence;
    sequence = null;
    if (!old) return;
    const now = context.currentTime;
    old.gain.gain.cancelScheduledValues(now);
    old.gain.gain.setValueAtTime(old.gain.gain.value, now);
    old.gain.gain.linearRampToValueAtTime(0, now + (immediate ? 0 : 0.18));
    old.sources.forEach((source) => { try { source.stop(now + (immediate ? 0 : 0.2)); } catch {} });
    const disconnect = () => {
      old.sources.forEach((source) => { try { source.disconnect(); } catch {} });
      old.gain.disconnect();
    };
    if (immediate) disconnect();
    else {
      const timer = setTimeout(() => { disconnectTimers.delete(timer); disconnect(); }, 240);
      disconnectTimers.add(timer);
    }
  }

  function stopMedia() {
    if (nextLoop) {
      nextLoop.pause();
      nextLoop.removeAttribute('src');
      nextLoop.load();
      nextLoop = null;
    }
    if (!media) return;
    const old = media;
    media = null;
    old.onended = null;
    old.onerror = null;
    old.pause();
    old.removeAttribute('src');
    old.load();
  }

  async function loadBuffers() {
    if (buffers) return buffers;
    if (loading) return loading;
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) throw new Error('Web Audio kullanılamıyor.');
    if (!context) {
      context = new Context();
      analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
      analyser.connect(context.destination);
    }
    loading = (async () => {
      const timeoutAbort = new AbortController();
      const cancel = () => timeoutAbort.abort();
      abort.signal.addEventListener('abort', cancel, { once: true });
      const timeout = setTimeout(cancel, 15000);
      try {
        buffers = await Promise.all([AUDIO_SOURCE.intro, AUDIO_SOURCE.loop].map(async (url) => {
          const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: timeoutAbort.signal });
          if (!response.ok) throw new Error(`Ses kaynağına ulaşılamadı (${response.status}).`);
          return context.decodeAudioData(await response.arrayBuffer());
        }));
        return buffers;
      } finally {
        clearTimeout(timeout);
        abort.signal.removeEventListener('abort', cancel);
      }
    })();
    return loading;
  }

  function fail(id) {
    if (!isCurrent(id)) return;
    wanted = false;
    generation++;
    stopSequence();
    stopMedia();
    setState('error');
    setStatus('Ses açılamadı. İnternet bağlantısını kontrol edip yeniden dene.');
  }

  async function startMedia(id, loop = false) {
    if (!isCurrent(id) || document.hidden) return;
    const prepared = loop ? nextLoop : null;
    nextLoop = null;
    stopMedia();
    const audio = prepared || new Audio(loop ? AUDIO_SOURCE.loop : AUDIO_SOURCE.intro);
    media = audio;
    audio.loop = loop;
    audio.volume = volume;
    audio.preload = 'auto';
    if (!loop) {
      nextLoop = new Audio(AUDIO_SOURCE.loop);
      nextLoop.volume = volume;
      nextLoop.preload = 'auto';
      nextLoop.load();
    }
    audio.onended = () => {
      if (media === audio && isCurrent(id)) startMedia(id, true).catch(() => fail(id));
    };
    audio.onerror = () => { if (media === audio) fail(id); };
    try {
      await audio.play();
      if (!isCurrent(id) || media !== audio) { audio.pause(); return; }
      if (document.hidden) { audio.pause(); setState('paused'); return; }
      setState('playing');
      setStatus();
    } catch (error) {
      if (media === audio) throw error;
    }
  }

  async function start(id) {
    const ticket = ++startTicket;
    setState('loading');
    setStatus();
    try {
      if (fallback) { await startMedia(id); return; }
      // Resume is initiated before awaiting network work, inside the user's gesture.
      const work = loadBuffers();
      const resume = context ? context.resume() : Promise.resolve();
      await Promise.all([work, resume]);
      if (!isCurrent(id) || ticket !== startTicket) return;
      if (document.hidden) { await context.suspend(); setState('paused'); return; }
      if (context.state !== 'running') throw new Error('Ses başlatılamadı.');
      const gain = context.createGain();
      gain.gain.value = 0;
      gain.connect(analyser);
      const intro = context.createBufferSource();
      const loop = context.createBufferSource();
      intro.buffer = buffers[0];
      loop.buffer = buffers[1];
      loop.loop = true;
      intro.connect(gain);
      loop.connect(gain);
      sequence = { gain, sources: [intro, loop] };
      const at = context.currentTime + 0.04;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(volume, at + 0.18);
      intro.start(at);
      loop.start(at + intro.buffer.duration);
      setState('playing');
    } catch {
      if (!isCurrent(id) || ticket !== startTicket) return;
      // A source may permit normal playback while disallowing cross-origin decoding.
      fallback = true;
      button.dataset.meter = 'unavailable';
      stopSequence(true);
      if (document.hidden) { setState('paused'); return; }
      try { await startMedia(id); } catch { fail(id); }
    }
  }

  async function toggle() {
    if (disposed) return;
    wanted = !wanted;
    const id = ++generation;
    if (!wanted) {
      stopSequence();
      stopMedia();
      setState('muted');
      setStatus();
      return;
    }
    await start(id);
  }

  async function onVisibility() {
    if (disposed) return;
    if (document.hidden) {
      if (context?.state === 'running') await context.suspend().catch(() => {});
      media?.pause();
      if (wanted) setState('paused');
      return;
    }
    if (!wanted) return;
    const id = generation;
    try {
      if (sequence) {
        await context.resume();
        if (isCurrent(id) && !document.hidden) setState('playing');
      } else if (media) {
        const resumed = media;
        await resumed.play();
        if (isCurrent(id) && media === resumed && !document.hidden) setState('playing');
      } else await start(id);
    } catch { fail(id); }
  }

  const onClick = () => { void toggle(); };
  const onHidden = () => { void onVisibility(); };
  button.addEventListener('click', onClick);
  button.dataset.meter = fallback ? 'unavailable' : 'live';
  document.addEventListener('visibilitychange', onHidden);
  setState('muted');
  setStatus();

  function dispose() {
    if (disposed) return;
    wanted = false;
    generation++;
    stopSequence(true);
    stopMedia();
    abort.abort();
    button.removeEventListener('click', onClick);
    document.removeEventListener('visibilitychange', onHidden);
    cancelAnimationFrame(meterFrame);
    resetBars();
    button.dataset.state = 'muted';
    button.setAttribute('aria-pressed', 'false');
    button.setAttribute('aria-busy', 'false');
    label.textContent = 'Sesi aç';
    button.setAttribute('aria-label', 'Sesi aç');
    setStatus();
    disposed = true;
    // Already-fading sources disconnect themselves; closing also frees all nodes.
    if (context && context.state !== 'closed') context.close().catch(() => {});
  }
  function setVolume(value) {
    if (disposed || !Number.isFinite(value)) return;
    volume = Math.max(0, Math.min(1, value));
    if (media) media.volume = volume;
    if (nextLoop) nextLoop.volume = volume;
    if (sequence && context) {
      sequence.gain.gain.cancelScheduledValues(context.currentTime);
      sequence.gain.gain.setValueAtTime(volume, context.currentTime);
    }
    onStateChange?.({state: button.dataset.state, wanted, volume});
  }
  return { toggle, dispose, setVolume };
}
