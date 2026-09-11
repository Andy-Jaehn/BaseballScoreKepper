import { applySpecial } from './special-engine.js';
import { earnedRunDetails } from "./earned.js";
export const POSITIONS = [
  "投手",
  "捕手",
  "一垒手",
  "二垒手",
  "三垒手",
  "游击手",
  "左外野",
  "中外野",
  "右外野",
  "自由人",
  "增额球员",
  "指定打击 DH",
];
export const lineupPositions=sport=>sport==='baseball'?[...POSITIONS.slice(0,9),'指定打击 DH']:POSITIONS.slice(0,11);
export const isDefender=p=>!['增额球员','指定打击 DH'].includes(p.pos);
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  Date.now().toString(36) + Math.random().toString(36).slice(2);
export const emptyStats = () =>
  Object.fromEntries(
    [
      "FB", "LD", "IFF", "GB",
      "P_FB", "P_LD", "P_IFF", "P_GB",
      "F_FB", "F_LD", "F_IFF", "F_GB",
      "WP", "PB", "BK", "PICK", "SB", "CS", "DS", "CI", "F_CI", "D3K", "F_FOUL_E", "NP",
      "PA",
      "AB",
      "H",
      "TB",
      "2B",
      "3B",
      "HR",
      "RBI",
      "HBP",
      "BB",
      "IBB",
      "IBBA",
      "SO",
      "SF",
      "SH",
      "R",
      "E",
      "PO",
      "A",
      "DP",
      "TP",
      "GDP",
      "P",
      "STR",
      "BF",
      "HA",
      "BBA",
      "HBPA",
      "K",
      "OUT",
      "RA",
      "ER",
    ].map((k) => [k, 0]),
  );
export function rates(st, sport = "baseball") {
  const s = { ...emptyStats(), ...st },
    div = (n, d) => (d ? n / d : 0);
  return {
    ...s,
    AVG: div(s.H, s.AB),
    OBP: div(s.H + s.BB + s.HBP, s.AB + s.BB + s.HBP + s.SF),
    SLG: div(s.TB, s.AB),
    OPS: div(s.H + s.BB + s.HBP, s.AB + s.BB + s.HBP + s.SF) + div(s.TB, s.AB),
    IP: `${Math.floor(s.OUT / 3)}.${s.OUT % 3}`,
    WHIP: div(3 * (s.HA + s.BBA), s.OUT),
    ERA: div((sport === "softball" ? 21 : 27) * s.ER, s.OUT),
    "K/9": div(27 * s.K, s.OUT),
    FPCT: div(s.PO + s.A, s.PO + s.A + s.E),
    "P-S": `${s.P}-${s.STR}`,
  };
}
export function newGame(sport, teams) {
  const now = new Date().toISOString();
  return {
    id: uid(),
    rulesVersion: 2,
    twoStrikeFoulOut: sport === "softball",
    sport,
    teams: clone(teams),
    created: now,
    startedAt: now,
    events: [],
    substitutions: [],
    draft: null,
    ended: false,
  };
}
export function initial(g) {
  return {
    sport: g.sport,
    inning: 1,
    side: 0,
    b: g.sport === "softball" ? 1 : 0,
    s: g.sport === "softball" ? 1 : 0,
    o: 0,
    pa: 0,
    paStartedAt: g.startedAt || g.created,
    strikeoutBatter: null,
    substitutions: [],
    bases: [null, null, null],
    order: [0, 0],
    teams: clone(g.teams),
    score: [
      { R: 0, H: 0, E: 0 },
      { R: 0, H: 0, E: 0 },
    ],
    stats: {},
    lines: [[0], []],
    log: [],
    halfEnded: false,
    ejected: [],
    scorerId:g.scorerId,
    umpireId:g.umpireId,
  };
}
export const batter = (s) =>
  s.teams[s.side].lineup[s.order[s.side] % s.teams[s.side].lineup.length].id;
export const pitcher = (s) =>
  s.teams[1 - s.side].lineup.find((p) => p.pos === "投手")?.id;
function add(s, id, k, n = 1) {
  if (id) {
    s.stats[id] ??= emptyStats();
    s.stats[id][k] += n;
  }
}
function reset(s, g) {
  s.strikeoutBatter = null;
  s.b = g.sport === "softball" ? 1 : 0;
  s.s = g.sport === "softball" ? 1 : 0;
}
function finish(s, g, time) {
  s.paStartedAt = time;
  s.pa++;
  s.order[s.side] = (s.order[s.side] + 1) % s.teams[s.side].lineup.length;
  reset(s, g);
  if (s.o >= 3) {
    s.o = 3;
    s.halfEnded = true;
    s.bases = [null, null, null];
  }
}
export function runnerQueue(s) {
  return [2, 1, 0]
    .filter((i) => s.bases[i])
    .map((i) => ({ ...s.bases[i], from: i + 1 }))
    .concat([
      {
        id: batter(s),
        pitcher: pitcher(s),
        token: `${s.side}:${s.pa}`,
        from: 0,
      },
    ]);
}
export function advanceLimit(s, actions, id) {
  const q = runnerQueue(s),
    at = q.findIndex((r) => r.id === id);
  let max = 4;
  for (const lead of q.slice(0, at)) {
    const a = actions.find((a) => a.id === lead.id);
    if (a && ["force", "tag"].includes(a.mode)) continue;
    const dest = lead.from + (a?.advance || 0) + (a?.errorAdvance || 0);
    if (dest < 4) max = Math.min(max, dest - 1);
  }
  return Math.max(-1, max - q[at].from);
}
export function forceBases(s,id,result='stop'){
  const r=runnerQueue(s).find(r=>r.id===id);if(!r)return [];
  if(r.from===0)return s.sport==='softball'?[1,4]:[1];
  const own=[r.from];
  const forced=!['catch','infieldFly'].includes(result)&&Array.from({length:r.from-1},(_,i)=>s.bases[i]).every(Boolean);
  return [...new Set([...(forced?[...own,r.from+1]:own),...(s.sport==='softball'?[4]:[])])];
}
function run(s, r) {
  add(s, r.id, "R");
  add(s, r.pitcher, "RA");
  s.score[s.side].R++;
  s.lines[s.side][s.inning - 1] = (s.lines[s.side][s.inning - 1] || 0) + 1;
}
function out(s, p, f) {
  s.o++;
  add(s, p, "OUT");
  if (f) add(s, f, "PO");
}
function plate(s, id, p, r) {
  add(s, id, "PA");
  add(s, p, "BF");
  if (!["BB", "HBP", "SF", "SH", "CI"].includes(r)) add(s, id, "AB");
  if (["BB", "HBP", "SF", "SH"].includes(r)) add(s, id, r);
  if (r === "BB") add(s, p, "BBA");
  if (r === "HBP") add(s, p, "HBPA");
  if (r === "SO") {
    add(s, id, "SO");
    add(s, p, "K");
  }
}
export function apply(s, g, e, provisional = false) {
  if(e.type==='special')return applySpecial(s,g,e,{batter,pitcher,runnerQueue,clone,add,out,run,plate,finish,reset,apply,isDefender});
  if(e.type === "ruling" && e.kind !== "awardWalk") return applyRuling(s,g,e);
  if (e.type === "sub") {
    if (e.team !== 0 && e.team !== 1) throw Error("无效球队");
    const l=s.teams[e.team].lineup,old=l[e.index];
    if(!old)throw Error('无效换人位置');
    const runner=s.bases.find(r=>r?.id===old.id),offense=e.team===s.side;
    const record={eventId:e.eventId,time:e.time,inning:s.inning,side:s.side,team:e.team,slot:e.index+1,outId:old.id,inId:e.id||null,position:old.pos,kind:e.swap!==undefined?'换位':offense?(runner?'代跑':'代打'):'守备换人',balls:s.b,strikes:s.s,base:runner?s.bases.indexOf(runner)+1:null};
    if(e.swap!==undefined){
      if(!l[e.swap]||e.swap===e.index)throw Error('无效换位');
      record.otherId=l[e.swap].id;record.otherSlot=e.swap+1;record.otherPosition=l[e.swap].pos;
      [old.pos,l[e.swap].pos]=[l[e.swap].pos,old.pos];
    }else{
      if(!e.id||s.ejected.includes(e.id)||s.teams.some(t=>t.lineup.some(p=>p.id===e.id)))throw Error('请选择未在场且未被驱逐的替补');
      if(offense&&old.id!==batter(s)&&!runner)throw Error('进攻换人只能替换当前打者或垒上跑者');
      if(offense&&old.id===batter(s)&&s.s===2&&g.sport==='baseball')s.strikeoutBatter ||= old.id;
      l[e.index]={id:e.id,pos:old.pos};
      if(runner)runner.id=e.id;
    }
    s.substitutions.push(record);
    return;
  }
  if (e.type === "half") {
    if (!s.halfEnded) throw Error("尚未三出局");
    s.paStartedAt = e.time;
    s.side = 1 - s.side;
    if (!s.side) s.inning++;
    s.o = 0;
    s.halfEnded = false;
    s.lines[s.side][s.inning - 1] = 0;
    reset(s, g);
    return;
  }
  if (s.halfEnded) throw Error("请先开启下个半局");
  const id = batter(s),
    p = e.pitcher || pitcher(s),
    beforeOut = s.o,
    pa = s.pa,
    slot = s.order[s.side] + 1,
    paStartedAt = s.paStartedAt,
    creditedBatter = s.strikeoutBatter || id,
    beforeBases = runnerQueue(s).filter((r) => r.from),
    br = { id, pitcher: p, token: `${s.side}:${pa}`, from: 0 };
  if (s.bases.some((r) => r?.id === id))
    throw Error("当前打者仍在垒上，请使用完整打序");
  if (!["ball", "strike", "foul", "hbp", "contact", "ibb", "awardWalk"].includes(e.kind))
    throw Error("未知投球类型");
  if(e.kind!=='awardWalk'){add(s,p,'P');add(s,id,'NP');}
  if (["strike", "foul", "contact"].includes(e.kind)) add(s, p, "STR");
  let summary = "",
    result = "",
    play = null,
    foulError = false;
  if (["ball", "hbp", "ibb", "awardWalk"].includes(e.kind)) {
    if (e.kind === "ball") s.b++;
    if (s.b >= 4 || e.kind !== "ball") {
      result = e.kind === "hbp" ? "HBP" : "BB";
      plate(s, id, p, result);
      if(e.kind==='ibb'){add(s,id,'IBB');add(s,p,'IBBA');}
      const runs = [];
      if (s.bases[0]) {
        if (s.bases[1]) {
          if (s.bases[2]) {
            runs.push({ ...s.bases[2] });
            run(s, s.bases[2]);
            add(s, id, "RBI");
          }
          s.bases[2] = s.bases[1];
        }
        s.bases[1] = s.bases[0];
      }
      s.bases[0] = br;
      play = { result, batter: br, runs, outs: [], actions: [],rbi:runs.length };
      finish(s, g, e.completedAt || e.time);
      summary = result === "BB" ? "四坏球保送" : "触身球保送";
      if(e.kind==='ibb')summary='故意四坏球保送 IBB';
      if(e.kind==='awardWalk')summary='裁判判罚：当前打者保送';
    } else summary = "坏球";
  } else if (e.kind === "strike" || e.kind === "foul") {
    const foulOut = g.sport === "softball" && (e.twoStrikeFoulOut ?? g.twoStrikeFoulOut ?? true);
    if (e.kind === "strike" || s.s < 2 || foulOut) s.s++;
    summary = e.kind === "foul" ? "界外球" : "好球";
    if (e.kind === 'foul' && e.foulErrorFielder && s.s < 3) {
      if (!s.teams[1-s.side].lineup.some(f=>f.id===e.foulErrorFielder)) throw Error('请选择失误野手');
      add(s,e.foulErrorFielder,'E');s.score[1-s.side].E++;
      foulError=true;summary+=' · 界外漏接失误 E';
    }
    if (s.s >= 3) {
      result = "SO";
      plate(s, creditedBatter, p, result);
      out(s, p, s.teams[1 - s.side].lineup.find((x) => x.pos === "捕手")?.id);
      play = {
        result,
        batter: br,
        runs: [],
        outs: [{ ...br, mode: "strike" }],
        actions: [],
      };
      finish(s, g, e.completedAt || e.time);
      summary = e.kind === "foul" ? "两好球后界外出局" : "三振出局";
    }
  } else {
    const q = runnerQueue(s).map((r) => (r.from === 0 ? br : r)),
      recoveredForce = e.result === 'error' && (e.actions || []).some(a=>a.mode==='force'),
      actions = (e.actions || []).map(a => recoveredForce && a.id===id && a.mode==='advance' && !a.advance && a.errorAdvance && a.errorFielder===e.fielder
        ? {...a,advance:1,errorAdvance:a.errorAdvance-1} : a),
      caught = ["catch", "infieldFly"].includes(e.result),
      error = e.result === "error" && !recoveredForce;
    if (!["catch", "stop", "error", "infieldFly"].includes(e.result))
      throw Error("请选择野手处理结果");
    if (caught && ["ground", "bunt"].includes(e.trajectory))
      throw Error("地滚球不能接杀");
    if (
      e.result === "infieldFly" &&
      (beforeOut >= 2 || !s.bases[0] || !s.bases[1] || e.trajectory !== "fly")
    )
      throw Error("内野高飞规则需两出局前、一二垒有人、非平飞或触击");
    if (new Set(actions.map((a) => a.id)).size !== actions.length)
      throw Error("跑者不能重复处理");
    for (const a of actions) {
      const r = q.find((r) => r.id === a.id);
      if (!r) throw Error("无效跑者");
      if (a.mode === "force" && !forceBases(s,a.id,e.result).includes(a.base)) throw Error("当前跑者不满足该垒包封杀条件");
      if (a.mode === "advance") {
        const n = a.advance || 0,
          err = a.errorAdvance || 0;
        if (
          !Number.isInteger(n) ||
          !Number.isInteger(err) ||
          n < 0 ||
          err < 0 ||
          r.from + n + err > 4 ||
          (!r.from && !n && !err)
        )
          throw Error("进垒数无效");
        if (err && !a.errorFielder) throw Error("请选择失误野手");
        if (g.rulesVersion >= 2 && n + err > advanceLimit(s, actions, a.id))
          throw Error("后位跑者不能超过前位跑者，也不能占据同一垒包");
      }
    }
    const outs = [],
      runs = [],
      dest = new Map(),
      assists = new Set(),
      involved = new Set(),
      errors = new Set();
    if (error && !e.fielder) throw Error("请选择处理失误的野手");
    if (error) errors.add(e.fielder);
    for (const a of actions) if (a.errorAdvance) errors.add(a.errorFielder);
    errors.forEach((f) => {
      add(s, f, "E");
      s.score[1 - s.side].E++;
    });
    if (caught) {
      out(s, p, e.fielder);
      outs.push({ ...br, mode: "catch" });
      involved.add(e.fielder);
    }
    for (const r of q) {
      if (!r.from && caught) continue;
      const a = actions.find((a) => a.id === r.id);
      if (!a) {
        if (r.from) dest.set(r.from, r);
        continue;
      }
      if (["force", "tag"].includes(a.mode)) {
        if (s.o < 3) {
          out(s, p, a.putout || e.fielder);
          outs.push({ ...r, ...a });
          involved.add(a.putout || e.fielder);
          if (a.putout && a.putout !== e.fielder && !assists.has(e.fielder)) {
            add(s, e.fielder, "A");
            assists.add(e.fielder);
            involved.add(e.fielder);
          }
        }
      } else {
        const n = r.from + (a.advance || 0) + (a.errorAdvance || 0),
          rr = { ...r };
        if (n >= 4)
          runs.push({ ...rr, normalScore: r.from + (a.advance || 0) >= 4 });
        else if (n > 0) {
          if (dest.has(n)) throw Error("同一垒包不能有两名跑者");
          dest.set(n, rr);
        }
      }
    }
    const ba = actions.find((a) => a.id === id),
      runnerOut = outs.some((o) => o.from > 0),
      batterOut = caught || outs.some((o) => o.from === 0),
      complete = s.o >= 3 || q.every(
        (r) => (!r.from && caught) || actions.some((a) => a.id === r.id),
      );
    const third =
      s.o >= 3
        ? e.thirdOutId
          ? outs.find((o) => o.id === e.thirdOutId) || outs[2 - beforeOut]
          : outs[2 - beforeOut]
        : null;
    const cancel = third && (third.mode === "force" || (third.from === 0 && !third.safeBases)),
      valid = cancel
        ? []
        : runs.filter(
            (r) =>
              !third ||
              e.runsBeforeThird === true ||
              actions.find((a) => a.id === r.id)?.beforeThird === true,
          );
    // OBR 5.08(a), 9.05(b): an inning-ending force overrides safe arrival
    // and all apparent runs on this play, but does not create another putout.
    const forceEndsHalf = Boolean(cancel && !caught);
    const effectiveActions = cancel
      ? actions.filter(a => outs.some(o => o.id === a.id))
      : actions;
    if (cancel) dest.clear();
    valid.forEach((r) => run(s, r));
    let hitBases = 0;
    result = "OUT";
    if (caught || error) {
      if (
        beforeOut < 2 &&
        valid.some((r) => r.normalScore) &&
        e.zone !== "内野" &&
        ["fly", "line"].includes(e.trajectory)
      )
        result = "SF";
      else result = error && !batterOut ? "E" : "OUT";
    } else if (ba && !batterOut) {
      if (!ba.advance && ba.errorAdvance) result = "E";
      else if (runnerOut || e.fieldersChoice) result = "FC";
      else {
        result = "H";
        hitBases = Math.min(4, e.awardBases || ba.advance);
      }
    }
    if (
      e.trajectory === "bunt" &&
      beforeOut < 2 &&
      !runnerOut &&
      actions.some((a) => a.id !== id && a.advance > 0) &&
      (batterOut || error)
    )
      result = "SH";
    if (!g.rulesVersion && e.scoring) {
      result = e.scoring;
      hitBases = e.hitBases || hitBases;
    }
    if (forceEndsHalf) {
      result = "OUT";
      hitBases = 0;
    }
    if (result === "FC") {
      const retired = outs.find((o) => o.from > 0);
      if (retired) {
        br.pitcher = retired.pitcher;
        for (const rr of dest.values())
          if (rr.id === id) rr.pitcher = retired.pitcher;
      }
    }
    if (complete || !provisional) {
      if (!complete) throw Error("请完成所有跑者的记录");
      if (result === "H" && (!hitBases || hitBases > 4))
        throw Error("安打垒数无效");
      const ballType = {fly:'FB',line:'LD',popup:'IFF',ground:'GB',bunt:'GB'}[e.trajectory];
      if (ballType) {
        add(s, id, ballType);
        add(s, p, 'P_'+ballType);
        if (e.fielder && !e.awardBases) add(s, e.fielder, 'F_'+ballType);
      }

      plate(s, id, p, result);
      if (result === "H") {
        add(s, id, "H");
        add(s, id, "TB", hitBases);
        add(s, p, "HA");
        s.score[s.side].H++;
        if (hitBases === 2) add(s, id, "2B");
        if (hitBases === 3) add(s, id, "3B");
        if (hitBases === 4) add(s, id, "HR");
      }
      const dp = outs.length === 2,
        tp = outs.length >= 3,
        groundDP =
          ["ground", "bunt"].includes(e.trajectory) &&
          dp &&
          outs.some((o) => o.mode === "force");
      if (dp || tp) {
        involved.forEach((f) => add(s, f, tp ? "TP" : "DP"));
        if (groundDP) add(s, id, "GDP");
      }
      let rbi = cancel || groundDP || (error && !batterOut && beforeOut + outs.length >= 2)
        ? 0
        : valid.filter((r) => r.normalScore).length;
      if (!g.rulesVersion && Number.isInteger(e.rbi)) rbi = e.rbi;
      add(s, id, "RBI", rbi);
      const outLabel = tp
        ? "三杀打"
        : dp
          ? "双杀打"
          : forceEndsHalf && !batterOut
            ? "封杀结束半局"
          : e.result === "infieldFly"
            ? "内野高飞球出局"
            : caught
              ? e.trajectory === "popup"
                ? "内野高飞接杀"
                : e.trajectory === "fly"
                ? "高飞球出局"
                : "平飞接杀出局"
              : ["ground", "bunt"].includes(e.trajectory)
                ? "地滚球出局"
                : "击球出局";
      summary = {
        OUT: outLabel,
        H: ["", "一垒安打", "二垒安打", "三垒安打", "全垒打"][hitBases],
        E: "失误上垒",
        FC: "野手选择上垒",
        SF: "牺牲飞球",
        SH: "牺牲触击",
      }[result];
      if ((dp || tp) && result !== "OUT") summary += ` · ${outLabel}`;
      if (valid.length) summary += ` · ${valid.length} 得分 / ${rbi} RBI`;
      const errorBases = effectiveActions.reduce((n, a) => n + (a.errorAdvance || 0), 0),
        errorRuns = valid.filter((r) => !r.normalScore).length;
      if (errors.size)
        summary += ` · ${errors.size} E / 失误进垒 ${errorBases} / 失误得分 ${errorRuns}`;
      play = {
        result,
        batter: { ...br },
        batterOut,
        reachedError: !forceEndsHalf && !batterOut && (error || result === "E"),
        forceEndsHalf,
        hitBases,
        runs: valid,
        outs,
        actions: effectiveActions.map((a) => ({
          ...q.find((r) => r.id === a.id),
          ...a,
        })),
        rbi,
        errorBases,
        errorRuns,
        dp,
        tp,
      };
    } else summary = "跑者处理中";
    s.bases = [1, 2, 3].map((n) => dest.get(n) || null);
    if (complete || !provisional) finish(s, g, e.completedAt || e.time);
  }
  s.log.push({
    id: e.id,
    pa,
    slot,
    paStartedAt,
    completedAt: pa !== s.pa ? (e.completedAt || e.time) : null,
    creditedBatter: result === "SO" ? creditedBatter : id,
    afterBases: clone(s.bases),
    errorFielder: e.result === "error" && !(e.actions || []).some(a=>a.mode==='force') ? e.fielder : foulError ? e.foulErrorFielder : null,
    foulError,
    inning: s.inning,
    side: s.side,
    defense: 1 - s.side,
    pitcher: p,
    batter: id,
    kind: e.kind,
    isPitch: e.isPitch,
    summary,
    result,
    terminal: pa !== s.pa,
    b: s.b,
    s: s.s,
    o: s.o,
    beforeOut,
    beforeBases,
    play,
    time: e.time || null,
    zone: e.zone,
    trajectory: e.trajectory,
    throwingPath: e.throwingPath || "",
  });
}
export function replay(g, includeDraft = false) {
  const s = initial(g);
  for (const e of g.events) apply(s, g, e);
  if(includeDraft&&g.pendingPitch)apply(s,g,g.pendingPitch);
  if (includeDraft && g.draft?.result) apply(s, g, g.draft, true);
  const er = earnedRunDetails(s.log);
  s.earnedRunAudit = er.runs;
  for (const [id, st] of Object.entries(s.stats)) st.ER = er.totals[id] || 0;
  return s;
}
export function commit(g, e) {
  if (g.ended) throw Error("比赛已结束");
  const n = clone(g),
    s = replay(g);
  // Entry restrictions must not invalidate previously saved events during replay.
  if(e.kind==='ibb' && s.bases.every(Boolean))throw Error("满垒时禁止故意四坏球保送；仍可正常记录坏球或触身球");
  if(e.kind==='contact'){
    if(!(g.sport==='softball'?/^[0-9]*$/:/^[1-9]*$/).test(e.throwingPath||''))throw Error(g.sport==='softball'?'传球路径仅可输入 0–9':'传球路径仅可输入 1–9');
    if(g.sport==='softball' && e.trajectory==='bunt')throw Error('慢投垒球不允许触击');
    for(const a of e.actions||[])if(a.mode==='force'&&!forceBases(s,a.id,e.result).includes(a.base))throw Error('当前跑者不满足该垒包封杀条件');
  }
  e = {
    ...e,
    isPitch: e.type === "pitch" || (e.type === "special" && !["steal","pickoff","interference"].includes(e.kind)),
    eventId: e.eventId || uid(),
    completedAt: new Date().toISOString(),
    pitcher: e.pitcher || pitcher(s),
    time: e.time || new Date().toISOString(),
  };
  // Freeze the rule on new pitches so existing matches can continue under the new rule.
  if(e.type==='pitch'&&e.kind==='foul')e.twoStrikeFoulOut=g.sport==='softball';
  if (e.type === "pitch" || e.type === "ruling" || e.type === "special") {
    e.id = e.id || uid();
    e.pa = s.pa;
    n.editing = false;
    n.pendingPitch=null;
  }
  apply(s, g, e);
  n.events.push(e);
  n.substitutions = clone(s.substitutions);
  n.draft = null;
  n.specialDraft = null;
  return n;
}
export function settleContact(g) {
  if (!g.draft?.result) return g;
  const shown = replay(g, true);
  if (!shown.halfEnded) return g;
  const n = clone(g), d = n.draft;
  for (const r of runnerQueue(replay(g))) {
    if (!d.actions.some(a => a.id === r.id) &&
        (r.from || !['catch','infieldFly'].includes(d.result)))
      d.actions.push({id:r.id, mode:'inningEnd', automatic:true});
  }
  return n;
}
export function canUndo(g) {
  if (g.ended || g.draft || g.pendingPitch || g.specialDraft || g.events.at(-1)?.type !== "pitch") return false;
  const s = replay(g),
    last = s.log.at(-1);
  return (
    !!last &&
    last.pa === s.pa &&
    ["ball", "strike", "foul"].includes(last.kind) &&
    !last.terminal
  );
}
export function recordCount(g,kind,details={}){
  if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前记录');
  const next=commit(g,{...details,type:'pitch',kind}),last=replay(next).log.at(-1);
  if(last.terminal){const pending=clone(g);pending.pendingPitch=next.events.at(-1);return pending;}
  return next;
}
export function stageSpecial(g,event){
 if(g.draft||g.pendingPitch)throw Error('请先确认或取消当前记录');
 const n=clone(g),next=commit(g,{...event,type:'special'});n.pendingPitch=next.events.at(-1);return n;
}
export function confirmCount(g){if(!g.pendingPitch)throw Error('没有待确认记录');return commit(g,g.pendingPitch);}
export function cancelCount(g){const n=clone(g);n.pendingPitch=null;n.specialDraft=null;return n;}
export function stageRuling(g,event){
  if(g.draft||g.pendingPitch||g.specialDraft)throw Error('请先确认或取消当前记录');
  const next=commit(g,{...event,type:'ruling'}),n=clone(g);
  n.pendingPitch=next.events.at(-1);return n;
}
function applyRuling(s,g,e){
  if(s.halfEnded && e.kind!=='eject')throw Error('请先开启下个半局');
  const p=e.pitcher||pitcher(s),id=batter(s),pa=s.pa,beforeOut=s.o,beforeBases=runnerQueue(s).filter(r=>r.from);
  let summary='',play=null;
  if(e.kind==='advanceAward'){
    if(![1,2,3].includes(e.bases)||!beforeBases.length)throw Error('请选择垒上跑者的有效进垒数');
    const actions=beforeBases.map(r=>({...r,mode:'advance',advance:Math.min(e.bases,4-r.from)})),runs=[];
    s.bases=[null,null,null];
    for(const a of actions){if(a.from+a.advance===4){run(s,a);runs.push(a);}else s.bases[a.from+a.advance-1]={...a};}
    play={result:'PENALTY',actions,runs,outs:[],rbi:0};
    summary=`裁判判罚：垒上跑者前进 ${e.bases} 垒`+(runs.length?` · ${runs.length} 得分`:'');
  }else if(e.kind==='runnerOut'){
    const r=beforeBases.find(r=>r.id===e.runnerId);if(!r)throw Error('请选择当前垒上跑者');
    out(s,p,null);s.bases[r.from-1]=null;
    play={result:'PENALTY',actions:[{...r,mode:'tag'}],runs:[],outs:[{...r,mode:'tag'}],rbi:0};
    if(s.o>=3){s.o=3;s.halfEnded=true;s.bases=[null,null,null];reset(s,g);}
    summary='裁判判罚：'+(e.runnerName||'所选跑者')+'出局';
  }else if(e.kind==='eject'){
    if(!e.personId||s.ejected.includes(e.personId))throw Error('请选择尚未被驱逐的人');
    const t=s.teams.find(t=>t.lineup.some(x=>x.id===e.personId));
    if(t){
      if(!e.replacementId||s.ejected.includes(e.replacementId)||s.teams.some(t=>t.lineup.some(x=>x.id===e.replacementId)))throw Error('驱逐场上球员时请选择未上场的替补');
      const slot=t.lineup.find(x=>x.id===e.personId);
      s.substitutions.push({eventId:e.eventId,time:e.time,inning:s.inning,side:s.side,team:s.teams.indexOf(t),slot:t.lineup.indexOf(slot)+1,outId:e.personId,inId:e.replacementId,position:slot.pos,kind:'驱逐替换',balls:s.b,strikes:s.s});
      if(e.personId===batter(s)&&s.s===2&&g.sport==='baseball')s.strikeoutBatter ||= e.personId;
      slot.id=e.replacementId;
      for(const r of s.bases)if(r?.id===e.personId)r.id=e.replacementId;
    }
    s.ejected.push(e.personId);summary='裁判判罚：驱逐'+(e.personName||'所选人员')+(e.replacementId?'，替换为 '+(e.replacementName||'所选替补'):'')+(t?'，继承位置与打序':'');
    for(const role of ['scorerId','umpireId'])if(s[role]===e.personId){if(!e.replacementId)throw Error('请选择工作人员替换人员');s[role]=e.replacementId;}
  }else throw Error('未知判罚');
  s.log.push({id:e.id,pa,paStartedAt:s.paStartedAt,slot:s.order[s.side]+1,afterBases:clone(s.bases),inning:s.inning,side:s.side,defense:1-s.side,pitcher:p,batter:id,kind:e.kind,summary,result:'PENALTY',terminal:false,b:s.b,s:s.s,o:s.o,beforeOut,beforeBases,play,time:e.time});
}
export function undo(g) {
  if (!canUndo(g)) throw Error("只能撤销当前未结束打席的 B、S、Foul");
  const n = clone(g);
  let i = n.events.length - 1;
  while (i >= 0 && n.events[i].type !== "pitch") i--;
  const removed = n.events.splice(i, 1)[0];
  n.substitutions = replay(n).substitutions;
  return { game: n, removed };
}
export function totals(games, sport) {
  const total = {};
  for (const g of games.filter((g) => g.sport === sport))
    for (const [id, st] of Object.entries(replay(g, true).stats)) {
      total[id] ??= emptyStats();
      for (const k of Object.keys(st)) total[id][k] += st[k];
    }
  return Object.fromEntries(
    Object.entries(total).map(([id, s]) => [id, rates(s, sport)]),
  );
}
export function inningBatting(s, id) {
  const st = emptyStats(),
    events = s.log.filter(
      (l) => l.inning === s.inning && (l.creditedBatter || l.batter) === id && l.terminal,
    ),
    tags = [];
  for (const l of events) {
    st.PA++;
    if (!["BB", "HBP", "SF", "SH", "CI"].includes(l.result)) st.AB++;
    if (l.result === "H") {
      st.H++;
      tags.push(l.play.hitBases === 4 ? "HR" : `${l.play.hitBases}B`);
    } else if (l.result === "SO") tags.push("K");
    else tags.push(l.result);
    st.RBI += l.play?.rbi || 0;
  }
  return {
    ...st,
    text: `${st.H}-${st.AB}${tags.length ? " " + tags.join(", ") : ""}${st.RBI ? " · " + st.RBI + " RBI" : ""}`,
  };
}
