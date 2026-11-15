const number=(v,min,max,fallback)=>Number.isFinite(Number(v))?Math.max(min,Math.min(max,Number(v))):fallback;
const color=(value,fallback)=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value)?value:fallback;
export function normalizeAppearance(raw={}) {
 return {
  hairStyle:['bald','buzz','short','part','curtains','wavy','curly','custom'].includes(raw.hairStyle)?raw.hairStyle:'bald',
  hairColor:color(raw.hairColor,'#30251e'),eyeColor:color(raw.eyeColor,'#695239'),
  hairLength:number(raw.hairLength,0,8,2.5),hairSides:number(raw.hairSides,0,4,1),
  hairFringe:number(raw.hairFringe,0,6,1.5),
  glasses:['none','round','square','oval'].includes(raw.glasses)?raw.glasses:'none',
  glassesColor:color(raw.glassesColor,'#292c32')
 };
}
export const appearanceKey=raw=>JSON.stringify(normalizeAppearance(raw));

