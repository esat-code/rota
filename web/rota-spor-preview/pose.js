/** MediaPipe 0.10.21: all inference files are served from this local preview. */
import{prepareNativePoseAssets}from'./native-assets.js';
export const JOINTS=[
 {key:'left-knee',label:'Sol diz',region:'knee',points:[23,25,27]},
 {key:'right-knee',label:'Sağ diz',region:'knee',points:[24,26,28]},
 {key:'left-elbow',label:'Sol dirsek',region:'elbow',points:[11,13,15]},
 {key:'right-elbow',label:'Sağ dirsek',region:'elbow',points:[12,14,16]},
 {key:'left-hip',label:'Sol kalça',region:'hip',points:[11,23,25]},
 {key:'right-hip',label:'Sağ kalça',region:'hip',points:[12,24,26]},
 {key:'left-shoulder',label:'Sol omuz',region:'shoulder',points:[13,11,23]},
 {key:'right-shoulder',label:'Sağ omuz',region:'shoulder',points:[14,12,24]},
];
const REGION_LABELS={knee:'Diz',hip:'Kalça',elbow:'Dirsek',shoulder:'Omuz'};
export function angle(a,b,c){if(!a||!b||!c)return null;const u=[a.x-b.x,a.y-b.y,(a.z||0)-(b.z||0)],v=[c.x-b.x,c.y-b.y,(c.z||0)-(b.z||0)];const den=Math.hypot(...u)*Math.hypot(...v);return den>1e-8?Math.acos(Math.max(-1,Math.min(1,u.reduce((s,x,i)=>s+x*v[i],0)/den)))*180/Math.PI:null;}
function quantile(values,p){const a=[...values].sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor((a.length-1)*p))]:0;}
export function countCycles(series,{minimumRange=25}={}){
 const points=series.filter(v=>Number.isFinite(v.value));if(points.length<8)return{count:null,range:0,reason:'Az sayıda kullanılabilir kare'};
 const smoothed=points.map((v,i)=>({...v,value:points.slice(Math.max(0,i-1),i+2).reduce((s,p)=>s+p.value,0)/points.slice(Math.max(0,i-1),i+2).length}));
 const low=quantile(smoothed.map(p=>p.value),.1),high=quantile(smoothed.map(p=>p.value),.9),range=high-low;
 if(range<minimumRange)return{count:null,range,reason:'Belirgin bükülme–açılma döngüsü yok'};
 const lo=low+range*.24,hi=high-range*.24;let origin=null,other=false,count=0,lastTime=-Infinity,lastFrame=null;
 for(const p of smoothed){if(lastFrame!==null&&p.time-lastFrame>1.1){origin=null;other=false;}lastFrame=p.time;const band=p.value<=lo?'low':p.value>=hi?'high':null;if(!band)continue;if(!origin){origin=band;lastTime=p.time;continue;}if(band!==origin){other=true;continue;}if(other&&p.time-lastTime>=.55){count++;lastTime=p.time;other=false;}}
 return{count,range,low,high,reason:'Tam açı döngüsü sayımı'};
}
export function summarizeSamples(samples,{duration=0,analyzedDuration=duration,totalFrames=samples.length}={}){
 const found=samples.filter(s=>s.detected),joints=JOINTS.map(j=>{const series=found.filter(s=>Number.isFinite(s.angles[j.key])).map(s=>({time:s.time,value:s.angles[j.key]}));const cycles=countCycles(series);return{...j,...cycles,visibleFrames:series.length,coverage:series.length/Math.max(1,totalFrames)};});
 const candidates=joints.filter(j=>j.coverage>=.4&&j.count!==null).sort((a,b)=>b.range-a.range),best=candidates[0],coverage=found.length/Math.max(1,totalFrames),usable=coverage>=.4&&found.length>=8;
 const regions=Object.entries(REGION_LABELS).filter(([key])=>joints.some(j=>j.region===key&&j.coverage>=.4&&j.range>=12)).map(([key,label])=>({key,label}));
 const warnings=['Sayım hareket adı değil, baskın eklemin tam bükülme–açılma döngüsüdür. Yarım tekrarlar, örtüşen vücut bölgeleri ve kamera açısı sayımı etkiler.'];
 if(coverage<.65)warnings.push('Vücut birçok karede yeterince görünmedi; sonuç güvenilir olmayabilir.');
 if(!best)warnings.push('Belirgin döngü bulunamadı. Durağan esnemeler bu yöntemle hangi kasın uzadığını göstermez.');
 return{duration,analyzedDuration,repCount:usable&&best?best.count:null,movement:best?{key:best.key,label:best.label+' bükülme–açılma döngüsü',joint:best.region,rangeDegrees:Math.round(best.range)}:null,joints,regions,quality:{usable,countingAvailable:usable&&!!best,detectedFrames:found.length,totalFrames,visibleFraction:coverage},warnings,samples:samples.map(s=>({time:s.time,angles:s.angles,detected:s.detected}))};
}
const abort=()=>new DOMException('Analiz durduruldu.','AbortError');
function waitEvent(element,event,signal,ms=12000){return new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timeout);element.removeEventListener(event,success);element.removeEventListener('error',fail);signal?.removeEventListener('abort',cancel)},success=()=>{done();resolve()},fail=()=>{done();reject(Error('Video okunamadı. Tarayıcının desteklediği MP4 veya WebM dosyası dene.'))},cancel=()=>{done();reject(abort())},timeout=setTimeout(()=>{done();reject(Error('Video karesi zamanında okunamadı. Dosyayı kontrol et.'))},ms);element.addEventListener(event,success,{once:true});element.addEventListener('error',fail,{once:true});signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();});}
let visionPromise;
async function vision(){if(!visionPromise)visionPromise=Promise.all([import('./assets/mediapipe/vision_bundle.mjs'),prepareNativePoseAssets()]).then(async([{FilesetResolver,PoseLandmarker},native])=>({PoseLandmarker,files:native?{wasmLoaderPath:native.wasmLoaderPath,wasmBinaryPath:native.wasmBinaryPath}:await FilesetResolver.forVisionTasks('./assets/mediapipe'),model:native?{modelAssetBuffer:native.modelAssetBuffer}:{modelAssetPath:'./assets/mediapipe/pose_landmarker_lite.task'}})).catch(e=>{visionPromise=null;throw e;});return visionPromise;}
export async function analyzeVideo(video,{onProgress=()=>{},signal,sampleRate=6,maxSeconds=180,startSeconds=0,endSeconds}={}){
 if(signal?.aborted)throw abort();if(video.readyState<1)await waitEvent(video,'loadedmetadata',signal);
 if(!Number.isFinite(video.duration)&&video.src.startsWith('blob:')){const original=video.currentTime;const seek=waitEvent(video,'seeked',signal,8000);video.currentTime=1e7;await seek;const reset=waitEvent(video,'seeked',signal,8000);video.currentTime=original;await reset;}
 if(!Number.isFinite(video.duration)||video.duration<=0)throw Error('Bu videonun süresi okunamadı. Kayıt dosyasını yeniden seç.');
 const start=Math.max(0,Number(startSeconds)||0),requestedEnd=Number(endSeconds)||video.duration,end=Math.min(video.duration-.001,requestedEnd,start+maxSeconds);
 if(end<=start+.3)throw Error('Başlangıç ve bitiş saniyelerini kontrol et; seçtiğin aralık videonun içinde olmalı.');
 const {PoseLandmarker,files,model}=await vision();if(signal?.aborted)throw abort();onProgress({progress:0,repCount:0,status:'Model hazırlanıyor'});
 const detector=await PoseLandmarker.createFromOptions(files,{baseOptions:{...model,delegate:'CPU'},runningMode:'VIDEO',numPoses:1,minPoseDetectionConfidence:.55,minPosePresenceConfidence:.55,minTrackingConfidence:.55});
 const samples=[],savedTime=video.currentTime,wasPaused=video.paused,step=1/Math.max(1,Math.min(sampleRate,12));video.pause();
 try{for(let t=start;t<end;t+=step){if(signal?.aborted)throw abort();if(Math.abs(video.currentTime-t)>.002){const seek=waitEvent(video,'seeked',signal,8000);video.currentTime=t;await seek;}if(video.readyState<2)await waitEvent(video,'loadeddata',signal);const result=detector.detectForVideo(video,1000+Math.round((t-start)*1000)),landmarks=result.landmarks?.[0],world=result.worldLandmarks?.[0];const angles={};if(landmarks&&world)for(const joint of JOINTS){if(joint.points.every(i=>(landmarks[i]?.visibility??0)>=.6)){const value=angle(...joint.points.map(i=>world[i]));if(value!==null)angles[joint.key]=value;}}
 samples.push({time:t,detected:!!landmarks&&Object.keys(angles).length>=1,angles});const interim=summarizeSamples(samples);onProgress({progress:Math.min(1,(t-start+step)/(end-start)),frameTime:t,landmarks:landmarks||[],repCount:interim.repCount,regions:interim.regions,status:'Kareler inceleniyor'});await new Promise(r=>setTimeout(r,0));}
 const summary=summarizeSamples(samples,{duration:video.duration,analyzedDuration:end-start,totalFrames:samples.length});if(end<Math.min(requestedEnd,video.duration)-1)summary.warnings.push('Bu analiz ilk '+maxSeconds+' saniyelik seçili aralıkla sınırlandı; devamını ayrı aralık olarak inceleyebilirsin.');return summary;
 }finally{detector.close();video.currentTime=savedTime;if(!wasPaused)video.play().catch(()=>{});}
}
const CONNECTIONS=[[11,12],[11,13],[13,15],[12,14],[14,16],[11,23],[12,24],[23,24],[23,25],[25,27],[24,26],[26,28]];
export function drawPose(canvas,landmarks=[]){if(!canvas)return;const video=canvas.parentElement?.querySelector('video');canvas.width=video?.videoWidth||640;canvas.height=video?.videoHeight||480;const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);if(!landmarks.length)return;ctx.strokeStyle='#e8d6b1';ctx.lineWidth=3;ctx.lineCap='round';for(const[a,b]of CONNECTIONS){if([a,b].every(i=>(landmarks[i]?.visibility??0)>.6)){ctx.beginPath();ctx.moveTo(landmarks[a].x*canvas.width,landmarks[a].y*canvas.height);ctx.lineTo(landmarks[b].x*canvas.width,landmarks[b].y*canvas.height);ctx.stroke();}}ctx.fillStyle='#e7edf5';for(const p of landmarks.filter(p=>(p.visibility??0)>.6)){ctx.beginPath();ctx.arc(p.x*canvas.width,p.y*canvas.height,3,0,Math.PI*2);ctx.fill();}}
export function compareAnalyses(reference,own){const same=reference?.movement?.joint&&reference.movement.joint===own?.movement?.joint,usable=reference?.quality.usable&&own?.quality.usable;return{comparable:!!(same&&usable),summary:!usable?'Kayıtlardan en az birinde güvenilir hareket döngüsü bulunamadı.':!same?'İki kayıtta farklı baskın eklemler izlendi; otomatik tekrar karşılaştırması aynı hareket olarak yorumlanamaz.':`Aynı eklem bölgesinde döngü izlendi. Referans açı değişimi yaklaşık ${reference.movement.rangeDegrees}°, seninki ${own.movement.rangeDegrees}°. Bu fark hareket doğruluğu veya esneklik puanı değildir.`};}
