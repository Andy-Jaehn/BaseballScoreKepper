import { specialNames } from './special-engine.js';
import { throwingPathLabel } from './throwing-path.js';
import {replay} from './engine.js';
export const pitchLabel=k=>specialNames[k]||({ball:'B',strike:'S',foul:'Foul',contact:'Fair',hbp:'HBP',ibb:'IBB',awardWalk:'判罚保送',advanceAward:'判罚进垒',runnerOut:'判罚出局',eject:'驱逐'})[k]||k;
export function plateRecords(g){
 const s=replay(g,true), records=[];
 for(const l of s.log){let r=records.at(-1);if(!r||r.pa!==l.pa||r.side!==l.side||r.inning!==l.inning){r={pa:l.pa,side:l.side,inning:l.inning,slot:l.slot,logs:[]};records.push(r);}r.logs.push(l);r.complete=r.logs.some(x=>x.terminal);r.startedAt=r.logs[0].paStartedAt||r.logs[0].time;r.endedAt=r.complete?(l.completedAt||l.time):l.o>=3?l.time:null;}
 for(let i=0;i<records.length;i++){const r=records[i];if(!r.endedAt&&records[i+1])r.endedAt=records[i+1].startedAt;if(!r.endedAt&&g.ended)r.endedAt=g.endedAt;}
 return records;
}
export function resultLines(l,person){
 if(!l)return [];const p=l.play||{},actions=p.actions||[],runs=p.runs||[],outs=p.outs||[],bases=l.afterBases||[];
 const queue=[...(l.beforeBases||[]).slice().sort((a,b)=>b.from-a.from),{id:l.batter,from:0}],lines=[];
 for(const r of queue){const a=actions.find(x=>x.id===r.id),o=outs.find(x=>x.id===r.id),dest=bases.findIndex(x=>x?.id===r.id)+1,scored=runs.some(x=>x.id===r.id);let text='';
 if(o)text=o.mode==='force'?(['','一垒','二垒','三垒','本垒'][o.base||a?.base||1]+'处被封杀'):o.mode==='tag'?'被触杀':o.mode==='strike'?'三振出局':'被接杀 / 规则出局';
 else if(a){text=(a.advance?'进 '+a.advance+' 个垒':'停留')+(a.errorAdvance?' + 失误进 '+a.errorAdvance+' 个垒':'')+' → '+(scored?'得分':r.from+(a.advance||0)+(a.errorAdvance||0)>=4?'到本垒，得分无效':dest?dest+' 垒':'半局结束');}
 else if(scored)text='进 '+(4-r.from)+' 个垒 → 得分';
 else if(dest)text=dest===r.from?'停留在 '+dest+' 垒':'进 '+(dest-r.from)+' 个垒 → '+dest+' 垒';
 else text=l.o>=3?'半局结束，未得分':r.from?'停留在 '+r.from+' 垒':'继续打击';
 lines.push('（'+(r.from?r.from+' 垒跑者':'打者')+' '+person(r.id)+'）'+text);
 }
 const list=ids=>[...new Set(ids)].map(person).join('，')||'无';
 if(l.pickoffBase)lines.push('牵制垒包：'+l.pickoffBase+' 垒');
 for(const a of outs){if(a.putout)lines.push('完成刺杀：'+person(a.putout));if(a.assist&&a.assist!==a.putout)lines.push('发动阻盗 / 助杀：'+person(a.assist));}
 if(runs.length)lines.push('R：'+list(runs.map(r=>r.id)));
 const errs=actions.filter(a=>a.errorAdvance).map(a=>a.errorFielder);if(l.errorFielder)errs.push(l.errorFielder);
 if(errs.length)lines.push('E：'+list(errs));
 if(['SH','SF'].includes(l.result))lines.push('SAC：'+person(l.batter)+'（'+(l.result==='SH'?'牺牲触击':'牺牲飞球')+'）；推进跑者：'+list(actions.filter(a=>a.from&&a.advance).map(a=>a.id)));
 if(p.dp)lines.push('DP：双杀');if(p.tp)lines.push('TP：三杀');if(p.hitBases)lines.push((p.hitBases===4?'HR':p.hitBases+'B')+'：'+person(l.batter));
 if(l.throwingPath)lines.push('传球路径：'+l.throwingPath+' · '+throwingPathLabel(l.throwingPath));
 if(p.rbi)lines.push('RBI：'+p.rbi);if(l.creditedBatter&&l.creditedBatter!==l.batter)lines.push('三振及打数归属：'+person(l.creditedBatter));return lines;
}
export function recordSheets(g,person){const records=plateRecords(g);return [{name:'比赛环境',rows:[['温度（℃）',g.temperature||''],['天气',g.weather||''],['地点',g.location||'']]},{name:'换人换位记录',rows:[['时间','局','球队','类型','打序','换出 / 球员','换入 / 另一球员','位置变化','球数 / 垒位'],...substitutionRows(g,person)]},{name:'打击席位',rows:[['球队','打序席位','球员及背号','守备位置','入场方式'],...lineupRows(g,person)]},{name:'逐打席记录',rows:[['打席','球队','局','打序席位','打者（依次）','状态','结果','开始时间','结束时间','传球路径'],...records.map((r,i)=>[i+1,g.teams[r.side].name,r.inning+(r.side?'下':'上'),r.slot,[...new Set(r.logs.map(l=>l.batter))].map(person).join(' → '),r.complete?'已完成':'未完成',r.logs.at(-1).summary,r.startedAt||'',r.endedAt||'',r.logs.filter(l=>l.throwingPath).map(l=>l.throwingPath+' · '+throwingPathLabel(l.throwingPath)).join('；')])]},{name:'打席内投球与跑垒',rows:[['打席','球序/事件序','投手','打者','投球 / 判罚','结果','跑者及统计','时间'],...records.flatMap((r,i)=>r.logs.map((l,j)=>[i+1,j+1,person(l.pitcher),person(l.batter),pitchLabel(l.kind),l.summary,resultLines(l,person).join('；'),l.time||'']))]}];}

export function lineupRows(g,person){
 const teams=g.teams.map(t=>({...t,lineup:t.lineup.map(p=>({...p}))})),rows=[];
 teams.forEach(t=>t.lineup.forEach((p,i)=>rows.push([t.name,i+1,person(p.id),p.pos,'首发'])));
 for(const e of g.events){
 if(e.type==='sub'){const t=teams[e.team];if(e.swap!==undefined){[t.lineup[e.index].pos,t.lineup[e.swap].pos]=[t.lineup[e.swap].pos,t.lineup[e.index].pos];}else{const p=t.lineup[e.index];p.id=e.id;rows.push([t.name,e.index+1,person(p.id),p.pos,'替补']);}}
 if(e.kind==='eject'&&e.replacementId){for(const t of teams){const i=t.lineup.findIndex(p=>p.id===e.personId);if(i>=0){t.lineup[i].id=e.replacementId;rows.push([t.name,i+1,person(e.replacementId),t.lineup[i].pos,'判罚替换（原球员 '+person(e.personId)+'）']);}}}
 }return rows;
}

export function substitutionRows(g,person){return replay(g).substitutions.map(r=>[r.time||'',r.inning+' 局'+(r.side?'下':'上'),g.teams[r.team].name,r.kind,'第 '+r.slot+' 棒'+(r.otherSlot?' ↔ 第 '+r.otherSlot+' 棒':''),person(r.outId),person(r.inId||r.otherId),r.otherPosition?r.position+' ↔ '+r.otherPosition:r.position,'B '+r.balls+' / S '+r.strikes+(r.base?' · '+r.base+' 垒':'')]);}
