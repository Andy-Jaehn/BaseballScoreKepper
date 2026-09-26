import {clone,uid,replay,POSITIONS} from './engine.js';
import {normalizeName} from './roster.js';
export const gameYear=g=>String(new Date(g.startedAt||g.created).getFullYear());
export const years=games=>[...new Set(games.map(gameYear))].sort().reverse();
export function archiveId(g){
  const a=Date.parse(g.startedAt),b=Date.parse(g.endedAt);
  if(!g.ended||!Number.isFinite(a)||!Number.isFinite(b)||b<a)throw Error('比赛开始或结束时间无效');
  return `${new Date(a).toISOString()}_${new Date(b).toISOString()}`;
}
function refs(g){
  const set=new Set();const add=id=>{if(id)set.add(id);};
  g.teams.forEach(t=>{t.lineup.forEach(p=>add(p.id));add(t.pitcherId);});add(g.scorerId);add(g.umpireId);
  for(const e of g.events){if((e.type==='sub'&&e.swap===undefined)||e.type==='pitchingSub')add(e.id);for(const k of ['pitcher','fielder','putout','errorFielder','thirdOutId','runnerId','personId','replacementId','foulErrorFielder'])add(e[k]);for(const a of e.actions||[]){add(a.id);add(a.putout);add(a.errorFielder);add(a.assist);}for(const credit of e.fieldingCredits||[])add(credit.id);}
  return set;
}
export function exportArchive(db,selectedYears,byGame=false){
  const games=db.games.filter(g=>g.ended&&selectedYears.includes(byGame?g.id:gameYear(g))).map(g=>({...clone(g),archiveId:archiveId(g),substitutions:replay(g).substitutions,draft:null,pendingPitch:null,specialDraft:null}));
  if(!games.length)throw Error('所选范围没有已完成的比赛');
  const ids=new Set(games.flatMap(g=>[...refs(g)]));
  return {format:'diamond-notebook',version:1,exportedAt:new Date().toISOString(),players:db.players.filter(p=>ids.has(p.id)).map(clone),games};
}
export function importArchive(db,text){
  if(text.length>20*1024*1024)throw Error('JSON 文件过大（上限 20 MB）');
  const data=JSON.parse(text);
  if(data.format!=='diamond-notebook'||data.version!==1||!Array.isArray(data.games)||!Array.isArray(data.players))throw Error('不是有效的钻石记分比赛文件');
  const next=clone(db),existing=new Set(next.games.filter(g=>g.ended).map(archiveId)),added=[],restored=[],map=new Map(),incoming=new Map();
  for(const p of data.players){if(typeof p.id!=='string'||!p.id||typeof p.name!=='string'||!p.name.trim()||p.name.length>100||incoming.has(p.id))throw Error('球员信息无效或重复');incoming.set(p.id,p);}
  const playerDetails=[],gameDetails=[];
  let count=0,skipped=0;
  for(const raw of data.games){
    const g=clone(raw),key=archiveId(g);
    if(g.archiveId!==key)throw Error('比赛身份与开始/结束时间不一致');
    const gameDetail={teams:g.teams?.map(t=>t.name).join(' vs ')||'比赛',startedAt:g.startedAt};
    if(existing.has(key)){skipped++;gameDetails.push({...gameDetail,status:'skipped'});continue;}
    if(!['baseball','softball'].includes(g.sport)||!Array.isArray(g.teams)||g.teams.length!==2||!Array.isArray(g.events)||g.events.length>100000)throw Error('比赛结构无效');
    for(const t of g.teams)if(typeof t.name!=='string'||!Array.isArray(t.lineup)||t.lineup.length<2||t.lineup.some(p=>!POSITIONS.includes(p.pos)))throw Error('球队阵容无效');
    for(const e of g.events)if(!['pitch','sub','pitchingSub','half','ruling','special'].includes(e.type))throw Error('未知比赛事件');
    for(const id of refs(g)){
      if(map.has(id))continue;
      const p=incoming.get(id);if(!p)throw Error('文件缺少比赛所需的球员信息');
      // Identity is name-only; keep the existing profile even when kit or handedness differs.
      let local=next.players.find(x=>normalizeName(x.name)===normalizeName(p.name));
      const status=!local?'added':local.deleted?'restored':'merged';
      if(!local){local={id:uid(),name:p.name.trim(),number:String(p.number||'').slice(0,8),bats:['L','R','S'].includes(p.bats)?p.bats:'R',throws:['L','R'].includes(p.throws)?p.throws:'R'};next.players.push(local);added.push(local.name);}
      else if(local.deleted){local.deleted=false;restored.push(local.name);}
      const differences=['name','number','bats','throws'].filter(k=>String(p[k]??'')!==String(local[k]??'')).map(field=>({field,incoming:String(p[field]??''),local:String(local[field]??'')}));
      playerDetails.push({incomingId:id,localId:local.id,incomingName:p.name,localName:local.name,status,differences});
      map.set(id,local.id);
    }
    const remap=(o,k)=>{if(o[k])o[k]=map.get(o[k]);};
    for(const t of g.teams){for(const p of t.lineup)remap(p,'id');remap(t,'pitcherId');}
    remap(g,'scorerId');remap(g,'umpireId');
    for(const e of g.events){if((e.type==='sub'&&e.swap===undefined)||e.type==='pitchingSub')remap(e,'id');for(const k of ['pitcher','fielder','putout','errorFielder','thirdOutId','runnerId','personId','replacementId','foulErrorFielder'])remap(e,k);for(const a of e.actions||[]){remap(a,'id');remap(a,'putout');remap(a,'errorFielder');remap(a,'assist');}for(const credit of e.fieldingCredits||[])remap(credit,'id');}
    const lineup=g.teams.flatMap(t=>[...t.lineup.map(p=>p.id),t.pitcherId].filter(Boolean));if(new Set(lineup).size!==lineup.length)throw Error('同名映射导致阵容重复，请核对球员姓名');
    g.id=uid();g.draft=null;g.pendingPitch=null;g.specialDraft=null;g.rulesVersion=2;
    const state=replay(g);g.substitutions=clone(state.substitutions);for(const st of Object.values(state.stats))for(const v of Object.values(st))if(!Number.isFinite(v)||v<0)throw Error('比赛统计无效');
    next.games.push(g);existing.add(key);count++;gameDetails.push({...gameDetail,status:'added'});
  }
  return {db:next,count,skipped,added,restored,playerDetails,gameDetails};
}
export function downloadJson(data,name){
  const text=JSON.stringify(data,null,2);
  if(window.AndroidStore){window.AndroidStore.exportJson(name,text);return;}
  const url=URL.createObjectURL(new Blob([text],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
}
