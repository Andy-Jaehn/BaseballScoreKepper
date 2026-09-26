import {replay,runnerQueue,advanceLimit,forceBases,isDefender,settleContact} from './engine.js';
export const trajectories={fly:'高飞球',line:'平飞球',ground:'地滚球',popup:'pop-up'};
export const outcomes={catch:'接杀',stop:'落地',error:'失误'};
const zones=[['左外','中左外','中外','中右外','右外'],['三垒边线','三游间','中路','一二垒间','一垒边线'],['内野浅层']];
const defaults=['左外野','左外野','中外野','右外野','右外野','三垒手','游击手','二垒手','二垒手','一垒手','投手'];
const colors=['#176ab4','#b4510d','#8b43b1','#167b57'];
const points=[[50,84],[84,50],[50,16],[16,50],[50,84]];
export const contactText=d=>(d.location?d.location+(['左外','中外','右外'].includes(d.location)?'野':'')+'方向':'')+(trajectories[d.trajectory]||'')+(d.awardBases?'场地规则'+['','一垒安打','二垒安打','三垒安打','本垒打'][d.awardBases]:outcomes[d.result]||'');
const queue=(s,d)=>runnerQueue(s).filter(r=>r.from||!['catch','infieldFly'].includes(d.result));
const current=(r,d)=>{const a=d.actions.find(a=>a.id===r.id);return r.from+(a?.advance||0)+(a?.errorAdvance||0);};
function validateOrder(s,d){
 let lead=5;
 for(const r of queue(s,d)) {const a=d.actions.find(a=>a.id===r.id);if(['force','tag'].includes(a?.mode))continue;const dest=current(r,d);if(lead<4&&dest>=lead)throw Error('后位跑者不能超过前位，也不能占据同一垒包');lead=dest;}
}
function replace(d,a){d.actions=d.actions.filter(x=>x.id!==a.id);d.actions.push(a);}
export function fairDialog(g,ctx){
 const {btn,esc,name}=ctx,d=g.draft,s=replay(g),q=queue(s,d);
 const opts=value=>s.teams[1-s.side].lineup.filter(isDefender).map(p=>`<option value="${esc(p.id)}" ${p.id===value?'selected':''}>${p.pos} · ${esc(name(p.id))}</option>`).join('');
 if(!d.phase||d.phase==='contact')return `<section class="fair-input"><h2>Fair · 界内球</h2><label>击球位置</label>${zones.map(row=>`<div class="fair-row" style="--count:${row.length}">${row.map(z=>btn(z,'fairZone',`data-value="${z}" aria-pressed="${d.location===z}"`,d.location===z?'selected':'')).join('')}</div>`).join('')}<hr><label>球路</label><div class="fair-row" style="--count:4">${Object.entries(trajectories).map(([k,v])=>btn(v.replace('球',''),'fairTrajectory',`data-value="${k}" aria-pressed="${d.trajectory===k}"`,d.trajectory===k?'selected':'')).join('')}</div><hr><label>处理结果</label><div class="fair-row" style="--count:4">${Object.entries(outcomes).map(([k,v])=>btn(v,'fairResult',`data-value="${k}" aria-pressed="${d.result===k}"`,d.result===k?'selected':'')).join('')}${btn('场地规则','fairAwardMenu','aria-expanded="'+!!d.awardOpen+'"',d.awardOpen?'selected':'')}</div>${d.awardOpen?`<div class="fair-overlay"><div class="fair-bubble" role="dialog" aria-label="场地规则"><h3>场地规则</h3><div class="fair-awards">${[1,2,3,4].map(n=>btn('场地规则'+['','一垒安打','二垒安打','三垒安打','本垒打'][n],'fairAward',`data-n="${n}"`)).join('')}</div>${btn('返回','fairAwardMenu','','ghost wide')}</div></div>`:''}<label>处理球员（按位置预选，可更改）</label><select data-contact-fielder>${opts(d.fielder)}</select><p class="fair-preview" aria-live="polite">${esc(contactText(d)||'选择位置、球路和处理结果')}${d.result==='error'?' · '+esc(name(d.fielder))+' 记 E':''}</p>${btn('确认本球','fairStart','','primary wide')}</section>`;
 if(d.phase==='review')return null;
 if(d.runnerForm){const f=d.runnerForm,r=q.find(r=>r.id===f.id),at=current(r,d),limit=advanceLimit(s,d.actions,r.id)-(at-r.from);
 return `<h2>${esc(name(f.id))} · ${f.mode==='error'?'失误进垒':f.mode==='force'?'封杀':'触杀'}</h2>${f.mode==='error'?`<p>从${['打击区','一垒','二垒','三垒','本垒'][at]}继续进垒</p><label>失误进垒数量</label><select id="fairErrorBases">${Array.from({length:Math.max(0,limit)},(_,i)=>`<option value="${i+1}">${i+1} 个垒</option>`).join('')}</select>`:f.mode==='force'?`<label>封杀垒包</label><select id="fairOutBase">${forceBases(s,f.id,d.result).map(n=>`<option value="${n}">${['','一垒','二垒','三垒','本垒'][n]}</option>`).join('')}</select>`:''}<label>${f.mode==='error'?'失误球员':'完成刺杀的球员'}</label><select id="fairPlayer">${opts(d.fielder)}</select>${f.mode!=='error'&&s.o+(d.result==='catch'?1:0)+d.actions.filter(a=>['force','tag'].includes(a.mode)).length>=2?'<label>得分与第三出局的先后</label><select id="fairTiming"><option value="after">出局在先 / 未确认得分在先</option><option value="before">跑者先回本垒</option></select>':''}<div class="row">${btn('返回','fairFormCancel')}${btn('确认','fairFormSave',f.mode==='error'&&limit<=0?'disabled':'','primary')}</div>`;
 }
 return runningScene(s,d,ctx);

}
function runningScene(s,d,{btn,esc,name}){
 const q=queue(s,d);
 const token=r=>{const dest=current(r,d),p=points[dest];return `<button class="runner-token ${dest===4?'scored-token':''}" data-runner="${esc(r.id)}" data-action="fairRunner" data-id="${esc(r.id)}" style="--runner-color:${colors[r.from]};${dest===4?'':`left:${p[0]}%;top:${p[1]-8}%`}" title="${esc(name(r.id))}" aria-label="${esc(name(r.id))}，${['打者','一垒','二垒','三垒','得分'][dest]}">${esc(name(r.id))}</button>`;};
 const alive=r=>!['force','tag'].includes(d.actions.find(a=>a.id===r.id)?.mode);
 const path=(r,start,end,dashed)=>{const radius=34+(r.from-1.5)*6;return end>start?`<polyline points="${Array.from({length:end-start+1},(_,i)=>points[start+i].map(v=>50+(v-50)*radius/34).join(',')).join(' ')}" fill="none" stroke="${colors[r.from]}" stroke-width="3.3" ${dashed?'stroke-dasharray="2 1"':''}/>`:'';};
 return `<h2>更新垒上情况</h2><p class="fair-caption">拖动至垒包、本垒或得分框；点击球员记录出局或失误。</p><div class="running-board"><div class="running-field"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 84L84 50L50 16L16 50Z" fill="#d9bd8d" stroke="#faf6e8" stroke-width="1"/>${q.map(r=>{const a=d.actions.find(a=>a.id===r.id),normal=r.from+(a?.advance||0);return path(r,r.from,normal,false)+path(r,normal,current(r,d),true);}).join('')}</svg>${points.slice(1).map(([x,y],i)=>`<div class="running-base" data-base="${i+1}" aria-label="${['一垒','二垒','三垒','本垒'][i]}" style="left:${x}%;top:${y}%"></div>`).join('')}${q.filter(r=>alive(r)&&current(r,d)<4).map(token).join('')}</div><div class="run-score-box" data-score-box aria-label="得分框"><b>得分</b><div class="scored-runners">${q.filter(r=>alive(r)&&current(r,d)===4).map(token).join('')}</div></div></div>${d.selectedRunner?`<div class="fair-overlay"><div class="fair-bubble runner-popover" role="dialog" aria-label="跑者操作"><b>${esc(name(d.selectedRunner))}</b><div class="fair-row" style="--count:3">${[['force','封杀'],['error','失误进垒'],['tag','触杀']].map(([k,v])=>btn(v,'fairForm',`data-mode="${k}"`)).join('')}</div>${btn('返回','fairRunnerClose','','ghost wide')}</div></div>`:''}<div class="runner-legend">${q.map(r=>`<span style="color:${colors[r.from]}">● ${['打者','一垒出发','二垒出发','三垒出发'][r.from]} ${esc(name(r.id))}${alive(r)?'':'（出局）'}</span>`).join('')}</div><div class="row fair-run-actions">${btn('重置','fairReset')}${btn('确认','fairConfirm','','primary')}</div>`;
}
export function handleFair(a,v,g,$){
 if(!a.startsWith('fair'))return false;
 const d=g.draft,s=replay(g);
 if(a==='fairZone'){d.location=v.value;d.zone=zones[0].includes(v.value)?'外野':'内野';d.fielder=s.teams[1-s.side].lineup.find(p=>p.pos===defaults[zones.flat().indexOf(v.value)])?.id;}
 if(a==='fairTrajectory')d.trajectory=v.value;
 if(a==='fairResult'){d.result=v.value;d.awardOpen=false;}
 if(a==='fairAwardMenu')d.awardOpen=!d.awardOpen;
 if(a==='fairStart'||a==='fairAward'){
  if(!d.location||!d.trajectory)throw Error('请先选择击球位置和球路');
  if(a==='fairAward'){d.awardBases=+v.n;d.result='stop';d.actions=runnerQueue(s).map(r=>({id:r.id,mode:'advance',advance:Math.min(+v.n,4-r.from)}));d.phase='review';}
  else {if(!d.result||!d.fielder)throw Error('请选择处理结果和处理球员');replay(g,true);d.phase='runners';d.actions=[];}
 }
 if(a==='fairRunnerClose')d.selectedRunner=null;
 if(a==='fairRunner')d.selectedRunner=d.selectedRunner===v.id?null:v.id;
 if(a==='fairForm')d.runnerForm={id:d.selectedRunner,mode:v.mode};
 if(a==='fairFormCancel'){d.runnerForm=null;d.selectedRunner=null;}
 if(a==='fairReset'){d.actions=[];d.selectedRunner=null;d.runnerForm=null;}
 if(a==='fairMove'){
  const r=queue(s,d).find(r=>r.id===v.id),dest=+v.base,old=d.actions.find(a=>a.id===r.id);
  if(dest<r.from)throw Error('不能退到出发垒之前');
  if(dest===r.from)d.actions=d.actions.filter(a=>a.id!==r.id);
  else {
   const total=dest-r.from,normal=d.result==='error'&&!r.from?0:old?.errorAdvance?Math.min(old.advance||0,total):total;
   replace(d,{id:r.id,mode:'advance',advance:normal,errorAdvance:total-normal,errorFielder:total>normal?(old?.errorFielder||d.fielder):undefined});
  }
  validateOrder(s,d);d.selectedRunner=null;
 }
 if(a==='fairFormSave'){
  const f=d.runnerForm,r=queue(s,d).find(r=>r.id===f.id),old=d.actions.find(a=>a.id===r.id);
  if(f.mode==='error'){
   if(old?.errorAdvance)throw Error('该跑者已记录失误进垒，请重置后调整');
   const n=+$('#fairErrorBases').value;if(!n)throw Error('没有可进垒的空间');
   replace(d,{id:r.id,mode:'advance',advance:current(r,d)-r.from,errorAdvance:n,errorFielder:$('#fairPlayer').value});validateOrder(s,d);
  }else{
   if($('#fairTiming'))for(const a of d.actions)a.beforeThird=$('#fairTiming').value==='before';
   replace(d,{...old,id:r.id,mode:f.mode,base:f.mode==='force'?+$('#fairOutBase').value:null,putout:$('#fairPlayer').value,safeBases:current(r,d)-r.from});
  }
  d.runnerForm=null;d.selectedRunner=null;
 }
 if(a==='fairConfirm'){
  validateOrder(s,d);
  for(const r of queue(s,d))if(!d.actions.some(a=>a.id===r.id)&&r.from)d.actions.push({id:r.id,mode:'advance',advance:0});
  const shown=replay(g,true);
  if(!shown.halfEnded&&queue(s,d).some(r=>!d.actions.some(a=>a.id===r.id)))throw Error('请拖动打者到达垒包，或记录出局');
  Object.assign(g,settleContact(g));g.draft.phase='review';replay(g,true);
 }
 return true;
}
export function installRunnerDrag(action){
 let drag=null,suppress=false;
 document.addEventListener('pointerdown',e=>{const token=e.target.closest('[data-runner]');if(!token)return;drag={id:token.dataset.runner,x:e.clientX,y:e.clientY,token,field:token.closest('.running-board').querySelector('.running-field'),score:token.closest('.running-board').querySelector('[data-score-box]'),moved:false};token.setPointerCapture?.(e.pointerId);});
 document.addEventListener('pointermove',e=>{if(!drag)return;if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>6)drag.moved=true;if(drag.moved){e.preventDefault();const base=drag.token.classList.contains('scored-token')?'0px':'-50%';drag.token.style.transform=`translate(calc(${base} + ${e.clientX-drag.x}px),calc(${base} + ${e.clientY-drag.y}px))`;}});
 document.addEventListener('pointerup',e=>{if(!drag)return;const d=drag;drag=null;d.token.style.transform='';if(!d.moved)return;suppress=true;setTimeout(()=>suppress=false,350);const score=d.score.getBoundingClientRect();if(e.clientX>=score.left&&e.clientX<=score.right&&e.clientY>=score.top&&e.clientY<=score.bottom){action('fairMove',{id:d.id,base:4});return;}const box=d.field.getBoundingClientRect(),x=(e.clientX-box.left)/box.width*100,y=(e.clientY-box.top)/box.height*100;const candidates=points.map(([px,py],i)=>({base:i,distance:Math.hypot(px-x,py-y)})).filter(p=>p.base>0).sort((a,b)=>a.distance-b.distance);if(candidates[0].distance<23)action('fairMove',{id:d.id,base:candidates[0].base});});
 document.addEventListener('pointercancel',()=>{if(drag)drag.token.style.transform='';drag=null;});
 document.addEventListener('click',e=>{if(suppress&&e.target.closest('[data-runner]')){e.preventDefault();e.stopImmediatePropagation();suppress=false;}},true);
}
