export const dateKey=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
export const localInput=d=>dateKey(d)+'T'+String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
export function dayStart(d){const v=new Date(d);v.setHours(0,0,0,0);return v;}
export function addDays(d,n){const v=new Date(d);v.setDate(v.getDate()+n);return v;}
export function weekStart(d){return addDays(dayStart(d),-((d.getDay()+6)%7));}
export function monthDays(d){const first=new Date(d.getFullYear(),d.getMonth(),1);const start=weekStart(first);return Array.from({length:42},(_,i)=>addDays(start,i));}
export function intersects(e,d){return +new Date(e.start)<+addDays(dayStart(d),1)&&+new Date(e.end)>+dayStart(d);}
export function validEvent(e){return !!e&&typeof e.id==='string'&&typeof e.title==='string'&&!!e.title.trim()&&typeof e.description==='string'&&typeof e.category==='string'&&typeof e.color==='string'&&Array.isArray(e.tags)&&e.tags.every(t=>typeof t==='string')&&Number.isFinite(+new Date(e.start))&&Number.isFinite(+new Date(e.end))&&+new Date(e.end)>+new Date(e.start);}
export const isColorless=color=>color==='none'||color==='';
export function eventColor(event){
  if(event.source==='rota-yks')return 'blue';
  if(event.source==='rota-sport')return 'orange';
  return event.color;
}
export function filtered(events,q,{colors=[],tags=[]}={}){const s=q.trim().toLocaleLowerCase('tr');return events.filter(e=>(!s||[e.title,e.description,...e.tags].join(' ').toLocaleLowerCase('tr').includes(s))&&(!colors.length||colors.includes(isColorless(eventColor(e))?'none':eventColor(e)))&&(!tags.length||e.tags.some(t=>tags.includes(t)))).sort((a,b)=>+new Date(a.start)-+new Date(b.start));}
// All-day ends are exclusive local midnights. Count calendar dates, not 24-hour
// periods, so moving across a daylight-saving change never adds a phantom day.
function allDayLength(e){
 const start=dayStart(new Date(e.start)),end=new Date(e.end),boundary=dayStart(end);
 if(!Number.isFinite(+start)||!Number.isFinite(+end))return 1;
 const last=+end>+boundary?addDays(boundary,1):boundary;
 const civil=d=>Date.UTC(d.getFullYear(),d.getMonth(),d.getDate());
 return Math.max(1,Math.round((civil(last)-civil(start))/86400000));
}
export function eventSchedule(e,date,clock,allDay){
 const invalid={start:'',end:'',allDay};
 if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||(!allDay&&!/^\d{2}:\d{2}$/.test(clock)))return invalid;
 const input=date+'T'+(allDay?'00:00':clock),start=new Date(input);
 if(!Number.isFinite(+start)||localInput(start)!==input)return invalid;
 const duration=e.allDay?3600000:+new Date(e.end)-+new Date(e.start);
 const end=allDay?addDays(start,e.allDay?allDayLength(e):1):new Date(+start+(Number.isFinite(duration)&&duration>0?duration:3600000));
 return {start:localInput(start),end:localInput(end),allDay};
}
export function moveEvent(e,day,hour){
 if(e.allDay)return {...e,...eventSchedule(e,dateKey(day),'09:00',true)};
 const original=new Date(e.start),start=new Date(dayStart(day));
 start.setHours(hour===undefined?original.getHours():hour,hour===undefined?original.getMinutes():0,0,0);
 const duration=+new Date(e.end)-+original;
 return {...e,start:localInput(start),end:localInput(new Date(+start+duration))};
}
export function dayLayout(events,day){const a=dayStart(day),b=addDays(a,1);const items=events.filter(e=>intersects(e,day)).map(e=>({event:e,start:Math.max(0,(+new Date(e.start)-+a)/60000),end:Math.min(1440,(+new Date(e.end)-+a)/60000)})).sort((a,b)=>a.start-b.start||b.end-a.end);let lanes=[];for(const item of items){let lane=lanes.findIndex(end=>end<=item.start);if(lane<0)lane=lanes.length;lanes[lane]=item.end;item.lane=lane;}return items.map(i=>({...i,lanes:lanes.length}));}
