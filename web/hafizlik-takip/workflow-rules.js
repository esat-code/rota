(() => {
  'use strict';
  const copy=value=>JSON.parse(JSON.stringify(value));
  const TYPES=new Set(['requiresAll','exclusiveReset','advanceSequence','resetSequence']);
  class HafizlikWorkflow {
    constructor(root,links,saved,runtime={},onChange=()=>{}) {
      this.root=root;this.links=links;this.onChange=onChange;this.rules=[];this.processing=false;this.queue=[];this.runtime={activeGroups:{...runtime?.activeGroups},completed:{...runtime?.completed}};
      this.known=new Map();this.initializing=true;links.workflow=this;
      const defaults=this.defaults();
      const input=Array.isArray(saved?.rules)?saved.rules:defaults;
      for(const rule of input.slice(0,100)){try{this.rules.push(this.validate(rule));}catch{if(defaults.some(r=>r.id===rule?.id))this.rules.push(defaults.find(r=>r.id===rule.id));else if(rule?.type==='requiresAll'&&this.node(rule.target)&&Array.isArray(rule.sources)&&rule.sources.length)this.rules.push({id:String(rule.id||'rule-'+crypto.randomUUID()),name:String(rule.name||'Eksik ön koşul'),type:'requiresAll',target:rule.target,sources:rule.sources.filter(id=>typeof id==='string'),enabled:rule.enabled!==false});}}
      for(const rule of this.rules.filter(r=>r.type==='exclusiveReset')){const previous=this.runtime.activeGroups[rule.id];const selected=rule.sources.includes(previous)?previous:rule.sources.find(id=>this.node(id)?.checked)||rule.sources[0];this.runtime.activeGroups[rule.id]=selected;rule.sources.forEach(id=>{const el=this.node(id);if(el)el.checked=id===selected;});}
      this.refreshGates(false);this.remember();this.initializing=false;
      root.addEventListener('change',event=>{const id=event.target?.dataset?.checkId;if(id&&this.links.nodes.get(id)===event.target)this.process(id);},true);
      root.addEventListener('hafizlik:design-change',()=>this.refresh());
      root.addEventListener('hafizlik:editing',()=>this.decorateDays());this.decorateDays();
    }
    node(id){return this.links.nodes.get(id);}
    label(id){return this.node(id)?this.links.label(id):'Silinmiş tik · yeniden seç';}
    defaults(){
      const id=el=>el?.dataset.checkId;const days=['bir-gun','diger-gun'].filter(key=>this.node(key));
      const daily=[...this.root.querySelectorAll('.daily-check')].map(id).filter(Boolean),weeks=[...this.root.querySelectorAll('.week-check')].map(id).filter(Boolean);
      const final=id(this.root.querySelector('#final-routine')),prerequisites=[...this.root.querySelectorAll('.routine-prerequisite')].map(id).filter(Boolean);
      const list=[];
      if(days.length>1)list.push({id:'default-days',name:'Bir gün / diğer gün',type:'exclusiveReset',sources:days,targets:daily,requireOne:true});
      if(final&&prerequisites.length)list.push({id:'default-final-gate',name:'Son tik için önceki 7 tik',type:'requiresAll',sources:prerequisites,target:final});
      if(final&&weeks.length)list.push({id:'default-week-progress',name:'Gün bitince sıradaki cüz',type:'advanceSequence',source:final,targets:weeks,resetOn:days,once:true});
      if(weeks.length>1)list.push({id:'default-week-reset',name:'İki hafta tamamlanınca yeniden başlat',type:'resetSequence',source:weeks[0],targets:weeks,onlyWhenAll:true});
      return list;
    }
    validate(raw){
      if(!raw||!TYPES.has(raw.type))throw Error('Geçerli bir kural türü seç.');
      const rule={id:typeof raw.id==='string'?raw.id:'rule-'+crypto.randomUUID(),type:raw.type,name:String(raw.name||this.typeLabel(raw.type)).trim().slice(0,100),enabled:raw.enabled!==false};
      const ids=(values,min=1)=>{const result=[...new Set(Array.isArray(values)?values:[])];if(result.length<min||result.some(id=>typeof id!=='string'||!this.node(id)))throw Error('Kural için geçerli tikleri seç.');return result;};
      if(raw.type==='requiresAll'){rule.sources=ids(raw.sources);rule.target=ids([raw.target])[0];if(rule.sources.includes(rule.target))throw Error('Bir tik kendi ön koşulu olamaz.');}
      if(raw.type==='exclusiveReset'){rule.sources=ids(raw.sources,2);rule.targets=ids(raw.targets,0);if(rule.targets.some(id=>rule.sources.includes(id)))throw Error('Gün seçimi tikleri sıfırlanacaklar arasında olamaz.');rule.requireOne=raw.requireOne!==false;}
      if(raw.type==='advanceSequence'){rule.source=ids([raw.source])[0];rule.targets=ids(raw.targets);if(rule.targets.includes(rule.source))throw Error('İlerleten tik, ilerleme listesinde olamaz.');rule.resetOn=ids(raw.resetOn,0);rule.once=raw.once!==false;}
      if(raw.type==='resetSequence'){rule.source=ids([raw.source])[0];rule.targets=ids(raw.targets);rule.onlyWhenAll=raw.onlyWhenAll!==false;}
      return rule;
    }
    typeLabel(type){return {requiresAll:'Hepsi tamamlanmadan açılmasın',exclusiveReset:'Birini seç, diğerlerini sıfırla',advanceSequence:'Sıradaki tiki ilerlet',resetSequence:'Listeyi yeniden başlat'}[type]||'Kural';}
    graph(extra){const edges=[];for(const link of this.links.links)edges.push([link.source,link.target]);for(const rule of [...this.rules.filter(r=>r.id!==extra?.id),...(extra?[extra]:[])].filter(r=>r.enabled!==false)){if(rule.type==='requiresAll')rule.sources.forEach(id=>edges.push([id,rule.target]));if(rule.type==='advanceSequence')rule.targets.forEach(id=>edges.push([rule.source,id]));}return edges;}
    validateGraph(extra){const edges=this.graph(extra),visiting=new Set(),done=new Set();const walk=id=>{if(visiting.has(id))throw Error('Bu ön koşul/bağlantı bir döngü oluşturuyor.');if(done.has(id))return;visiting.add(id);edges.filter(e=>e[0]===id).forEach(e=>walk(e[1]));visiting.delete(id);done.add(id);};for(const [id]of edges)walk(id);}
    upsert(raw){const rule=this.validate(raw);this.validateGraph(rule);const old=this.rules.find(r=>r.id===rule.id);if(old)Object.assign(old,rule);else this.rules.push(rule);this.refreshGates();this.remember();this.changed();return copy(rule);}
    addGate(source,target){const old=this.rules.find(r=>r.type==='requiresAll'&&r.target===target);return this.upsert({...old,type:'requiresAll',name:old?.name||'Ön koşullar',sources:[...(old?.sources||[]),source],target});}
    remove(id){this.rules=this.rules.filter(r=>r.id!==id);delete this.runtime.activeGroups[id];delete this.runtime.completed[id];this.refreshGates();this.remember();this.changed();}
    list(){return copy(this.rules);}
    serialize(){return {version:1,rules:this.list()};}
    remember(){this.links.nodes.forEach((node,id)=>this.known.set(id,node.checked));}
    allowed(id){return this.rules.filter(r=>r.enabled!==false&&r.type==='requiresAll'&&r.target===id).every(r=>r.sources.every(key=>this.node(key)?.checked));}
    setCheck(id,value){const node=this.node(id);if(!node||node.checked===value)return;if(value&&!this.allowed(id))return;node.checked=value;node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}
    refreshGates(events=true){
      const gated=new Map();this.rules.filter(r=>r.type==='requiresAll'&&r.enabled!==false).forEach(r=>gated.set(r.target,true));
      for(const [id,node] of this.links.nodes){if(gated.has(id)){const allowed=this.allowed(id);node.disabled=!allowed;node.dataset.workflowGate='true';node.title=allowed?'Ön koşullar tamamlandı.':'Önce: '+this.rules.filter(r=>r.type==='requiresAll'&&r.target===id&&r.enabled!==false).flatMap(r=>r.sources).filter(key=>!this.node(key)?.checked).map(key=>this.label(key)).join(' · ');if(!allowed&&node.checked){if(events)this.setCheck(id,false);else node.checked=false;}}else if(node.dataset.workflowGate){node.disabled=false;delete node.dataset.workflowGate;node.removeAttribute('title');}}
    }
    process(id){
      this.queue.push(id);if(this.processing)return;this.processing=true;let steps=0;
      try{while(this.queue.length&&steps++<1000){const key=this.queue.shift(),node=this.node(key);if(!node)continue;const before=this.known.get(key),checked=node.checked;this.known.set(key,checked);if(checked&&!this.allowed(key)){this.setCheck(key,false);continue;}if(before===checked)continue;
        for(const r of this.rules.filter(r=>r.enabled!==false)){
          if(r.type==='exclusiveReset'&&r.sources.includes(key)){const active=this.runtime.activeGroups[r.id];if(checked&&active!==key){this.runtime.activeGroups[r.id]=key;r.sources.filter(other=>other!==key).forEach(other=>this.setCheck(other,false));r.targets.forEach(other=>this.setCheck(other,false));}else if(!checked&&active===key&&r.requireOne)this.setCheck(key,true);}
          if(r.type==='advanceSequence'&&r.resetOn?.includes(key)&&checked)this.runtime.completed[r.id]=false;
          if(r.type==='advanceSequence'&&r.source===key&&checked&&(!r.once||!this.runtime.completed[r.id])){const target=r.targets.find(other=>!this.node(other)?.checked);if(target&&this.allowed(target)&&!this.node(target)?.disabled){this.runtime.completed[r.id]=true;this.setCheck(target,true);}}
          if(r.type==='resetSequence'&&r.source===key&&!checked&&(!r.onlyWhenAll||r.targets.filter(other=>other!==key).every(other=>this.node(other)?.checked))){r.targets.forEach(other=>this.setCheck(other,false));this.rules.filter(a=>a.type==='advanceSequence'&&a.targets.some(other=>r.targets.includes(other))).forEach(a=>this.runtime.completed[a.id]=false);}
        }
        this.refreshGates();
      }}finally{this.queue=[];this.processing=false;this.remember();this.decorateDays();this.onChange();this.root.dispatchEvent(new Event('hafizlik:workflow-state'));document.dispatchEvent(new Event('hafizlik:checks-updated'));}
    }
    decorateDays(){for(const r of this.rules.filter(r=>r.type==='exclusiveReset'))for(const id of r.sources)this.node(id)?.closest('label')?.classList.toggle('active',!!this.node(id)?.checked);}
    refresh(){if(this.initializing||this.processing)return;this.rules=this.rules.filter(rule=>rule.type==='requiresAll'?this.node(rule.target):true);this.refreshGates();this.decorateDays();}
    edges(id){const r=this.rules.find(rule=>rule.id===id);if(!r)return [];if(r.type==='requiresAll')return r.sources.map(source=>({source,target:r.target,action:'requiresAll'}));if(r.type==='exclusiveReset')return r.sources.flatMap(source=>r.targets.map(target=>({source,target,action:'uncheck'})));return r.targets.filter(target=>target!==r.source).map(target=>({source:r.source,target,action:r.type==='advanceSequence'?'check':'uncheck'}));}
    preview(id){const r=this.rules.find(rule=>rule.id===id);if(!r)return '';if(r.type==='requiresAll'){const done=r.sources.filter(key=>this.node(key)?.checked).length;return done+' / '+r.sources.length+' ön koşul tamam. '+this.label(r.target)+(done===r.sources.length?' işaretlenebilir.':' henüz işaretlenemez.');}if(r.type==='advanceSequence')return 'Sıradaki: '+this.label(r.targets.find(key=>!this.node(key)?.checked)||r.targets.at(-1));if(r.type==='exclusiveReset')return r.targets.length+' tik sıfırlanır. Diğer tikler korunur.';return r.targets.length+' tik, koşul sağlandığında yeniden başlar.';}
    changed(){this.onChange();this.root.dispatchEvent(new CustomEvent('hafizlik:design-change',{detail:{kind:'workflow'}}));this.links.draw();}
  }
  window.HafizlikWorkflow=HafizlikWorkflow;
})();
