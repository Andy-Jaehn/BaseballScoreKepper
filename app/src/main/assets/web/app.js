import {specialMenu,specialDialog,handleSpecial} from './special-ui.js';
import { throwingPathLabel } from './throwing-path.js';
import {recordSheets,plateRecords,lineupRows,substitutionRows} from './plate-records.js';
let logIndex=null, subMode="defense";
import {gameYear,years,exportArchive,importArchive,downloadJson} from './archive.js';
import {officialFields,rulingDialog,ejectDialog,boxScore} from './season-ui.js';
import { settleContact, canUndo, advanceLimit, recordCount, confirmCount, cancelCount, stageRuling } from "./engine.js";
import { migrateRoster, validatePlayer, normalizeName } from "./roster.js";
import {
  matchView,
  playDialog,
  resultPanel,
  pitchLog,
  score as matchScore,
} from "./match-ui.js";
import { statLabel, BATTING, FIELDING, PITCHING, statSheets, teamIds } from "./statistics.js";
import {
  POSITIONS,
  lineupPositions,
  isDefender,
  clone,
  uid,
  emptyStats,
  rates,
  newGame,
  replay,
  batter,
  pitcher,
  runnerQueue,
  commit,
  undo,
  totals,
} from "./engine.js";
import { downloadXlsx } from "./xlsx.js";
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
let db;
try {
  const raw = window.AndroidStore
    ? window.AndroidStore.read()
    : localStorage.getItem("diamond-v1");
  db = raw
    ? JSON.parse(raw)
    : { version: 1, players: [], games: [], active: null, setup: null };
  if (
    db.version !== 1 ||
    !Array.isArray(db.games) ||
    !Array.isArray(db.players)
  )
    throw Error();
} catch (e) {
  document.body.innerHTML =
    "<p>数据未能读取。请保留应用数据并重启，勿清除存储。</p>";
  throw e;
}
migrateRoster(db.players);
let season = String(new Date().getFullYear()), historyYear = String(new Date().getFullYear()), ejectId = null;
let playerQuery="", playerPage=1;
let panel = null,
  panelGameId = null;
let page = db.active ? "game" : "home",
  sport = "baseball",
  selected = new Set(),
  viewGame = null,
  stage = "pitch",
  sub = false;
const sportName = (s) => (s === "baseball" ? "棒球" : "慢投垒球");
const name = (id) => db.players.find((p) => p.id === id)?.name || "已删除球员";
const game = () => db.games.find((g) => g.id === db.active);
function save() {
  const raw = JSON.stringify(db);
  if (window.AndroidStore) {
    if (!window.AndroidStore.write(raw))
      throw Error("保存失败，请检查剩余空间");
  } else localStorage.setItem("diamond-v1", raw);
}
function toast(s) {
  const openDialog = document.querySelector("dialog[open]");
  if (openDialog) {
    let notice = openDialog.querySelector(".dialog-feedback");
    if (!notice) {
      notice = document.createElement("p");
      notice.className = "dialog-feedback";
      notice.setAttribute("role", "alert");
      openDialog.prepend(notice);
    }
    notice.textContent = s;
  }
  $("#toast").textContent = s;
  $("#toast").style.display = "block";
  setTimeout(() => ($("#toast").style.display = "none"), 3000);
}
function btn(label, action, data = "", cls = "") {
  return `<button class="${cls}" data-action="${action}" ${data}>${label}</button>`;
}
function header(title, menu = "") {
  return `<div class="top">${btn("‹", "home", "", "ghost fit")}<strong>${title}</strong>${menu || ''}</div>`;
}
function table(ids, stats, keys) {
  return `<div class="tablewrap"><table><thead><tr><th>球员</th>${keys.map((k) => `<th>${statLabel(k)}</th>`).join("")}</tr></thead><tbody>${ids
    .map((id) => {
      const s = stats[id] || rates(emptyStats());
      return `<tr><td>${esc(name(id))}</td>${keys.map((k) => `<td>${["OPS", "AVG", "OBP", "SLG", "WHIP", "FPCT", "ERA", "K/9"].includes(k) ? s[k].toFixed(3) : (s[k] ?? 0)}</td>`).join("")}</tr>`;
    })
    .join("")}</tbody></table></div>`;
}
const batting = BATTING,
  fielding = FIELDING,
  pitching = PITCHING;
function statsSections(ids, stats) {
  const pitchers = ids.filter((id) => stats[id]?.P > 0);
  return (
    "<h3>打击数据</h3>" +
    table(ids, stats, batting) +
    "<details><summary>守备数据</summary>" +
    table(ids, stats, fielding) +
    "</details>" +
    (pitchers.length
      ? "<details><summary>投球数据</summary>" +
        table(pitchers, stats, pitching) +
        "</details>"
      : "")
  );
}
function home() {
  return `${header("钻石记分", btn("软件作者", "author", "", "ghost fit"))}<section class="hero"><div class="eyebrow">DIAMOND NOTEBOOK</div><h1>专注比赛。<br>记下每一个瞬间。</h1><p>从第一球到最后一个出局，<br>你的球场记录簿。</p><div class="mark">◇</div></section>${db.active ? `<div class="card row"><div><b>有一场比赛正在进行</b><p class="muted">所有投球与未完成步骤已保存</p></div>${btn("继续记录", "resume", "", "primary fit")}</div>` : ""}<div class="grid">${btn("◉<b>球员</b><span>注册 · 统计 · 导出</span>", "players", "", "homebtn")}${btn("⚾<b>开始棒球比赛</b><span>标准逐球记分</span>", "setup", 'data-sport="baseball"', "homebtn primary")}${btn("◇<b>开始垒球比赛</b><span>慢投 · 1–1 起始球数</span>", "setup", 'data-sport="softball"', "homebtn")}${btn("▤<b>记录查看</b><span>赛后回顾 · 全部投球</span>", "history", "", "homebtn")}</div>`;
}
function players() {
  const matches = db.players.filter((p) => !p.deleted && normalizeName(p.name).includes(normalizeName(playerQuery))),
    pages=Math.max(1,Math.ceil(matches.length/20)),
    current=playerPage=Math.min(pages,Math.max(1,playerPage)),
    people=matches.slice((current-1)*20,current*20),
    st = totals(db.games.filter(g=>gameYear(g)===season), sport);
  return `${header("球员")}<label>搜索球员姓名<input id="playerSearch" type="search" placeholder="输入姓名搜索" value="${esc(playerQuery)}"></label>${yearSelect("season",season)}<div class="tabs">${btn("棒球", "sport", 'data-sport="baseball"', sport === "baseball" ? "primary" : "")}${btn("垒球", "sport", 'data-sport="softball"', sport === "softball" ? "primary" : "")}</div><div class="row">${btn("＋ 添加球员", "addPlayer", "", "primary")}${btn("导出所选 Excel", "exportPlayers", "", "ghost")}</div><p class="muted">勾选球员导出；未勾选时导出全部在册球员。当前年份的两种运动独立累计。</p>${people.length ? people.map((p) => `<section class="card"><div class="row"><input class="check fit" type="checkbox" data-select="${p.id}" ${selected.has(p.id) ? "checked" : ""}><div><b>${esc(p.name)}</b><span class="muted">　${esc(p.number || "—")} 号 · ${p.bats || "—"}打/${p.throws || "—"}投</span></div>${btn("编辑", "editPlayer", `data-id="${p.id}"`, "small fit")}${btn("删除", "deletePlayer", `data-id="${p.id}"`, "small danger fit")}</div>${statsSections([p.id], st)}</section>`).join("") : '<div class="empty">没有匹配的球员</div>'}<div class="row pagination">${btn('上一页','playerPage','data-page="'+(current-1)+'" '+(current===1?'disabled':''))}<span>第 ${current} / ${pages} 页 · ${matches.length} 人</span>${btn('下一页','playerPage','data-page="'+(current+1)+'" '+(current===pages?'disabled':''))}</div>`;
}
function editPlayer(id) {
  const p = db.players.find((x) => x.id === id) || {};
  dialog(
    `<h2>${id ? "编辑" : "添加"}球员</h2><label>姓名</label><input id="pname" maxlength="30" value="${esc(p.name || "")}" placeholder="球员姓名"><div class="row"><div><label>打击手</label><select id="pbats"><option value="R" ${p.bats !== "L" && p.bats !== "S" ? "selected" : ""}>R 右打</option><option value="L" ${p.bats === "L" ? "selected" : ""}>L 左打</option><option value="S" ${p.bats === "S" ? "selected" : ""}>S Switch hitter（左右开弓）</option></select></div><div><label>投球手</label><select id="pthrows"><option value="R" ${p.throws !== "L" ? "selected" : ""}>R 右投</option><option value="L" ${p.throws === "L" ? "selected" : ""}>L 左投</option></select></div></div><label>背号（可选）</label><input id="pnumber" maxlength="8" value="${esc(p.number || "")}"><div class="row" style="margin-top:20px">${btn("取消", "close")}${btn("保存", "savePlayer", `data-id="${id || ""}"`, "primary")}</div>`,
  );
  $("#pname").focus();
}
function ask(message) {
  return new Promise((resolve) => {
    dialog(
      '<div class="dialog-body"><h2>请确认</h2><p>' +
        esc(message) +
        '</p></div><div class="dialog-actions row"><button id="askNo">取消</button><button class="primary" id="askYes">确认</button></div>',
    );
    const d = $("dialog");
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      d.close();
      resolve(value);
      if(!value && page==='game' && game()?.draft)render();
    };
    $("#askNo").onclick = () => finish(false);
    $("#askYes").onclick = () => finish(true);
    d.addEventListener("cancel", () => finish(false), { once: true });
  });
}
function dialog(html) {
  $("dialog")?.remove();
  const d = document.createElement("dialog");
  d.innerHTML = html;
  if(d.querySelector('.dialog-body'))d.classList.add('fixed-dialog');
  document.body.append(d);
  d.showModal();
}

function setup() {
  const d = db.setup;
  if(!d){page=db.active?'game':'home';return db.active?record():home();}
  return (
    header("组队 · " + sportName(d.sport)) + (d.sport === "softball" ? '<p class="muted">增额球员：加入球员后选择增额球员，参与打序、不占守备位置。守备满员后新增球员自动设为增额球员。</p>' : "") +
    officialFields(d,db.players,esc) +
    '<section class="card"><h3>比赛环境（可选）</h3>'+[['temperature','温度（℃）'],['weather','天气'],['location','地点']].map(([key,label])=>'<label>'+label+'<input data-environment="'+key+'" maxlength="100" value="'+esc(d[key]||'')+'" placeholder="可不填写"></label>').join('')+'</section>'+
    '<p class="muted">按住 ≡ 拖动打序 · L 左打 / R 右打 / S 左右开弓</p>' +
    d.teams
      .map(
        (t, i) =>
          `<section class="card compact-team"><div class="row"><b class="fit">${i ? "主队" : "客队"}</b><input aria-label="${i ? "主" : "客"}队名称" data-team-name="${i}" value="${esc(t.name)}" maxlength="30"></div><div data-lineup="${i}">${t.lineup
            .map(
              (p, j) =>
                `<div class="lineup" data-team="${i}" data-index="${j}"><div class="handle" data-drag="${i}:${j}" aria-label="拖动打序">≡</div><div class="clip"><b>${j + 1}. ${esc(name(p.id))}</b> <span class="hand">${db.players.find((x) => x.id === p.id)?.bats || "—"}</span></div><select aria-label="${esc(name(p.id))}守备位置" data-position="${i}:${j}">${lineupPositions(d.sport)
                  .map(
                    (pos) =>
                      `<option ${p.pos === pos ? "selected" : ""}>${pos}</option>`,
                  )
                  .join(
                    "",
                  )}</select>${btn("×", "removeLine", `data-team="${i}" data-index="${j}"`, "small")}</div>`,
            )
            .join(
              "",
            )}</div>${btn("＋ 搜索并加入球员", "pickPlayer", `data-team="${i}"`, "ghost wide")}</section>`,
      )
      .join("") +
    '<div class="row">' +
    btn("交换主客队", "swapTeams") +
    btn("进入比赛", "start", "", "primary") +
    "</div>"
  );
}
function context(g) {
  return {
    logIndex,
    esc,
    name,
    btn,
    player: (id) => db.players.find((p) => p.id === id),
    sport:g.sport,
    career: totals(
      db.games.filter((x) => x.id !== g.id),
      g.sport,
    ),
  };
}
function record() {
  const g = game();
  if (!g) return home();
  return (
    header(
      sportName(g.sport),
      '<details class="menu"><summary aria-label="比赛菜单">⋮</summary><div>' +
        btn("结束比赛", "end", "", "danger") +
        "</div></details>",
    ) + matchView(g, context(g))
  );
}
function score(s, ended = false) {
  return matchScore(s, ended, esc);
}
function matchModal() {
  const g =
    panel === "log"
      ? db.games.find((g) => g.id === (panelGameId || db.active))
      : game();
  if (!g) return;
  if (panel === "log") {
    dialog(pitchLog(g, context(g)));
    return;
  }
  if (page !== "game") return;
  const d = g.draft;
  if(panel==='special'){dialog(specialMenu(g,context(g)));return;}
  if(panel==='ruling'){dialog(rulingDialog(g,context(g),db.players));return;}
  if(panel==='eject'){dialog(ejectDialog(g,context(g),db.players,ejectId));return;}
  if (panel === "sub") {
    dialog(subPanel(replay(g)));
    return;
  }
  if (g.pendingPitch) {
    dialog(resultPanel(g, context(g)));
    $("dialog").addEventListener("cancel", (e) => e.preventDefault());
    return;
  }
  if(g.specialDraft){dialog(specialDialog(g,context(g)));$('dialog').addEventListener('cancel',e=>e.preventDefault());return;}
  if (d) {
    const holder=document.createElement('div');holder.innerHTML=playDialog(g,context(g));
    const confirm=holder.querySelector('[data-action="commitContact"]');const confirmHtml=confirm?.outerHTML||'';confirm?.remove();
    dialog('<div class="dialog-body">'+holder.innerHTML+'</div><div class="dialog-actions">'+confirmHtml+'<div class="row">'+btn('上一步','draftBack','','ghost')+btn('取消本球','cancelDraft','','ghost')+'</div></div>');
    $("dialog").addEventListener("cancel", (e) => e.preventDefault());
  }
}
function pickPlayer(team,role=null) {
  dialog(
    "<h2>加入" +
      (role ? (role==='scorerId'?'记录者':'裁判') : (team ? "主队" : "客队")) +
      '</h2><input id="rosterSearch" placeholder="搜索球员姓名" autocomplete="off"><div id="rosterOptions" class="search-options"></div>' +
      btn("关闭", "close"),
  );
  const input = $("#rosterSearch");
  const refresh = () => {
    $("#rosterOptions").innerHTML =
      db.players
        .filter(
          (p) =>
            !p.deleted &&
            (role || !db.setup.teams.some((t) => t.lineup.some((x) => x.id === p.id))) &&
            p.name
              .toLocaleLowerCase()
              .includes(input.value.trim().toLocaleLowerCase()),
        )
        .map((p) =>
          btn(
            esc(p.name) + " · " + p.bats + "打/" + p.throws + "投",
            role ? "setOfficial" : "addLine",
            `data-team="${team}" data-role="${role||''}" data-id="${p.id}"`,
            "ghost",
          ),
        )
        .join("") || '<p class="muted">无匹配球员</p>';
  };
  input.addEventListener("input", refresh);
  refresh();
  input.focus();
}

function subPanel(s) {
 const offense=subMode==='offense',team=offense?s.side:1-s.side,lineup=s.teams[team].lineup;
 const slots=lineup.map((p,i)=>({...p,index:i})).filter(p=>!offense||p.id===batter(s)||s.bases.some(r=>r?.id===p.id));
 return '<div class="dialog-body"><h2>'+(offense?'进攻换人':'守备换人 / 换位')+'</h2><p>'+esc(s.teams[team].name)+'</p><p class="muted">'+(offense?'代打继承球数；代跑继承垒位，后续得分记给代跑。替补继承原打序和守备位置。':'替补继承原打序；此前数据保留在原球员名下。')+'</p><label>替换场上球员</label><select id="subout">'+slots.map(p=>'<option value="'+p.index+'">'+(offense?(p.id===batter(s)?'当前打者':'垒上跑者')+' · ':'')+'第 '+(p.index+1)+' 棒 · '+esc(name(p.id))+'</option>').join('')+'</select><label>换入注册球员</label><select id="subin"><option value="">选择替补…</option>'+db.players.filter(p=>!p.deleted&&!s.ejected.includes(p.id)&&!s.teams.some(t=>t.lineup.some(x=>x.id===p.id))).map(p=>'<option value="'+p.id+'">'+esc(p.name)+' #'+esc(p.number||'—')+'</option>').join('')+'</select>'+(offense?'':'<label>或与场上球员交换守备位置</label><select id="swapin">'+lineup.map((p,i)=>'<option value="'+i+'">'+p.pos+' · '+esc(name(p.id))+'</option>').join('')+'</select>')+'</div><div class="dialog-actions">'+btn('确认换人','doSub','','primary wide')+(offense?'':btn('交换位置','doSwap','','wide'))+btn('返回记分','subBack','','ghost wide')+'</div>';
}
function recent(s) {
  return (
    '<div class="card">' +
    btn(
      "逐打席记录",
      "showLog",
      'data-id="' + (viewGame || db.active) + '"',
      "ghost wide",
    ) +
    "</div>"
  );
}
function yearSelect(kind,value){return `<label class="year-select">年份<select data-year="${kind}">${[...new Set([String(new Date().getFullYear()),...years(db.games),value])].sort().reverse().map(y=>`<option ${y===value?"selected":""}>${y}</option>`).join("")}</select></label>`;}
function history() {
  return `${header("记录查看")}${yearSelect("history",historyYear)}<div class="row">${btn("选择比赛导出 JSON","archiveExport","","primary")}${btn("导入比赛 JSON","archiveImport")}</div>${
    db.games.length
      ? db.games
          .filter(g=>gameYear(g)===historyYear)
          .slice()
          .reverse()
          .map((g) => {
            const s = replay(g, true);
            return `<div class="card"><span class="pill">${sportName(g.sport)} · ${g.ended ? "已结束" : "进行中"}</span><h3>${esc(g.teams[0].name)} ${s.score[0].R} : ${s.score[1].R} ${esc(g.teams[1].name)}</h3><p class="muted">${new Date(g.created).toLocaleString("zh-CN")} · ${s.log.length} 条记录</p><div class="row">${btn("查看数据", "view", `data-id="${g.id}"`, "primary")}${btn("删除比赛", "deleteGame", `data-id="${g.id}"`, "danger")}</div></div>`;
          })
          .join("")
      : '<div class="empty">还没有比赛记录</div>'
  }`;
}
function summary() {
  const g = db.games.find((x) => x.id === viewGame);
  if (!g) {
    page = "history";
    return history();
  }
  const s = replay(g, true),
    st = Object.fromEntries(
      Object.entries(s.stats).map(([id, x]) => [id, rates(x,g.sport)]),
    );
  return `${header('比赛数据')}${score(s,g.ended)}<p class="muted">开始：${new Date(g.startedAt).toLocaleString('zh-CN')}<br>结束：${g.endedAt?new Date(g.endedAt).toLocaleString('zh-CN'):'进行中'}<br>${[["温度",g.temperature ? g.temperature+" ℃" : ""],["天气",g.weather],["地点",g.location]].filter(x=>x[1]).map(x=>esc(x.join("："))).join(" · ")}<br>记录者：${esc(name(s.scorerId))} · 裁判：${esc(name(s.umpireId))}</p><div class="row">${btn('导出本场 Excel','exportGame','','primary')}${g.ended?btn('导出本场 JSON','archiveOne','data-id="'+g.id+'"'):''}${!g.ended?btn('继续比赛','resume'):''}</div><section class="card"><h2>打击席位</h2>${g.teams.map((t,i)=>(i?"<hr>":"")+`<h3>${i?"主队":"客队"} · ${esc(t.name)}</h3>`+t.lineup.map((p,j)=>`<p>第 ${j+1} 棒 · ${esc(name(p.id))} #${esc(db.players.find(x=>x.id===p.id)?.number||"—")} · ${esc(p.pos)} · 先发</p>`).join("")).join("")}</section><section class="card"><h2>换人 / 换位记录</h2>${`<div class="box-table"><table><thead><tr>${["时间","局","球队","类型","打序","换出 / 球员","换入 / 另一球员","位置变化","球数 / 垒位"].map(h=>`<th>${h}</th>`).join("")}</tr></thead><tbody>${substitutionRows(g,id=>name(id)+" #"+(db.players.find(p=>p.id===id)?.number||"—")).map(row=>`<tr>${row.map(cell=>`<td>${esc(cell)}</td>`).join("")}</tr>`).join("")||"<tr><td colspan=9>无换人记录</td></tr>"}</tbody></table></div>`}</section>${boxScore(g,context(g))}${recent(s)}`;
}

function render() {
  try {
    $("#app").innerHTML =
      `<main class="shell">${({ home, players, setup, game: record, history, summary }[page] || home)()}</main>`;
    bindDrag();
    matchModal();
  } catch (e) {
    // Never leave controls from the previous page attached to a new app state.
    page='home';panel=null;panelGameId=null;
    $("dialog")?.remove();
    $("#app").innerHTML=`<main class="shell">${home()}<p class="notice" role="alert">页面未能打开：${esc(e.message)}。比赛和组队数据已保留。</p></main>`;
    toast(e.message);
    console.error(e);
  }
}
function updateGame(g) {
  db.games[db.games.findIndex((x) => x.id === g.id)] = g;
  save();
}
function exportStats(groups, title, meta = {}) {
  downloadXlsx(
    [...statSheets(groups, db.players, { sport, ...meta }),...(meta.game?recordSheets(meta.game,id=>name(id)+" #"+(db.players.find(p=>p.id===id)?.number||"—")):[])],
    title + ".xlsx",
  );
}

window.receiveArchive = text => {
  const before=clone(db);
  try{const result=importArchive(db,text);db=result.db;save();page='history';historyYear=years(db.games)[0]||historyYear;render();dialog('<h2>导入完成</h2><p>新增 '+result.count+' 场，跳过重复 '+result.skipped+' 场。</p>'+(result.added.length?'<p>已加入球员库：'+esc(result.added.join('、'))+'</p>':'')+(result.restored.length?'<p>已恢复球员：'+esc(result.restored.join('、'))+'</p>':'')+btn('关闭','close'));}catch(e){db=before;toast('导入失败：'+e.message);}
};
window.goHome = () => {
  save();
  page = "home";
  sub = false;
  panel = null;
  $("dialog")?.close();
  render();
};
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zone]");
  if (z) {
    action("zone", { value: z.dataset.zone });
    return;
  }
  const b = e.target.closest("[data-action]");
  if (b) action(b.dataset.action, b.dataset);
});
async function action(a, v = {}) {
  const snapshot = clone(db);
  try {
    const g = game();
    if(a.startsWith('special')&&a!=='specialMenu'){
      panel=null;
      if(handleSpecial(a,v,g,{$,updateGame,close:()=>{$('dialog')?.close();panel=null;}})){save();render();return;}
    }
    switch (a) {
      case 'specialMenu':
        if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前记录');
        panel='special';break;
      case "home":
        window.goHome();
        return;
      case "author":
        dialog('<div class="dialog-body"><h2>软件作者</h2><p>作者：Andy（PAVIA）</p><p>联系方式：<a href="https://github.com/Andy-Jaehn/BaseballScoreKepper" style="overflow-wrap:anywhere;word-break:break-word">https://github.com/Andy-Jaehn/BaseballScoreKepper</a></p></div><div class="dialog-actions">'+btn('关闭','close','','primary wide')+'</div>');
        return;
      case "close":
        $("dialog")?.close();
        return;
      case "playerPage":
        playerPage=+v.page;break;
      case "players":
        page = "players";
        break;
      case "sport":
        sport = v.sport;
        break;
      case "history":
        page = "history";
        break;
      case "resume":
        page = "game";
        sub = false;
        break;
      case "addPlayer":
        editPlayer();
        return;
      case "editPlayer":
        editPlayer(v.id);
        return;
      case "savePlayer": {
        const n = $("#pname").value.trim();
        if (!n) throw Error("请输入姓名");
        const p = {
          bats: $("#pbats").value,
          throws: $("#pthrows").value,
          id: v.id || uid(),
          name: n,
          number: $("#pnumber").value.trim(),
        };
        validatePlayer(db.players, p);
        if (v.id)
          Object.assign(
            db.players.find((p) => p.id === v.id),
            p,
          );
        else db.players.push(p);
        $("dialog").close();
        break;
      }
      case "deletePlayer":
        if (
          g &&
          replay(g).teams.some((t) => t.lineup.some((p) => p.id === v.id))
        )
          throw Error("该球员正在比赛中，请先换下或结束比赛");
        if (!(await ask("从注册表删除该球员？历史比赛中的姓名与数据保留。")))
          return;
        db.players.find((p) => p.id === v.id).deleted = true;
        selected.delete(v.id);
        break;
      case "exportPlayers": {
        const ids = db.players
          .filter((p) => !p.deleted && (!selected.size || selected.has(p.id)))
          .map((p) => p.id);
        exportStats(
          [{ name: "球员", ids, stats: totals(db.games.filter(g=>gameYear(g)===season), sport) }],
          sportName(sport) + "球员统计",
        );

        return;
      }
      case "setup":
        if (g) {
          page = "game";
          toast("请先完成当前比赛，再开始新比赛");
          break;
        }
        if (!db.setup || db.setup.sport !== v.sport)
          db.setup = {
            sport: v.sport,
            teams: [
              { name: "客队", lineup: [] },
              { name: "主队", lineup: [] },
            ],
          };
        page = "setup";
        break;
      case "pickOfficial":
        pickPlayer(0,v.role);return;
      case "setOfficial":
        db.setup[v.role]=v.id;$("dialog")?.close();break;
      case "pickPlayer":
        pickPlayer(+v.team);
        return;
      case "logMove":
        logIndex=Number(v.index);break;
      case "showLog":
        logIndex=null;
        panel = "log";
        panelGameId = v.id || db.active;
        break;
      case "closePanel":
        panel = null;
        $("dialog")?.close();
        break;
      case "addLine": {
        const t = db.setup.teams[+v.team],
          id = v.id;
        if (!id) throw Error("请先选择球员");
        const available = lineupPositions(db.setup.sport).find((p) => !t.lineup.some((x) => x.pos === p)) || (db.setup.sport === "softball" ? "增额球员" : null);
        if (!available) throw Error("场上位置已满");
        if (db.setup.teams.some((t) => t.lineup.some((p) => p.id === id)))
          throw Error("该球员已在队中");
        t.lineup.push({ id, pos: available });
        $("dialog")?.close();
        break;
      }
      case "removeLine":
        db.setup.teams[+v.team].lineup.splice(+v.index, 1);
        break;
      case "up": {
        const l = db.setup.teams[+v.team].lineup,
          i = +v.index;
        if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
        break;
      }
      case "swapTeams":
        if(!db.setup){page=db.active?'game':'home';break;}
        db.setup.teams.reverse();
        break;
      case "start": {
        if(!db.setup){page=db.active?'game':'home';break;}
        for (const t of db.setup.teams) {
          if (!t.name.trim()) throw Error("请填写队名");
          if (t.lineup.length < 2) throw Error("每队至少加入 2 位球员");
          if (new Set(t.lineup.filter(p=>p.pos!=="增额球员").map(p=>p.pos)).size !== t.lineup.filter(p=>p.pos!=="增额球员").length)
            throw Error("同一队的守备位置不能重复");
          if (!t.lineup.some((p) => p.pos === "投手"))
            throw Error("两队都需要指定投手");
          if (
            t.lineup.some((p) => db.players.find((x) => x.id === p.id)?.deleted)
          )
            throw Error("组队中包含已删除球员，请移除");
        }
        for(const k of ['scorerId','umpireId'])if(!db.players.some(p=>!p.deleted&&p.id===db.setup[k]))throw Error('请选择记录者和裁判');
        const n = newGame(db.setup.sport, db.setup.teams);
        n.scorerId=db.setup.scorerId;n.umpireId=db.setup.umpireId;
        for(const key of ["temperature","weather","location"])n[key]=db.setup[key]||"";
        db.games.push(n);
        db.active = n.id;
        db.setup = null;
        page = "game";
        stage = "pitch";
        break;
      }
      case "miss":
        stage = "miss";
        g.uiStage = "miss";
        break;
      case 'ruling':
        if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前记录');
        panel='ruling';break;
      case 'rulingAdvance':
        updateGame(stageRuling(g,{kind:'advanceAward',bases:+v.n}));panel=null;break;
      case 'rulingWalk':
        updateGame(stageRuling(g,{kind:'awardWalk'}));panel=null;break;
      case 'rulingOut':
        updateGame(stageRuling(g,{kind:'runnerOut',runnerId:$('#penaltyRunner').value,runnerName:name($('#penaltyRunner').value)}));panel=null;break;
      case 'rulingEject':
        ejectId=$('#ejectPerson').value;if(!ejectId)throw Error('请选择驱逐人员');panel='eject';break;
      case 'ejectReady': {
        const replacementId=$('#ejectReplacement')?.value;
        if($('#ejectReplacement')&&!replacementId)throw Error('请选择替换人员');
        updateGame(stageRuling(g,{kind:'eject',personId:v.id,personName:name(v.id),replacementName:replacementId?name(replacementId):null,replacementId,team:+v.team}));panel=null;break;
      }
      case 'archiveExport':
        dialog('<h2>选择比赛导出</h2>'+db.games.filter(g=>g.ended).map(g=>'<label class="row"><input class="check fit" type="checkbox" name="archiveGame" value="'+g.id+'">'+esc(new Date(g.startedAt||g.created).toLocaleString('zh-CN')+' · '+g.teams.map(t=>t.name).join(' vs '))+'</label>').join('')+btn('导出所选 JSON','archiveSave','','primary wide')+btn('关闭','close'));return;
      case "archiveOne":
        downloadJson(exportArchive(db,[v.id],true),'钻石记分-单场.json');return;
      case "archiveSave": {
        const ids=[...document.querySelectorAll('[name="archiveGame"]:checked')].map(x=>x.value);
        if(!ids.length)throw Error('请至少选择一场比赛');downloadJson(exportArchive(db,ids,true),'钻石记分-所选比赛.json');$('dialog')?.close();return;
      }

      case 'archiveImport':
        if(window.AndroidStore){window.AndroidStore.importJson();return;}
        {const input=document.createElement('input');input.type='file';input.accept='.json,application/json';input.onchange=()=>{const f=input.files[0];if(!f)return;if(f.size>20*1024*1024){toast('文件超过 20 MB');return;}const reader=new FileReader();reader.onload=()=>window.receiveArchive(reader.result);reader.readAsText(f);};input.click();}return;
      case "pitchStage":
        stage = "pitch";
        g.uiStage = "pitch";
        break;
      case "foulError": {
        if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先完成当前记录');
        const s=replay(g);
        dialog('<h2>界外漏接失误</h2><p>仅记录正常防守应接住、漏接后延长打席的界外球。战术性放弃接球不记失误。</p><label>失误野手</label><select id="foulErrorFielder">'+s.teams[1-s.side].lineup.filter(isDefender).map(p=>'<option value="'+p.id+'">'+esc(p.pos+' · '+name(p.id))+'</option>').join('')+'</select>'+btn('记录本球','saveFoulError','','primary wide')+btn('取消','close','','wide'));
        return;
      }
      case "saveFoulError":
        updateGame(recordCount(g,'foul',{foulErrorFielder:$('#foulErrorFielder').value}));
        $('dialog')?.close();break;
      case "pitch":
        panel=null;
        if (g.draft) throw Error("请先处理当前 Fair");
        if (g.sport === "softball" && v.kind === "hbp") throw Error("慢投垒球不适用 HBP");
        g.uiStage = "pitch";
        updateGame(recordCount(g, v.kind));
        stage = "pitch";
        break;
      case "contact":
        if(g.draft || g.pendingPitch || g.specialDraft)throw Error("请先完成当前记录");
        if (replay(g).halfEnded) throw Error("请先开启下一半局");
        g.draft = {
          type: "pitch",
          id: uid(),
          kind: "contact",
          time: new Date().toISOString(),
          actions: [],
          pitcher: pitcher(replay(g)),
        };
        break;
      case "award": {
        const s = replay(g),
          n = +v.n;
        Object.assign(g.draft, {
          trajectory: null,
          awardBases: n,
          result: "stop",
          fielder: null,
          actions: runnerQueue(s).map((r) => ({
            id: r.id,
            mode: "advance",
            advance: Math.min(n, 4 - r.from),
          })),
        });
        break;
      }
      case "result": {
        const d = g.draft, s = replay(g);
        d.fielder = $("#fielder").value;
        d.result = v.value;
        d.trajectory = v.trajectory || null;
        const pos = s.teams[1-s.side].lineup.find(p=>p.id===d.fielder)?.pos;
        d.zone = d.trajectory==='popup' || !['左外野','中外野','右外野'].includes(pos) ? '内野' : '外野';
        break;
      }
      case "advance": {
        g.draft.actions.push({ id: v.id, advance: +v.n, mode: "advance" });
        replay(g, true);
        break;
      }

      case "toggleError":
        g.draft.pending = { advance: +$("#normalAdvance").value };
        g.draft.errorOpen = !g.draft.errorOpen;
        break;
      case "saveRunner": {
        const d = g.draft,
          a = {
            id: v.id,
            mode: "advance",
            advance: +$("#normalAdvance").value,
            errorAdvance: $("#errorAdvance") ? +$("#errorAdvance").value : 0,
            errorFielder: $("#errorFielder")?.value,
          };
        d.actions.push(a);
        replay(g, true);
        d.pending = null;
        d.errorOpen = false;
        break;
      }
      case "force":
      case "tag":
        g.draft.outForm = { id: v.id, mode: a };
        break;
      case "cancelOut":
        g.draft.outForm = null;
        break;
      case "runnerOut": {
        const d = g.draft;
        if ($("#outTiming"))
          for (const r of d.actions)
            r.beforeThird = $("#outTiming").value === "before";
        d.actions.push({
          id: v.id,
          mode: v.mode,
          base: v.mode === "force" ? +$("#outbase").value : null,
          putout: $("#putout").value,
        });
        d.outForm = null;
        d.pending = null;
        d.errorOpen = false;
        updateGame(settleContact(g));
        break;
      }

      case "draftBack": {
        const d = g.draft;
        d.actions = d.actions.filter(a => !a.automatic);
        if(d.awardBases){delete d.awardBases;d.actions=[];delete d.result;delete d.trajectory;break;}
        d.pending = null;
        d.errorOpen = false;
        d.outForm = null;
        if (d.actions.length) {
          d.actions.pop();
          delete d.scoring;
          delete d.rbi;
        } else if (d.result) { delete d.result; delete d.trajectory; delete d.zone; }
        else { g.draft = null; $("dialog")?.close(); }
        break;
      }
      case "cancelDraft":
        if (!(await ask("取消当前尚未确认的投球录入？"))) return;
        g.draft = null;
        $("dialog")?.close();
        break;
      case "commitContact":
        updateGame(commit(g, g.draft));
        $("dialog")?.close();
        stage = "pitch";
        break;
      case "confirmCount":
        updateGame(confirmCount(g));
        $("dialog")?.close();
        break;
      case "pendingBack": {
        const ruling=g.pendingPitch?.type==='ruling',special=g.pendingPitch?.type==='special',draft=clone(g.specialDraft||null);updateGame(cancelCount(g));
        if(special&&draft&&!['balk','interference'].includes(draft.kind)){if(draft.actions.length)draft.actions.pop();game().specialDraft=draft;}panel=ruling?'ruling':special&&!game().specialDraft?'special':null;$("dialog")?.close();break;
      }
      case "cancelCount":
        updateGame(cancelCount(g));
        $("dialog")?.close();
        break;
      case "undo":
        updateGame(undo(g).game);
        toast("已撤销当前打席上一条记录");
        break;

      case "half":
        updateGame(commit(g, { type: "half" }));
        stage = "pitch";
        break;
      case "offenseSub":
      case "sub":
        if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前本球记录');
        if(a==='offenseSub'&&replay(g).halfEnded)throw Error('请先开启下一半局');
        subMode=a==='offenseSub'?'offense':'defense';
        panel = "sub";
        sub = true;
        break;
      case "subBack":
        panel = null;
        $("dialog")?.close();
        sub = false;
        break;
      case "doSub":
      case "doSwap": {
        const s = replay(g),
          index = +$("#subout").value;
        const event = { type: "sub", team: subMode==='offense'?s.side:1-s.side, index };
        if (a === "doSub") {
          event.id = $("#subin").value;
          if (!event.id) throw Error("请选择换入球员");
        } else {
          event.swap = +$("#swapin").value;
          if (event.swap === index) throw Error("请选择另一位场上球员");
        }
        const draft = g.draft;
        const n = commit(g, event);
        n.draft = draft;
        updateGame(n);
        sub = false;
        panel = null;
        $("dialog")?.close();
        toast("换人 / 换位已记录");
        break;
      }
      case "end":
        if (g.draft || g.pendingPitch || g.specialDraft) throw Error("请先确认或取消当前投球，再结束比赛");
        if (!(await ask("结束这场比赛并保存最终数据？"))) return;
        g.ended = true;
        g.endedAt = new Date().toISOString();
        viewGame = g.id;
        db.active = null;
        page = "summary";
        break;
      case "view":
        viewGame = v.id;
        page = "summary";
        break;
      case "deleteGame":
        if (!(await ask("永久删除该比赛及其对所有球员累计统计的贡献？")))
          return;
        db.games = db.games.filter((g) => g.id !== v.id);
        if (db.active === v.id) db.active = null;
        break;
      case "exportGame": {
        const x = db.games.find((g) => g.id === viewGame),
          s = replay(x, true),
          st = Object.fromEntries(
            Object.entries(s.stats).map(([id, x]) => [id, rates(x)]),
          ),
          ids = [
            ...new Set([
              ...x.teams.flatMap((t) => t.lineup.map((p) => p.id)),
              ...Object.keys(st),
            ]),
          ];
        const groups = x.teams.map((t, i) => ({
          name: t.name,
          ids: teamIds(x,i),
          stats: st,
        }));
        exportStats(groups, "比赛统计-" + x.created.slice(0, 10), {
          game: x,
          sport: x.sport,
          startedAt: x.startedAt || x.created,
          endedAt: x.endedAt,
        });

        return;
      }
    }
    save();
    render();
  } catch (e) {
    db = snapshot;
    if (page === "game") render();
    toast(e.message);
    console.error(e);
  }
}
function searchPlayers(e){
  if(e.target.id!=='playerSearch'||e.isComposing)return;
  playerQuery=e.target.value;playerPage=1;
  const cursor=e.target.selectionStart;render();
  const input=$('#playerSearch');input?.focus();
  if(cursor!==null)try{input.setSelectionRange(cursor,cursor);}catch{}
}
document.addEventListener('input',searchPlayers);
document.addEventListener('input',e=>{const key=e.target.dataset.environment;if(!key||!db.setup)return;db.setup[key]=e.target.value;save();});
document.addEventListener('input',e=>{
 if(e.target.id!=='throwingPath')return;
 const g=game();if(!g?.draft)return;
 const value=e.target.value,valid=(g.sport==='softball'?/^[0-9]*$/:/^[1-9]*$/).test(value);
 e.target.setCustomValidity(valid?'':'请输入有效的守备编号');e.target.setAttribute('aria-invalid',String(!valid));
 g.draft.throwingPath=value;save();
 $('#throwingPathPreview').textContent=valid?(throwingPathLabel(value)||'未填写传球路径'):g.sport==='softball'?'仅可输入 0–9':'仅可输入 1–9';
});
document.addEventListener('compositionend',searchPlayers);
document.addEventListener("change", (e) => {
  const el = e.target;
  if (![...el.attributes].some((a) => a.name.startsWith("data-"))) return;
  const before = clone(db);
  try {
    if(el.dataset.year){if(el.dataset.year==='season')season=el.value;else historyYear=el.value;selected.clear();render();return;}
    if(el.dataset.environment){db.setup[el.dataset.environment]=el.value.trim();save();return;}
    if(el.dataset.official){db.setup[el.dataset.official]=el.value;save();return;}
    if (el.dataset.select) {
      el.checked
        ? selected.add(el.dataset.select)
        : selected.delete(el.dataset.select);
      return;
    }
    if (el.dataset.teamName !== undefined) {
      db.setup.teams[+el.dataset.teamName].name = el.value;
      save();
      return;
    }
    if (el.dataset.position) {
      const [t, i] = el.dataset.position.split(":").map(Number);
      db.setup.teams[t].lineup[i].pos = el.value;
    }
    const d = game()?.draft;
    if(el.hasAttribute("data-contact-fielder"))d.fielder=el.value;
    if (el.hasAttribute("data-normal-advance")) {
      d.pending ??= {};
      d.pending.advance = +el.value;
      d.pending.errorAdvance = 1;
    }
    if (el.hasAttribute("data-error-fielder")) {
      d.pending ??= {};
      d.pending.errorFielder = el.value;
    }
    if (el.hasAttribute("data-error-advance")) {
      d.pending ??= {};
      d.pending.errorAdvance = +el.value;
    }
    if (el.hasAttribute("data-draft-fielder")) d.fielder = el.value;
    if (el.hasAttribute("data-third-out")) d.thirdOutId = el.value;
    if (el.hasAttribute("data-choice")) d.fieldersChoice = el.checked;
    if (el.hasAttribute("data-third")) d.runsBeforeThird = el.checked;
    if (el.hasAttribute("data-scoring")) {
      d.scoring = el.value;
      d.hitBases = 1;
    }
    if (el.hasAttribute("data-hitbases")) d.hitBases = +el.value;
    if (el.hasAttribute("data-rbi")) {
      if (el.value === "") delete d.rbi;
      else d.rbi = Math.min(4, Math.max(0, Math.floor(+el.value)));
    }
    if (d?.result) replay(game(), true);
    save();
    render();
  } catch (err) {
    db = before;
    render();
    toast(err.message);
  }
});
function bindDrag() {
  document.querySelectorAll("[data-drag]").forEach((h) =>
    h.addEventListener("pointerdown", (e) => {
      const [t, i] = h.dataset.drag.split(":").map(Number),
        rows = [
          ...document.querySelectorAll('[data-lineup="' + t + '"] .lineup'),
        ],
        row = h.parentElement,
        bounds = rows.map((r) => r.getBoundingClientRect()),
        start = e.clientY;
      let target = i;
      h.setPointerCapture(e.pointerId);
      row.classList.add("dragging");
      const move = (ev) => {
        row.style.transform = "translateY(" + (ev.clientY - start) + "px)";
        target = bounds.reduce(
          (best, b, j) =>
            Math.abs(ev.clientY - (b.top + b.height / 2)) <
            Math.abs(ev.clientY - (bounds[best].top + bounds[best].height / 2))
              ? j
              : best,
          i,
        );
        rows.forEach((r, j) => {
          if (j !== i)
            r.style.transform =
              "translateY(" +
              (i < target && j > i && j <= target
                ? -bounds[i].height
                : i > target && j >= target && j < i
                  ? bounds[i].height
                  : 0) +
              "px)";
        });
      };
      const end = (ev) => {
        h.removeEventListener("pointermove", move);
        h.removeEventListener("pointerup", end);
        h.removeEventListener("pointercancel", end);
        if (ev.type === "pointercancel") {
          rows.forEach((r) => (r.style.transform = ""));
          row.classList.remove("dragging");
          return;
        }
        const list = db.setup.teams[t].lineup;
        list.splice(target, 0, list.splice(i, 1)[0]);
        save();
        render();
        const moved = document.querySelector(
          '[data-lineup="' + t + '"] .lineup:nth-child(' + (target + 1) + ")",
        );
        moved?.classList.add("dropped");
      };
      h.addEventListener("pointermove", move);
      h.addEventListener("pointerup", end);
      h.addEventListener("pointercancel", end);
    }),
  );
}
render();

let plateTouch=null;
document.addEventListener('touchstart',e=>{const el=e.target.closest('[data-plate-index]');plateTouch=el?{x:e.touches[0].clientX,y:e.touches[0].clientY,index:Number(el.dataset.plateIndex)}:null;},{passive:true});
document.addEventListener('touchend',e=>{if(!plateTouch)return;const t=plateTouch;plateTouch=null;const dx=e.changedTouches[0].clientX-t.x,dy=e.changedTouches[0].clientY-t.y;if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)){const g=db.games.find(g=>g.id===(panelGameId||db.active)),index=t.index+(dx<0?1:-1);if(g&&index>=0&&index<plateRecords(g).length)action('logMove',{index});}},{passive:true});

let plateMouse=null;
document.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse')return;const el=e.target.closest('[data-plate-index]');plateMouse=el?{x:e.clientX,y:e.clientY,index:Number(el.dataset.plateIndex)}:null;});
document.addEventListener('pointerup',e=>{if(!plateMouse)return;const t=plateMouse;plateMouse=null;const dx=e.clientX-t.x,dy=e.clientY-t.y;const g=db.games.find(g=>g.id===(panelGameId||db.active));const index=t.index+(dx<0?1:-1);if(Math.abs(dx)>50&&Math.abs(dx)>Math.abs(dy)&&g&&index>=0&&index<plateRecords(g).length)action('logMove',{index});});
