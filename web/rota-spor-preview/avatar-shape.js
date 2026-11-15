import {bodyFat,numberOrNull} from './model.js';
import {normalizeAppearance,appearanceKey} from './appearance.js';

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const measured=(value,min,max)=>numberOrNull(value,min,max);

/** Rendering proportions only, not an estimate of muscle mass or fat distribution. */
export function avatarShape(profile={}){
  const heightCm=measured(profile.heightCm,100,240),weightKg=measured(profile.weightKg,25,300);
  const h=heightCm??182,weight=weightKg??72,bmi=weight/((h/100)**2);
  const fat=bodyFat(profile),fatPct=fat.value===null?null:clamp(fat.value,3,55);
  const softness=clamp(((fatPct??18)-14)/28,0,1);
  const build=clamp(Math.sqrt(bmi/21.74),.78,1.42);
  const waistCm=measured(profile.waistCm,35,200),neckCm=measured(profile.neckCm,20,70),armCm=measured(profile.armCm,15,65);
  const rightArmCm=measured(profile.rightArmCm,15,65),leftArmCm=measured(profile.leftArmCm,15,65);
  // All geometry is made at 182 cm and scaled as a whole afterward.
  const scale=h/182;
  const waistRadius=waistCm===null?.137*build:(waistCm/100)/5.73/scale;
  const neckRadius=neckCm===null?.057*clamp(build,.9,1.15):(neckCm/100)/(Math.PI*2)/scale;
  const upperArmRadius=armCm===null?.046*clamp(build,.87,1.3):(armCm/100)/(Math.PI*2)/scale;
  // Legacy circumference is only a fallback for the illustration, not copied
  // into either side's recorded measurement.
  const rightUpperArmRadius=rightArmCm===null?upperArmRadius:(rightArmCm/100)/(Math.PI*2)/scale;
  const leftUpperArmRadius=leftArmCm===null?upperArmRadius:(leftArmCm/100)/(Math.PI*2)/scale;
  const shoulderHalfWidth=.203*clamp(.87+build*.13,.94,1.13);
  const chestHalfWidth=Math.max(.171*build,waistRadius*.98);
  const chestDepth=.108*clamp(build,.85,1.25)+softness*.014;
  const hipHalfWidth=Math.max(.151*clamp(build,.9,1.28),waistRadius*.97);
  const thighRadius=.080*clamp(build,.85,1.45)+softness*.008;
  const calfRadius=.052*clamp(build,.85,1.23)+softness*.004;
  return{
    heightCm,weightKg,waistCm,neckCm,armCm,rightArmCm,leftArmCm,fatPct,estimatedFat:fat.estimated===true,appearance:normalizeAppearance(profile.appearance),
    bmi:heightCm&&weightKg?bmi:null,scale,softness,build,
    waistRadius:clamp(waistRadius,.090,.27),neckRadius:clamp(neckRadius,.04,.105),upperArmRadius:clamp(upperArmRadius,.03,.105),
    rightUpperArmRadius:clamp(rightUpperArmRadius,.03,.105),leftUpperArmRadius:clamp(leftUpperArmRadius,.03,.105),
    shoulderHalfWidth,chestHalfWidth,chestDepth,hipHalfWidth,thighRadius,calfRadius,
    hasMeasurements:heightCm!==null||weightKg!==null||waistCm!==null||neckCm!==null||armCm!==null||rightArmCm!==null||leftArmCm!==null,
    note:'Ölçülere göre yaklaşık görünüm. Kas ve yağın vücuttaki dağılımı bu verilerden ölçülemez.',
  };
}

export function avatarShapeKey(profile={}){
  const p=avatarShape(profile);
  return[p.scale,p.waistRadius,p.neckRadius,p.upperArmRadius,p.rightUpperArmRadius,p.leftUpperArmRadius,p.shoulderHalfWidth,p.chestHalfWidth,p.chestDepth,p.hipHalfWidth,p.thighRadius,p.calfRadius,p.softness,p.fatPct??18].map(v=>v.toFixed(5)).join('|')+appearanceKey(profile.appearance);
}
