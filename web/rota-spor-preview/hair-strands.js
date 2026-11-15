import * as THREE from 'three';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function randomGenerator(seed){return()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
/** Batched, rooted strands. No hair planes, detached wig or per-strand draw calls. */
export function createHairStrands(body,appearance,hairLine){
 const a=appearance;if(['bald','buzz'].includes(a.hairStyle))return null;
 const position=body.attributes.position,normal=body.attributes.normal,idx=body.index.array;
 const triangles=[],cumulative=[];let area=0;
 const p=new THREE.Vector3(),q=new THREE.Vector3(),r=new THREE.Vector3();
 for(let i=0;i<idx.length;i+=3){
  const ids=[idx[i],idx[i+1],idx[i+2]];
  if(!ids.every(id=>position.getY(id)>1.65&&Math.abs(position.getX(id))<.12))continue;
  p.fromBufferAttribute(position,ids[0]);q.fromBufferAttribute(position,ids[1]);r.fromBufferAttribute(position,ids[2]);
  const size=q.clone().sub(p).cross(r.clone().sub(p)).length()*.5;
  area+=size;triangles.push(ids);cumulative.push(area);
 }
 if(!triangles.length)return null;
 const random=randomGenerator(102841),vertices=[],normals=[],colors=[],indices=[];
 const count=2800,segments=11,sides=4,color=new THREE.Color(a.hairColor);
 const root=new THREE.Vector3(),rootNormal=new THREE.Vector3(),v=new THREE.Vector3(),n=new THREE.Vector3();
 function chooseTriangle(){
  const value=random()*area;let lo=0,hi=cumulative.length-1;
  while(lo<hi){const mid=(lo+hi)>>1;if(cumulative[mid]<value)lo=mid+1;else hi=mid;}return triangles[lo];
 }
 let accepted=0;
 for(let attempt=0;attempt<count*7&&accepted<count;attempt++){
  const tri=chooseTriangle();let u=random(),w=random();if(u+w>1){u=1-u;w=1-w;}const weights=[1-u-w,u,w];
  root.set(0,0,0);rootNormal.set(0,0,0);
  tri.forEach((id,i)=>{v.fromBufferAttribute(position,id);root.addScaledVector(v,weights[i]);n.fromBufferAttribute(normal,id);rootNormal.addScaledVector(n,weights[i]);});
  rootNormal.normalize();
  if(root.y<hairLine(root.x,root.z,a)+.0008||Math.abs(root.x)<.0010&&root.z>.010)continue;
  const rootCopy=root.clone(),normalCopy=rootNormal.clone(),front=clamp((root.z-.005)/.08,0,1),crown=clamp((root.y-1.70)/.09,0,1),side=root.x<0?-1:1;
  const variation=.76+random()*.45,topLength=a.hairLength/100,sideLength=a.hairSides/100;
  const length=Math.max(.003,(sideLength*(1-crown)+topLength*crown)*variation);
  const desired=a.hairStyle==='curtains'||a.hairStyle==='part'?new THREE.Vector3(side*.9,-.26*(1-crown),front*.35-.18):new THREE.Vector3(side*.45,-.4*(1-crown),.4);
  const tangent=desired.addScaledVector(normalCopy,-desired.dot(normalCopy)).normalize();
  if(tangent.lengthSq()<.1)tangent.set(side,0,0);
  const across=new THREE.Vector3().crossVectors(normalCopy,tangent).normalize(),phase=random()*Math.PI*2;
  const wave=(a.hairStyle==='curly'?.004:a.hairStyle==='wavy'?.0024:.0011)*(0.4+crown*.6);
  const thickness=.00012+random()*.000085;
  const tint=.72+random()*.45,baseIndex=vertices.length/3;
  const pointAt=t=>{
   const point=rootCopy.clone().addScaledVector(normalCopy,.00065+.016*crown*Math.sin(Math.PI*t));
   point.addScaledVector(tangent,length*t);
   point.addScaledVector(across,wave*Math.sin(t*Math.PI*(a.hairStyle==='curly'?5:2)+phase)*Math.sin(Math.PI*t*.5));
   point.y-=length*.22*t*t*(.6+front*.4);
   return point;
  };
  for(let step=0;step<=segments;step++){
   const t=step/segments,center=pointAt(t),direction=pointAt(Math.min(1,t+.005)).sub(pointAt(Math.max(0,t-.005))).normalize();
   const reference=Math.abs(direction.z)>.9?new THREE.Vector3(0,1,0):new THREE.Vector3(0,0,1);
   const right=new THREE.Vector3().crossVectors(direction,reference).normalize(),up=new THREE.Vector3().crossVectors(right,direction).normalize();
   const radius=thickness*(1-.86*t);
   for(let j=0;j<=sides;j++){
    const angle=j/sides*Math.PI*2,offset=right.clone().multiplyScalar(Math.cos(angle)).addScaledVector(up,Math.sin(angle));
    const vertex=center.clone().addScaledVector(offset,radius);
    vertices.push(vertex.x,vertex.y-1.72,vertex.z);normals.push(offset.x,offset.y,offset.z);
    colors.push(color.r*tint,color.g*tint,color.b*tint);
    if(step<segments&&j<sides){const at=baseIndex+step*(sides+1)+j;indices.push(at,at+sides+1,at+1,at+1,at+sides+1,at+sides+2);}
   }
  }
  accepted++;
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeBoundingSphere();
 const material=new THREE.MeshStandardMaterial({color:'#ffffff',vertexColors:true,roughness:.58,metalness:0});
 const strands=new THREE.Mesh(geometry,material);strands.name='rooted-hair-strands';strands.castShadow=false;strands.userData.strandCount=accepted;
 const lod=new THREE.LOD();lod.name='hair-strand-detail';lod.position.y=1.72;lod.addLevel(strands,0);lod.addLevel(new THREE.Group(),1.8);
 lod.userData.strandCount=accepted;return lod;
}

