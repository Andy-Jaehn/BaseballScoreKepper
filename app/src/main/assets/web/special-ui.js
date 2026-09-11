import {replay,runnerQueue,advanceLimit,isDefender,stageSpecial,uid} from './engine.js';
import {specialNames} from './special-engine.js';
import {field} from './match-ui.js';
export function specialMenu(g,ctx){const {btn}=ctx,s=replay(g);return '<div class="dialog-body"><h2>特殊情况</h2>'+[
 [['HBP','pitch','hbp'],['IBB','pitch','ibb']],
 [['暴投','specialStart','wp'],['捕逸','specialStart','pb'],['投手犯规','specialStart','balk']],
 [['界外接杀','specialStart','foulCatch'],['界外漏接','specialStart','foulDrop'],['牵制出局','specialStart','pickoff']],
 [['不死三振','specialStart','droppedThird'],['捕手妨碍打击','specialStart','interference'],['盗垒','specialStart','steal']]
 ].map(row=>'<div class="special-row">'+row.map(([label,action,kind])=>btn(label,action,'data-kind="'+kind+'" '+(kind==='droppedThird'&&s.s!==2?'disabled title="仅两好球时可用"':''))).join('')+'</div>').join('')+'</div><div class="dialog-actions">'+btn('返回记分','closePanel','','ghost wide')+'</div>';}
const queueFor=(s,d)=>runnerQueue(s).filter(r=>r.from||d.kind==='droppedThird');
export function specialDialog(g,ctx){
 const {btn,esc,name}=ctx,s=replay(g),d=g.specialDraft,defense=s.teams[1-s.side].lineup.filter(isDefender);
 const options=(list=defense,selected='',blank=true)=>(blank?'<option value="">请选择…</option>':'')+list.map(p=>'<option value="'+esc(p.id)+'" '+(selected===p.id?'selected':'')+'>'+esc(p.pos+' · '+name(p.id))+'</option>').join('');
 const select=(label,id,list=defense,selected='')=>'<label for="'+id+'">'+label+'</label><select id="'+id+'">'+options(list,selected)+'</select>';
 const footer=btn('上一步','specialBack','','ghost')+btn('取消本次记录','specialCancel','','ghost');
 let body='<h2>'+specialNames[d.kind]+'</h2>';
 if(d.step==='pitch')return '<div class="dialog-body">'+body+'<label for="specialPitchResult">本次投球判定</label><select id="specialPitchResult"><option value="ball">坏球</option><option value="strike">好球</option></select></div><div class="dialog-actions">'+btn('下一步','specialPitchNext','','primary wide')+footer+'</div>';
 if(d.step==='choose'){
  if(d.kind==='pickoff')body+='<label for="specialBase">牵制垒包</label><select id="specialBase"><option value="">选择有跑者的垒包…</option>'+queueFor(s,d).map(r=>'<option value="'+r.from+'" '+(d.base===r.from?'selected':'')+'>'+r.from+' 垒 · '+esc(name(r.id))+'</option>').join('')+'</select>'+select('完成触杀的野手（可选）','specialPutout',defense,d.putout)+select('牵制失误球员（可选）','specialError',defense,d.errorFielder)+'<p class="special-note">只选垒包记录一次牵制；选择触杀野手记录出局；选择失误球员后逐个更新跑者。出局与失误请择一填写。</p>';
  else body+=select(d.kind==='foulDrop'?'漏接失误球员':'完成接杀的野手','specialFielder');
  return '<div class="dialog-body">'+body+'</div><div class="dialog-actions">'+btn('下一步','specialChoose','','primary wide')+footer+'</div>';
 }
 const queue=queueFor(s,d),r=queue.find(r=>!d.actions.some(a=>a.id===r.id));
 if(!r)return body+btn('查看结果','specialReady','','primary wide')+footer;
 if(d.outId){
  const currentOuts=s.o+d.actions.filter(a=>a.mode==='tag').length;
  body+='<h3>触杀 · '+esc(name(r.id))+'</h3>'+select('完成刺杀的野手','specialPutout');
  if(d.kind==='steal')body+=select('发动阻盗的投手或捕手','specialAssist',defense.filter(f=>['投手','捕手'].includes(f.pos)));
  if(currentOuts===2)body+='<label for="specialTiming">此前已录入得分与第三出局的先后</label><select id="specialTiming"><option value="after">第三出局在先 / 未确认得分在先</option><option value="before">跑者先回本垒，再发生第三出局</option></select>';
  return '<div class="dialog-body">'+body+'</div><div class="dialog-actions">'+btn('确认跑者出局','specialOut','','danger wide')+btn('返回跑者','specialOutBack','','ghost')+btn('取消本次记录','specialCancel','','ghost')+'</div>';
 }
 const limit=Math.max(0,advanceLimit(s,d.actions,r.id)),walk=(d.kind==='wp'||(d.kind==='pb'&&d.pitchResult!=='strike'))&&s.b===3,min=walk&&Array.from({length:r.from},(_,i)=>s.bases[i]).every(Boolean)?1:0;
 body+='<h3>跑者处理 · '+esc(name(r.id))+'</h3><div class="runner-mini">'+field(s)+'</div><p class="muted">'+(r.from?r.from+' 垒跑者':'打者')+' · '+(d.actions.length+1)+' / '+queue.length+'</p><label for="specialAdvance">正常进垒数量</label><select id="specialAdvance">'+Array.from({length:Math.max(0,limit-min+1)},(_,i)=>i+min).map(n=>'<option value="'+n+'" '+(n===(r.from?min:Math.min(1,limit))?'selected':'')+'>'+n+' 个垒'+(n?' → '+['','一垒','二垒','三垒','本垒'][r.from+n]:'（停留）')+'</option>').join('')+'</select><label for="specialErrorAdvance">额外因失误进垒数量</label><select id="specialErrorAdvance">'+Array.from({length:limit+1},(_,n)=>'<option value="'+n+'">'+n+' 个垒</option>').join('')+'</select>'+select('失误球员（因失误进垒时必选）','specialError',defense,d.errorFielder||'');
 if(!r.from)body+='<p class="special-note">不死三振打者至少到达一垒；可将进垒记为正常进垒或失误进垒。</p>';
 return '<div class="dialog-body">'+body+'</div><div class="dialog-actions">'+btn('确认跑者','specialRunner','','primary wide')+(r.from?btn('被触杀','specialTag','','danger wide'):'')+footer+'</div>';
}
export function handleSpecial(action,v,g,ctx){
 if(!action.startsWith('special')||action==='specialMenu')return false;
 const {$,updateGame,close}=ctx,s=replay(g);let d=g.specialDraft;
 const ready=()=>{updateGame(stageSpecial(g,{...d,type:'special'}));close();};
 const advance=()=>{const q=queueFor(s,d);if(s.o+d.actions.filter(a=>a.mode==='tag').length>=3||q.every(r=>d.actions.some(a=>a.id===r.id)))ready();};
 if(action==='specialStart'){
  if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前记录');if(s.halfEnded)throw Error('请先开启下个半局');
  if(v.kind==='droppedThird'&&s.s!==2)throw Error('不死三振仅可在两好球时记录');
  if(!specialNames[v.kind])throw Error('未知特殊情况');
  if(['wp','pb','pickoff','steal'].includes(v.kind)&&!s.bases.some(Boolean))throw Error('当前没有垒上跑者');
  d=g.specialDraft={type:'special',id:uid(),kind:v.kind,time:new Date().toISOString(),actions:[],step:v.kind==='pb'?'pitch':['pickoff','foulDrop','foulCatch'].includes(v.kind)?'choose':'runners'};
  if(['balk','interference'].includes(v.kind))ready();return true;
 }
 if(action==='specialCancel'){g.specialDraft=null;close();return true;}
 if(!d)throw Error('没有正在录入的特殊情况');
 if(action==='specialPitchNext'){
  d.pitchResult=$('#specialPitchResult').value;d.step='runners';
  if(d.pitchResult==='strike'&&s.s===2){d.kind='droppedThird';d.cause='pb';}
 }else if(action==='specialChoose'){
  if(d.kind==='pickoff'){
   d.base=Number($('#specialBase').value);d.putout=$('#specialPutout').value;d.errorFielder=$('#specialError').value;
   if(!s.bases[d.base-1])throw Error('请选择有跑者的垒包');if(d.putout&&d.errorFielder)throw Error('触杀野手与失误球员请择一填写');
   if(d.errorFielder)d.step='runners';else ready();
  }else{const id=$('#specialFielder').value;if(!id)throw Error('请选择守备球员');d[d.kind==='foulDrop'?'errorFielder':'fielder']=id;ready();}
 }else if(action==='specialRunner'){
  const r=queueFor(s,d).find(r=>!d.actions.some(a=>a.id===r.id)),advance=Number($('#specialAdvance').value),errorAdvance=Number($('#specialErrorAdvance').value),errorFielder=$('#specialError').value;
  if(advance+errorAdvance>advanceLimit(s,d.actions,r.id))throw Error('总进垒数不能超过前位跑者或本垒');
  if(!r.from&&advance+errorAdvance<1)throw Error('不死三振打者至少到达一垒');if(errorAdvance&&!errorFielder)throw Error('请选择失误球员');
  d.actions.push({id:r.id,mode:'advance',advance,errorAdvance,errorFielder});
  const q=queueFor(s,d);if(q.every(r=>d.actions.some(a=>a.id===r.id)))ready();
 }else if(action==='specialTag'){d.outId=queueFor(s,d).find(r=>!d.actions.some(a=>a.id===r.id)).id;
 }else if(action==='specialOutBack'){delete d.outId;
 }else if(action==='specialOut'){
  const putout=$('#specialPutout').value,assist=$('#specialAssist')?.value;if(!putout)throw Error('请选择完成刺杀的野手');if(d.kind==='steal'&&!assist)throw Error('请选择发动阻盗的投手或捕手');
  d.actions.push({id:d.outId,mode:'tag',putout,assist,runsBeforeThird:$('#specialTiming')?.value==='before'});delete d.outId;advance();
 }else if(action==='specialReady'){ready();
 }else if(action==='specialBack'){
  if(d.actions.length)d.actions.pop();else if(d.kind==='pickoff'&&d.step==='runners')d.step='choose';else {g.specialDraft=null;close();}
 }
 return true;
}
