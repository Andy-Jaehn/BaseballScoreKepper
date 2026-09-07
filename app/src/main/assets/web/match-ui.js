import {
  batter,
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
export function score(s, ended, esc) {
  const innings = Math.max(9, s.inning);
  return `<section class="score match-score"><div class="score-caption">${s.inning} 局${s.side ? "下" : "上"} · ${ended ? "已结束" : s.halfEnded ? "半局结束" : "第 " + (s.pa + 1) + " 打席"}</div><div class="inning-board"><table><thead><tr><th>球队</th>${Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${s.teams.map((t, i) => `<tr><th title="${esc(t.name)}">${i ? "主" : "客"} ${esc(t.name)}</th>${Array.from({ length: innings }, (_, j) => `<td class="${s.inning === j + 1 && s.side === i ? "current" : ""}">${s.lines[i][j] ?? "–"}</td>`).join("")}<td><b>${s.score[i].R}</b></td><td>${s.score[i].H}</td><td>${s.score[i].E}</td></tr>`).join("")}</tbody></table></div><div class="lamp-counts">${[
    ["B", 4, s.b],
    ["S", 3, s.s],
    ["O", 3, s.o],
  ]
    .map(
      ([k, n, v]) =>
        `<div aria-label="${k} ${v}"><b>${k}</b><span>${Array.from({ length: n }, (_, i) => `<i class="lamp ${i < v ? "on " + k : ""}"></i>`).join("")}</span></div>`,
    )
    .join("")}</div></section>`;
}
export function matchView(g, ctx) {
  const { esc, name, btn, career, player } = ctx,
    s = replay(g),
    shown = replay(g, true),
    b = batter(s),
    p = pitcher(s),
    bs = inningBatting(shown, b),
    bp = career[b] || rates(emptyStats()),
    ps = rates(shown.stats[p], g.sport),
    pc = career[p] || rates(emptyStats(), g.sport),
    stat = (label, v) =>
      `<div class="mini-stat"><span>${label}</span><b>${v}</b></div>`;
  return `${score(g.pendingPitch && ['ball','strike','foul'].includes(g.pendingPitch.kind) ? {...shown, pa:s.pa, b:g.pendingPitch.kind === "ball" ? 4 : s.b, s:g.pendingPitch.kind === "ball" ? s.s : 3} : shown, g.ended, esc)}<div class="live-field"><aside class="player-panel"><small>打者 · ${player(b)?.bats || "—"} 打</small><b class="clip" title="${esc(name(b))}">${esc(name(b))}</b><small>第 ${s.inning} 局</small><div class="inning-batting clip" title="${esc(bs.text)}">${esc(bs.text)}</div>${stat("RBI", bs.RBI)}<hr><small>历史 · 不含本场</small>${stat("AVG", bp.AVG.toFixed(3))}${stat("OPS", bp.OPS.toFixed(3))}</aside><div class="field-center">${defenseField(shown, ctx)}</div><aside class="player-panel"><small>投手 · ${player(p)?.throws || "—"} 投</small><b class="clip" title="${esc(name(p))}">${esc(name(p))}</b><small>本场</small>${stat("P-S", ps["P-S"])}${stat("H / ER", ps.HA + " / " + ps.ER)}${stat("K / HBP", ps.K + " / " + ps.HBPA)}<hr><small>历史 · 不含本场</small>${stat("ERA", pc.ERA.toFixed(2))}${stat("WHIP", pc.WHIP.toFixed(2))}</aside></div>${s.halfEnded ? `<div class="half-actions"><span>三出局 · 半局结束</span><div class="row">${btn("开启下个半局", "half", "", "primary")}${btn("结束比赛", "end", "", "danger")}</div></div>` : `<div class="pitch-actions">${btn("B<small>坏球</small>", "pitch", 'data-kind="ball"')}${btn("S<small>好球</small>", "pitch", 'data-kind="strike"')}${btn("Foul<small>界外</small>", "pitch", 'data-kind="foul"')}${btn("Fair<small>界内</small>", "contact", "", "primary")}</div>`}<div class="record-tools">${btn("撤销记录", "undo", canUndo(g) ? "" : "disabled", "ghost")}${btn("逐球记录", "showLog", "", "ghost")}${btn("守备换人", "sub", "", "ghost")}</div><div class="last-play clip" title="${esc(shown.log.at(-1)?.summary || "")}">${esc(shown.log.at(-1)?.summary || "准备就绪，开始记录当前打席")}</div>`;
}
export function playDialog(g, ctx) {
  const { btn, esc, name } = ctx,
    s = replay(g),
    d = g.draft,
    fielders = s.teams[1 - s.side].lineup,
    fopts = (value) =>
      fielders
        .map(
          (p) =>
            `<option value="${p.id}" ${p.id === value ? "selected" : ""}>${p.pos} · ${esc(name(p.id))}</option>`,
        )
        .join("");
  if (!d.zone)
    return `<h2>① 球的落点</h2><div class="landing-field">${field(s, true)}</div><div class="zone-buttons">${[...zoneNames, "内野"].map((z) => btn(z, "zone", `data-value="${z}"`, "small")).join("")}</div>`;
  if (!d.trajectory)
    return `<h2>② 球的飞行方式</h2><p class="muted">落点：${d.zone}</p><div class="actions">${[
      ["fly", "高飞球"],
      ["line", "平飞球"],
      ["ground", "地滚球"],
      ["bunt", "触击球"],
    ]
      .filter(([v])=>g.sport!=="softball"||v!=="bunt")
      .map(([v, l]) => btn(l, "trajectory", `data-value="${v}"`))
      .join(
        "",
      )}</div><h3>场地规则判定</h3><div class="stack">${[1, 2, 3, 4].map((n) => btn(n === 4 ? "全垒打" : `场地规则${["", "一", "二", "三"][n]}垒安打`, "award", `data-n="${n}"`, "primary")).join("")}</div>`;
  if (!d.result)
    return `<h2>③ 野手处理</h2><label>处理球的野手</label><select id="fielder" data-contact-fielder>${fopts(d.fielder)}</select><div class="stack">${btn("接杀", "result", 'data-value="catch"', "primary")}${btn("拦截 / 传球", "result", 'data-value="stop"')}${btn("失误 E（本可使打者出局）", "result", 'data-value="error"', "gold")}${d.trajectory === "fly" && s.o < 2 && s.bases[0] && s.bases[1] ? btn("裁判宣告内野高飞球", "result", 'data-value="infieldFly"') : ""}</div>`;
  const q = runnerQueue(s).filter(
      (r) => r.from || !["catch", "infieldFly"].includes(d.result),
    ),
    r = q.find((r) => !d.actions.some((a) => a.id === r.id));
  if (d.outForm) {
    const f = d.outForm,
      shown = replay(g, true);
    return `<h2>${f.mode === "force" ? "封杀" : "触杀"} · ${esc(name(f.id))}</h2>${f.mode === "force" ? `<label>出局垒包</label><select id="outbase">${forceBases(s,f.id,d.result).map((n) => `<option value="${n}">${["", "一垒", "二垒", "三垒", "本垒"][n]}</option>`).join("")}</select>` : ""}<label>完成刺杀的野手</label><select id="putout">${fopts(d.fielder)}</select>${shown.o === 2 ? `<label>已记录的得分跑者与本次出局的先后</label><select id="outTiming"><option value="after">出局在先 / 未确认得分在先</option><option value="before">跑者先回本垒，再发生出局</option></select>` : ""}${btn("确认出局", "runnerOut", `data-id="${f.id}" data-mode="${f.mode}"`, "danger")}${btn("返回跑者", "cancelOut")}`;
  }
  if (r) {
    const limit = advanceLimit(s, d.actions, r.id),
      pending = d.pending || {},
      isError = d.result === "error" && !r.from,
      normal = pending.advance ?? (isError ? 0 : r.from ? 0 : 1),
      showError = d.errorOpen || isError;
    return `<h2>④ ${esc(name(r.id))}</h2><div class="runner-mini">${field(s)}</div><p class="muted">${r.from ? ["", "一垒", "二垒", "三垒"][r.from] : "打者"} · ${q.findIndex((x) => x.id === r.id) + 1}/${q.length}　按前位至后位处理</p><label>正常击球进垒数</label><select id="normalAdvance" data-normal-advance>${Array.from({ length: (isError?0:Math.max(0, limit)) + 1 }, (_, n) => `<option value="${n}" ${n === normal ? "selected" : ""}>${n === 0 ? "不因击球进垒" : `前进 ${n} 垒`}</option>`).join("")}</select>${btn(showError ? "取消额外失误" : "因失误进垒", "toggleError", "", "gold")}${showError ? `<div class="error-box"><label>失误野手</label><select id="errorFielder" data-error-fielder>${fopts(pending.errorFielder || d.fielder)}</select><label>额外失误进垒数（与正常进垒相加）</label><select id="errorAdvance" data-error-advance>${Array.from({ length: Math.max(0, limit - normal) }, (_, i) => `<option value="${i + 1}" ${pending.errorAdvance === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>` : ""}<div class="actions">${btn("确认跑者", "saveRunner", `data-id="${r.id}"`, "primary wide")}${btn("被封杀", "force", `data-id="${r.id}"`, "danger")}${btn("被触杀", "tag", `data-id="${r.id}"`, "danger")}</div>`;
  }
  return resultPanel(g,ctx);
}
export function resultPanel(g,ctx){
  const {esc,btn}=ctx, s=replay(g), shown=replay(g,true), last=shown.log.at(-1), pending=g.pendingPitch;
  return `<h2>${pending ? (pending.type==='ruling'?'判罚确认':'本打席结果') : '本球结果'}</h2><div class="result-only"><span class="pill">自动判定</span><h3>${esc(last?.summary)}</h3><p>R ${shown.score[s.side].R} · H ${shown.score[s.side].H} · 对方 E ${shown.score[1-s.side].E}</p><p class="muted">${pending ? '确认后应用本次结果；取消则恢复本次操作前的状态。' : '根据飞行方式、野手处理和跑垒自动计算。'}</p></div>${pending ? btn(pending.type==='ruling'?'确认判罚':['ball','ibb','hbp'].includes(pending.kind)?'确认保送':'确认三振','confirmCount','','primary wide')+btn('取消本球','cancelCount','','ghost wide') : btn('确认打席结果','commitContact','','primary wide')}`;
}
export function pitchLog(g,ctx){
  const {name,esc,btn}=ctx,s=replay(g,true);
  return `<div class="log-header"><h2>逐球记录</h2>${btn('关闭','closePanel','','small')}</div><div class="pitch-log-list">${s.log.slice().reverse().map(l=>`<div class="log"><small>${l.inning} 局${l.side?'下':'上'} · 打席 ${l.pa+1} · ${l.time?new Date(l.time).toLocaleTimeString('zh-CN'):''}</small><small>${esc(s.teams[l.defense].name)} · 投手 ${esc(name(l.pitcher))}</small><b>${({ball:'B',strike:'S',foul:'Foul',contact:'Fair',hbp:'HBP',ibb:'IBB',awardWalk:'判罚保送',advanceAward:'判罚进垒',runnerOut:'判罚出局',eject:'驱逐'})[l.kind]} · 打者 ${esc(name(l.batter))}</b><span>${esc(l.summary)}</span></div>`).join('') || '<p class="muted">尚未投球</p>'}</div>`;
}
export function defenseField(s,ctx){
  const positions={'左外野':[16,17],'中外野':[50,2],'右外野':[84,17],'自由人':[16,34],'游击手':[84,34],'二垒手':[50,34],'投手':[25,90],'三垒手':[16,59],'一垒手':[84,59],'捕手':[75,90]};
  return `<div class="defense-field"><svg viewBox="0 0 200 160" role="img" aria-label="内野垒包，红色表示有人"><path d="M100 140L140 100L100 60L60 100Z" fill="#927650" stroke="#c5ae85" stroke-width="2"/>${[[140,100,s.bases[0]],[100,60,s.bases[1]],[60,100,s.bases[2]]].map(([x,y,r])=>`<rect x="${x-15}" y="${y-15}" width="30" height="30" rx="2" transform="rotate(45 ${x} ${y})" fill="${r?'#ff203f':'#655137'}" stroke="white" stroke-width="4"/>`).join('')}<path d="M95 136H105V142L100 147L95 142Z" fill="white"/></svg>${Object.entries(positions).filter(([pos])=>pos!=='自由人'||ctx.sport==='softball').map(([pos,xy])=>{const p=s.teams[1-s.side].lineup.find(p=>p.pos===pos),player=p?ctx.player(p.id):null,label=p?ctx.name(p.id)+(player?.number?' #'+player.number:''):'—';return `<div class="defender-label" style="left:${xy[0]}%;top:${xy[1]}%" title="${ctx.esc(pos+' · '+label)}">${ctx.esc(label)}</div>`;}).join('')}</div>`;
}
