import {replay,rates,emptyStats,batter,runnerQueue} from './engine.js';
import {statLabel,teamIds,BATTING,FIELDING,PITCHING} from './statistics.js';
export function officialFields(setup,players,esc){
 return '<section class="card officials"><h3>比赛工作人员</h3>'+[['scorerId','记录者'],['umpireId','裁判']].map(([key,label])=>'<label>'+label+'</label><button data-action="pickOfficial" data-role="'+key+'" class="wide">'+esc(players.find(p=>p.id===setup[key])?.name||'搜索并选择'+label)+'</button>').join('')+'<small class="muted">记录者与裁判可以是同一人，也可以参与比赛。</small></section>';
}
export function rulingDialog(g,ctx,players){
 const {btn,esc,name}=ctx,s=replay(g),runners=runnerQueue(s).filter(r=>r.from);
 return `<h2>裁判判罚</h2><h3>进攻方垒上跑者获判进垒</h3><div class="actions">${[1,2,3].map(n=>btn(`前进 ${n} 垒`,'rulingAdvance',`data-n="${n}"`,'primary')).join('')}</div>${btn('当前打者保送','rulingWalk','','wide')}<h3>当前跑者出局</h3><select id="penaltyRunner"><option value="">选择垒上跑者</option>${runners.map(r=>`<option value="${esc(r.id)}">${['','一垒','二垒','三垒'][r.from]} · ${esc(name(r.id))}</option>`).join('')}</select>${btn('判跑者出局','rulingOut','','danger wide')}<h3>驱逐人员</h3><select id="ejectPerson"><option value="">选择人员</option>${players.filter(p=>!p.deleted&&!s.ejected.includes(p.id)).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>${btn('驱逐并选择替换人员','rulingEject','','danger wide')}${btn('关闭','closePanel','','ghost wide')}`;
}
export function ejectDialog(g,ctx,players,id){
 const {btn,esc,name}=ctx,s=replay(g),team=s.teams.findIndex(t=>t.lineup.some(p=>p.id===id)),index=team<0?-1:s.teams[team].lineup.findIndex(p=>p.id===id);
 const officer=id===s.scorerId||id===s.umpireId;
 return `<h2>驱逐 · 替换人员</h2><p>${esc(name(id))}${team<0?'':` · 第 ${index+1} 棒 · ${esc(s.teams[team].lineup[index].pos)}`}</p><p class="muted">${team>=0?'替补继承原棒次、守备位置及垒上状态。':officer?'替换人员接任其比赛工作人员职责。':'该人员不在当前场上阵容中。'}</p>${team>=0||officer?`<label>选择替换人员</label><select id="ejectReplacement"><option value="">从注册表选择</option>${players.filter(p=>!p.deleted&&p.id!==id&&!s.ejected.includes(p.id)&&(team<0||!s.teams.some(t=>t.lineup.some(x=>x.id===p.id)))).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')}</select>`:''}${btn('查看判罚结果','ejectReady',`data-id="${esc(id)}" data-team="${team}"`,'primary wide')}${btn('返回判罚','ruling','','ghost wide')}`;
}
export function boxScore(g,ctx){
 const {esc,name}=ctx,s=replay(g,true),fmt=(v,k)=>['AVG','OBP','SLG','OPS','FPCT'].includes(k)?Number(v||0).toFixed(3):['ERA','RA9','WHIP','K/9'].includes(k)?Number(v||0).toFixed(2):v??0;
 const table=(ids,keys,st,label)=>`<h3>${label}</h3><div class="box-table"><table><thead><tr><th>球员</th>${keys.map(k=>`<th>${statLabel(k)}</th>`).join('')}</tr></thead><tbody>${ids.map(id=>`<tr><th title="${esc(name(id))}">${esc(name(id))}</th>${keys.map(k=>`<td>${fmt(st[id][k],k)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
 return `<div class="box-score">${g.teams.map((t,i)=>{
  const ids=teamIds(g,i),st=Object.fromEntries(ids.map(id=>[id,rates(s.stats[id]||emptyStats(),g.sport)])),pitchers=ids.filter(id=>st[id].P>0);
  const notes=(keys,list=ids)=>keys.map(k=>{const values=list.filter(id=>Number(st[id][k])>0).map(id=>`${name(id)} ${fmt(st[id][k],k)}`);return values.length?`<p><b>${k}</b> ${esc(values.join('；'))}</p>`:'';}).join('');
  return `<section class="box-team"><h2>${i?'主队':'客队'} · ${esc(t.name)} <strong>${s.score[i].R}</strong></h2>${table(ids,['AB','R','H','RBI','BB','SO'],st,'打击')}<div class="box-notes">${notes(['2B','3B','HR','HBP','IBB','SF','SH','GDP','SB','CS','DS','CI'])}</div><details><summary>高级打击数据</summary>${table(ids,['AVG','OBP','SLG','OPS','SB','CS','DS','CI','D3K','NP','FB','LD','IFF','GB'],st,'本场比率')}</details>${pitchers.length?table(pitchers,['IP','HA','RA','RA9','ER','BBA','K'],st,'投球')+table(pitchers,['P-S','HBPA','IBBA','ERA','K/9','WP','BK','PICK','P_FB','P_LD','P_IFF','P_GB'],st,'投球明细'):''}${table(ids,FIELDING,st,'守备')}</section>`;
 }).join('')}</div>`;
}
