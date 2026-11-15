(() => {
  'use strict';
  const el=(tag,className,text)=>{const node=document.createElement(tag);if(className)node.className=className;if(text!==undefined)node.textContent=text;return node;};
  class HafizlikWorkflowPanel {
    constructor(root,studio,workflow){
      this.root=root;this.studio=studio;this.workflow=workflow;this.host=el('section','workflow-panel');this.host.setAttribute('aria-label','Planın tik kuralları');root.querySelector('#design-links').prepend(this.host);
      this.list=el('div','workflow-rule-list');const heading=el('div','workflow-heading'),title=el('h3','','Plan kuralları'),add=el('button','','+ Kural');add.type='button';add.addEventListener('click',()=>this.edit());heading.append(title,add);this.host.append(heading,el('p','design-help','Kod yazmadan kendi tik sistemini kur. Hazır planın kuralları da aynı araçlarla düzenlenir.'));
      const types=el('div','workflow-quick-types');
      for(const [kind,symbol,label,detail] of [['requiresAll','✓ → ◇','Ön koşul kilidi','Hepsi bitmeden açılmasın'],['exclusiveReset','⇄','Gün değişimi','Diğerini seç, listeyi temizle'],['advanceSequence','1 → 2','Sıralı ilerleme','Sıradaki tiki işaretle'],['resetSequence','↺','Baştan başlat','Bitince listeyi sıfırla']]){
        const button=el('button');button.type='button';button.dataset.newRuleType=kind;button.append(el('span','workflow-type-symbol',symbol),el('strong','',label),el('small','',detail));button.addEventListener('click',()=>this.edit(null,kind));types.append(button);
      }
      this.host.append(types,this.list);
      this.dialog=el('dialog','workflow-dialog');this.dialog.setAttribute('aria-label','Tik kuralını düzenle');this.root.append(this.dialog);
      this.dialog.addEventListener('click',event=>{if(event.target===this.dialog)this.dialog.close();});
      root.addEventListener('hafizlik:design-change',()=>this.render());root.addEventListener('hafizlik:workflow-state',()=>this.render());
      root.addEventListener('pointerdown',event=>{const path=event.target.closest?.('[data-rule-id]');if(path){event.stopPropagation();this.edit(path.dataset.ruleId);}},true);
      root.addEventListener('click',event=>{const button=event.target.closest?.('[data-edit-link]');if(!button)return;const link=studio.links.links.find(item=>item.id===button.dataset.editLink);if(!link)return;studio.links.editingId=link.id;studio.panel.setTab('links');const set=(id,value)=>{const input=root.querySelector(id);if(input)input.value=value;};set('#design-link-source',link.source);set('#design-link-target',link.target);set('#design-link-action',link.action);studio.links.setAction(link.action);root.querySelector('.design-link-fallback').open=true;studio.message('Kaynak, hedef veya eylemi değiştirip Bağlantıyı ekle ile güncelleyebilirsin.');});
      this.render();
    }
    render(){
      this.list.replaceChildren();for(const rule of this.workflow.list()){
        const card=el('article','workflow-rule-card'+(this.workflow.selectedRule===rule.id?' is-selected':'')),head=el('strong','',rule.name),type=el('small','',this.workflow.typeLabel(rule.type)),summary=el('p','',this.workflow.preview(rule.id)),actions=el('div','workflow-card-actions');
        const show=el('button','',this.workflow.selectedRule===rule.id?'Gizle':'Bağlantıları göster');show.type='button';show.addEventListener('click',()=>{this.workflow.selectedRule=this.workflow.selectedRule===rule.id?null:rule.id;this.studio.links.setMode(!!this.workflow.selectedRule);this.studio.links.draw();this.render();this.studio.panel.refresh();});
        const edit=el('button','','Düzenle');edit.type='button';edit.addEventListener('click',()=>this.edit(rule.id));
        const remove=el('button','','Sil');remove.type='button';remove.className='workflow-remove';remove.addEventListener('click',()=>{if(confirm('“'+rule.name+'” kuralı kaldırılsın mı? Tik ilerlemesi silinmez; kural tasarım geçmişinden geri alınabilir.')){this.workflow.remove(rule.id);this.render();}});
        actions.append(show,edit,remove);card.append(head,type,summary,actions);this.list.append(card);
      }
    }
    field(label,node){const wrapper=el('label','workflow-field');wrapper.append(el('span','',label),node);return wrapper;}
    select(label,values,value){const select=el('select');select.setAttribute('aria-label',label);for(const item of values){const option=el('option','',item.label);option.value=item.id;select.append(option);}select.value=value||values[0]?.id||'';this.form.append(this.field(label,select));return select;}
    picker(label,initial=[],ordered=false){
      const selected=[...initial],details=el('details','workflow-picker'),summary=el('summary','',label+' · '+selected.length+' seçili'),search=el('input'),list=el('div','workflow-picker-list');search.type='search';search.placeholder='Tik ara…';search.setAttribute('aria-label',label+' içinde ara');const order=el('div','workflow-picked-order');order.setAttribute('aria-label',label+' sırası');details.append(summary,order,search,list);
      const renderOrder=()=>{order.replaceChildren();if(!ordered)return;selected.forEach((id,index)=>{const row=el('div','workflow-order-row');row.dataset.orderedEndpoint=id;row.append(el('b','',String(index+1)),el('span','',this.workflow.label(id)));for(const [delta,symbol,title]of [[-1,'↑','yukarı taşı'],[1,'↓','aşağı taşı']]){const button=el('button','',symbol);button.type='button';button.setAttribute('aria-label',this.workflow.label(id)+': '+title);button.disabled=index+delta<0||index+delta>=selected.length;button.addEventListener('click',()=>{[selected[index],selected[index+delta]]=[selected[index+delta],selected[index]];renderOrder();});row.append(button);}order.append(row);});};
      for(const point of [...this.studio.links.endpoints(),...selected.filter(id=>!this.studio.links.nodes.has(id)).map(id=>({id,label:'Silinmiş tik · kaldır veya yenisini seç'}))]){const line=el('label'),input=el('input');input.type='checkbox';input.checked=selected.includes(point.id);input.dataset.workflowEndpoint=point.id;line.append(input,el('span','',point.label));list.append(line);input.addEventListener('change',()=>{const index=selected.indexOf(point.id);if(input.checked&&index<0)selected.push(point.id);else if(!input.checked&&index>=0)selected.splice(index,1);summary.textContent=label+' · '+selected.length+' seçili';renderOrder();});}
      renderOrder();search.addEventListener('input',()=>{for(const line of list.children)line.hidden=!line.textContent.toLocaleLowerCase('tr').includes(search.value.toLocaleLowerCase('tr'));});this.form.append(details);return ()=>[...selected];
    }
    edit(id,initialType='requiresAll'){
      const old=this.workflow.list().find(rule=>rule.id===id)||{type:initialType,name:'',sources:[],targets:[],resetOn:[]};this.draft=old;this.dialog.replaceChildren();const head=el('div','workflow-dialog-head'),title=el('h2','',id?'Tik kuralını düzenle':'Yeni tik kuralı'),close=el('button','','×');close.type='button';close.setAttribute('aria-label','Kural penceresini kapat');close.addEventListener('click',()=>this.dialog.close());head.append(title,close);this.dialog.append(head);this.form=el('form','workflow-form');this.dialog.append(this.form);
      const name=el('input');name.value=old.name;name.maxLength=100;name.setAttribute('aria-label','Kural adı');this.form.append(this.field('Kural adı',name));
      const type=this.select('Kural türü',['requiresAll','exclusiveReset','advanceSequence','resetSequence'].map(key=>({id:key,label:this.workflow.typeLabel(key)})),old.type);
      const body=el('div','workflow-dynamic-fields');this.form.append(body);let readFields;
      const fields=()=>{body.replaceChildren();const outer=this.form;this.form=body;const endpoints=this.studio.links.endpoints();const kind=type.value;
        if(kind==='requiresAll'){const target=this.select('Kilitli olacak tik',endpoints,old.target),sources=this.picker('Önce tamamlanması gereken tikler',old.sources);body.append(el('p','design-help','Seçilenlerin hepsi işaretlenmeden hedef tik işaretlenemez. İçlerinden biri kaldırılırsa hedef de temizlenir.'));readFields=()=>({target:target.value,sources:sources()});}
        else if(kind==='exclusiveReset'){const sources=this.picker('Birbirinin yerine seçilecek tikler',old.sources),targets=this.picker('Seçim değişince sıfırlanacak tikler',old.targets);readFields=()=>({sources:sources(),targets:targets(),requireOne:true});}
        else if(kind==='advanceSequence'){const source=this.select('İlerlemeyi başlatan tik',endpoints,old.source),targets=this.picker('Sırayla işaretlenecek tikler',old.targets,true),resets=this.picker('Yeni tur/gün başlatan tikler',old.resetOn);body.append(el('p','design-help','Seçtiğin tiklerin sırasını ↑ ↓ ile değiştirebilirsin. Yeni gün/başlangıç tiklerini de seç: onlardan biri işaretlendiğinde bir sonraki ilerlemeye izin verilir.'));readFields=()=>({source:source.value,targets:targets(),resetOn:resets(),once:true});}
        else{const source=this.select('İşareti kaldırılacak başlangıç tiki',endpoints,old.source),targets=this.picker('Yeniden başlatılacak liste',old.targets);body.append(el('p','design-help','Diğer liste tiklerinin hepsi tamamlandıysa başlangıç tikini kaldırmak bu listeyi sıfırlar.'));readFields=()=>({source:source.value,targets:targets(),onlyWhenAll:true});}
        this.form=outer;
      };type.addEventListener('change',fields);fields();const error=el('p','workflow-error');error.setAttribute('role','alert');const submit=el('button','workflow-save','Kuralı kaydet');submit.type='submit';this.form.append(error,submit);this.form.addEventListener('submit',event=>{event.preventDefault();try{const rule=this.workflow.upsert({id:old.id,type:type.value,name:name.value,...readFields()});this.workflow.selectedRule=rule.id;this.studio.links.setMode(true);this.studio.links.draw();this.studio.panel.refresh();this.render();this.dialog.close();}catch(err){error.textContent=err.message;}});
      if(!this.dialog.open)this.dialog.showModal();name.focus();
    }
  }
  window.HafizlikWorkflowPanel=HafizlikWorkflowPanel;
})();
