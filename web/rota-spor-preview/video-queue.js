export const VIDEO_DAYS=[{id:6,day:'Cumartesi',group:'Kardiyo'},{id:7,day:'Pazar',group:'Bilek'},{id:1,day:'Pazartesi',group:'Kol'},{id:2,day:'Salı',group:'Göğüs'},{id:3,day:'Çarşamba',group:'Sırt'},{id:4,day:'Perşembe',group:'Omuz'}];
export function videoDays(state,id){return VIDEO_DAYS.filter(day=>state.plan.weekly.some(rule=>rule.weekday===day.id&&rule.videoIds?.includes(id)));}
export function orderedVideos(state,day='all'){
 if(day==='all')return state.videos;
 const linked=[...new Set(state.plan.weekly.filter(rule=>rule.weekday===Number(day)).flatMap(rule=>rule.videoIds||[]))];
 const saved=Array.isArray(state.plan.videoOrder?.[day])?state.plan.videoOrder[day]:[];
 const ids=[...new Set([...saved.filter(id=>linked.includes(id)),...linked])];
 const byId=new Map(state.videos.map(video=>[video.id,video]));
 return ids.map(id=>byId.get(id)).filter(Boolean);
}
export function moveVideo(state,day,id,toIndex){
 const videos=orderedVideos(state,day),ids=videos.map(video=>video.id),from=ids.indexOf(id);
 if(from<0||!Number.isInteger(toIndex))return state;
 const to=Math.max(0,Math.min(ids.length-1,toIndex));if(from===to)return state;
 ids.splice(from,1);ids.splice(to,0,id);
 if(day==='all'){
  const byId=new Map(state.videos.map(video=>[video.id,video]));
  return {...state,videos:ids.map(id=>byId.get(id))};
 }
 return {...state,plan:{...state.plan,videoOrder:{...state.plan.videoOrder,[day]:ids},weekly:state.plan.weekly.map(rule=>rule.weekday!==Number(day)?rule:{...rule,videoIds:ids.filter(id=>rule.videoIds.includes(id))})}};
}
export function linkVideoDay(state,id,day,linked=true){
 if(!VIDEO_DAYS.some(value=>value.id===Number(day)))return state;
 if(linked&&!state.videos.some(video=>video.id===id))return state;
 const weekday=Number(day),weekly=state.plan.weekly;
 if(!linked)return {...state,plan:{...state.plan,weekly:weekly.map(rule=>rule.weekday!==weekday?rule:{...rule,videoIds:rule.videoIds.filter(value=>value!==id)}),videoOrder:{...state.plan.videoOrder,[weekday]:(state.plan.videoOrder?.[weekday]||[]).filter(value=>value!==id)}}};
 if(weekly.some(rule=>rule.weekday===weekday&&rule.videoIds.includes(id)))return state;
 const index=weekly.findIndex(rule=>rule.weekday===weekday);
 const next=index<0?[...weekly,{id:'routine-videos-'+weekday,weekday,title:VIDEO_DAYS.find(day=>day.id===weekday).group,type:'workout',time:'',durationMinutes:null,videoIds:[id],startDate:null,endDate:null}]:weekly.map((rule,i)=>i!==index?rule:{...rule,videoIds:[...rule.videoIds,id]});
 return {...state,plan:{...state.plan,weekly:next,videoOrder:{...state.plan.videoOrder,[weekday]:[...orderedVideos(state,weekday).map(video=>video.id),id]}}};
}
// A copied day references the same library entry/file, not a duplicate upload.
// Repeated copies are idempotent; the source day's list is never removed.
export function copyVideoDays(state,id,days){
 return days.reduce((next,day)=>linkVideoDay(next,id,day,true),state);
}
export function videoDropIndex(from,target,after=false){
 const insertion=target+(after?1:0);
 return insertion-(from<insertion?1:0);
}
export function saveDayVideo(state,video){
 const next={...state,videos:[...state.videos.filter(value=>value.id!==video.id),video]};
 return video.weekday?linkVideoDay(next,video.id,video.weekday):next;
}

