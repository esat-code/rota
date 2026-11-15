import * as THREE from 'three';
import {normalizeAppearance} from './appearance.js';
import {createHairStrands} from './hair-strands.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gaussian=(x,m,w)=>Math.exp(-(((x-m)/w)**2));
function hairLine(x,z,a){
 const front=clamp((z-.015)/.09,0,1);
 const fringe=a.hairStyle==='buzz'?0:a.hairFringe/100;
 const center=a.hairStyle==='curtains'?gaussian(x,0,.014)*front*.003:0;
 return 1.673+front*.081+Math.abs(x)*.16-fringe*front*.22+center;
}
function hairLineGLSL(a,p){
 const fringe=a.hairStyle==='buzz'?0:a.hairFringe/100;
 const part=a.hairStyle==='curtains'?`+exp(-pow(${p}.x/0.014,2.0))*clamp((${p}.z-.015)/.09,0.0,1.0)*.003`:'';
 return `(1.673+clamp((${p}.z-.015)/.09,0.0,1.0)*.081+abs(${p}.x)*.16-${fringe.toFixed(4)}*clamp((${p}.z-.015)/.09,0.0,1.0)*.22${part})`;
}
/** Scalp-colored roots close the cap edge, including the temples and center part. */
export function applyHairRoots(shader,raw){
 const a=normalizeAppearance(raw);if(a.hairStyle==='bald')return;
 shader.uniforms.rotaHairColor={value:new THREE.Color(a.hairColor)};
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 rotaHairColor;');
 const part=a.hairStyle==='curtains'?'*(1.0-step(abs(vRotaBodyPosition.x),.0012)*step(.015,vRotaBodyPosition.z))':'';
 shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+
  'float rootMask=step('+hairLineGLSL(a,'vRotaBodyPosition')+',vRotaBodyPosition.y)*step(abs(vRotaBodyPosition.x),.11)*step(vRotaBodyPosition.z,.14)'+part+';\n'+
  'diffuseColor.rgb=mix(diffuseColor.rgb,rotaHairColor,rootMask);');
}
export function addAppearance(group,geometry,centerOf,raw){
 const a=normalizeAppearance(raw),pos=geometry.attributes.position,normals=geometry.attributes.normal;
 const add=(geo,material,name)=>{const mesh=new THREE.Mesh(geo,material);mesh.castShadow=true;mesh.receiveShadow=true;if(name)mesh.name=name;group.add(mesh);return mesh;};
 if(a.hairStyle!=='bald'){
  const hair=new THREE.MeshStandardMaterial({color:a.hairColor,roughness:.88});
  const hairPoints=new Float32Array(pos.array.length),indices=[];
  const length=a.hairStyle==='buzz'?.0012:a.hairLength/100;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),front=clamp((z-.015)/.075,0,1);
    const crown=clamp((y-1.69)/.11,0,1),side=1-crown;
    const edge=clamp((y-hairLine(x,z,a))/.026,0,1);
    let lift=.0007+edge*(length*crown*(a.hairStyle==='curtains'?.13:.35)+(a.hairSides/100)*side*.35);
    const wave=Math.sin(x*210+z*130)*Math.sin(y*240-z*90);
    if(a.hairStyle==='wavy'||a.hairStyle==='custom')lift+=edge*.0023*wave*crown;
    if(a.hairStyle==='curly')lift+=edge*(.005*Math.abs(wave)+.0025*Math.sin(x*380+z*310));
    if(a.hairStyle==='part')lift*=1-.65*gaussian(x,.019,.006);
    if(a.hairStyle==='curtains')lift*=1-.15*gaussian(x,0,.009);
    hairPoints[i*3]=x+normals.getX(i)*lift;
    hairPoints[i*3+1]=y+normals.getY(i)*lift;
    hairPoints[i*3+2]=z+normals.getZ(i)*lift;
  }
  const base=geometry.index.array;
  for(let i=0;i<base.length;i+=3){
    const ids=[base[i],base[i+1],base[i+2]];
    if(ids.some(id=>pos.getY(id)>1.66)&&ids.every(id=>pos.getY(id)>1.60&&Math.abs(pos.getX(id))<.125))
      indices.push(...ids);
  }
  const cap=new THREE.BufferGeometry();cap.setAttribute('position',new THREE.BufferAttribute(hairPoints,3));
  cap.setAttribute('hairBasePosition',new THREE.BufferAttribute(new Float32Array(pos.array),3));cap.setIndex(indices);cap.computeVertexNormals();
  hair.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 hairBasePosition;varying vec3 vHairBase;');
   shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvHairBase=hairBasePosition;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vHairBase;');
   const part=a.hairStyle==='curtains'?'if(abs(vHairBase.x)<.0012&&vHairBase.z>.015)discard;':'';
   shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+
    'if(vHairBase.y<'+hairLineGLSL(a,'vHairBase')+'||abs(vHairBase.x)>.11||vHairBase.z>.14)discard;'+part+
    'float fibers=sin(vHairBase.x*1700.0+sin(vHairBase.z*250.0)*2.5+vHairBase.y*120.0);\n'+
    'diffuseColor.rgb*=.94+.06*fibers;');
  };
  hair.customProgramCacheKey=()=> 'rota-rooted-hair-'+JSON.stringify([a.hairStyle,a.hairFringe]);
  const capMesh=add(cap,hair,'rooted-hair-cap');capMesh.castShadow=false;
  const strands=createHairStrands(geometry,a,hairLine);if(strands)group.add(strands);
 }
 const eyeCenters=[];
 for(const name of ['helper-l-eye','helper-r-eye']){
   const eye=centerOf(name);if(!eye)continue;eyeCenters.push(eye);
   const sclera=new THREE.MeshStandardMaterial({color:'#d7d2c4',roughness:.4});
   const eyeGeo=new THREE.SphereGeometry(.0108,24,18);eyeGeo.translate(eye.x,eye.y,eye.z);add(eyeGeo,sclera,'eye-sclera');
   const irisMaterial=new THREE.MeshStandardMaterial({color:a.eyeColor,roughness:.37});
   const iris=new THREE.CircleGeometry(.0048,32);iris.translate(eye.x,eye.y,eye.z+.0105);add(iris,irisMaterial,'eye-iris');
   const pupil=new THREE.CircleGeometry(.0021,24);pupil.translate(eye.x,eye.y,eye.z+.0108);add(pupil,new THREE.MeshStandardMaterial({color:'#101215',roughness:.2}),'eye-pupil');
 }
 if(a.glasses!=='none'&&eyeCenters.length===2){
  const material=new THREE.MeshStandardMaterial({color:a.glassesColor,metalness:.45,roughness:.35});
  const tube=(curve,radius,name,closed=false)=>add(new THREE.TubeGeometry(curve,64,radius,10,closed),material,name);
  const line=points=>new THREE.CatmullRomCurve3(points,false,'centripetal');
  const eyeY=(eyeCenters[0].y+eyeCenters[1].y)/2;
  const bodyIDs=[...new Set(geometry.index.array)];
  const brow=bodyIDs.filter(id=>Math.abs(pos.getY(id)-eyeY)<.024&&Math.abs(pos.getX(id))>.012&&Math.abs(pos.getX(id))<.066).map(id=>pos.getZ(id));
  const eyeZ=Math.max(Math.max(...eyeCenters.map(p=>p.z))+.025,...brow.map(z=>z+.003));
  const oval=a.glasses==='oval',rx=oval?.023:.021,ry=oval?.0152:.014;
  for(const eye of eyeCenters){
    const points=[],side=Math.sign(eye.x);
    for(let i=0;i<64;i++){
      const t=i/64*Math.PI*2,cos=Math.cos(t),sin=Math.sin(t),square=a.glasses==='square';
      const x=square?Math.sign(cos)*Math.sqrt(Math.abs(cos)):cos;
      const y=square?Math.sign(sin)*Math.sqrt(Math.abs(sin)):sin;
      points.push(new THREE.Vector3(eye.x+x*rx,eyeY+y*ry,eyeZ-.0015*x*x));
    }
    tube(new THREE.CatmullRomCurve3(points,true,'centripetal'),oval?.00105:.0013,'glasses-frame-'+side,true);
    // Find the actual lateral upper ear on this head, not a fixed unrelated point.
    const candidates=bodyIDs.map(id=>new THREE.Vector3().fromArray(pos.array,id*3)).filter(p=>p.x*side>.062&&p.y>1.66&&p.y<1.735&&p.z<.04&&p.z>-.08);
    const maxX=candidates.length?Math.max(...candidates.map(p=>p.x*side)):.079;
    const outer=candidates.filter(p=>p.x*side>maxX*.94).sort((p,q)=>p.y-q.y);
    const ear=outer[Math.floor(outer.length*.80)]||new THREE.Vector3(side*.079,eyeY+.008,-.014);
    const hinge=new THREE.Vector3(eye.x+side*rx,eyeY+.003,eyeZ-.0015);
    const outsideX=side*(Math.max(Math.abs(ear.x),.074)+.002);
    const arm=[
      hinge,
      new THREE.Vector3(outsideX,eyeY+.004,eyeZ-.025),
      new THREE.Vector3(outsideX,ear.y+.002,ear.z+.012),
      new THREE.Vector3(outsideX,ear.y+.002,ear.z-.006),
      new THREE.Vector3(side*(Math.abs(ear.x)+.001),ear.y-.013,ear.z-.020),
    ];
    tube(line(arm),oval?.00095:.00115,'glasses-temple-'+side);
    group.userData['glasses-ear-'+side]={ear:ear.toArray(),hook:arm[2].toArray()};
  }
  const xs=eyeCenters.map(p=>p.x).sort((x,y)=>x-y);
  const bridgeY=eyeY+(oval?.010:.006);
  const nose=bodyIDs.filter(id=>Math.abs(pos.getY(id)-bridgeY)<.010&&Math.abs(pos.getX(id))<.010).map(id=>pos.getZ(id));
  const bridgeZ=Math.max(eyeZ+.004,...nose.map(z=>z+.002));
  tube(line([new THREE.Vector3(xs[0]+rx-.001,bridgeY,eyeZ),new THREE.Vector3(0,bridgeY+(oval?0:.003),bridgeZ),new THREE.Vector3(xs[1]-rx+.001,bridgeY,eyeZ)]),.00095,'glasses-bridge');
  if(oval){
    const pads=new THREE.MeshStandardMaterial({color:'#d0d4c9',roughness:.3,transparent:true,opacity:.40});
    for(const side of [-1,1]){const pad=new THREE.SphereGeometry(1,16,12);pad.scale(.0022,.004,.0015);pad.translate(side*.009,eyeY-.004,eyeZ-.003);add(pad,pads,'glasses-nose-pad');}
  }
 }
}

