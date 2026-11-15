import * as THREE from 'three';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const defaultFootprints=[
 {side:'left',center:[.095,.045],direction:[0,1],halfSize:[.065,.175]},
 {side:'right',center:[-.095,.045],direction:[0,1],halfSize:[.065,.175]},
];

/** A soft footprint fitted to the actual indexed sole vertices, in model space. */
export function avatarFootprints(model){
 let body;
 model?.traverse?.(node=>{if(!body&&node.isMesh&&node.geometry?.attributes.position?.count>1000)body=node;});
 if(!body)return {feet:defaultFootprints.map(foot=>({...foot})),floorY:-.002};
 const positions=body.geometry.attributes.position;
 const used=body.geometry.index?[...new Set(body.geometry.index.array)]:Array.from({length:positions.count},(_,index)=>index);
 let soleY=Infinity;for(const id of used)soleY=Math.min(soleY,positions.getY(id));
 if(!Number.isFinite(soleY))return {feet:defaultFootprints.map(foot=>({...foot})),floorY:-.002};
 const feet=['left','right'].map((side,index)=>{
  const sign=side==='left'?1:-1;
  const points=used.filter(id=>positions.getY(id)<soleY+.065&&positions.getX(id)*sign>.015)
   .map(id=>[positions.getX(id),positions.getZ(id)]);
  if(points.length<6)return {...defaultFootprints[index]};
  const mean=points.reduce((sum,p)=>[sum[0]+p[0]/points.length,sum[1]+p[1]/points.length],[0,0]);
  let xx=0,zz=0,xz=0;
  for(const p of points){const x=p[0]-mean[0],z=p[1]-mean[1];xx+=x*x;zz+=z*z;xz+=x*z;}
  // Principal direction keeps the contact patches aligned with the turned-out
  // anatomical feet, instead of a fixed blob that floats beside a heel.
  const angle=.5*Math.atan2(2*xz,xx-zz),direction=[Math.cos(angle),Math.sin(angle)];
  const across=[-direction[1],direction[0]];
  let minAlong=Infinity,maxAlong=-Infinity,minAcross=Infinity,maxAcross=-Infinity;
  for(const p of points){const x=p[0]-mean[0],z=p[1]-mean[1],along=x*direction[0]+z*direction[1],cross=x*across[0]+z*across[1];minAlong=Math.min(minAlong,along);maxAlong=Math.max(maxAlong,along);minAcross=Math.min(minAcross,cross);maxAcross=Math.max(maxAcross,cross);}
  const shiftAlong=(minAlong+maxAlong)/2,shiftAcross=(minAcross+maxAcross)/2;
  return {side,center:[mean[0]+direction[0]*shiftAlong+across[0]*shiftAcross,mean[1]+direction[1]*shiftAlong+across[1]*shiftAcross],direction,
   halfSize:[clamp((maxAcross-minAcross)/2+.025,.045,.13),clamp((maxAlong-minAlong)/2+.045,.095,.24)]};
 });
 return {feet,floorY:soleY-.0015};
}

/**
 * Analytic contact shadow: no shadow-map frustum, polygonal silhouette, image,
 * texture allocation, rectangular cut edge or lighting-dependent bright patch.
 * Returns a THREE.Group with setTheme(light), setScale(value), fitModel(model)
 * and dispose(). Add the group to the scene, not to the scaled body model.
 */
export function createAvatarGroundShadow({model=null,scale=1,light=false}={}){
 const ground=new THREE.Group();ground.name='avatar-soft-contact-shadow';
 const uniforms={
  uLeftCenter:{value:new THREE.Vector2()},uRightCenter:{value:new THREE.Vector2()},
  uLeftDirection:{value:new THREE.Vector2()},uRightDirection:{value:new THREE.Vector2()},
  uLeftHalfSize:{value:new THREE.Vector2()},uRightHalfSize:{value:new THREE.Vector2()},
  uAmbientCenter:{value:new THREE.Vector2()},uAmbientHalfSize:{value:new THREE.Vector2(.28,.22)},
  uExtent:{value:new THREE.Vector2(.58,.48)},uOpacity:{value:.30},uColor:{value:new THREE.Color('#03060a')},
 };
 const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,side:THREE.DoubleSide,toneMapped:false,
  vertexShader:`varying vec2 vGroundPosition;
   void main(){vGroundPosition=vec2(position.x,-position.y);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`varying vec2 vGroundPosition;
   uniform vec2 uLeftCenter,uRightCenter,uLeftDirection,uRightDirection,uLeftHalfSize,uRightHalfSize;
   uniform vec2 uAmbientCenter,uAmbientHalfSize,uExtent;
   uniform float uOpacity;uniform vec3 uColor;
   float footprint(vec2 center,vec2 direction,vec2 size){
    vec2 delta=vGroundPosition-center;
    vec2 q=vec2(dot(delta,vec2(-direction.y,direction.x)),dot(delta,direction))/size;
    float radius=length(q);
    return exp(-2.5*radius*radius)*(1.0-smoothstep(1.0,1.8,radius));
   }
   void main(){
    float left=footprint(uLeftCenter,uLeftDirection,uLeftHalfSize);
    float right=footprint(uRightCenter,uRightDirection,uRightHalfSize);
    vec2 ambientPoint=(vGroundPosition-uAmbientCenter)/uAmbientHalfSize;
    float ambient=exp(-2.2*dot(ambientPoint,ambientPoint))*.19;
    float contact=1.0-(1.0-left*.82)*(1.0-right*.82);
    vec2 edge=abs(vGroundPosition)/uExtent;
    float fade=1.0-smoothstep(.76,1.0,max(edge.x,edge.y));
    float alpha=(1.0-(1.0-contact)*(1.0-ambient))*uOpacity*fade;
    gl_FragColor=vec4(uColor,alpha);
    #include <colorspace_fragment>
   }`,
 });
 const plane=new THREE.Mesh(new THREE.PlaneGeometry(1.16,.96),material);
 plane.name='avatar-contact-shadow-plane';plane.rotation.x=-Math.PI/2;
 plane.castShadow=false;plane.receiveShadow=false;plane.renderOrder=-1;ground.add(plane);
 let disposed=false;
 ground.setTheme=value=>{
  const isLight=value===true||value==='light';
  uniforms.uColor.value.set(isLight?'#292420':'#020407');
  uniforms.uOpacity.value=isLight?.25:.36;
  ground.userData.theme=isLight?'light':'dark';return ground;
 };
 ground.setScale=value=>{const n=Number(value);ground.scale.setScalar(Number.isFinite(n)&&n>0?n:1);return ground;};
 ground.fitModel=value=>{
  const {feet,floorY}=avatarFootprints(value),[left,right]=feet;
  for(const [name,foot]of [['Left',left],['Right',right]]){
   uniforms['u'+name+'Center'].value.fromArray(foot.center);
   uniforms['u'+name+'Direction'].value.fromArray(foot.direction);
   uniforms['u'+name+'HalfSize'].value.fromArray(foot.halfSize);
  }
  const center=[(left.center[0]+right.center[0])/2,(left.center[1]+right.center[1])/2];
  uniforms.uAmbientCenter.value.fromArray(center);
  uniforms.uAmbientHalfSize.value.set(Math.max(.24,Math.abs(left.center[0]-right.center[0])*.65+.12),Math.max(.19,left.halfSize[1]*1.3,right.halfSize[1]*1.3));
  // The alpha field is already near zero here, with an explicit final fade to
  // zero. Even tall/wide models cannot expose a sharp geometry boundary.
  const extentX=Math.max(.52,...feet.map(foot=>Math.abs(foot.center[0])+foot.halfSize[1]*2.4));
  const extentZ=Math.max(.44,...feet.map(foot=>Math.abs(foot.center[1])+foot.halfSize[1]*2.5));
  uniforms.uExtent.value.set(extentX,extentZ);
  plane.geometry.dispose();plane.geometry=new THREE.PlaneGeometry(extentX*2,extentZ*2);
  plane.position.y=floorY;
  ground.userData.footprints=feet;ground.userData.floorY=floorY;
  if(value?.scale?.x)ground.setScale(value.scale.x);
  return ground;
 };
 ground.dispose=()=>{if(disposed)return;disposed=true;plane.geometry.dispose();material.dispose();ground.removeFromParent();};
 ground.fitModel(model);ground.setScale(model?.scale?.x??scale);ground.setTheme(light);
 return ground;
}
