import React,{useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import * as THREE from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RotateCcw,MoveHorizontal,ZoomIn,ZoomOut,Expand,X,Brush,Check} from 'lucide-react';
import {avatarShape,avatarShapeKey} from './avatar-shape.js';
import bodyModel from './human-model.js';
import {normalizeAppearance} from './appearance.js';
import {useAvatarOverlay} from './avatar-overlay.jsx';
import {createAvatarGroundShadow} from './ground-shadow.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export default function BodyAvatar({profile={},compact=false,onAppearanceChange}){
  const mount=useRef(null),slotRef=useRef(null),figureRef=useRef(null),api=useRef(null),[unavailable,setUnavailable]=useState(false),[interacted,setInteracted]=useState(false),[expanded,setExpanded]=useState(false);
  const key=avatarShapeKey(profile),shape=useMemo(()=>avatarShape(profile),[key]);
  const[editingAppearance,setEditingAppearance]=useState(false);
  const closeExpanded=useCallback(()=>{setExpanded(false);setEditingAppearance(false);api.current?.reset();},[]);
  const {host,rememberOpener}=useAvatarOverlay({expanded,onClose:closeExpanded,slotRef,figureRef});
  const openExpanded=(edit=false)=>{rememberOpener();setExpanded(true);setEditingAppearance(edit);};
  const openEditor=()=>{if(!expanded)rememberOpener();setExpanded(true);setEditingAppearance(true);requestAnimationFrame(()=>api.current?.focusHead());};
  const updateAppearance=patch=>onAppearanceChange?.(normalizeAppearance({...shape.appearance,...patch}));
  const latest=useRef(shape);latest.current=shape;
  useEffect(()=>{
    const host=mount.current;if(!host)return;
    let renderer,controls,model,frame=0,resizeFrame=0,disposed=false,activeUntil=0,themeObserver,resizeObserver,lastWidth=0,lastHeight=0;
    const clean=[];
    try{
      renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
      const canvas=renderer.domElement;canvas.setAttribute('aria-label','Ölçülere göre yaklaşık üç boyutlu vücut. Fareyle sürükleyerek çevir.');canvas.setAttribute('role','img');canvas.tabIndex=0;host.appendChild(canvas);
      const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.03,40);
      model=bodyModel(latest.current);scene.add(model);
      const ambient=new THREE.HemisphereLight('#edf2ff','#5c5550',2.3);scene.add(ambient);
      const keyLight=new THREE.DirectionalLight('#fff0d9',4.1);keyLight.position.set(-2.1,3.8,3.2);keyLight.castShadow=true;keyLight.shadow.mapSize.set(1024,1024);keyLight.shadow.camera.left=-1.1;keyLight.shadow.camera.right=1.1;keyLight.shadow.camera.top=2.3;keyLight.shadow.camera.bottom=-.2;keyLight.shadow.normalBias=.025;keyLight.shadow.bias=-.0001;scene.add(keyLight);
      const rim=new THREE.DirectionalLight('#a8c6ed',2.2);rim.position.set(2,2,-2);scene.add(rim);
      const fill=new THREE.DirectionalLight('#e7ddd0',1.1);fill.position.set(1,1.2,2);scene.add(fill);
      const floor=createAvatarGroundShadow({model,scale:latest.current.scale});scene.add(floor);
      controls=new OrbitControls(camera,canvas);controls.enablePan=false;controls.enableDamping=true;controls.dampingFactor=.12;controls.minPolarAngle=Math.PI*.23;controls.maxPolarAngle=Math.PI*.58;controls.minDistance=1.8;controls.maxDistance=5.6;controls.rotateSpeed=.65;controls.zoomSpeed=.65;controls.target.set(0,.91*latest.current.scale,0);
      const reset=()=>{const s=latest.current.scale;controls.minDistance=1.8*s;camera.position.set(.5*s,1.12*s,3.7*s);controls.target.set(0,.91*s,0);controls.update();requestRender()};
      const focusHead=()=>{const s=latest.current.scale;controls.minDistance=.34*s;camera.position.set(.06*s,1.69*s,.86*s);controls.target.set(0,1.68*s,0);controls.update();requestRender(700)};
      function draw(){if(disposed)return;controls.update();renderer.render(scene,camera);if(performance.now()<activeUntil)frame=requestAnimationFrame(draw);else frame=0}
      function requestRender(duration=950){if(disposed)return;activeUntil=Math.max(activeUntil,performance.now()+duration);if(!frame)frame=requestAnimationFrame(draw)}
      const interact=()=>{setInteracted(true);requestRender(1600)};
      controls.addEventListener('change',()=>requestRender(180));controls.addEventListener('start',interact);canvas.addEventListener('wheel',interact,{passive:true});
      const resize=()=>{const rect=host.getBoundingClientRect(),width=Math.floor(rect.width),height=Math.floor(rect.height);if(width<1||height<1||(width===lastWidth&&height===lastHeight))return;lastWidth=width;lastHeight=height;renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();requestRender(150)};
      resizeObserver=new ResizeObserver(()=>{if(!resizeFrame)resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;resize()})});resizeObserver.observe(host);
      const theme=()=>{const light=document.documentElement.dataset.theme==='light';ambient.intensity=light?2.8:2.3;model.userData.materials.skin.color.set(light?'#b6aa96':'#bcb3a4');model.userData.materials.detail.color.set(light?'#9d8e79':'#aaa091');floor.setTheme(light);requestRender(200)};
      themeObserver=new MutationObserver(theme);themeObserver.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
      const keydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const offset=camera.position.clone().sub(controls.target);offset.applyAxisAngle(new THREE.Vector3(0,1,0),e.key==='ArrowLeft'?-.18:.18);camera.position.copy(controls.target).add(offset);interact()}if(e.key==='Home'){e.preventDefault();reset()}if(e.key==='+'||e.key==='-'){e.preventDefault();zoom(e.key==='+'?.87:1.13)}};
      const zoom=factor=>{const offset=camera.position.clone().sub(controls.target);offset.multiplyScalar(clamp(factor,controls.minDistance/offset.length(),controls.maxDistance/offset.length()));camera.position.copy(controls.target).add(offset);interact()};
      canvas.addEventListener('keydown',keydown);clean.push(()=>canvas.removeEventListener('keydown',keydown),()=>canvas.removeEventListener('wheel',interact));
      api.current={reset,zoom,focusHead,updateShape(){const previous=model;model=bodyModel(latest.current);scene.remove(previous);scene.add(model);floor.fitModel(model);disposeModel(previous);theme();requestRender(700)}};
      theme();reset();resize();
      return()=>{disposed=true;cancelAnimationFrame(frame);cancelAnimationFrame(resizeFrame);resizeObserver?.disconnect();themeObserver?.disconnect();controls?.dispose();clean.forEach(fn=>fn());api.current=null;disposeModel(model);floor.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove()};
    }catch(error){console.warn('Vücut görünümü başlatılamadı.',error);setUnavailable(true);renderer?.dispose();return()=>{disposed=true;cancelAnimationFrame(frame);resizeObserver?.disconnect();themeObserver?.disconnect();controls?.dispose();clean.forEach(fn=>fn());host.replaceChildren()}}
  },[]);
  useEffect(()=>{api.current?.updateShape()},[key]);
  return <><div className={'body-avatar-slot'+(compact?' compact':'')} ref={slotRef}/>{createPortal(<>
   {expanded&&<div className="avatar-overlay-backdrop" onClick={closeExpanded} aria-hidden="true"/>}
   <figure key="avatar-figure" ref={figureRef} className={'body-avatar'+(compact?' compact':'')+(expanded?' expanded':'')+(expanded&&editingAppearance?' editing-appearance':'')} role={expanded?'dialog':undefined} aria-modal={expanded?'true':undefined} aria-label={expanded?'Üç boyutlu vücut görünümü':undefined}>
    {expanded&&<header className="avatar-expanded-header"><strong>Vücut görünümü</strong><div>{onAppearanceChange&&<button className="avatar-editor-trigger" aria-label="Karakter görünümünü düzenle" onClick={openEditor}><Brush size={15}/>Görünüm</button>}<button data-avatar-close aria-label="Vücut görünümünü kapat" onClick={closeExpanded}><X size={17}/><span>Kapat</span></button></div></header>}
    <div className="body-avatar-stage" ref={mount}/>
    {unavailable?<div className="body-avatar-fallback"><span>3D görünüm bu ekranda açılamadı.</span><small>Ölçümlerin ve hesapların kullanılmaya devam eder.</small></div>:<>
      <div className="body-avatar-controls" aria-label="Vücut görünümü kontrolleri"><button type="button" title="Uzaklaştır" aria-label="Vücut görünümünü uzaklaştır" onClick={()=>api.current?.zoom(1.12)}><ZoomOut size={13}/></button><button type="button" title="Yakınlaştır" aria-label="Vücut görünümünü yakınlaştır" onClick={()=>api.current?.zoom(.88)}><ZoomIn size={13}/></button><button type="button" title="Görünümü sıfırla" aria-label="Vücut görünümünü sıfırla" onClick={()=>api.current?.reset()}><RotateCcw size={12}/></button><button type="button" title={expanded?'Küçült':'Büyüt'} aria-label={expanded?'Vücut görünümünü küçült':'Vücut görünümünü büyüt'} onClick={()=>expanded?closeExpanded():openExpanded()}>{expanded?<X size={13}/>:<Expand size={12}/>}</button></div>
      <span className={'body-avatar-helper'+(interacted?' interacted':'')}><MoveHorizontal size={12}/>{compact?'Çevir':'Sürükle · çevir'}</span>
      {onAppearanceChange&&!expanded&&<button className="avatar-edit-button" aria-label="Karakter görünümünü düzenle" onClick={openEditor}><Brush size={13}/>Görünüm</button>}
      {expanded&&editingAppearance&&<aside className="avatar-customizer" aria-label="Karakter görünüm ayarları">
        <div className="row"><h3>Karakterin</h3><button className="avatar-edit-done" aria-label="Görünüm düzenlemeyi bitir" onClick={closeExpanded}><Check size={15}/>Bitti</button></div>
        <p>Seçimlerin otomatik kaydedilir.</p>
        <label>Saç modeli<select aria-label="Saç modeli" value={shape.appearance.hairStyle} onChange={e=>updateAppearance(e.target.value==='curtains'?{hairStyle:'curtains',hairLength:5.5,hairSides:.7,hairFringe:3.5,hairColor:'#211e1a'}:{hairStyle:e.target.value})}><option value="bald">Saçsız</option><option value="buzz">Çok kısa</option><option value="short">Kısa</option><option value="part">Yandan ayrılmış</option><option value="curtains">Fotoğrafındaki · doğal orta ayrım</option><option value="wavy">Dalgalı</option><option value="curly">Kıvırcık</option><option value="custom">Kendi modelim</option></select></label>
        <div className="appearance-colors"><label>Saç rengi<input type="color" value={shape.appearance.hairColor} onChange={e=>updateAppearance({hairColor:e.target.value})}/></label><label>Göz rengi<input type="color" value={shape.appearance.eyeColor} onChange={e=>updateAppearance({eyeColor:e.target.value})}/></label></div>
        {shape.appearance.hairStyle!=='bald'&&[['hairLength','Üst uzunluğu',8],['hairSides','Yanlar',4],['hairFringe','Ön uzunluğu',6]].map(([key,label,max])=><label key={key}>{label}<span className="appearance-slider"><input aria-label={label} type="range" min="0" max={max} step="0.1" value={shape.appearance[key]} onChange={e=>updateAppearance({[key]:Number(e.target.value)})}/><small>{shape.appearance[key].toLocaleString('tr-TR')} cm</small></span></label>)}
        <label>Gözlük<select aria-label="Gözlük" value={shape.appearance.glasses} onChange={e=>updateAppearance(e.target.value==='oval'?{glasses:'oval',glassesColor:'#171b1f'}:{glasses:e.target.value})}><option value="none">Yok</option><option value="oval">Fotoğraftaki · siyah oval</option><option value="round">Yuvarlak çerçeve</option><option value="square">Dikdörtgen çerçeve</option></select></label>
        {shape.appearance.glasses!=='none'&&<label className="appearance-color-row">Çerçeve rengi<input aria-label="Çerçeve rengi" type="color" value={shape.appearance.glassesColor} onChange={e=>updateAppearance({glassesColor:e.target.value})}/></label>}
        <button onClick={()=>api.current?.focusHead()}>Başa yaklaş</button><button onClick={()=>{setEditingAppearance(false);api.current?.reset()}}>Vücudu göster</button>
      </aside>}
    </>}
    <figcaption title={shape.note}>{expanded?shape.note:compact?'Yaklaşık görünüm':'Ölçülere göre yaklaşık görünüm'}</figcaption>
  </figure></>,host)}</>;
}

function disposeModel(model){if(!model)return;const materials=new Set();model.traverse(node=>{node.geometry?.dispose();if(node.material)(Array.isArray(node.material)?node.material:[node.material]).forEach(material=>materials.add(material))});materials.forEach(material=>material.dispose())}
