export const specialNames={wp:'暴投',pb:'捕逸',balk:'投手犯规',foulCatch:'界外接杀',foulDrop:'界外漏接',pickoff:'牵制',droppedThird:'不死三振',interference:'捕手妨碍打击',steal:'盗垒'};
export function applySpecial(s,g,e,h){
 const {batter,pitcher,runnerQueue,clone,add,out,run,plate,finish,reset,apply,isDefender}=h;
 if(s.halfEnded)throw Error('请先开启下个半局');
 if(!specialNames[e.kind])throw Error('未知特殊情况');
 const id=batter(s),p=e.pitcher||pitcher(s),pa=s.pa,slot=s.order[s.side]+1,paStartedAt=s.paStartedAt,beforeOut=s.o,beforeBases=runnerQueue(s).filter(r=>r.from),br={id,pitcher:p,token:s.side+':'+pa,from:0};
 const defense=s.teams[1-s.side].lineup.filter(isDefender),validFielder=id=>defense.some(f=>f.id===id),catcher=defense.find(f=>f.pos==='捕手')?.id;
 const requireFielder=id=>{if(!validFielder(id))throw Error('请选择有效的守备球员');};
 const markLast=(label)=>{const l=s.log.at(-1);l.kind=e.kind;l.summary=label+' · '+l.summary;l.special=true;};
 if(e.kind==='balk'&&!beforeBases.length){add(s,p,'BK');apply(s,g,{...e,type:'pitch',kind:'ball',countsAsNonPitch:true});markLast('投手犯规（无人上垒，记一个坏球）');return;}
 if(e.kind==='droppedThird'&&s.s!==2)throw Error('不死三振仅可在两好球时记录');
 if(e.kind==='foulDrop'){
  requireFielder(e.errorFielder);add(s,e.errorFielder,'F_FOUL_E');apply(s,g,{...e,type:'pitch',kind:'foul',twoStrikeFoulOut:false,foulErrorFielder:e.errorFielder});markLast('界外漏接');return;
 }
 let result='SPECIAL',summary=specialNames[e.kind],terminal=false,actions=[],runs=[],outs=[],errors=new Set();
 let queue=beforeBases.slice(),source=e.actions||[];
 if(['wp','pb'].includes(e.kind)){
  if(!beforeBases.length)throw Error('当前没有垒上跑者');
  add(s,p,'P');add(s,id,'NP');if(e.kind==='wp')add(s,p,'WP');else {if(!catcher)throw Error('请指定捕手');add(s,catcher,'PB');}
 }
 if(e.kind==='balk'){add(s,p,'BK');source=queue.map(r=>({id:r.id,mode:'advance',advance:1}));}
 if(e.kind==='pickoff'){
  const target=beforeBases.find(r=>r.from===e.base);if(!target)throw Error('请选择有跑者的牵制垒包');
  if(e.putout&&e.errorFielder)throw Error('牵制出局与牵制失误不能同时填写');
  add(s,p,'PICK');
  if(e.putout){requireFielder(e.putout);source=queue.map(r=>r.id===target.id?{id:r.id,mode:'tag',putout:e.putout,assist:p}:{id:r.id,mode:'advance',advance:0});}
  else if(e.errorFielder){requireFielder(e.errorFielder);errors.add(e.errorFielder);}
  else source=queue.map(r=>({id:r.id,mode:'advance',advance:0}));
 }
 if(e.kind==='steal'&&!beforeBases.length)throw Error('当前没有垒上跑者');
 if(e.kind==='droppedThird'){
  add(s,id,'D3K');if(e.cause==='pb'){if(!catcher)throw Error('请指定捕手');add(s,catcher,'PB');summary='捕逸 · 不死三振';}
  queue=[...queue,br];terminal=true;result='SO';plate(s,id,p,'SO');add(s,p,'P');add(s,id,'NP');add(s,p,'STR');
 }
 if(e.kind==='foulCatch'){
  requireFielder(e.fielder);terminal=true;result='OUT';plate(s,id,p,result);add(s,p,'P');add(s,id,'NP');add(s,p,'STR');out(s,p,e.fielder);outs.push({...br,mode:'catch',putout:e.fielder});
  source=queue.map(r=>({id:r.id,mode:'advance',advance:0}));
 }
 if(e.kind==='interference'){
  if(!catcher)throw Error('请指定捕手');errors.add(catcher);terminal=true;result='CI';plate(s,id,p,result);add(s,id,'CI');add(s,catcher,'F_CI');
  let forced=true;const advances=new Map();for(let base=1;base<=3;base++){if(!s.bases[base-1])forced=false;advances.set(base,forced?1:0);}
  queue=[...queue,br];source=queue.map(r=>({id:r.id,mode:'advance',advance:r.from?advances.get(r.from):1}));
 }
 const pitchBall=e.kind==='wp'||(e.kind==='pb'&&e.pitchResult!=='strike');
 if(pitchBall)s.b++;
 if(e.kind==='pb'&&e.pitchResult==='strike'){if(s.s>=2)throw Error('第三好球捕逸请使用不死三振');s.s++;add(s,p,'STR');}
 const walk=pitchBall&&s.b>=4;
 const forcedBase=r=>walk&&Array.from({length:r.from},(_,i)=>s.bases[i]).every(Boolean);
 if(walk){terminal=true;result='BB';plate(s,id,p,'BB');summary+=' · 四坏球保送';}
 const dest=new Map();let limit=4;
 for(const r of queue){
  if(s.o>=3){actions.push({...r,mode:'inningEnd'});continue;}
  const a=source.find(a=>a.id===r.id);if(!a)throw Error('请逐个确认所有跑者');
  if(a.mode==='tag'){
   requireFielder(a.putout);if(e.kind==='steal'&&!defense.some(f=>f.id===a.assist&&['投手','捕手'].includes(f.pos)))throw Error('请选择发动阻盗的投手或捕手');
   if(a.assist)requireFielder(a.assist);
   out(s,p,a.putout);if(a.assist&&a.assist!==a.putout)add(s,a.assist,'A');
   if(e.kind==='steal')add(s,r.id,'CS');outs.push({...r,...a});actions.push({...r,...a});
   if(s.o===3&&!a.runsBeforeThird){for(const run of runs){add(s,run.id,'R',-1);add(s,run.pitcher,'RA',-1);s.score[s.side].R--;s.lines[s.side][s.inning-1]--;}runs=[];}
   continue;
  }
  if(a.mode!=='advance')throw Error('无效跑者处理');
  const advance=Number(a.advance||0),errorAdvance=Number(a.errorAdvance||0),to=r.from+advance+errorAdvance;
  if(!Number.isInteger(advance)||!Number.isInteger(errorAdvance)||advance<0||errorAdvance<0||to>4||to>limit)throw Error('跑者不能重叠、越过前位跑者或超过本垒');
  if(forcedBase(r)&&advance<1)throw Error('第四坏球时受迫跑者至少正常前进一垒');
  if(!r.from&&to<1)throw Error('不死三振打者至少到达一垒');
  if(errorAdvance){requireFielder(a.errorFielder);errors.add(a.errorFielder);}
  const action={...r,...a,advance,errorAdvance};
  // Passed balls and recorded errors never advance the error-free reconstruction.
  if(e.kind==='pb'||e.cause==='pb')action.shadowAdvance=forcedBase(r)?1:0;
  if(e.kind==='interference')action.shadowAdvance=0;
  actions.push(action);
  if(e.kind==='steal'&&advance>0)add(s,r.id,'SB',advance);
  if(to===4){run(s,r);runs.push({...r});}else{dest.set(to,{...r});limit=to-1;}
 }
 if(source.some(a=>!queue.some(r=>r.id===a.id))||new Set(source.map(a=>a.id)).size!==source.length)throw Error('跑者记录无效或重复');
 for(const f of errors){add(s,f,'E');s.score[1-s.side].E++;}
 if(walk){actions.push({...br,mode:'advance',advance:1,errorAdvance:0});if(s.o<3)dest.set(1,br);}
 s.bases=[1,2,3].map(n=>dest.get(n)||null);
 const attempts=e.kind==='steal'?actions.filter(a=>a.mode==='tag'||a.advance>0).length:0;
 if(e.kind==='steal'&&!attempts&&!actions.some(a=>a.errorAdvance))throw Error('请记录至少一位跑者的盗垒尝试');
 if(attempts>=2){summary='双盗垒';for(const a of actions.filter(a=>a.advance>0))add(s,a.id,'DS');}
 if(terminal)finish(s,g,e.completedAt||e.time);
 else if(s.o>=3){s.o=3;s.halfEnded=true;s.bases=[null,null,null];reset(s,g);}
 const batterAction=actions.find(a=>a.from===0),play={result,actions,runs,outs,rbi:0,batter:terminal?br:null,batterOut:outs.some(o=>o.from===0),reachedError:e.kind==='droppedThird'&&(!!batterAction?.errorAdvance||e.cause==='pb')};
 if(walk){play.specialWalk=true;const forcedRun=beforeBases.length===3&&runs.some(r=>r.id===beforeBases.find(r=>r.from===3)?.id);if(forcedRun){play.rbi=1;add(s,id,'RBI');}}
 if(e.kind==='interference')play.interference=true;
 if(runs.length)summary+=' · '+runs.length+' 得分';if(outs.length)summary+=' · '+outs.length+' 出局';if(errors.size)summary+=' · '+errors.size+' E';
 if(e.kind==='pickoff')summary+=' · '+e.base+' 垒牵制'+(e.putout?'出局':e.errorFielder?'失误':'尝试');
 s.log.push({id:e.id,pa,slot,paStartedAt,completedAt:terminal?(e.completedAt||e.time):null,inning:s.inning,side:s.side,defense:1-s.side,pitcher:p,batter:id,kind:e.kind,isPitch:e.isPitch,summary,result,terminal,b:s.b,s:s.s,o:s.o,beforeOut,beforeBases,afterBases:clone(s.bases),play,time:e.time,special:true,errorFielder:e.errorFielder|| (e.kind==='interference'?catcher:null),pickoffBase:e.base,putout:e.putout});
}
