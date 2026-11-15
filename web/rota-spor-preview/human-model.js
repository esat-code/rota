import * as THREE from 'three';
import baseOBJ from './assets/avatar/base.obj';
import maleA from './assets/avatar/african-male-young.target';
import maleB from './assets/avatar/asian-male-young.target';
import maleC from './assets/avatar/caucasian-male-young.target';
import normalTarget from './assets/avatar/universal-male-young-averagemuscle-averageweight.target';
import muscleTarget from './assets/avatar/universal-male-young-maxmuscle-averageweight.target';
import softTarget from './assets/avatar/universal-male-young-averagemuscle-maxweight.target';
import {addAppearance,applyHairRoots} from './human-appearance.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const gauss=(v,m,w)=>Math.exp(-(((v-m)/w)**2));
function target(text,count) {
  const values=new Float32Array(count*3);
  for(const line of text.split('\n')) {
    if(!/^\d/.test(line))continue;
    const [index,x,y,z]=line.trim().split(/\s+/).map(Number);
    if(index<count){values[index*3]=x;values[index*3+1]=y;values[index*3+2]=z;}
  }
  return values;
}
function parseBase() {
  const vertices=[],faces=[],groups={};let group='';
  for(const line of baseOBJ.split('\n')){
    if(line.startsWith('v '))vertices.push(...line.trim().split(/\s+/).slice(1).map(Number));
    else if(line.startsWith('g '))group=line.slice(2).trim();
    else if(line.startsWith('f ')){
      const ids=line.trim().split(/\s+/).slice(1).map(v=>Number(v.split('/')[0])-1);
      if(group==='body')for(let i=1;i<ids.length-1;i++)faces.push(ids[0],ids[i],ids[i+1]);
      if(group.startsWith('joint-')||group==='helper-l-eye'||group==='helper-r-eye') {
        groups[group]??=new Set();ids.forEach(i=>groups[group].add(i));
      }
    }
  }
  const count=vertices.length/3;
  return {vertices:new Float32Array(vertices),indices:new Uint16Array(faces),used:[...new Set(faces)],groups,
    males:[maleA,maleB,maleC].map(t=>target(t,count)),normal:target(normalTarget,count),muscle:target(muscleTarget,count),soft:target(softTarget,count)};
}
const BASE=parseBase();

/** Licensed anatomical surface, transformed for visualization; not a body scan. */
export default function bodyModel(shape) {
  const group=new THREE.Group();
  const skin=new THREE.MeshStandardMaterial({color:'#bcb3a4',roughness:.68,metalness:.015});
  const detail=new THREE.MeshStandardMaterial({color:'#9f9484',roughness:.75});
  const shorts=new THREE.MeshStandardMaterial({color:'#233449',roughness:.94});
  const seam=new THREE.MeshStandardMaterial({color:'#41536a',roughness:.86});
  const add=(geometry,material=skin)=>{const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;};
  const positions=new Float32Array(BASE.vertices.length);
  const definition=clamp((22-(shape.fatPct??18))/15,0,1)*.62;
  const softness=clamp(((shape.fatPct??18)-15)/28,0,1)*.75;
  for(let i=0;i<positions.length;i++){
    positions[i]=BASE.vertices[i]+(BASE.males[0][i]+BASE.males[1][i]+BASE.males[2][i])/3+
      BASE.normal[i]+definition*(BASE.muscle[i]-BASE.normal[i])+softness*(BASE.soft[i]-BASE.normal[i]);
  }
  let minY=Infinity,maxY=-Infinity;
  BASE.used.forEach(i=>{minY=Math.min(minY,positions[i*3+1]);maxY=Math.max(maxY,positions[i*3+1]);});
  const unit=1.82/(maxY-minY);
  for(let i=0;i<positions.length;i+=3){positions[i]*=unit;positions[i+1]=(positions[i+1]-minY)*unit;positions[i+2]*=unit;}
  const centerOf=name=>{
    const ids=[...(BASE.groups[name]||[])],point=new THREE.Vector3();
    ids.forEach(i=>point.add(new THREE.Vector3().fromArray(positions,i*3)));
    return ids.length?point.multiplyScalar(1/ids.length):null;
  };
  const pelvis=centerOf('joint-pelvis'),offsetZ=pelvis?.z??0;
  for(let i=0;i<positions.length;i+=3)positions[i+2]-=offsetZ;
  const centralRows=(y,range=.035)=>BASE.used.filter(i=>Math.abs(positions[i*3+1]-y)<range&&Math.abs(positions[i*3])<.26);
  const radiusX=ids=>Math.max(.05,...ids.map(i=>Math.abs(positions[i*3])));
  const waistY=1.105,waistBase=radiusX(centralRows(waistY)),neckBase=radiusX(centralRows(1.55,.022));
  const waistScale=clamp(shape.waistRadius/waistBase,.7,1.8),neckScale=clamp(shape.neckRadius/neckBase,.75,1.4);
  for(let i=0;i<positions.length;i+=3){
    let x=positions[i],y=positions[i+1],z=positions[i+2];
    const centerMask=1-clamp((Math.abs(x)-.22)/.06,0,1);
    const waistMask=gauss(y,waistY,.14)*centerMask;
    x*=1+(waistScale-1)*waistMask;
    z*=1+(waistScale-1)*waistMask*.8;
    const neckMask=gauss(y,1.55,.042)*(1-clamp((Math.abs(x)-.06)/.045,0,1));
    x*=1+(neckScale-1)*neckMask;z*=1+(neckScale-1)*neckMask;
    // Keep weight-related silhouette modest; measured waist/neck remain primary.
    const buildMask=gauss(y,1.31,.12)*centerMask;
    x*=1+(shape.build-1)*.35*buildMask;
    z*=1+(shape.build-1)*.35*buildMask;
    // Definition is only an illustrative surface treatment, not detected abs.
    const fatPct=shape.fatPct??18;
    const definitionMask=clamp((21-fatPct)/13,0,1);
    const front=clamp((z-.005)/.07,0,1)*centerMask;
    const abdomen=gauss(y,1.18,.13)*(1-clamp((Math.abs(x)-.075)/.07,0,1));
    const middleGroove=gauss(x,0,.008);
    const crossGrooves=[1.115,1.177,1.239].reduce((sum,line)=>sum+gauss(y,line,.006),0);
    z-=front*abdomen*definitionMask*(.0022*middleGroove+.0016*crossGrooves);
    const sag=clamp((fatPct-29)/22,0,1);
    const lowerBelly=gauss(y,1.09,.092)*front*(1-clamp((Math.abs(x)-.10)/.10,0,1));
    y-=.055*sag*lowerBelly;
    z+=.028*sag*lowerBelly;
    positions[i]=x;positions[i+1]=y;positions[i+2]=z;
  }
  // MakeHuman uses anatomical left at positive X and right at negative X.
  // Each circumference changes tissue around only that arm's real axis.
  const armGeometry={};
  for(const side of ['l','r']){
    const a=centerOf('joint-'+side+'-shoulder'),end=centerOf('joint-'+side+'-elbow');
    if(!a||!end)continue;
    const axis=end.clone().sub(a),length=axis.length();axis.normalize();
    const candidates=[];
    BASE.used.forEach(i=>{
      const p=new THREE.Vector3().fromArray(positions,i*3),delta=p.clone().sub(a),t=delta.dot(axis);
      const d=delta.addScaledVector(axis,-t).length();
      if(t>length*.25&&t<length*.62&&Math.sign(p.x)===Math.sign(a.x)&&Math.abs(p.x)>.23&&d<.13)candidates.push(d);
    });
    const baseRadius=candidates.length?candidates.sort((a,b)=>a-b)[Math.floor(candidates.length*.82)]:.045;
    const anatomicalSide=side==='l'?'left':'right';
    const measuredCm=(side==='l'?shape.leftArmCm:shape.rightArmCm)??null;
    const targetRadius=(side==='l'?shape.leftUpperArmRadius:shape.rightUpperArmRadius)??shape.upperArmRadius;
    const armScale=measuredCm===null&&(shape.armCm??null)===null?clamp(shape.build,.9,1.15):clamp(targetRadius/baseRadius,.72,1.8);
    armGeometry[anatomicalSide]={measuredCm,targetRadius,baseRadius,radialScale:armScale,axisStart:a.toArray(),axisEnd:end.toArray()};
    if(Math.abs(armScale-1)<.001)continue;
    BASE.used.forEach(i=>{
      const p=new THREE.Vector3().fromArray(positions,i*3),delta=p.clone().sub(a),t=delta.dot(axis);
      const radial=delta.clone().addScaledVector(axis,-t),d=radial.length();
      if(t<-.02||t>length+.07||Math.sign(p.x)!==Math.sign(a.x)||Math.abs(p.x)<.22||d>.14)return;
      const mask=gauss(t,length*.48,length*.48);
      p.addScaledVector(radial,(armScale-1)*mask);
      p.toArray(positions,i*3);
    });
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  // A continuous fitted garment uses interpolated local coordinates. This keeps
  // waist/leg hems straight instead of stepping along the model's triangles.
  skin.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+'varying vec3 vRotaBodyPosition;');
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+'vRotaBodyPosition=position;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\n'+'varying vec3 vRotaBodyPosition;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+
      'float shortsMask=step(0.705,vRotaBodyPosition.y)*step(vRotaBodyPosition.y,1.036)*step(abs(vRotaBodyPosition.x),0.30);\n'+
      'float shortsBand=step(1.018,vRotaBodyPosition.y);\n'+
      'vec3 shortsTone=mix(vec3(0.017,0.030,0.055),vec3(0.032,0.050,0.079),shortsBand);\n'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,shortsTone,shortsMask);');
    applyHairRoots(shader,shape.appearance);
  };
  skin.customProgramCacheKey=()=> 'rota-fitted-shorts-v2-'+JSON.stringify([shape.appearance.hairStyle,shape.appearance.hairFringe]);
  geometry.setIndex(new THREE.BufferAttribute(BASE.indices,1));
  geometry.computeVertexNormals();add(geometry);
  addAppearance(group,geometry,centerOf,shape.appearance);
  group.scale.setScalar(shape.scale);
  group.userData.materials={skin,detail,shorts,seam};
  group.userData.armGeometry=armGeometry;
  group.userData.approximate=true;
  return group;
}

