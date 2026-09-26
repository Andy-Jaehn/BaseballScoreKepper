import {fairDialog} from './fair-ui.js';
import { specialNames } from './special-engine.js';
import { throwingPathLabel } from './throwing-path.js';
import {plateRecords,resultLines,pitchLabel} from './plate-records.js';
import {
  batter,
  isDefender,
  pitcher,
  replay,
  rates,
  emptyStats,
  runnerQueue,
  advanceLimit,
  forceBases,
  inningBatting,
  canUndo,
} from "./engine.js";
const zoneNames = ["左外", "左中外", "中外", "右中外", "右外"];
export function field(s, landing = false) {
  const pt = (a) => [
    220 + Math.sin((a * Math.PI) / 180) * 290,
    330 - Math.cos((a * Math.PI) / 180) * 290,
  ];
  return `<svg class="diamond-field" viewBox="0 0 440 365" role="img" aria-label="90度棒球场，三个垒包：红色有人，空心无人"><rect width="440" height="365" fill="transparent" />${zoneNames
    .map((z, i) => {
      const a = pt(-45 + i * 18),
        b = pt(-27 + i * 18);
      return `<path d="M220 330L${a}A290 290 0 0 1 ${b}Z" fill="${i % 2 ? "#355b49" : "#2e5141"}" stroke="#8bad8e" stroke-width="1.5" ${landing ? `data-zone="${z}"` : ""}/>`;
    })
    .join(
      "",
    )}<path d="M220 330L300 250L220 170L140 250Z" fill="#927650" stroke="#c5ae85" stroke-width="2" ${landing ? 'data-zone="内野"' : ""}/><path d="M14.94 124.94L220 330L425.06 124.94" fill="none" stroke="#f4edd8" stroke-width="2" pointer-events="none"/><circle cx="220" cy="250" r="5" fill="#d8c3a0" pointer-events="none"/>${[
    [300, 250, s.bases[0]],
    [220, 170, s.bases[1]],
    [140, 250, s.bases[2]],
  ]
    .map(
      ([x, y, r]) =>
        `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="2" transform="rotate(45 ${x} ${y})" fill="${r ? "#ff203f" : "#655137"}" stroke="white" stroke-width="4" pointer-events="none"/>`,
    )
    .join(
      "",
    )}<path d="M215 326H225V332L220 337L215 332Z" fill="white" pointer-events="none"/></svg>`;
}
export function score(s, ended, esc, players = "") {
  const innings = Math.max(9, s.inning);
  return `<section class="score match-score"><div class="inning-board"><table><thead><tr><th>球队</th>${Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${s.teams.map((t, i) => `<tr><th title="${esc(t.name)}">${i ? "主" : "客"} ${esc(t.name)}</th>${Array.from({ length: innings }, (_, j) => `<td class="${s.inning === j + 1 && s.side === i ? "current" : ""}">${s.lines[i][j] ?? "–"}</td>`).join("")}<td><b>${s.score[i].R}</b></td><td>${s.score[i].H}</td><td>${s.score[i].E}</td></tr>`).join("")}</tbody></table></div><div class="score-details">${players}<div class="inning-indicator" aria-label="${s.inning} 局${s.side ? '下' : '上'}"><b>${s.inning}</b><span><i class="half-up ${s.side===0 ? 'lit' : ''}"></i><i class="half-down ${s.side===1 ? 'lit' : ''}"></i></span></div><div class="lamp-counts">${[
    ["B", 3, s.b],
    ["S", 2, s.s],
    ["O", 2, s.o],
  ]
    .map(
      ([k, n, v]) =>
        `<div aria-label="${k} ${v}"><b>${k}</b><span>${Array.from({ length: n }, (_, i) => `<i class="lamp ${i < v ? "on " + k : ""}"></i>`).join("")}</span></div>`,
    )
    .join("")}</div></div></section>`;
}
export function matchView(g,ctx){
 const {esc,name,btn,career}=ctx,s=replay(g),b=batter(s),p=pitcher(s),next=s.teams[s.side].lineup[(s.order[s.side]+1)%s.teams[s.side].lineup.length].id;
 const batting=id=>{const logs=s.log.filter(l=>l.terminal&&(l.creditedBatter||l.batter)===id),hits=logs.filter(l=>l.result==='H').length,tags=logs.map(l=>l.result==='H'?(l.play.hitBases===4?'HR':l.play.hitBases+'B'):l.result==='SO'?'K':l.result);return hits+'-'+logs.length+(tags.length?' '+tags.join(', '):'');};
 const batterCard=(id,label)=>'<div class="score-person"><small>'+label+'</small><b title="'+esc(name(id))+'">'+esc(name(id))+'</b><span>AVG '+(career[id]?.AVG||0).toFixed(3)+'</span><span title="'+esc(batting(id))+'">'+esc(batting(id))+'</span></div>';
 const ps=rates(s.stats[p],g.sport),cards='<div class="score-players">'+batterCard(b,'当前打者')+batterCard(next,'下一位打者')+'<div class="score-person"><small>投手</small><b title="'+esc(name(p))+'">'+esc(name(p))+'</b><span>P-S '+ps['P-S']+'</span><span>ERA '+(career[p]?.ERA||0).toFixed(2)+'</span></div></div>';
 return score(s,g.ended,esc,cards)+'<div class="live-field"><div class="field-center">'+defenseField(s,ctx)+'</div></div>'+(s.halfEnded?'<div class="half-actions"><span>三出局 · 半局结束</span><div class="row">'+btn('开启下个半局','half','','primary')+btn('结束比赛','end','','danger')+'</div></div>':'<div class="pitch-actions">'+btn('B<small>坏球</small>','pitch','data-kind="ball"')+btn('S<small>好球</small>','pitch','data-kind="strike"')+btn('Foul<small>界外</small>','pitch','data-kind="foul"')+btn('Fair<small>界内</small>','contact','','primary')+'</div><div class="special-entry">'+btn('裁判判罚','ruling')+btn('特殊情况','specialMenu')+'</div>')+'<div class="record-tools">'+btn('撤销记录','undo',canUndo(g)?'':'disabled','ghost')+btn('逐打席记录','showLog','','ghost')+'<div class="sub-tools">'+btn('守备换人','sub','','ghost')+btn('进攻换人','offenseSub','','ghost')+'</div></div><div class="last-play">'+esc(s.log.at(-1)?.summary||'准备就绪，开始记录当前打席')+'</div>';
}
export function playDialog(g,ctx){return fairDialog(g,ctx) ?? resultPanel(g,ctx);}
export function resultPanel(g,ctx){
 const {esc,btn}=ctx,last=replay(g,true).log.at(-1),pending=g.pendingPitch;
 const body='<h2>'+(pending?.type==='special'&&!last?.terminal?(specialNames[pending.kind]+'结果'):pending?.type==='ruling'?'判罚确认':'本打席结果')+'</h2><div class="result-only"><h3>'+esc((last?.summary||'').replace(/ \/ 0 RBI/g,''))+'</h3><div class="runner-summary">'+resultLines(last,id=>ctx.name(id)+' #'+(ctx.player(id)?.number||'—')).map(line=>'<p>'+esc(line)+'</p>').join('')+'</div></div>';
 if(!pending)return body+'<label for="throwingPath">传球路径（可选）</label><input id="throwingPath" type="text" inputmode="numeric" autocomplete="off" value="'+esc(g.draft?.throwingPath||'')+'" placeholder="'+(g.sport==='softball'?'输入 0–9，0 表示 10 号自由人':'输入 1–9')+'"><p id="throwingPathPreview" class="muted" aria-live="polite">'+esc(throwingPathLabel(g.draft?.throwingPath||'')||'未填写传球路径')+'</p>'+btn('确认打席结果','commitContact','','primary wide');
 return '<div class="dialog-body">'+body+'</div><div class="dialog-actions">'+btn(pending.type==='special'?'确认结果':pending.type==='ruling'?'确认判罚':['ball','ibb','hbp'].includes(pending.kind)?'确认保送':pending.kind==='foul'?'确认界外出局':'确认三振','confirmCount','','primary wide')+'<div class="row">'+btn('上一步','pendingBack','','ghost')+btn('取消本球','cancelCount','','ghost')+'</div></div>';
}
export function pitchLog(g,ctx){
 const {name,esc,btn}=ctx,s=replay(g,true),records=plateRecords(g);let index=ctx.logIndex;
 if(index==null){index=records.map((r,i)=>r.side===s.side&&r.complete?i:-1).filter(i=>i>=0).at(-1);if(index==null)index=Math.max(0,records.length-1);}
 index=Math.max(0,Math.min(index,records.length-1));const r=records[index],person=id=>name(id)+' #'+(ctx.player(id)?.number||'—');
 return '<div class="log-header"><h2>逐打席记录</h2>'+btn('关闭','closePanel','','small')+'</div><div class="row">'+btn('← 上一打席','logMove','data-index="'+(index-1)+'" '+(index<=0?'disabled':''))+'<span>'+(records.length?index+1:0)+' / '+records.length+'</span>'+btn('下一打席 →','logMove','data-index="'+(index+1)+'" '+(index>=records.length-1?'disabled':''))+'</div><div class="pitch-log-list" data-plate-index="'+index+'">'+(r?'<h3>'+esc(s.teams[r.side].name)+' · '+r.inning+' 局'+(r.side?'下':'上')+' · 第 '+r.slot+' 棒</h3><p>'+esc([...new Set(r.logs.map(l=>l.batter))].map(person).join(' → '))+' · '+(r.complete?'已完成':'未完成')+'</p><p class="muted">开始：'+esc(r.startedAt?new Date(r.startedAt).toLocaleString('zh-CN'):'—')+'<br>结束：'+esc(r.endedAt?new Date(r.endedAt).toLocaleString('zh-CN'):'进行中')+'</p><h3>'+esc(r.logs.at(-1).summary)+'</h3>'+r.logs.map((l,i)=>'<div class="log"><small>记录 '+(i+1)+' · '+esc(person(l.pitcher))+' 投球</small><b>'+pitchLabel(l.kind)+' · '+esc(l.summary)+'</b>'+resultLines(l,person).map(t=>'<p>'+esc(t)+'</p>').join('')+'</div>').join(''):'<p>尚无打席记录</p>')+'</div>';
}
export function defenseField(s,ctx){
  const positions={'左外野':[16,17],'中外野':[50,2],'右外野':[84,17],'自由人':[84,34],'游击手':[16,34],'二垒手':[50,34],'投手':[25,90],'三垒手':[16,59],'一垒手':[84,59],'捕手':[75,90]};
  return `<div class="defense-field"><svg viewBox="0 0 200 160" role="img" aria-label="内野垒包，红色表示有人"><path d="M100 140L140 100L100 60L60 100Z" fill="#927650" stroke="#c5ae85" stroke-width="2"/>${[[140,100,s.bases[0]],[100,60,s.bases[1]],[60,100,s.bases[2]]].map(([x,y,r])=>`<rect x="${x-15}" y="${y-15}" width="30" height="30" rx="2" transform="rotate(45 ${x} ${y})" fill="${r?'#ff203f':'#655137'}" stroke="white" stroke-width="4"/>`).join('')}<path d="M95 136H105V142L100 147L95 142Z" fill="white"/></svg>${Object.entries(positions).filter(([pos])=>pos!=='自由人'||ctx.sport==='softball').map(([pos,xy])=>{const p=s.teams[1-s.side].lineup.find(p=>p.pos===pos),player=p?ctx.player(p.id):null,label=p?ctx.name(p.id)+(player?.number?' #'+player.number:''):'—';return `<div class="defender-label" style="left:${xy[0]}%;top:${xy[1]}%" title="${ctx.esc(pos+' · '+label)}">${ctx.esc(label)}</div>`;}).join('')}</div>`;
}
