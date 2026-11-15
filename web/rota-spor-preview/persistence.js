export const SPORT_KEY='rota-sport-preview-v1';
export function embeddedSport(){try{return window.parent!==window&&typeof window.parent.rotaSportChanged==='function'}catch{return false}}
export function sportStorage(){return embeddedSport()?window.parent.localStorage:window.localStorage}
export function saveSportState(state){sportStorage().setItem(SPORT_KEY,JSON.stringify(state));if(embeddedSport())window.parent.rotaSportChanged();}
export function goSportHome(){if(embeddedSport())window.parent.rotaShowHome?.();}
export function exportSportFile(name,text,type='application/json'){
 if(embeddedSport()&&typeof window.parent.rotaSportExport==='function')return window.parent.rotaSportExport({name,text,type});
 const url=URL.createObjectURL(new Blob([text],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);return Promise.resolve({downloaded:true});
}
