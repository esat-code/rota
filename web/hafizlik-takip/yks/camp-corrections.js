import {CAMP_TASKS, CAMP_MILESTONES} from './camp.js';
import {MERT70} from './mert70.js';

const photoNote = kind => 'Kendi kampındaki bu günün '+(kind==='vdk'?'VDK':'soru bankası')+' çalışması. Sayfalar gönderdiğin çizelgeden eşleştirildi; bu kitabın geri kalanını bitirme ödevi değildir.';

// Correct only untouched, unfinished generated rows. Never relabel completed work,
// replace a user's edited task, add a deleted task, or reset any progress.
export function correctProblemCampDays(plan) {
  if (plan.settings?.campId !== 'ne-ne-zaman-page-2') return {plan, updatedTaskIds:[], reviewTaskIds:[]};
  const updatedTaskIds=[], reviewTaskIds=[];
  const tasks=plan.tasks.map(task=>{
    const match=task.id.match(/^camp-mat-son-problem-(vdk|sb|ilaci|sarmal)-(20|21|22)$/);
    if(!match)return task;
    const [,kind,rowText]=match,row=Number(rowText),oldDay=row===20?null:row===21?48:49;
    const seed=CAMP_TASKS.find(t=>t.id===task.id);
    if(!seed||task.title===seed.title&&task.note===seed.note&&task.pageFrom===seed.pageFrom&&task.pageTo===seed.pageTo)return task;
    const label=oldDay?`Kampın ${oldDay}. günü`:'Kaynakta kontrol edilecek · 20. satır';
    const oldNote=oldDay
      ? `Problemler aşamasının ${row}. satırı. Kamp gün numarası ${oldDay}; konu başlığı/sayfa aralığı belirtilmemiş.`
      : 'Bu konum X+91. Kaynak “kampların yirminci günü” diyor; öncesi 47, sonrası 48 ve 49. gün. Yanlışlığı sessizce düzeltmek yerine kamp günü kullanıcı tarafından doğrulanmalı.';
    const data=MERT70.days.find(d=>d.day===oldDay),isMert=kind==='vdk'||kind==='sb';
    const legacyTitle=isMert
      ? data?`Mert Hoca · ${oldDay}. gün · ${data.topic}`:`Mert Hoca · ${label}${kind==='sb'?' soruları':''}`
      : `${label} · ${kind==='ilaci'?'Matematiğin İlacı':'Bilgi Sarmal'}`;
    const legacyNote=isMert&&data?photoNote(kind):oldNote+(kind==='ilaci'?' Aynı konudan önce Matematiğin İlacı çözülür.':kind==='sarmal'?' Aynı konudan ikinci kaynak Bilgi Sarmal’dır.':'');
    const from=isMert&&data?(kind==='vdk'?data.vdkFrom:data.sbFrom):undefined;
    const to=isMert&&data?(kind==='vdk'?data.vdkTo:data.sbTo):undefined;
    const untouched=task.title===legacyTitle&&task.note===legacyNote&&task.day===seed.day&&task.bookId===seed.bookId&&task.pageFrom===from&&task.pageTo===to;
    if(task.done||!untouched){reviewTaskIds.push(task.id);return task;}
    const corrected={...task,title:seed.title,note:seed.note};
    if(seed.pageFrom){corrected.pageFrom=seed.pageFrom;corrected.pageTo=seed.pageTo;}
    updatedTaskIds.push(task.id);
    return corrected;
  });
  const milestones=plan.milestones?.map(m=>{
    if(m.id!=='camp-ready-problem-continuation'||!m.description?.includes('20. satır önce doğrulanmalıdır.'))return m;
    const seed=CAMP_MILESTONES.find(s=>s.id===m.id);
    const oldIds=seed.prerequisiteTaskIds.filter(id=>!id.startsWith('camp-mat-fasikul-1-'));
    const sameIds=JSON.stringify(m.prerequisiteTaskIds)===JSON.stringify(oldIds);
    return {...m,title:seed.title,description:seed.description,note:m.note===m.description?seed.note:m.note,...(sameIds?{prerequisiteTaskIds:[...seed.prerequisiteTaskIds]}:{})};
  });
  return {plan:{...plan,tasks,...(milestones?{milestones}:{})},updatedTaskIds,reviewTaskIds};
}
