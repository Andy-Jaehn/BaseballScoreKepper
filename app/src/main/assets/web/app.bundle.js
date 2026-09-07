(() => {
  // app/src/main/assets/web/polyfills.js
  if (typeof window !== "undefined" && !window.globalThis)
    window.globalThis = window;
  if (!Object.fromEntries)
    Object.fromEntries = (entries) => {
      const out2 = {};
      for (const [key, value] of entries)
        Object.defineProperty(out2, key, {
          value,
          enumerable: true,
          configurable: true,
          writable: true
        });
      return out2;
    };
  if (!Array.prototype.at)
    Object.defineProperty(Array.prototype, "at", {
      value: function(index) {
        const n = Math.trunc(index) || 0;
        return this[n < 0 ? this.length + n : n];
      },
      configurable: true,
      writable: true
    });
  if (!Array.prototype.flatMap)
    Object.defineProperty(Array.prototype, "flatMap", {
      value: function(fn, thisArg) {
        return this.reduce(
          (out2, value, index) => out2.concat(fn.call(thisArg, value, index, this)),
          []
        );
      },
      configurable: true,
      writable: true
    });

  // app/src/main/assets/web/earned.js
  function earnedRuns(log) {
    const result = {}, tracks = /* @__PURE__ */ new Map();
    let half = "";
    const collect = () => {
      for (const [p, t] of tracks)
        for (const token of t.actual)
          if (t.scored.has(token) && !t.credited.has(token)) {
            result[p] = (result[p] || 0) + 1;
            t.credited.add(token);
          }
    };
    for (const l of log) {
      const key = `${l.inning}:${l.side}`;
      if (key !== half) {
        collect();
        tracks.clear();
        half = key;
      }
      if (!tracks.has(l.pitcher))
        tracks.set(l.pitcher, {
          outs: l.beforeOut,
          bases: new Map(
            l.beforeBases.filter(Boolean).map((r) => [r.token, { ...r, pos: r.from }])
          ),
          scored: /* @__PURE__ */ new Set(),
          actual: /* @__PURE__ */ new Set(),
          credited: /* @__PURE__ */ new Set()
        });
      const play = l.play;
      if (!play) continue;
      for (const r of play.runs || []) {
        const t = tracks.get(r.pitcher);
        if (t) t.actual.add(r.token);
      }
      for (const t of tracks.values()) {
        if (t.outs >= 3) continue;
        const score3 = (r) => {
          if (t.outs < 3) t.scored.add(r.token);
          t.bases.delete(r.token);
        };
        const safe = (r, pos) => {
          if (pos >= 4) score3(r);
          else t.bases.set(r.token, { ...r, pos });
        };
        if (play.result === "BB" || play.result === "HBP") {
          const at = (n) => [...t.bases.values()].find((r) => r.pos === n), a = at(1), b = at(2), c = at(3);
          if (a) {
            if (b) {
              if (c) score3(c);
              safe(b, 3);
            }
            safe(a, 2);
          }
          safe(play.batter, 1);
          continue;
        }
        const lostOut = play.reachedError ? 1 : 0;
        const outs = play.outs || [];
        const virtualThird = outs[2 - t.outs - lostOut];
        const thirdForce = t.outs + lostOut >= 3 || t.outs + lostOut + outs.length >= 3 && virtualThird && (virtualThird.mode === "force" || virtualThird.from === 0 && !virtualThird.safeBases);
        if (thirdForce) {
          t.outs += lostOut + outs.length;
          continue;
        }
        const observed = /* @__PURE__ */ new Set(), beforeTokens = new Set(t.bases.keys());
        for (const a of play.actions || []) {
          observed.add(a.token);
          const old = t.bases.get(a.token);
          if (a.mode === "force" || a.mode === "tag") {
            t.bases.delete(a.token);
            continue;
          }
          if (a.from === 0) continue;
          if (old) safe(old, old.pos + (a.advance > 0 ? Math.max(a.advance, play.hitBases || 0) : 0));
        }
        if (play.hitBases) {
          for (const r of [...t.bases.values()])
            if (!observed.has(r.token)) safe(r, r.pos + play.hitBases);
        }
        if (play.result === "H") safe(play.batter, play.hitBases);
        else if (play.result === "FC" && !play.batterOut) {
          const retired = outs.find((o) => o.from > 0);
          if (!retired || beforeTokens.has(retired.token)) safe(play.batter, 1);
        }
        t.outs += lostOut + outs.length;
      }
      collect();
    }
    collect();
    return result;
  }

  // app/src/main/assets/web/engine.js
  var POSITIONS = [
    "\u6295\u624B",
    "\u6355\u624B",
    "\u4E00\u5792\u624B",
    "\u4E8C\u5792\u624B",
    "\u4E09\u5792\u624B",
    "\u6E38\u51FB\u624B",
    "\u5DE6\u5916\u91CE",
    "\u4E2D\u5916\u91CE",
    "\u53F3\u5916\u91CE",
    "\u81EA\u7531\u4EBA"
  ];
  var clone = (x) => JSON.parse(JSON.stringify(x));
  var uid = () => {
    var _a, _b;
    return ((_b = (_a = globalThis.crypto) == null ? void 0 : _a.randomUUID) == null ? void 0 : _b.call(_a)) || Date.now().toString(36) + Math.random().toString(36).slice(2);
  };
  var emptyStats = () => Object.fromEntries(
    [
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
      "ER"
    ].map((k) => [k, 0])
  );
  function rates(st, sport2 = "baseball") {
    const s = { ...emptyStats(), ...st }, div = (n, d) => d ? n / d : 0;
    return {
      ...s,
      AVG: div(s.H, s.AB),
      OBP: div(s.H + s.BB + s.HBP, s.AB + s.BB + s.HBP + s.SF),
      SLG: div(s.TB, s.AB),
      OPS: div(s.H + s.BB + s.HBP, s.AB + s.BB + s.HBP + s.SF) + div(s.TB, s.AB),
      IP: `${Math.floor(s.OUT / 3)}.${s.OUT % 3}`,
      WHIP: div(3 * (s.HA + s.BBA), s.OUT),
      ERA: div((sport2 === "softball" ? 21 : 27) * s.ER, s.OUT),
      "K/9": div(27 * s.K, s.OUT),
      FPCT: div(s.PO + s.A, s.PO + s.A + s.E),
      "P-S": `${s.P}-${s.STR}`
    };
  }
  function newGame(sport2, teams) {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    return {
      id: uid(),
      rulesVersion: 2,
      twoStrikeFoulOut: false,
      sport: sport2,
      teams: clone(teams),
      created: now,
      startedAt: now,
      events: [],
      draft: null,
      ended: false
    };
  }
  function initial(g) {
    return {
      inning: 1,
      side: 0,
      b: g.sport === "softball" ? 1 : 0,
      s: g.sport === "softball" ? 1 : 0,
      o: 0,
      pa: 0,
      bases: [null, null, null],
      order: [0, 0],
      teams: clone(g.teams),
      score: [
        { R: 0, H: 0, E: 0 },
        { R: 0, H: 0, E: 0 }
      ],
      stats: {},
      lines: [[0], []],
      log: [],
      halfEnded: false,
      ejected: [],
      scorerId: g.scorerId,
      umpireId: g.umpireId
    };
  }
  var batter = (s) => s.teams[s.side].lineup[s.order[s.side] % s.teams[s.side].lineup.length].id;
  var pitcher = (s) => {
    var _a;
    return (_a = s.teams[1 - s.side].lineup.find((p) => p.pos === "\u6295\u624B")) == null ? void 0 : _a.id;
  };
  function add(s, id, k, n = 1) {
    var _a, _b;
    if (id) {
      (_b = (_a = s.stats)[id]) != null ? _b : _a[id] = emptyStats();
      s.stats[id][k] += n;
    }
  }
  function reset(s, g) {
    s.b = g.sport === "softball" ? 1 : 0;
    s.s = g.sport === "softball" ? 1 : 0;
  }
  function finish(s, g) {
    s.pa++;
    s.order[s.side] = (s.order[s.side] + 1) % s.teams[s.side].lineup.length;
    reset(s, g);
    if (s.o >= 3) {
      s.o = 3;
      s.halfEnded = true;
      s.bases = [null, null, null];
    }
  }
  function runnerQueue(s) {
    return [2, 1, 0].filter((i) => s.bases[i]).map((i) => ({ ...s.bases[i], from: i + 1 })).concat([
      {
        id: batter(s),
        pitcher: pitcher(s),
        token: `${s.side}:${s.pa}`,
        from: 0
      }
    ]);
  }
  function advanceLimit(s, actions, id) {
    const q = runnerQueue(s), at = q.findIndex((r) => r.id === id);
    let max = 4;
    for (const lead of q.slice(0, at)) {
      const a = actions.find((a2) => a2.id === lead.id);
      if (a && ["force", "tag"].includes(a.mode)) continue;
      const dest = lead.from + ((a == null ? void 0 : a.advance) || 0) + ((a == null ? void 0 : a.errorAdvance) || 0);
      if (dest < 4) max = Math.min(max, dest - 1);
    }
    return Math.max(-1, max - q[at].from);
  }
  function forceBases(s, id, result = "stop") {
    const r = runnerQueue(s).find((r2) => r2.id === id);
    if (!r) return [];
    if (r.from === 0) return [1, 4];
    const own = [r.from];
    const forced = !["catch", "infieldFly"].includes(result) && Array.from({ length: r.from - 1 }, (_, i) => s.bases[i]).every(Boolean);
    return [.../* @__PURE__ */ new Set([...forced ? [...own, r.from + 1] : own, 4])];
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
    if (!["BB", "HBP", "SF", "SH"].includes(r)) add(s, id, "AB");
    if (["BB", "HBP", "SF", "SH"].includes(r)) add(s, id, r);
    if (r === "BB") add(s, p, "BBA");
    if (r === "HBP") add(s, p, "HBPA");
    if (r === "SO") {
      add(s, id, "SO");
      add(s, p, "K");
    }
  }
  function apply(s, g, e, provisional = false) {
    var _a, _b, _c;
    if (e.type === "ruling" && e.kind !== "awardWalk") return applyRuling(s, g, e);
    if (e.type === "sub") {
      if (e.team !== 0 && e.team !== 1) throw Error("\u65E0\u6548\u7403\u961F");
      const l = s.teams[e.team].lineup;
      if (!l[e.index]) throw Error("\u65E0\u6548\u6362\u4EBA\u4F4D\u7F6E");
      if (e.swap !== void 0) {
        if (!l[e.swap]) throw Error("\u65E0\u6548\u6362\u4F4D");
        [l[e.index].pos, l[e.swap].pos] = [l[e.swap].pos, l[e.index].pos];
      } else {
        if (s.ejected.includes(e.id)) throw Error("\u88AB\u9A71\u9010\u7403\u5458\u4E0D\u80FD\u91CD\u65B0\u4E0A\u573A");
        l[e.index] = { id: e.id, pos: l[e.index].pos };
      }
      return;
    }
    if (e.type === "half") {
      if (!s.halfEnded) throw Error("\u5C1A\u672A\u4E09\u51FA\u5C40");
      s.side = 1 - s.side;
      if (!s.side) s.inning++;
      s.o = 0;
      s.halfEnded = false;
      s.lines[s.side][s.inning - 1] = 0;
      reset(s, g);
      return;
    }
    if (s.halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40");
    const id = batter(s), p = e.pitcher || pitcher(s), beforeOut = s.o, pa = s.pa, beforeBases = runnerQueue(s).filter((r) => r.from), br = { id, pitcher: p, token: `${s.side}:${pa}`, from: 0 };
    if (s.bases.some((r) => (r == null ? void 0 : r.id) === id))
      throw Error("\u5F53\u524D\u6253\u8005\u4ECD\u5728\u5792\u4E0A\uFF0C\u8BF7\u4F7F\u7528\u5B8C\u6574\u6253\u5E8F");
    if (!["ball", "strike", "foul", "hbp", "contact", "ibb", "awardWalk"].includes(e.kind))
      throw Error("\u672A\u77E5\u6295\u7403\u7C7B\u578B");
    if (!["ibb", "awardWalk"].includes(e.kind)) add(s, p, "P");
    if (["strike", "foul", "contact"].includes(e.kind)) add(s, p, "STR");
    let summary2 = "", result = "", play = null;
    if (["ball", "hbp", "ibb", "awardWalk"].includes(e.kind)) {
      if (e.kind === "ball") s.b++;
      if (s.b >= 4 || e.kind !== "ball") {
        result = e.kind === "hbp" ? "HBP" : "BB";
        plate(s, id, p, result);
        if (e.kind === "ibb") {
          add(s, id, "IBB");
          add(s, p, "IBBA");
        }
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
        play = { result, batter: br, runs, outs: [], actions: [], rbi: runs.length };
        finish(s, g);
        summary2 = result === "BB" ? "\u56DB\u574F\u7403\u4FDD\u9001" : "\u89E6\u8EAB\u7403\u4FDD\u9001";
        if (e.kind === "ibb") summary2 = "\u6545\u610F\u56DB\u574F\u7403\u4FDD\u9001 IBB";
        if (e.kind === "awardWalk") summary2 = "\u88C1\u5224\u5224\u7F5A\uFF1A\u5F53\u524D\u6253\u8005\u4FDD\u9001";
      } else summary2 = "\u574F\u7403";
    } else if (e.kind === "strike" || e.kind === "foul") {
      const foulOut = g.sport === "softball" && ((_b = (_a = e.twoStrikeFoulOut) != null ? _a : g.twoStrikeFoulOut) != null ? _b : true);
      if (e.kind === "strike" || s.s < 2 || foulOut) s.s++;
      summary2 = e.kind === "foul" ? "\u754C\u5916\u7403" : "\u597D\u7403";
      if (s.s >= 3) {
        result = "SO";
        plate(s, id, p, result);
        out(s, p, (_c = s.teams[1 - s.side].lineup.find((x) => x.pos === "\u6355\u624B")) == null ? void 0 : _c.id);
        play = {
          result,
          batter: br,
          runs: [],
          outs: [{ ...br, mode: "strike" }],
          actions: []
        };
        finish(s, g);
        summary2 = e.kind === "foul" ? "\u4E24\u597D\u7403\u540E\u754C\u5916\u51FA\u5C40" : "\u4E09\u632F\u51FA\u5C40";
      }
    } else {
      const q = runnerQueue(s).map((r) => r.from === 0 ? br : r), actions = e.actions || [], caught = ["catch", "infieldFly"].includes(e.result), error = e.result === "error";
      if (!["catch", "stop", "error", "infieldFly"].includes(e.result))
        throw Error("\u8BF7\u9009\u62E9\u91CE\u624B\u5904\u7406\u7ED3\u679C");
      if (caught && ["ground", "bunt"].includes(e.trajectory))
        throw Error("\u5730\u6EDA\u7403\u4E0D\u80FD\u63A5\u6740");
      if (e.result === "infieldFly" && (beforeOut >= 2 || !s.bases[0] || !s.bases[1] || e.trajectory !== "fly"))
        throw Error("\u5185\u91CE\u9AD8\u98DE\u89C4\u5219\u9700\u4E24\u51FA\u5C40\u524D\u3001\u4E00\u4E8C\u5792\u6709\u4EBA\u3001\u975E\u5E73\u98DE\u6216\u89E6\u51FB");
      if (new Set(actions.map((a) => a.id)).size !== actions.length)
        throw Error("\u8DD1\u8005\u4E0D\u80FD\u91CD\u590D\u5904\u7406");
      for (const a of actions) {
        const r = q.find((r2) => r2.id === a.id);
        if (!r) throw Error("\u65E0\u6548\u8DD1\u8005");
        if (a.mode === "advance") {
          const n = a.advance || 0, err = a.errorAdvance || 0;
          if (!Number.isInteger(n) || !Number.isInteger(err) || n < 0 || err < 0 || r.from + n + err > 4 || !r.from && !n && !err)
            throw Error("\u8FDB\u5792\u6570\u65E0\u6548");
          if (err && !a.errorFielder) throw Error("\u8BF7\u9009\u62E9\u5931\u8BEF\u91CE\u624B");
          if (g.rulesVersion >= 2 && n + err > advanceLimit(s, actions, a.id))
            throw Error("\u540E\u4F4D\u8DD1\u8005\u4E0D\u80FD\u8D85\u8FC7\u524D\u4F4D\u8DD1\u8005\uFF0C\u4E5F\u4E0D\u80FD\u5360\u636E\u540C\u4E00\u5792\u5305");
        }
      }
      const outs = [], runs = [], dest = /* @__PURE__ */ new Map(), assists = /* @__PURE__ */ new Set(), involved = /* @__PURE__ */ new Set(), errors = /* @__PURE__ */ new Set();
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
        const a = actions.find((a2) => a2.id === r.id);
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
          const n = r.from + (a.advance || 0) + (a.errorAdvance || 0), rr = { ...r };
          if (n >= 4)
            runs.push({ ...rr, normalScore: r.from + (a.advance || 0) >= 4 });
          else if (n > 0) {
            if (dest.has(n)) throw Error("\u540C\u4E00\u5792\u5305\u4E0D\u80FD\u6709\u4E24\u540D\u8DD1\u8005");
            dest.set(n, rr);
          }
        }
      }
      const ba = actions.find((a) => a.id === id), runnerOut = outs.some((o) => o.from > 0), batterOut = caught || outs.some((o) => o.from === 0), complete = q.every(
        (r) => !r.from && caught || actions.some((a) => a.id === r.id)
      );
      const third = s.o >= 3 ? e.thirdOutId ? outs.find((o) => o.id === e.thirdOutId) : outs[2 - beforeOut] : null;
      const cancel = third && (third.mode === "force" || third.from === 0), valid = cancel ? [] : runs.filter(
        (r) => {
          var _a2;
          return !third || e.runsBeforeThird === true || ((_a2 = actions.find((a) => a.id === r.id)) == null ? void 0 : _a2.beforeThird) === true;
        }
      );
      valid.forEach((r) => run(s, r));
      let hitBases = 0;
      result = "OUT";
      if (caught || error) {
        if (beforeOut < 2 && valid.some((r) => r.normalScore) && e.zone !== "\u5185\u91CE" && ["fly", "line"].includes(e.trajectory))
          result = "SF";
        else result = error ? "E" : "OUT";
      } else if (ba && !batterOut) {
        if (!ba.advance && ba.errorAdvance) result = "E";
        else if (runnerOut || e.fieldersChoice) result = "FC";
        else {
          result = "H";
          hitBases = Math.min(4, e.awardBases || ba.advance);
        }
      }
      if (e.trajectory === "bunt" && beforeOut < 2 && !runnerOut && actions.some((a) => a.id !== id && a.advance > 0) && (batterOut || error))
        result = "SH";
      if (!g.rulesVersion && e.scoring) {
        result = e.scoring;
        hitBases = e.hitBases || hitBases;
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
        if (!complete) throw Error("\u8BF7\u5B8C\u6210\u6240\u6709\u8DD1\u8005\u7684\u8BB0\u5F55");
        if (result === "H" && (!hitBases || hitBases > 4))
          throw Error("\u5B89\u6253\u5792\u6570\u65E0\u6548");
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
        const dp = outs.length === 2, tp = outs.length >= 3, groundDP = ["ground", "bunt"].includes(e.trajectory) && dp && outs.some((o) => o.mode === "force");
        if (dp || tp) {
          involved.forEach((f) => add(s, f, tp ? "TP" : "DP"));
          if (groundDP) add(s, id, "GDP");
        }
        let rbi = groundDP ? 0 : valid.filter((r) => r.normalScore && result !== "E").length;
        if (!g.rulesVersion && Number.isInteger(e.rbi)) rbi = e.rbi;
        add(s, id, "RBI", rbi);
        const outLabel = tp ? "\u4E09\u6740\u6253" : dp ? "\u53CC\u6740\u6253" : e.result === "infieldFly" ? "\u5185\u91CE\u9AD8\u98DE\u7403\u51FA\u5C40" : caught ? e.trajectory === "fly" ? "\u9AD8\u98DE\u7403\u51FA\u5C40" : "\u63A5\u6740\u51FA\u5C40" : ["ground", "bunt"].includes(e.trajectory) ? "\u5730\u6EDA\u7403\u51FA\u5C40" : "\u51FB\u7403\u51FA\u5C40";
        summary2 = {
          OUT: outLabel,
          H: ["", "\u4E00\u5792\u5B89\u6253", "\u4E8C\u5792\u5B89\u6253", "\u4E09\u5792\u5B89\u6253", "\u5168\u5792\u6253"][hitBases],
          E: "\u5931\u8BEF\u4E0A\u5792",
          FC: "\u91CE\u624B\u9009\u62E9\u4E0A\u5792",
          SF: "\u727A\u7272\u98DE\u7403",
          SH: "\u727A\u7272\u89E6\u51FB"
        }[result];
        if ((dp || tp) && result !== "OUT") summary2 += ` \xB7 ${outLabel}`;
        if (valid.length) summary2 += ` \xB7 ${valid.length} \u5F97\u5206 / ${rbi} RBI`;
        const errorBases = actions.reduce((n, a) => n + (a.errorAdvance || 0), 0), errorRuns = valid.filter((r) => !r.normalScore).length;
        if (errors.size)
          summary2 += ` \xB7 ${errors.size} E / \u5931\u8BEF\u8FDB\u5792 ${errorBases} / \u5931\u8BEF\u5F97\u5206 ${errorRuns}`;
        play = {
          result,
          batter: { ...br },
          batterOut,
          reachedError: error || result === "E",
          hitBases,
          runs: valid,
          outs,
          actions: actions.map((a) => ({
            ...q.find((r) => r.id === a.id),
            ...a
          })),
          rbi,
          errorBases,
          errorRuns,
          dp,
          tp
        };
      } else summary2 = "\u8DD1\u8005\u5904\u7406\u4E2D";
      s.bases = [1, 2, 3].map((n) => dest.get(n) || null);
      if (complete || !provisional) finish(s, g);
    }
    s.log.push({
      id: e.id,
      pa,
      inning: s.inning,
      side: s.side,
      defense: 1 - s.side,
      pitcher: p,
      batter: id,
      kind: e.kind,
      summary: summary2,
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
      trajectory: e.trajectory
    });
  }
  function replay(g, includeDraft = false) {
    var _a;
    const s = initial(g);
    for (const e of g.events) apply(s, g, e);
    if (includeDraft && g.pendingPitch) apply(s, g, g.pendingPitch);
    if (includeDraft && ((_a = g.draft) == null ? void 0 : _a.result)) apply(s, g, g.draft, true);
    const er = earnedRuns(s.log);
    for (const [id, st] of Object.entries(s.stats)) st.ER = er[id] || 0;
    return s;
  }
  function commit(g, e) {
    if (g.ended) throw Error("\u6BD4\u8D5B\u5DF2\u7ED3\u675F");
    const n = clone(g), s = replay(g);
    if (e.kind === "ibb" && s.bases.every(Boolean)) throw Error("\u6EE1\u5792\u65F6\u7981\u6B62\u6545\u610F\u56DB\u574F\u7403\u4FDD\u9001\uFF1B\u4ECD\u53EF\u6B63\u5E38\u8BB0\u5F55\u574F\u7403\u6216\u89E6\u8EAB\u7403");
    if (e.kind === "contact") {
      if (g.sport === "softball" && e.trajectory === "bunt") throw Error("\u6162\u6295\u5792\u7403\u4E0D\u5141\u8BB8\u89E6\u51FB");
      for (const a of e.actions || []) if (a.mode === "force" && !forceBases(s, a.id, e.result).includes(a.base)) throw Error("\u8BF7\u9009\u62E9\u539F\u5792\u5305\u3001\u5F3A\u5236\u8FDB\u5792\u5792\u5305\u6216\u672C\u5792");
    }
    e = {
      ...e,
      eventId: e.eventId || uid(),
      pitcher: e.pitcher || pitcher(s),
      time: e.time || (/* @__PURE__ */ new Date()).toISOString()
    };
    if (e.type === "pitch" && e.kind === "foul") e.twoStrikeFoulOut = false;
    if (e.type === "pitch" || e.type === "ruling") {
      e.id = e.id || uid();
      e.pa = s.pa;
      n.editing = false;
      n.pendingPitch = null;
    }
    apply(s, g, e);
    n.events.push(e);
    n.draft = null;
    return n;
  }
  function canUndo(g) {
    if (g.ended || g.draft || g.pendingPitch) return false;
    const s = replay(g), last = s.log.at(-1);
    return !!last && last.pa === s.pa && ["ball", "strike", "foul"].includes(last.kind) && !last.terminal;
  }
  function recordCount(g, kind) {
    if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
    const next = commit(g, { type: "pitch", kind }), last = replay(next).log.at(-1);
    if (last.terminal) {
      const pending = clone(g);
      pending.pendingPitch = next.events.at(-1);
      return pending;
    }
    return next;
  }
  function confirmCount(g) {
    if (!g.pendingPitch) throw Error("\u6CA1\u6709\u5F85\u786E\u8BA4\u8BB0\u5F55");
    return commit(g, g.pendingPitch);
  }
  function cancelCount(g) {
    const n = clone(g);
    n.pendingPitch = null;
    return n;
  }
  function stageRuling(g, event) {
    if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
    const next = commit(g, { ...event, type: "ruling" }), n = clone(g);
    n.pendingPitch = next.events.at(-1);
    return n;
  }
  function applyRuling(s, g, e) {
    if (s.halfEnded && e.kind !== "eject") throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40");
    const p = e.pitcher || pitcher(s), id = batter(s), pa = s.pa, beforeOut = s.o, beforeBases = runnerQueue(s).filter((r) => r.from);
    let summary2 = "", play = null;
    if (e.kind === "advanceAward") {
      if (![1, 2, 3].includes(e.bases) || !beforeBases.length) throw Error("\u8BF7\u9009\u62E9\u5792\u4E0A\u8DD1\u8005\u7684\u6709\u6548\u8FDB\u5792\u6570");
      const actions = beforeBases.map((r) => ({ ...r, mode: "advance", advance: Math.min(e.bases, 4 - r.from) })), runs = [];
      s.bases = [null, null, null];
      for (const a of actions) {
        if (a.from + a.advance === 4) {
          run(s, a);
          runs.push(a);
        } else s.bases[a.from + a.advance - 1] = { ...a };
      }
      play = { result: "PENALTY", actions, runs, outs: [], rbi: 0 };
      summary2 = `\u88C1\u5224\u5224\u7F5A\uFF1A\u5792\u4E0A\u8DD1\u8005\u524D\u8FDB ${e.bases} \u5792 \xB7 ${runs.length} \u5F97\u5206\uFF08\u65E0 RBI\uFF09`;
    } else if (e.kind === "runnerOut") {
      const r = beforeBases.find((r2) => r2.id === e.runnerId);
      if (!r) throw Error("\u8BF7\u9009\u62E9\u5F53\u524D\u5792\u4E0A\u8DD1\u8005");
      out(s, p, null);
      s.bases[r.from - 1] = null;
      play = { result: "PENALTY", actions: [{ ...r, mode: "tag" }], runs: [], outs: [{ ...r, mode: "tag" }], rbi: 0 };
      if (s.o >= 3) {
        s.o = 3;
        s.halfEnded = true;
        s.bases = [null, null, null];
        reset(s, g);
      }
      summary2 = "\u88C1\u5224\u5224\u7F5A\uFF1A" + (e.runnerName || "\u6240\u9009\u8DD1\u8005") + "\u51FA\u5C40";
    } else if (e.kind === "eject") {
      if (!e.personId || s.ejected.includes(e.personId)) throw Error("\u8BF7\u9009\u62E9\u5C1A\u672A\u88AB\u9A71\u9010\u7684\u4EBA");
      const t = s.teams.find((t2) => t2.lineup.some((x) => x.id === e.personId));
      if (t) {
        if (!e.replacementId || s.ejected.includes(e.replacementId) || s.teams.some((t2) => t2.lineup.some((x) => x.id === e.replacementId))) throw Error("\u9A71\u9010\u573A\u4E0A\u7403\u5458\u65F6\u8BF7\u9009\u62E9\u672A\u4E0A\u573A\u7684\u66FF\u8865");
        const slot = t.lineup.find((x) => x.id === e.personId);
        slot.id = e.replacementId;
        for (const r of s.bases) if ((r == null ? void 0 : r.id) === e.personId) r.id = e.replacementId;
      }
      s.ejected.push(e.personId);
      summary2 = "\u88C1\u5224\u5224\u7F5A\uFF1A\u9A71\u9010" + (e.personName || "\u6240\u9009\u4EBA\u5458") + (e.replacementId ? "\uFF0C\u66FF\u6362\u4E3A " + (e.replacementName || "\u6240\u9009\u66FF\u8865") : "") + (t ? "\uFF0C\u7EE7\u627F\u4F4D\u7F6E\u4E0E\u6253\u5E8F" : "");
      for (const role of ["scorerId", "umpireId"]) if (s[role] === e.personId) {
        if (!e.replacementId) throw Error("\u8BF7\u9009\u62E9\u5DE5\u4F5C\u4EBA\u5458\u66FF\u6362\u4EBA\u5458");
        s[role] = e.replacementId;
      }
    } else throw Error("\u672A\u77E5\u5224\u7F5A");
    s.log.push({ id: e.id, pa, inning: s.inning, side: s.side, defense: 1 - s.side, pitcher: p, batter: id, kind: e.kind, summary: summary2, result: "PENALTY", terminal: false, b: s.b, s: s.s, o: s.o, beforeOut, beforeBases, play, time: e.time });
  }
  function undo(g) {
    if (!canUndo(g)) throw Error("\u53EA\u80FD\u64A4\u9500\u5F53\u524D\u672A\u7ED3\u675F\u6253\u5E2D\u7684 B\u3001S\u3001Foul");
    const n = clone(g);
    let i = n.events.length - 1;
    while (i >= 0 && n.events[i].type !== "pitch") i--;
    const removed = n.events.splice(i, 1)[0];
    return { game: n, removed };
  }
  function totals(games, sport2) {
    var _a;
    const total = {};
    for (const g of games.filter((g2) => g2.sport === sport2))
      for (const [id, st] of Object.entries(replay(g, true).stats)) {
        (_a = total[id]) != null ? _a : total[id] = emptyStats();
        for (const k of Object.keys(st)) total[id][k] += st[k];
      }
    return Object.fromEntries(
      Object.entries(total).map(([id, s]) => [id, rates(s, sport2)])
    );
  }
  function inningBatting(s, id) {
    var _a;
    const st = emptyStats(), events = s.log.filter(
      (l) => l.inning === s.inning && l.batter === id && l.terminal
    ), tags = [];
    for (const l of events) {
      st.PA++;
      if (!["BB", "HBP", "SF", "SH"].includes(l.result)) st.AB++;
      if (l.result === "H") {
        st.H++;
        tags.push(l.play.hitBases === 4 ? "HR" : `${l.play.hitBases}B`);
      } else if (l.result === "SO") tags.push("K");
      else tags.push(l.result);
      st.RBI += ((_a = l.play) == null ? void 0 : _a.rbi) || 0;
    }
    return {
      ...st,
      text: `${st.H}-${st.AB}${tags.length ? " " + tags.join(", ") : ""}${st.RBI ? " \xB7 " + st.RBI + " RBI" : ""}`
    };
  }

  // app/src/main/assets/web/roster.js
  var normalizeName = (value) => String(value || "").normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
  function validatePlayer(players2, player) {
    var _a;
    if (!((_a = player.name) == null ? void 0 : _a.trim())) throw Error("\u8BF7\u8F93\u5165\u59D3\u540D");
    if (players2.some(
      (p) => p.id !== player.id && normalizeName(p.name) === normalizeName(player.name)
    ))
      throw Error("\u7403\u5458\u59D3\u540D\u5DF2\u5B58\u5728\uFF0C\u8BF7\u4F7F\u7528\u4E0D\u540C\u59D3\u540D\uFF08\u542B\u5DF2\u5220\u9664\u7403\u5458\uFF09");
    if (!["L", "R", "S"].includes(player.bats) || !["L", "R"].includes(player.throws))
      throw Error("\u8BF7\u9009\u62E9\u6253\u51FB\u624B\u548C\u6295\u7403\u624B");
    return { ...player, name: player.name.trim() };
  }
  function migrateRoster(players2) {
    var _a;
    const used = /* @__PURE__ */ new Set();
    for (const p of players2) {
      let n = ((_a = p.name) == null ? void 0 : _a.trim()) || "\u672A\u547D\u540D\u7403\u5458", i = 2, base = n;
      while (used.has(normalizeName(n))) n = `${base}\uFF08${i++}\uFF09`;
      if (n !== p.name) p.previousName = p.name;
      p.name = n;
      used.add(normalizeName(n));
      p.bats = p.bats || "";
      p.throws = p.throws || "";
    }
  }

  // app/src/main/assets/web/archive.js
  var gameYear = (g) => String(new Date(g.startedAt || g.created).getFullYear());
  var years = (games) => [...new Set(games.map(gameYear))].sort().reverse();
  function archiveId(g) {
    const a = Date.parse(g.startedAt), b = Date.parse(g.endedAt);
    if (!g.ended || !Number.isFinite(a) || !Number.isFinite(b) || b < a) throw Error("\u6BD4\u8D5B\u5F00\u59CB\u6216\u7ED3\u675F\u65F6\u95F4\u65E0\u6548");
    return `${new Date(a).toISOString()}_${new Date(b).toISOString()}`;
  }
  function refs(g) {
    const set = /* @__PURE__ */ new Set();
    const add2 = (id) => {
      if (id) set.add(id);
    };
    g.teams.forEach((t) => t.lineup.forEach((p) => add2(p.id)));
    add2(g.scorerId);
    add2(g.umpireId);
    for (const e of g.events) {
      if (e.type === "sub" && e.swap === void 0) add2(e.id);
      for (const k of ["pitcher", "fielder", "putout", "errorFielder", "thirdOutId", "runnerId", "personId", "replacementId"]) add2(e[k]);
      for (const a of e.actions || []) {
        add2(a.id);
        add2(a.putout);
        add2(a.errorFielder);
      }
    }
    return set;
  }
  function exportArchive(db2, selectedYears) {
    const games = db2.games.filter((g) => g.ended && selectedYears.includes(gameYear(g))).map((g) => ({ ...clone(g), archiveId: archiveId(g), draft: null, pendingPitch: null }));
    if (!games.length) throw Error("\u6240\u9009\u5E74\u4EFD\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u6BD4\u8D5B");
    const ids = new Set(games.flatMap((g) => [...refs(g)]));
    return { format: "diamond-notebook", version: 1, exportedAt: (/* @__PURE__ */ new Date()).toISOString(), players: db2.players.filter((p) => ids.has(p.id)).map(clone), games };
  }
  function importArchive(db2, text) {
    if (text.length > 20 * 1024 * 1024) throw Error("JSON \u6587\u4EF6\u8FC7\u5927\uFF08\u4E0A\u9650 20 MB\uFF09");
    const data = JSON.parse(text);
    if (data.format !== "diamond-notebook" || data.version !== 1 || !Array.isArray(data.games) || !Array.isArray(data.players)) throw Error("\u4E0D\u662F\u6709\u6548\u7684\u94BB\u77F3\u8BB0\u5206\u6BD4\u8D5B\u6587\u4EF6");
    const next = clone(db2), existing = new Set(next.games.filter((g) => g.ended).map(archiveId)), added = [], restored = [], map = /* @__PURE__ */ new Map(), incoming = /* @__PURE__ */ new Map();
    for (const p of data.players) {
      if (typeof p.id !== "string" || !p.id || typeof p.name !== "string" || !p.name.trim() || p.name.length > 100 || incoming.has(p.id)) throw Error("\u7403\u5458\u4FE1\u606F\u65E0\u6548\u6216\u91CD\u590D");
      incoming.set(p.id, p);
    }
    let count = 0, skipped = 0;
    for (const raw of data.games) {
      const g = clone(raw), key = archiveId(g);
      if (g.archiveId !== key) throw Error("\u6BD4\u8D5B\u8EAB\u4EFD\u4E0E\u5F00\u59CB/\u7ED3\u675F\u65F6\u95F4\u4E0D\u4E00\u81F4");
      if (existing.has(key)) {
        skipped++;
        continue;
      }
      if (!["baseball", "softball"].includes(g.sport) || !Array.isArray(g.teams) || g.teams.length !== 2 || !Array.isArray(g.events) || g.events.length > 1e5) throw Error("\u6BD4\u8D5B\u7ED3\u6784\u65E0\u6548");
      for (const t of g.teams) if (typeof t.name !== "string" || !Array.isArray(t.lineup) || t.lineup.length < 2 || t.lineup.length > 10 || t.lineup.some((p) => !POSITIONS.includes(p.pos))) throw Error("\u7403\u961F\u9635\u5BB9\u65E0\u6548");
      for (const e of g.events) if (!["pitch", "sub", "half", "ruling"].includes(e.type)) throw Error("\u672A\u77E5\u6BD4\u8D5B\u4E8B\u4EF6");
      for (const id of refs(g)) {
        if (map.has(id)) continue;
        const p = incoming.get(id);
        if (!p) throw Error("\u6587\u4EF6\u7F3A\u5C11\u6BD4\u8D5B\u6240\u9700\u7684\u7403\u5458\u4FE1\u606F");
        let local = next.players.find((x) => normalizeName(x.name) === normalizeName(p.name));
        if (!local) {
          local = { id: uid(), name: p.name.trim(), number: String(p.number || "").slice(0, 8), bats: ["L", "R", "S"].includes(p.bats) ? p.bats : "R", throws: ["L", "R"].includes(p.throws) ? p.throws : "R" };
          next.players.push(local);
          added.push(local.name);
        } else if (local.deleted) {
          local.deleted = false;
          restored.push(local.name);
        }
        map.set(id, local.id);
      }
      const remap = (o, k) => {
        if (o[k]) o[k] = map.get(o[k]);
      };
      for (const t of g.teams) for (const p of t.lineup) remap(p, "id");
      remap(g, "scorerId");
      remap(g, "umpireId");
      for (const e of g.events) {
        if (e.type === "sub" && e.swap === void 0) remap(e, "id");
        for (const k of ["pitcher", "fielder", "putout", "errorFielder", "thirdOutId", "runnerId", "personId", "replacementId"]) remap(e, k);
        for (const a of e.actions || []) {
          remap(a, "id");
          remap(a, "putout");
          remap(a, "errorFielder");
        }
      }
      const lineup = g.teams.flatMap((t) => t.lineup.map((p) => p.id));
      if (new Set(lineup).size !== lineup.length) throw Error("\u540C\u540D\u6620\u5C04\u5BFC\u81F4\u9635\u5BB9\u91CD\u590D\uFF0C\u8BF7\u6838\u5BF9\u7403\u5458\u59D3\u540D");
      g.id = uid();
      g.draft = null;
      g.pendingPitch = null;
      g.rulesVersion = 2;
      const state = replay(g);
      for (const st of Object.values(state.stats)) for (const v of Object.values(st)) if (!Number.isFinite(v) || v < 0) throw Error("\u6BD4\u8D5B\u7EDF\u8BA1\u65E0\u6548");
      next.games.push(g);
      existing.add(key);
      count++;
    }
    return { db: next, count, skipped, added, restored };
  }
  function downloadJson(data, name2) {
    const text = JSON.stringify(data, null, 2);
    if (window.AndroidStore) {
      window.AndroidStore.exportJson(name2, text);
      return;
    }
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" })), a = document.createElement("a");
    a.href = url;
    a.download = name2;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2e3);
  }

  // app/src/main/assets/web/statistics.js
  var BATTING = [
    "AB",
    "H",
    "RBI",
    "HBP",
    "OPS",
    "R",
    "BB",
    "IBB",
    "SO",
    "SF",
    "SH",
    "2B",
    "3B",
    "HR",
    "GDP",
    "AVG",
    "OBP",
    "SLG",
    "PA",
    "TB"
  ];
  var FIELDING = ["E", "PO", "A", "DP", "TP", "FPCT"];
  var PITCHING = [
    "P-S",
    "P",
    "STR",
    "BF",
    "IP",
    "HA",
    "BBA",
    "HBPA",
    "K",
    "RA",
    "ER",
    "ERA",
    "WHIP",
    "IBBA",
    "K/9"
  ];
  function statSheets(groups, players2, meta = {}) {
    const player = (id) => players2.find((p) => p.id === id) || { name: "\u5DF2\u5220\u9664\u7403\u5458" }, st = (g, id) => rates(g.stats[id] || emptyStats(), meta.sport), all = [...BATTING, ...FIELDING, ...PITCHING];
    const rows = [
      ["\u9879\u76EE", meta.sport === "softball" ? "\u6162\u6295\u5792\u7403" : "\u68D2\u7403"],
      ["\u5F00\u59CB\u65F6\u95F4", meta.startedAt || "\u7D2F\u8BA1\u7EDF\u8BA1"],
      ["\u7ED3\u675F\u65F6\u95F4", meta.endedAt || "\u8FDB\u884C\u4E2D / \u4E0D\u9002\u7528"],
      [],
      ["\u7403\u961F", "\u59D3\u540D", "\u6253\u51FB\u624B", "\u6295\u7403\u624B", ...all]
    ];
    for (const g of groups)
      for (const id of g.ids) {
        const p = player(id), s = st(g, id);
        rows.push([
          g.name,
          p.name,
          p.bats || "\u2014",
          p.throws || "\u2014",
          ...all.map((k) => PITCHING.includes(k) && !s.P ? "" : s[k])
        ]);
      }
    const sheets = [{ name: "\u5168\u90E8\u6570\u636E", rows }];
    groups.forEach((g, i) => {
      for (const [category, keys] of [
        ["\u6253\u51FB", BATTING],
        ["\u5B88\u5907", FIELDING],
        ["\u6295\u7403", PITCHING]
      ])
        sheets.push({
          name: `${i + 1}${g.name}-${category}`.replace(/[\[\]:*?/\\]/g, "").slice(0, 31),
          rows: [
            ["\u7403\u961F", "\u7403\u5458", "\u6253\u51FB\u624B", "\u6295\u7403\u624B", ...keys],
            ...g.ids.filter((id) => category !== "\u6295\u7403" || st(g, id).P > 0).map((id) => [
              g.name,
              player(id).name,
              player(id).bats || "\u2014",
              player(id).throws || "\u2014",
              ...keys.map((k) => st(g, id)[k])
            ])
          ]
        });
    });
    return sheets;
  }
  function teamIds(g, team) {
    return [.../* @__PURE__ */ new Set([...g.teams[team].lineup.map((p) => p.id), ...g.events.filter((e) => e.type === "sub" && e.team === team && e.swap === void 0).map((e) => e.id), ...g.events.filter((e) => e.type === "ruling" && e.kind === "eject" && e.team === team && e.replacementId).map((e) => e.replacementId)])];
  }

  // app/src/main/assets/web/season-ui.js
  function officialFields(setup2, players2, esc2) {
    return `<section class="card officials"><h3>\u6BD4\u8D5B\u5DE5\u4F5C\u4EBA\u5458</h3>${[["scorerId", "\u8BB0\u5F55\u8005"], ["umpireId", "\u88C1\u5224"]].map(([key, label]) => `<label>${label}<select data-official="${key}"><option value="">\u4ECE\u7403\u5458\u6CE8\u518C\u8868\u9009\u62E9</option>${players2.filter((p) => !p.deleted).map((p) => `<option value="${esc2(p.id)}" ${setup2[key] === p.id ? "selected" : ""}>${esc2(p.name)}</option>`).join("")}</select></label>`).join("")}<small class="muted">\u8BB0\u5F55\u8005\u4E0E\u88C1\u5224\u53EF\u4EE5\u662F\u540C\u4E00\u4EBA\uFF0C\u4E5F\u53EF\u4EE5\u53C2\u4E0E\u6BD4\u8D5B\u3002</small></section>`;
  }
  function rulingDialog(g, ctx, players2) {
    const { btn: btn2, esc: esc2, name: name2 } = ctx, s = replay(g), runners = runnerQueue(s).filter((r) => r.from);
    return `<h2>\u88C1\u5224\u5224\u7F5A</h2><h3>\u8FDB\u653B\u65B9\u5792\u4E0A\u8DD1\u8005\u83B7\u5224\u8FDB\u5792</h3><div class="actions">${[1, 2, 3].map((n) => btn2(`\u524D\u8FDB ${n} \u5792`, "rulingAdvance", `data-n="${n}"`, "primary")).join("")}</div>${btn2("\u5F53\u524D\u6253\u8005\u4FDD\u9001", "rulingWalk", "", "wide")}<h3>\u5F53\u524D\u8DD1\u8005\u51FA\u5C40</h3><select id="penaltyRunner"><option value="">\u9009\u62E9\u5792\u4E0A\u8DD1\u8005</option>${runners.map((r) => `<option value="${esc2(r.id)}">${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792"][r.from]} \xB7 ${esc2(name2(r.id))}</option>`).join("")}</select>${btn2("\u5224\u8DD1\u8005\u51FA\u5C40", "rulingOut", "", "danger wide")}<h3>\u9A71\u9010\u4EBA\u5458</h3><select id="ejectPerson"><option value="">\u9009\u62E9\u4EBA\u5458</option>${players2.filter((p) => !p.deleted && !s.ejected.includes(p.id)).map((p) => `<option value="${esc2(p.id)}">${esc2(p.name)}</option>`).join("")}</select>${btn2("\u9A71\u9010\u5E76\u9009\u62E9\u66FF\u6362\u4EBA\u5458", "rulingEject", "", "danger wide")}${btn2("\u5173\u95ED", "closePanel", "", "ghost wide")}`;
  }
  function ejectDialog(g, ctx, players2, id) {
    const { btn: btn2, esc: esc2, name: name2 } = ctx, s = replay(g), team = s.teams.findIndex((t) => t.lineup.some((p) => p.id === id)), index = team < 0 ? -1 : s.teams[team].lineup.findIndex((p) => p.id === id);
    const officer = id === s.scorerId || id === s.umpireId;
    return `<h2>\u9A71\u9010 \xB7 \u66FF\u6362\u4EBA\u5458</h2><p>${esc2(name2(id))}${team < 0 ? "" : ` \xB7 \u7B2C ${index + 1} \u68D2 \xB7 ${esc2(s.teams[team].lineup[index].pos)}`}</p><p class="muted">${team >= 0 ? "\u66FF\u8865\u7EE7\u627F\u539F\u68D2\u6B21\u3001\u5B88\u5907\u4F4D\u7F6E\u53CA\u5792\u4E0A\u72B6\u6001\u3002" : officer ? "\u66FF\u6362\u4EBA\u5458\u63A5\u4EFB\u5176\u6BD4\u8D5B\u5DE5\u4F5C\u4EBA\u5458\u804C\u8D23\u3002" : "\u8BE5\u4EBA\u5458\u4E0D\u5728\u5F53\u524D\u573A\u4E0A\u9635\u5BB9\u4E2D\u3002"}</p>${team >= 0 || officer ? `<label>\u9009\u62E9\u66FF\u6362\u4EBA\u5458</label><select id="ejectReplacement"><option value="">\u4ECE\u6CE8\u518C\u8868\u9009\u62E9</option>${players2.filter((p) => !p.deleted && p.id !== id && !s.ejected.includes(p.id) && (team < 0 || !s.teams.some((t) => t.lineup.some((x) => x.id === p.id)))).map((p) => `<option value="${esc2(p.id)}">${esc2(p.name)}</option>`).join("")}</select>` : ""}${btn2("\u67E5\u770B\u5224\u7F5A\u7ED3\u679C", "ejectReady", `data-id="${esc2(id)}" data-team="${team}"`, "primary wide")}${btn2("\u8FD4\u56DE\u5224\u7F5A", "ruling", "", "ghost wide")}`;
  }
  function boxScore(g, ctx) {
    const { esc: esc2, name: name2 } = ctx, s = replay(g, true), fmt = (v, k) => ["AVG", "OBP", "SLG", "OPS", "FPCT"].includes(k) ? Number(v || 0).toFixed(3) : ["ERA", "WHIP", "K/9"].includes(k) ? Number(v || 0).toFixed(2) : v != null ? v : 0;
    const table2 = (ids, keys, st, label) => `<h3>${label}</h3><div class="box-table"><table><thead><tr><th>\u7403\u5458</th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${ids.map((id) => `<tr><th title="${esc2(name2(id))}">${esc2(name2(id))}</th>${keys.map((k) => `<td>${fmt(st[id][k], k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return `<div class="box-score">${g.teams.map((t, i) => {
      const ids = teamIds(g, i), st = Object.fromEntries(ids.map((id) => [id, rates(s.stats[id] || emptyStats(), g.sport)])), pitchers = ids.filter((id) => st[id].P > 0);
      const notes = (keys, list = ids) => keys.map((k) => {
        const values = list.filter((id) => Number(st[id][k]) > 0).map((id) => `${name2(id)} ${fmt(st[id][k], k)}`);
        return values.length ? `<p><b>${k}</b> ${esc2(values.join("\uFF1B"))}</p>` : "";
      }).join("");
      return `<section class="box-team"><h2>${i ? "\u4E3B\u961F" : "\u5BA2\u961F"} \xB7 ${esc2(t.name)} <strong>${s.score[i].R}</strong></h2>${table2(ids, ["AB", "R", "H", "RBI", "BB", "SO"], st, "\u6253\u51FB")}<div class="box-notes">${notes(["2B", "3B", "HR", "HBP", "IBB", "SF", "SH", "GDP"])}</div><details><summary>\u9AD8\u7EA7\u6253\u51FB\u6570\u636E</summary>${table2(ids, ["AVG", "OBP", "SLG", "OPS"], st, "\u672C\u573A\u6BD4\u7387")}</details>${pitchers.length ? table2(pitchers, ["IP", "HA", "RA", "ER", "BBA", "K"], st, "\u6295\u7403") + table2(pitchers, ["P-S", "HBPA", "IBBA", "ERA", "K/9"], st, "\u6295\u7403\u660E\u7EC6") : ""}${table2(ids, ["PO", "A", "E", "DP", "TP"], st, "\u5B88\u5907")}</section>`;
    }).join("")}</div>`;
  }

  // app/src/main/assets/web/match-ui.js
  var zoneNames = ["\u5DE6\u5916", "\u5DE6\u4E2D\u5916", "\u4E2D\u5916", "\u53F3\u4E2D\u5916", "\u53F3\u5916"];
  function field(s, landing = false) {
    const pt = (a) => [
      220 + Math.sin(a * Math.PI / 180) * 290,
      330 - Math.cos(a * Math.PI / 180) * 290
    ];
    return `<svg class="diamond-field" viewBox="0 0 440 365" role="img" aria-label="90\u5EA6\u68D2\u7403\u573A\uFF0C\u4E09\u4E2A\u5792\u5305\uFF1A\u7EA2\u8272\u6709\u4EBA\uFF0C\u7A7A\u5FC3\u65E0\u4EBA"><rect width="440" height="365" fill="transparent" />${zoneNames.map((z, i) => {
      const a = pt(-45 + i * 18), b = pt(-27 + i * 18);
      return `<path d="M220 330L${a}A290 290 0 0 1 ${b}Z" fill="${i % 2 ? "#355b49" : "#2e5141"}" stroke="#8bad8e" stroke-width="1.5" ${landing ? `data-zone="${z}"` : ""}/>`;
    }).join(
      ""
    )}<path d="M220 330L300 250L220 170L140 250Z" fill="#927650" stroke="#c5ae85" stroke-width="2" ${landing ? 'data-zone="\u5185\u91CE"' : ""}/><path d="M14.94 124.94L220 330L425.06 124.94" fill="none" stroke="#f4edd8" stroke-width="2" pointer-events="none"/><circle cx="220" cy="250" r="5" fill="#d8c3a0" pointer-events="none"/>${[
      [300, 250, s.bases[0]],
      [220, 170, s.bases[1]],
      [140, 250, s.bases[2]]
    ].map(
      ([x, y, r]) => `<rect x="${x - 12}" y="${y - 12}" width="24" height="24" rx="2" transform="rotate(45 ${x} ${y})" fill="${r ? "#ff203f" : "#655137"}" stroke="white" stroke-width="4" pointer-events="none"/>`
    ).join(
      ""
    )}<path d="M215 326H225V332L220 337L215 332Z" fill="white" pointer-events="none"/></svg>`;
  }
  function score(s, ended, esc2) {
    const innings = Math.max(9, s.inning);
    return `<section class="score match-score"><div class="score-caption">${s.inning} \u5C40${s.side ? "\u4E0B" : "\u4E0A"} \xB7 ${ended ? "\u5DF2\u7ED3\u675F" : s.halfEnded ? "\u534A\u5C40\u7ED3\u675F" : "\u7B2C " + (s.pa + 1) + " \u6253\u5E2D"}</div><div class="inning-board"><table><thead><tr><th>\u7403\u961F</th>${Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${s.teams.map((t, i) => `<tr><th title="${esc2(t.name)}">${i ? "\u4E3B" : "\u5BA2"} ${esc2(t.name)}</th>${Array.from({ length: innings }, (_, j) => {
      var _a;
      return `<td class="${s.inning === j + 1 && s.side === i ? "current" : ""}">${(_a = s.lines[i][j]) != null ? _a : "\u2013"}</td>`;
    }).join("")}<td><b>${s.score[i].R}</b></td><td>${s.score[i].H}</td><td>${s.score[i].E}</td></tr>`).join("")}</tbody></table></div><div class="lamp-counts">${[
      ["B", 4, s.b],
      ["S", 3, s.s],
      ["O", 3, s.o]
    ].map(
      ([k, n, v]) => `<div aria-label="${k} ${v}"><b>${k}</b><span>${Array.from({ length: n }, (_, i) => `<i class="lamp ${i < v ? "on " + k : ""}"></i>`).join("")}</span></div>`
    ).join("")}</div></section>`;
  }
  function matchView(g, ctx) {
    var _a, _b, _c, _d;
    const { esc: esc2, name: name2, btn: btn2, career, player } = ctx, s = replay(g), shown = replay(g, true), b = batter(s), p = pitcher(s), bs = inningBatting(shown, b), bp = career[b] || rates(emptyStats()), ps = rates(shown.stats[p], g.sport), pc = career[p] || rates(emptyStats(), g.sport), stat = (label, v) => `<div class="mini-stat"><span>${label}</span><b>${v}</b></div>`;
    return `${score(g.pendingPitch && ["ball", "strike", "foul"].includes(g.pendingPitch.kind) ? { ...shown, pa: s.pa, b: g.pendingPitch.kind === "ball" ? 4 : s.b, s: g.pendingPitch.kind === "ball" ? s.s : 3 } : shown, g.ended, esc2)}<div class="live-field"><aside class="player-panel"><small>\u6253\u8005 \xB7 ${((_a = player(b)) == null ? void 0 : _a.bats) || "\u2014"} \u6253</small><b class="clip" title="${esc2(name2(b))}">${esc2(name2(b))}</b><small>\u7B2C ${s.inning} \u5C40</small><div class="inning-batting clip" title="${esc2(bs.text)}">${esc2(bs.text)}</div>${stat("RBI", bs.RBI)}<hr><small>\u5386\u53F2 \xB7 \u4E0D\u542B\u672C\u573A</small>${stat("AVG", bp.AVG.toFixed(3))}${stat("OPS", bp.OPS.toFixed(3))}</aside><div class="field-center">${defenseField(shown, ctx)}</div><aside class="player-panel"><small>\u6295\u624B \xB7 ${((_b = player(p)) == null ? void 0 : _b.throws) || "\u2014"} \u6295</small><b class="clip" title="${esc2(name2(p))}">${esc2(name2(p))}</b><small>\u672C\u573A</small>${stat("P-S", ps["P-S"])}${stat("H / ER", ps.HA + " / " + ps.ER)}${stat("K / HBP", ps.K + " / " + ps.HBPA)}<hr><small>\u5386\u53F2 \xB7 \u4E0D\u542B\u672C\u573A</small>${stat("ERA", pc.ERA.toFixed(2))}${stat("WHIP", pc.WHIP.toFixed(2))}</aside></div>${s.halfEnded ? `<div class="half-actions"><span>\u4E09\u51FA\u5C40 \xB7 \u534A\u5C40\u7ED3\u675F</span><div class="row">${btn2("\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40", "half", "", "primary")}${btn2("\u7ED3\u675F\u6BD4\u8D5B", "end", "", "danger")}</div></div>` : `<div class="pitch-actions">${btn2("B<small>\u574F\u7403</small>", "pitch", 'data-kind="ball"')}${btn2("S<small>\u597D\u7403</small>", "pitch", 'data-kind="strike"')}${btn2("Foul<small>\u754C\u5916</small>", "pitch", 'data-kind="foul"')}${btn2("Fair<small>\u754C\u5185</small>", "contact", "", "primary")}</div>`}<div class="record-tools">${btn2("\u64A4\u9500\u8BB0\u5F55", "undo", canUndo(g) ? "" : "disabled", "ghost")}${btn2("\u9010\u7403\u8BB0\u5F55", "showLog", "", "ghost")}${btn2("\u5B88\u5907\u6362\u4EBA", "sub", "", "ghost")}</div><div class="last-play clip" title="${esc2(((_c = shown.log.at(-1)) == null ? void 0 : _c.summary) || "")}">${esc2(((_d = shown.log.at(-1)) == null ? void 0 : _d.summary) || "\u51C6\u5907\u5C31\u7EEA\uFF0C\u5F00\u59CB\u8BB0\u5F55\u5F53\u524D\u6253\u5E2D")}</div>`;
  }
  function playDialog(g, ctx) {
    var _a;
    const { btn: btn2, esc: esc2, name: name2 } = ctx, s = replay(g), d = g.draft, fielders = s.teams[1 - s.side].lineup, fopts = (value) => fielders.map(
      (p) => `<option value="${p.id}" ${p.id === value ? "selected" : ""}>${p.pos} \xB7 ${esc2(name2(p.id))}</option>`
    ).join("");
    if (!d.zone)
      return `<h2>\u2460 \u7403\u7684\u843D\u70B9</h2><div class="landing-field">${field(s, true)}</div><div class="zone-buttons">${[...zoneNames, "\u5185\u91CE"].map((z) => btn2(z, "zone", `data-value="${z}"`, "small")).join("")}</div>`;
    if (!d.trajectory)
      return `<h2>\u2461 \u7403\u7684\u98DE\u884C\u65B9\u5F0F</h2><p class="muted">\u843D\u70B9\uFF1A${d.zone}</p><div class="actions">${[
        ["fly", "\u9AD8\u98DE\u7403"],
        ["line", "\u5E73\u98DE\u7403"],
        ["ground", "\u5730\u6EDA\u7403"],
        ["bunt", "\u89E6\u51FB\u7403"]
      ].filter(([v]) => g.sport !== "softball" || v !== "bunt").map(([v, l]) => btn2(l, "trajectory", `data-value="${v}"`)).join(
        ""
      )}</div><h3>\u573A\u5730\u89C4\u5219\u5224\u5B9A</h3><div class="stack">${[1, 2, 3, 4].map((n) => btn2(n === 4 ? "\u5168\u5792\u6253" : `\u573A\u5730\u89C4\u5219${["", "\u4E00", "\u4E8C", "\u4E09"][n]}\u5792\u5B89\u6253`, "award", `data-n="${n}"`, "primary")).join("")}</div>`;
    if (!d.result)
      return `<h2>\u2462 \u91CE\u624B\u5904\u7406</h2><label>\u5904\u7406\u7403\u7684\u91CE\u624B</label><select id="fielder" data-contact-fielder>${fopts(d.fielder)}</select><div class="stack">${btn2("\u63A5\u6740", "result", 'data-value="catch"', "primary")}${btn2("\u62E6\u622A / \u4F20\u7403", "result", 'data-value="stop"')}${btn2("\u5931\u8BEF E\uFF08\u672C\u53EF\u4F7F\u6253\u8005\u51FA\u5C40\uFF09", "result", 'data-value="error"', "gold")}${d.trajectory === "fly" && s.o < 2 && s.bases[0] && s.bases[1] ? btn2("\u88C1\u5224\u5BA3\u544A\u5185\u91CE\u9AD8\u98DE\u7403", "result", 'data-value="infieldFly"') : ""}</div>`;
    const q = runnerQueue(s).filter(
      (r2) => r2.from || !["catch", "infieldFly"].includes(d.result)
    ), r = q.find((r2) => !d.actions.some((a) => a.id === r2.id));
    if (d.outForm) {
      const f = d.outForm, shown = replay(g, true);
      return `<h2>${f.mode === "force" ? "\u5C01\u6740" : "\u89E6\u6740"} \xB7 ${esc2(name2(f.id))}</h2>${f.mode === "force" ? `<label>\u51FA\u5C40\u5792\u5305</label><select id="outbase">${forceBases(s, f.id, d.result).map((n) => `<option value="${n}">${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][n]}</option>`).join("")}</select>` : ""}<label>\u5B8C\u6210\u523A\u6740\u7684\u91CE\u624B</label><select id="putout">${fopts(d.fielder)}</select>${shown.o === 2 ? `<label>\u5DF2\u8BB0\u5F55\u7684\u5F97\u5206\u8DD1\u8005\u4E0E\u672C\u6B21\u51FA\u5C40\u7684\u5148\u540E</label><select id="outTiming"><option value="after">\u51FA\u5C40\u5728\u5148 / \u672A\u786E\u8BA4\u5F97\u5206\u5728\u5148</option><option value="before">\u8DD1\u8005\u5148\u56DE\u672C\u5792\uFF0C\u518D\u53D1\u751F\u51FA\u5C40</option></select>` : ""}${btn2("\u786E\u8BA4\u51FA\u5C40", "runnerOut", `data-id="${f.id}" data-mode="${f.mode}"`, "danger")}${btn2("\u8FD4\u56DE\u8DD1\u8005", "cancelOut")}`;
    }
    if (r) {
      const limit = advanceLimit(s, d.actions, r.id), pending = d.pending || {}, isError = d.result === "error" && !r.from, normal = (_a = pending.advance) != null ? _a : isError ? 0 : r.from ? 0 : 1, showError = d.errorOpen || isError;
      return `<h2>\u2463 ${esc2(name2(r.id))}</h2><div class="runner-mini">${field(s)}</div><p class="muted">${r.from ? ["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792"][r.from] : "\u6253\u8005"} \xB7 ${q.findIndex((x) => x.id === r.id) + 1}/${q.length}\u3000\u6309\u524D\u4F4D\u81F3\u540E\u4F4D\u5904\u7406</p><label>\u6B63\u5E38\u51FB\u7403\u8FDB\u5792\u6570</label><select id="normalAdvance" data-normal-advance>${Array.from({ length: (isError ? 0 : Math.max(0, limit)) + 1 }, (_, n) => `<option value="${n}" ${n === normal ? "selected" : ""}>${n === 0 ? "\u4E0D\u56E0\u51FB\u7403\u8FDB\u5792" : `\u524D\u8FDB ${n} \u5792`}</option>`).join("")}</select>${btn2(showError ? "\u53D6\u6D88\u989D\u5916\u5931\u8BEF" : "\u56E0\u5931\u8BEF\u8FDB\u5792", "toggleError", "", "gold")}${showError ? `<div class="error-box"><label>\u5931\u8BEF\u91CE\u624B</label><select id="errorFielder" data-error-fielder>${fopts(pending.errorFielder || d.fielder)}</select><label>\u989D\u5916\u5931\u8BEF\u8FDB\u5792\u6570\uFF08\u4E0E\u6B63\u5E38\u8FDB\u5792\u76F8\u52A0\uFF09</label><select id="errorAdvance" data-error-advance>${Array.from({ length: Math.max(0, limit - normal) }, (_, i) => `<option value="${i + 1}" ${pending.errorAdvance === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select></div>` : ""}<div class="actions">${btn2("\u786E\u8BA4\u8DD1\u8005", "saveRunner", `data-id="${r.id}"`, "primary wide")}${btn2("\u88AB\u5C01\u6740", "force", `data-id="${r.id}"`, "danger")}${btn2("\u88AB\u89E6\u6740", "tag", `data-id="${r.id}"`, "danger")}</div>`;
    }
    return resultPanel(g, ctx);
  }
  function resultPanel(g, ctx) {
    const { esc: esc2, btn: btn2 } = ctx, s = replay(g), shown = replay(g, true), last = shown.log.at(-1), pending = g.pendingPitch;
    return `<h2>${pending ? pending.type === "ruling" ? "\u5224\u7F5A\u786E\u8BA4" : "\u672C\u6253\u5E2D\u7ED3\u679C" : "\u672C\u7403\u7ED3\u679C"}</h2><div class="result-only"><span class="pill">\u81EA\u52A8\u5224\u5B9A</span><h3>${esc2(last == null ? void 0 : last.summary)}</h3><p>R ${shown.score[s.side].R} \xB7 H ${shown.score[s.side].H} \xB7 \u5BF9\u65B9 E ${shown.score[1 - s.side].E}</p><p class="muted">${pending ? "\u786E\u8BA4\u540E\u5E94\u7528\u672C\u6B21\u7ED3\u679C\uFF1B\u53D6\u6D88\u5219\u6062\u590D\u672C\u6B21\u64CD\u4F5C\u524D\u7684\u72B6\u6001\u3002" : "\u6839\u636E\u98DE\u884C\u65B9\u5F0F\u3001\u91CE\u624B\u5904\u7406\u548C\u8DD1\u5792\u81EA\u52A8\u8BA1\u7B97\u3002"}</p></div>${pending ? btn2(pending.type === "ruling" ? "\u786E\u8BA4\u5224\u7F5A" : ["ball", "ibb", "hbp"].includes(pending.kind) ? "\u786E\u8BA4\u4FDD\u9001" : "\u786E\u8BA4\u4E09\u632F", "confirmCount", "", "primary wide") + btn2("\u53D6\u6D88\u672C\u7403", "cancelCount", "", "ghost wide") : btn2("\u786E\u8BA4\u6253\u5E2D\u7ED3\u679C", "commitContact", "", "primary wide")}`;
  }
  function pitchLog(g, ctx) {
    const { name: name2, esc: esc2, btn: btn2 } = ctx, s = replay(g, true);
    return `<div class="log-header"><h2>\u9010\u7403\u8BB0\u5F55</h2>${btn2("\u5173\u95ED", "closePanel", "", "small")}</div><div class="pitch-log-list">${s.log.slice().reverse().map((l) => `<div class="log"><small>${l.inning} \u5C40${l.side ? "\u4E0B" : "\u4E0A"} \xB7 \u6253\u5E2D ${l.pa + 1} \xB7 ${l.time ? new Date(l.time).toLocaleTimeString("zh-CN") : ""}</small><small>${esc2(s.teams[l.defense].name)} \xB7 \u6295\u624B ${esc2(name2(l.pitcher))}</small><b>${{ ball: "B", strike: "S", foul: "Foul", contact: "Fair", hbp: "HBP", ibb: "IBB", awardWalk: "\u5224\u7F5A\u4FDD\u9001", advanceAward: "\u5224\u7F5A\u8FDB\u5792", runnerOut: "\u5224\u7F5A\u51FA\u5C40", eject: "\u9A71\u9010" }[l.kind]} \xB7 \u6253\u8005 ${esc2(name2(l.batter))}</b><span>${esc2(l.summary)}</span></div>`).join("") || '<p class="muted">\u5C1A\u672A\u6295\u7403</p>'}</div>`;
  }
  function defenseField(s, ctx) {
    const positions = { "\u5DE6\u5916\u91CE": [16, 17], "\u4E2D\u5916\u91CE": [50, 2], "\u53F3\u5916\u91CE": [84, 17], "\u81EA\u7531\u4EBA": [16, 34], "\u6E38\u51FB\u624B": [84, 34], "\u4E8C\u5792\u624B": [50, 34], "\u6295\u624B": [25, 90], "\u4E09\u5792\u624B": [16, 59], "\u4E00\u5792\u624B": [84, 59], "\u6355\u624B": [75, 90] };
    return `<div class="defense-field"><svg viewBox="0 0 200 160" role="img" aria-label="\u5185\u91CE\u5792\u5305\uFF0C\u7EA2\u8272\u8868\u793A\u6709\u4EBA"><path d="M100 140L140 100L100 60L60 100Z" fill="#927650" stroke="#c5ae85" stroke-width="2"/>${[[140, 100, s.bases[0]], [100, 60, s.bases[1]], [60, 100, s.bases[2]]].map(([x, y, r]) => `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="2" transform="rotate(45 ${x} ${y})" fill="${r ? "#ff203f" : "#655137"}" stroke="white" stroke-width="4"/>`).join("")}<path d="M95 136H105V142L100 147L95 142Z" fill="white"/></svg>${Object.entries(positions).filter(([pos]) => pos !== "\u81EA\u7531\u4EBA" || ctx.sport === "softball").map(([pos, xy]) => {
      const p = s.teams[1 - s.side].lineup.find((p2) => p2.pos === pos), player = p ? ctx.player(p.id) : null, label = p ? ctx.name(p.id) + ((player == null ? void 0 : player.number) ? " #" + player.number : "") : "\u2014";
      return `<div class="defender-label" style="left:${xy[0]}%;top:${xy[1]}%" title="${ctx.esc(pos + " \xB7 " + label)}">${ctx.esc(label)}</div>`;
    }).join("")}</div>`;
  }

  // app/src/main/assets/web/xlsx.js
  var enc = new TextEncoder();
  var xml = (s) => String(s).replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&apos;"
    })[c]
  ).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
  function crc32(b) {
    let c = 4294967295;
    for (const n of b) {
      c ^= n;
      for (let k = 0; k < 8; k++) c = c >>> 1 ^ (c & 1 ? 3988292384 : 0);
    }
    return (c ^ 4294967295) >>> 0;
  }
  function zip(files) {
    let offset = 0;
    const chunks = [], central = [];
    const hdr = (size) => new DataView(new ArrayBuffer(size));
    const u16 = (v, o, n) => v.setUint16(o, n, true), u32 = (v, o, n) => v.setUint32(o, n, true);
    for (const [name2, content] of Object.entries(files)) {
      const n = enc.encode(name2), b = enc.encode(content), crc = crc32(b), h = hdr(30);
      u32(h, 0, 67324752);
      u16(h, 4, 20);
      u16(h, 6, 2048);
      u32(h, 14, crc);
      u32(h, 18, b.length);
      u32(h, 22, b.length);
      u16(h, 26, n.length);
      chunks.push(new Uint8Array(h.buffer), n, b);
      const c = hdr(46);
      u32(c, 0, 33639248);
      u16(c, 4, 20);
      u16(c, 6, 20);
      u16(c, 8, 2048);
      u32(c, 16, crc);
      u32(c, 20, b.length);
      u32(c, 24, b.length);
      u16(c, 28, n.length);
      u32(c, 42, offset);
      central.push(new Uint8Array(c.buffer), n);
      offset += 30 + n.length + b.length;
    }
    const cs = central.reduce((n, x) => n + x.length, 0), end = hdr(22);
    u32(end, 0, 101010256);
    u16(end, 8, Object.keys(files).length);
    u16(end, 10, Object.keys(files).length);
    u32(end, 12, cs);
    u32(end, 16, offset);
    const all = [...chunks, ...central, new Uint8Array(end.buffer)], out2 = new Uint8Array(offset + cs + 22);
    let p = 0;
    for (const b of all) {
      out2.set(b, p);
      p += b.length;
    }
    return out2;
  }
  function workbook(sheets) {
    if (!sheets.length) throw Error("\u6CA1\u6709\u53EF\u5BFC\u51FA\u7684\u6570\u636E");
    const column = (n) => {
      let s = "";
      for (n++; n; n = Math.floor((n - 1) / 26))
        s = String.fromCharCode(65 + (n - 1) % 26) + s;
      return s;
    };
    const files = {};
    files["[Content_Types].xml"] = `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
    files["_rels/.rels"] = '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
    files["xl/workbook.xml"] = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
    files["xl/_rels/workbook.xml.rels"] = `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;
    for (const [i, s] of sheets.entries())
      files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${column(Math.max(1, ...s.rows.map((r) => r.length)) - 1)}${Math.max(1, s.rows.length)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="2" width="20" customWidth="1"/><col min="3" max="80" width="12" customWidth="1"/></cols><sheetData>${s.rows.map((row, j) => `<row r="${j + 1}">${row.map((v, k) => typeof v === "number" ? `<c r="${column(k)}${j + 1}" t="n"><v>${Number.isFinite(v) ? v : 0}</v></c>` : `<c r="${column(k)}${j + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v != null ? v : "")}</t></is></c>`).join("")}</row>`).join("")}</sheetData></worksheet>`;
    return zip(files);
  }
  function downloadXlsx(sheets, name2) {
    const bytes = workbook(sheets);
    if (window.AndroidStore) {
      let s = "";
      for (const b of bytes) s += String.fromCharCode(b);
      window.AndroidStore.exportFile(name2, btoa(s));
    } else {
      const url = URL.createObjectURL(
        new Blob([bytes], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        })
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = name2;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
    }
  }

  // app/src/main/assets/web/app.js
  var $ = (s) => document.querySelector(s);
  var esc = (s) => String(s != null ? s : "").replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[c]
  );
  var db;
  try {
    const raw = window.AndroidStore ? window.AndroidStore.read() : localStorage.getItem("diamond-v1");
    db = raw ? JSON.parse(raw) : { version: 1, players: [], games: [], active: null, setup: null };
    if (db.version !== 1 || !Array.isArray(db.games) || !Array.isArray(db.players))
      throw Error();
  } catch (e) {
    document.body.innerHTML = "<p>\u6570\u636E\u672A\u80FD\u8BFB\u53D6\u3002\u8BF7\u4FDD\u7559\u5E94\u7528\u6570\u636E\u5E76\u91CD\u542F\uFF0C\u52FF\u6E05\u9664\u5B58\u50A8\u3002</p>";
    throw e;
  }
  migrateRoster(db.players);
  var season = String((/* @__PURE__ */ new Date()).getFullYear());
  var historyYear = String((/* @__PURE__ */ new Date()).getFullYear());
  var ejectId = null;
  var playerQuery = "";
  var playerPage = 1;
  var panel = null;
  var panelGameId = null;
  var page = db.active ? "game" : "home";
  var sport = "baseball";
  var selected = /* @__PURE__ */ new Set();
  var viewGame = null;
  var stage = "pitch";
  var sub = false;
  var sportName = (s) => s === "baseball" ? "\u68D2\u7403" : "\u6162\u6295\u5792\u7403";
  var name = (id) => {
    var _a;
    return ((_a = db.players.find((p) => p.id === id)) == null ? void 0 : _a.name) || "\u5DF2\u5220\u9664\u7403\u5458";
  };
  var game = () => db.games.find((g) => g.id === db.active);
  function save() {
    const raw = JSON.stringify(db);
    if (window.AndroidStore) {
      if (!window.AndroidStore.write(raw))
        throw Error("\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u5269\u4F59\u7A7A\u95F4");
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
    setTimeout(() => $("#toast").style.display = "none", 3e3);
  }
  function btn(label, action2, data = "", cls = "") {
    return `<button class="${cls}" data-action="${action2}" ${data}>${label}</button>`;
  }
  function header(title, menu = "") {
    return `<div class="top">${btn("\u2039", "home", "", "ghost fit")}<strong>${title}</strong>${menu || ""}</div>`;
  }
  function table(ids, stats, keys) {
    return `<div class="tablewrap"><table><thead><tr><th>\u7403\u5458</th>${keys.map((k) => `<th>${k}</th>`).join("")}</tr></thead><tbody>${ids.map((id) => {
      const s = stats[id] || rates(emptyStats());
      return `<tr><td>${esc(name(id))}</td>${keys.map((k) => {
        var _a;
        return `<td>${["OPS", "AVG", "OBP", "SLG", "WHIP", "FPCT", "ERA", "K/9"].includes(k) ? s[k].toFixed(3) : (_a = s[k]) != null ? _a : 0}</td>`;
      }).join("")}</tr>`;
    }).join("")}</tbody></table></div>`;
  }
  var batting = BATTING;
  var fielding = FIELDING;
  var pitching = PITCHING;
  function statsSections(ids, stats) {
    const pitchers = ids.filter((id) => {
      var _a;
      return ((_a = stats[id]) == null ? void 0 : _a.P) > 0;
    });
    return "<h3>\u6253\u51FB\u6570\u636E</h3>" + table(ids, stats, batting) + "<details><summary>\u5B88\u5907\u6570\u636E</summary>" + table(ids, stats, fielding) + "</details>" + (pitchers.length ? "<details><summary>\u6295\u7403\u6570\u636E</summary>" + table(pitchers, stats, pitching) + "</details>" : "");
  }
  function home() {
    return `${header("\u94BB\u77F3\u8BB0\u5206")}<section class="hero"><div class="eyebrow">DIAMOND NOTEBOOK</div><h1>\u4E13\u6CE8\u6BD4\u8D5B\u3002<br>\u8BB0\u4E0B\u6BCF\u4E00\u4E2A\u77AC\u95F4\u3002</h1><p>\u4ECE\u7B2C\u4E00\u7403\u5230\u6700\u540E\u4E00\u4E2A\u51FA\u5C40\uFF0C<br>\u4F60\u7684\u7403\u573A\u8BB0\u5F55\u7C3F\u3002</p><div class="mark">\u25C7</div></section>${db.active ? `<div class="card row"><div><b>\u6709\u4E00\u573A\u6BD4\u8D5B\u6B63\u5728\u8FDB\u884C</b><p class="muted">\u6240\u6709\u6295\u7403\u4E0E\u672A\u5B8C\u6210\u6B65\u9AA4\u5DF2\u4FDD\u5B58</p></div>${btn("\u7EE7\u7EED\u8BB0\u5F55", "resume", "", "primary fit")}</div>` : ""}<div class="grid">${btn("\u25C9<b>\u7403\u5458</b><span>\u6CE8\u518C \xB7 \u7EDF\u8BA1 \xB7 \u5BFC\u51FA</span>", "players", "", "homebtn")}${btn("\u26BE<b>\u5F00\u59CB\u68D2\u7403\u6BD4\u8D5B</b><span>\u6807\u51C6\u9010\u7403\u8BB0\u5206</span>", "setup", 'data-sport="baseball"', "homebtn primary")}${btn("\u25C7<b>\u5F00\u59CB\u5792\u7403\u6BD4\u8D5B</b><span>\u6162\u6295 \xB7 1\u20131 \u8D77\u59CB\u7403\u6570</span>", "setup", 'data-sport="softball"', "homebtn")}${btn("\u25A4<b>\u8BB0\u5F55\u67E5\u770B</b><span>\u8D5B\u540E\u56DE\u987E \xB7 \u5168\u90E8\u6295\u7403</span>", "history", "", "homebtn")}</div>`;
  }
  function players() {
    const matches = db.players.filter((p) => !p.deleted && normalizeName(p.name).includes(normalizeName(playerQuery))), pages = Math.max(1, Math.ceil(matches.length / 20)), current = playerPage = Math.min(pages, Math.max(1, playerPage)), people = matches.slice((current - 1) * 20, current * 20), st = totals(db.games.filter((g) => gameYear(g) === season), sport);
    return `${header("\u7403\u5458")}<label>\u641C\u7D22\u7403\u5458\u59D3\u540D<input id="playerSearch" type="search" placeholder="\u8F93\u5165\u59D3\u540D\u641C\u7D22" value="${esc(playerQuery)}"></label>${yearSelect("season", season)}<div class="tabs">${btn("\u68D2\u7403", "sport", 'data-sport="baseball"', sport === "baseball" ? "primary" : "")}${btn("\u5792\u7403", "sport", 'data-sport="softball"', sport === "softball" ? "primary" : "")}</div><div class="row">${btn("\uFF0B \u6DFB\u52A0\u7403\u5458", "addPlayer", "", "primary")}${btn("\u5BFC\u51FA\u6240\u9009 Excel", "exportPlayers", "", "ghost")}</div><p class="muted">\u52FE\u9009\u7403\u5458\u5BFC\u51FA\uFF1B\u672A\u52FE\u9009\u65F6\u5BFC\u51FA\u5168\u90E8\u5728\u518C\u7403\u5458\u3002\u5F53\u524D\u5E74\u4EFD\u7684\u4E24\u79CD\u8FD0\u52A8\u72EC\u7ACB\u7D2F\u8BA1\u3002</p>${people.length ? people.map((p) => `<section class="card"><div class="row"><input class="check fit" type="checkbox" data-select="${p.id}" ${selected.has(p.id) ? "checked" : ""}><div><b>${esc(p.name)}</b><span class="muted">\u3000${esc(p.number || "\u2014")} \u53F7 \xB7 ${p.bats || "\u2014"}\u6253/${p.throws || "\u2014"}\u6295</span></div>${btn("\u7F16\u8F91", "editPlayer", `data-id="${p.id}"`, "small fit")}${btn("\u5220\u9664", "deletePlayer", `data-id="${p.id}"`, "small danger fit")}</div>${statsSections([p.id], st)}</section>`).join("") : '<div class="empty">\u6CA1\u6709\u5339\u914D\u7684\u7403\u5458</div>'}<div class="row pagination">${btn("\u4E0A\u4E00\u9875", "playerPage", 'data-page="' + (current - 1) + '" ' + (current === 1 ? "disabled" : ""))}<span>\u7B2C ${current} / ${pages} \u9875 \xB7 ${matches.length} \u4EBA</span>${btn("\u4E0B\u4E00\u9875", "playerPage", 'data-page="' + (current + 1) + '" ' + (current === pages ? "disabled" : ""))}</div>`;
  }
  function editPlayer(id) {
    const p = db.players.find((x) => x.id === id) || {};
    dialog(
      `<h2>${id ? "\u7F16\u8F91" : "\u6DFB\u52A0"}\u7403\u5458</h2><label>\u59D3\u540D</label><input id="pname" maxlength="30" value="${esc(p.name || "")}" placeholder="\u7403\u5458\u59D3\u540D"><div class="row"><div><label>\u6253\u51FB\u624B</label><select id="pbats"><option value="R" ${p.bats !== "L" && p.bats !== "S" ? "selected" : ""}>R \u53F3\u6253</option><option value="L" ${p.bats === "L" ? "selected" : ""}>L \u5DE6\u6253</option><option value="S" ${p.bats === "S" ? "selected" : ""}>S Switch hitter\uFF08\u5DE6\u53F3\u5F00\u5F13\uFF09</option></select></div><div><label>\u6295\u7403\u624B</label><select id="pthrows"><option value="R" ${p.throws !== "L" ? "selected" : ""}>R \u53F3\u6295</option><option value="L" ${p.throws === "L" ? "selected" : ""}>L \u5DE6\u6295</option></select></div></div><label>\u80CC\u53F7\uFF08\u53EF\u9009\uFF09</label><input id="pnumber" maxlength="8" value="${esc(p.number || "")}"><div class="row" style="margin-top:20px">${btn("\u53D6\u6D88", "close")}${btn("\u4FDD\u5B58", "savePlayer", `data-id="${id || ""}"`, "primary")}</div>`
    );
    $("#pname").focus();
  }
  function ask(message) {
    return new Promise((resolve) => {
      dialog(
        "<h2>\u8BF7\u786E\u8BA4</h2><p>" + esc(message) + '</p><div class="row"><button id="askNo">\u53D6\u6D88</button><button class="primary" id="askYes">\u786E\u8BA4</button></div>'
      );
      const d = $("dialog");
      let done = false;
      const finish2 = (value) => {
        var _a;
        if (done) return;
        done = true;
        d.close();
        resolve(value);
        if (!value && page === "game" && ((_a = game()) == null ? void 0 : _a.draft)) render();
      };
      $("#askNo").onclick = () => finish2(false);
      $("#askYes").onclick = () => finish2(true);
      d.addEventListener("cancel", () => finish2(false), { once: true });
    });
  }
  function dialog(html) {
    var _a;
    (_a = $("dialog")) == null ? void 0 : _a.remove();
    const d = document.createElement("dialog");
    d.innerHTML = html;
    document.body.append(d);
    d.showModal();
  }
  function setup() {
    const d = db.setup;
    if (!d) {
      page = db.active ? "game" : "home";
      return db.active ? record() : home();
    }
    return header("\u7EC4\u961F \xB7 " + sportName(d.sport)) + officialFields(d, db.players, esc) + '<p class="muted">\u6309\u4F4F \u2261 \u62D6\u52A8\u6253\u5E8F \xB7 L \u5DE6\u6253 / R \u53F3\u6253 / S \u5DE6\u53F3\u5F00\u5F13</p>' + d.teams.map(
      (t, i) => `<section class="card compact-team"><div class="row"><b class="fit">${i ? "\u4E3B\u961F" : "\u5BA2\u961F"}</b><input aria-label="${i ? "\u4E3B" : "\u5BA2"}\u961F\u540D\u79F0" data-team-name="${i}" value="${esc(t.name)}" maxlength="30"></div><div data-lineup="${i}">${t.lineup.map(
        (p, j) => {
          var _a;
          return `<div class="lineup" data-team="${i}" data-index="${j}"><div class="handle" data-drag="${i}:${j}" aria-label="\u62D6\u52A8\u6253\u5E8F">\u2261</div><div class="clip"><b>${j + 1}. ${esc(name(p.id))}</b> <span class="hand">${((_a = db.players.find((x) => x.id === p.id)) == null ? void 0 : _a.bats) || "\u2014"}</span></div><select aria-label="${esc(name(p.id))}\u5B88\u5907\u4F4D\u7F6E" data-position="${i}:${j}">${POSITIONS.slice(
            0,
            d.sport === "baseball" ? 9 : 10
          ).map(
            (pos) => `<option ${p.pos === pos ? "selected" : ""}>${pos}</option>`
          ).join(
            ""
          )}</select>${btn("\xD7", "removeLine", `data-team="${i}" data-index="${j}"`, "small")}</div>`;
        }
      ).join(
        ""
      )}</div>${btn("\uFF0B \u641C\u7D22\u5E76\u52A0\u5165\u7403\u5458", "pickPlayer", `data-team="${i}"`, "ghost wide")}</section>`
    ).join("") + '<div class="row">' + btn("\u4EA4\u6362\u4E3B\u5BA2\u961F", "swapTeams") + btn("\u8FDB\u5165\u6BD4\u8D5B", "start", "", "primary") + "</div>";
  }
  function context(g) {
    return {
      esc,
      name,
      btn,
      player: (id) => db.players.find((p) => p.id === id),
      sport: g.sport,
      career: totals(
        db.games.filter((x) => x.id !== g.id),
        g.sport
      )
    };
  }
  function record() {
    const g = game();
    if (!g) return home();
    return header(
      sportName(g.sport),
      '<details class="menu"><summary aria-label="\u6BD4\u8D5B\u83DC\u5355">\u22EE</summary><div>' + btn("\u89E6\u8EAB\u7403 HBP", "pitch", 'data-kind="hbp"') + btn("\u6545\u610F\u56DB\u574F\u7403 IBB", "pitch", 'data-kind="ibb"') + btn("\u88C1\u5224\u5224\u7F5A", "ruling") + btn("\u7ED3\u675F\u6BD4\u8D5B", "end", "", "danger") + "</div></details>"
    ) + matchView(g, context(g));
  }
  function score2(s, ended = false) {
    return score(s, ended, esc);
  }
  function matchModal() {
    const g = panel === "log" ? db.games.find((g2) => g2.id === (panelGameId || db.active)) : game();
    if (!g) return;
    if (panel === "log") {
      dialog(pitchLog(g, context(g)));
      return;
    }
    if (page !== "game") return;
    const d = g.draft;
    if (panel === "ruling") {
      dialog(rulingDialog(g, context(g), db.players));
      return;
    }
    if (panel === "eject") {
      dialog(ejectDialog(g, context(g), db.players, ejectId));
      return;
    }
    if (panel === "sub") {
      dialog(subPanel(replay(g)));
      return;
    }
    if (g.pendingPitch) {
      dialog(resultPanel(g, context(g)));
      $("dialog").addEventListener("cancel", (e) => e.preventDefault());
      return;
    }
    if (d) {
      dialog(
        playDialog(g, context(g)) + '<div class="modal-footer">' + btn("\u4E0A\u4E00\u6B65", "draftBack", "", "ghost") + btn("\u53D6\u6D88\u672C\u7403", "cancelDraft", "", "ghost") + "</div>"
      );
      $("dialog").addEventListener("cancel", (e) => e.preventDefault());
    }
  }
  function pickPlayer(team) {
    dialog(
      "<h2>\u52A0\u5165" + (team ? "\u4E3B\u961F" : "\u5BA2\u961F") + '</h2><input id="rosterSearch" placeholder="\u641C\u7D22\u7403\u5458\u59D3\u540D" autocomplete="off"><div id="rosterOptions" class="search-options"></div>' + btn("\u5173\u95ED", "close")
    );
    const input = $("#rosterSearch");
    const refresh = () => {
      $("#rosterOptions").innerHTML = db.players.filter(
        (p) => !p.deleted && !db.setup.teams.some((t) => t.lineup.some((x) => x.id === p.id)) && p.name.toLocaleLowerCase().includes(input.value.trim().toLocaleLowerCase())
      ).map(
        (p) => btn(
          esc(p.name) + " \xB7 " + p.bats + "\u6253/" + p.throws + "\u6295",
          "addLine",
          `data-team="${team}" data-id="${p.id}"`,
          "ghost"
        )
      ).join("") || '<p class="muted">\u65E0\u5339\u914D\u7403\u5458</p>';
    };
    input.addEventListener("input", refresh);
    refresh();
    input.focus();
  }
  function subPanel(s) {
    return `<div class="card"><h2>\u5B88\u5907\u6362\u4EBA / \u6362\u4F4D</h2><p class="muted">\u4EC5\u64CD\u4F5C ${esc(s.teams[1 - s.side].name)}\uFF0C\u66FF\u8865\u7EE7\u627F\u539F\u6253\u5E8F\u3002\u5F53\u524D\u7403\u5DF2\u5F00\u59CB\u65F6\uFF0C\u6362\u4E0A\u7684\u6295\u624B\u4ECE\u4E0B\u4E00\u6295\u7403\u627F\u62C5\u8D23\u4EFB\u3002</p><label>\u573A\u4E0A\u7403\u5458</label><select id="subout">${s.teams[1 - s.side].lineup.map((p, i) => `<option value="${i}">${p.pos} \xB7 ${esc(name(p.id))}</option>`).join("")}</select><label>\u6362\u5165\u6CE8\u518C\u7403\u5458</label><select id="subin"><option value="">\u9009\u62E9\u66FF\u8865\u2026</option>${db.players.filter(
      (p) => !p.deleted && !s.teams.some((t) => t.lineup.some((x) => x.id === p.id))
    ).map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join(
      ""
    )}</select>${btn("\u786E\u8BA4\u6362\u4EBA", "doSub", "", "primary")}<label>\u6216\u4E0E\u573A\u4E0A\u7403\u5458\u4EA4\u6362\u5B88\u5907\u4F4D\u7F6E</label><select id="swapin">${s.teams[1 - s.side].lineup.map((p, i) => `<option value="${i}">${p.pos} \xB7 ${esc(name(p.id))}</option>`).join("")}</select>${btn("\u4EA4\u6362\u4F4D\u7F6E", "doSwap", "", "primary")}${btn("\u8FD4\u56DE\u8BB0\u5206", "subBack", "", "ghost")}</div>`;
  }
  function recent(s) {
    return '<div class="card">' + btn(
      "\u9010\u7403\u4E0E\u5224\u7F5A\u8BB0\u5F55 \xB7 " + s.log.length + " \u6761",
      "showLog",
      'data-id="' + (viewGame || db.active) + '"',
      "ghost wide"
    ) + "</div>";
  }
  function yearSelect(kind, value) {
    return `<label class="year-select">\u5E74\u4EFD<select data-year="${kind}">${[.../* @__PURE__ */ new Set([String((/* @__PURE__ */ new Date()).getFullYear()), ...years(db.games), value])].sort().reverse().map((y) => `<option ${y === value ? "selected" : ""}>${y}</option>`).join("")}</select></label>`;
  }
  function history() {
    return `${header("\u8BB0\u5F55\u67E5\u770B")}${yearSelect("history", historyYear)}<div class="row">${btn("\u6309\u5E74\u5BFC\u51FA JSON", "archiveExport", "", "primary")}${btn("\u5BFC\u5165\u6BD4\u8D5B JSON", "archiveImport")}</div>${db.games.length ? db.games.filter((g) => gameYear(g) === historyYear).slice().reverse().map((g) => {
      const s = replay(g, true);
      return `<div class="card"><span class="pill">${sportName(g.sport)} \xB7 ${g.ended ? "\u5DF2\u7ED3\u675F" : "\u8FDB\u884C\u4E2D"}</span><h3>${esc(g.teams[0].name)} ${s.score[0].R} : ${s.score[1].R} ${esc(g.teams[1].name)}</h3><p class="muted">${new Date(g.created).toLocaleString("zh-CN")} \xB7 ${s.log.length} \u6761\u8BB0\u5F55</p><div class="row">${btn("\u67E5\u770B\u6570\u636E", "view", `data-id="${g.id}"`, "primary")}${btn("\u5220\u9664\u6BD4\u8D5B", "deleteGame", `data-id="${g.id}"`, "danger")}</div></div>`;
    }).join("") : '<div class="empty">\u8FD8\u6CA1\u6709\u6BD4\u8D5B\u8BB0\u5F55</div>'}`;
  }
  function summary() {
    const g = db.games.find((x) => x.id === viewGame);
    if (!g) {
      page = "history";
      return history();
    }
    const s = replay(g, true), st = Object.fromEntries(
      Object.entries(s.stats).map(([id, x]) => [id, rates(x, g.sport)])
    );
    return `${header("\u6BD4\u8D5B\u6570\u636E")}${score2(s, g.ended)}<p class="muted">\u5F00\u59CB\uFF1A${new Date(g.startedAt).toLocaleString("zh-CN")}<br>\u7ED3\u675F\uFF1A${g.endedAt ? new Date(g.endedAt).toLocaleString("zh-CN") : "\u8FDB\u884C\u4E2D"}<br>\u8BB0\u5F55\u8005\uFF1A${esc(name(s.scorerId))} \xB7 \u88C1\u5224\uFF1A${esc(name(s.umpireId))}</p><div class="row">${btn("\u5BFC\u51FA\u672C\u573A Excel", "exportGame", "", "primary")}${!g.ended ? btn("\u7EE7\u7EED\u6BD4\u8D5B", "resume") : ""}</div>${boxScore(g, context(g))}${recent(s)}`;
  }
  function render() {
    var _a;
    try {
      $("#app").innerHTML = `<main class="shell">${({ home, players, setup, game: record, history, summary }[page] || home)()}</main>`;
      bindDrag();
      matchModal();
    } catch (e) {
      page = "home";
      panel = null;
      panelGameId = null;
      (_a = $("dialog")) == null ? void 0 : _a.remove();
      $("#app").innerHTML = `<main class="shell">${home()}<p class="notice" role="alert">\u9875\u9762\u672A\u80FD\u6253\u5F00\uFF1A${esc(e.message)}\u3002\u6BD4\u8D5B\u548C\u7EC4\u961F\u6570\u636E\u5DF2\u4FDD\u7559\u3002</p></main>`;
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
      statSheets(groups, db.players, { sport, ...meta }),
      title + ".xlsx"
    );
  }
  window.receiveArchive = (text) => {
    const before = clone(db);
    try {
      const result = importArchive(db, text);
      db = result.db;
      save();
      page = "history";
      historyYear = years(db.games)[0] || historyYear;
      render();
      dialog("<h2>\u5BFC\u5165\u5B8C\u6210</h2><p>\u65B0\u589E " + result.count + " \u573A\uFF0C\u8DF3\u8FC7\u91CD\u590D " + result.skipped + " \u573A\u3002</p>" + (result.added.length ? "<p>\u5DF2\u52A0\u5165\u7403\u5458\u5E93\uFF1A" + esc(result.added.join("\u3001")) + "</p>" : "") + (result.restored.length ? "<p>\u5DF2\u6062\u590D\u7403\u5458\uFF1A" + esc(result.restored.join("\u3001")) + "</p>" : "") + btn("\u5173\u95ED", "close"));
    } catch (e) {
      db = before;
      toast("\u5BFC\u5165\u5931\u8D25\uFF1A" + e.message);
    }
  };
  window.goHome = () => {
    var _a;
    save();
    page = "home";
    sub = false;
    panel = null;
    (_a = $("dialog")) == null ? void 0 : _a.close();
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l;
    const snapshot = clone(db);
    try {
      const g = game();
      switch (a) {
        case "home":
          window.goHome();
          return;
        case "close":
          (_a = $("dialog")) == null ? void 0 : _a.close();
          return;
        case "playerPage":
          playerPage = +v.page;
          break;
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
          if (!n) throw Error("\u8BF7\u8F93\u5165\u59D3\u540D");
          const p = {
            bats: $("#pbats").value,
            throws: $("#pthrows").value,
            id: v.id || uid(),
            name: n,
            number: $("#pnumber").value.trim()
          };
          validatePlayer(db.players, p);
          if (v.id)
            Object.assign(
              db.players.find((p2) => p2.id === v.id),
              p
            );
          else db.players.push(p);
          $("dialog").close();
          break;
        }
        case "deletePlayer":
          if (g && replay(g).teams.some((t) => t.lineup.some((p) => p.id === v.id)))
            throw Error("\u8BE5\u7403\u5458\u6B63\u5728\u6BD4\u8D5B\u4E2D\uFF0C\u8BF7\u5148\u6362\u4E0B\u6216\u7ED3\u675F\u6BD4\u8D5B");
          if (!await ask("\u4ECE\u6CE8\u518C\u8868\u5220\u9664\u8BE5\u7403\u5458\uFF1F\u5386\u53F2\u6BD4\u8D5B\u4E2D\u7684\u59D3\u540D\u4E0E\u6570\u636E\u4FDD\u7559\u3002"))
            return;
          db.players.find((p) => p.id === v.id).deleted = true;
          selected.delete(v.id);
          break;
        case "exportPlayers": {
          const ids = db.players.filter((p) => !p.deleted && (!selected.size || selected.has(p.id))).map((p) => p.id);
          exportStats(
            [{ name: "\u7403\u5458", ids, stats: totals(db.games.filter((g2) => gameYear(g2) === season), sport) }],
            sportName(sport) + "\u7403\u5458\u7EDF\u8BA1"
          );
          return;
        }
        case "setup":
          if (g) {
            page = "game";
            toast("\u8BF7\u5148\u5B8C\u6210\u5F53\u524D\u6BD4\u8D5B\uFF0C\u518D\u5F00\u59CB\u65B0\u6BD4\u8D5B");
            break;
          }
          if (!db.setup || db.setup.sport !== v.sport)
            db.setup = {
              sport: v.sport,
              teams: [
                { name: "\u5BA2\u961F", lineup: [] },
                { name: "\u4E3B\u961F", lineup: [] }
              ]
            };
          page = "setup";
          break;
        case "pickPlayer":
          pickPlayer(+v.team);
          return;
        case "showLog":
          panel = "log";
          panelGameId = v.id || db.active;
          break;
        case "closePanel":
          panel = null;
          (_b = $("dialog")) == null ? void 0 : _b.close();
          break;
        case "addLine": {
          const t = db.setup.teams[+v.team], id = v.id;
          if (!id) throw Error("\u8BF7\u5148\u9009\u62E9\u7403\u5458");
          const available = POSITIONS.slice(
            0,
            db.setup.sport === "baseball" ? 9 : 10
          ).find((p) => !t.lineup.some((x) => x.pos === p));
          if (!available) throw Error("\u573A\u4E0A\u4F4D\u7F6E\u5DF2\u6EE1");
          if (db.setup.teams.some((t2) => t2.lineup.some((p) => p.id === id)))
            throw Error("\u8BE5\u7403\u5458\u5DF2\u5728\u961F\u4E2D");
          t.lineup.push({ id, pos: available });
          (_c = $("dialog")) == null ? void 0 : _c.close();
          break;
        }
        case "removeLine":
          db.setup.teams[+v.team].lineup.splice(+v.index, 1);
          break;
        case "up": {
          const l = db.setup.teams[+v.team].lineup, i = +v.index;
          if (i > 0) [l[i - 1], l[i]] = [l[i], l[i - 1]];
          break;
        }
        case "swapTeams":
          if (!db.setup) {
            page = db.active ? "game" : "home";
            break;
          }
          db.setup.teams.reverse();
          break;
        case "start": {
          if (!db.setup) {
            page = db.active ? "game" : "home";
            break;
          }
          for (const t of db.setup.teams) {
            if (!t.name.trim()) throw Error("\u8BF7\u586B\u5199\u961F\u540D");
            if (t.lineup.length < 2) throw Error("\u6BCF\u961F\u81F3\u5C11\u52A0\u5165 2 \u4F4D\u7403\u5458");
            if (new Set(t.lineup.map((p) => p.pos)).size !== t.lineup.length)
              throw Error("\u540C\u4E00\u961F\u7684\u5B88\u5907\u4F4D\u7F6E\u4E0D\u80FD\u91CD\u590D");
            if (!t.lineup.some((p) => p.pos === "\u6295\u624B"))
              throw Error("\u4E24\u961F\u90FD\u9700\u8981\u6307\u5B9A\u6295\u624B");
            if (t.lineup.some((p) => {
              var _a2;
              return (_a2 = db.players.find((x) => x.id === p.id)) == null ? void 0 : _a2.deleted;
            }))
              throw Error("\u7EC4\u961F\u4E2D\u5305\u542B\u5DF2\u5220\u9664\u7403\u5458\uFF0C\u8BF7\u79FB\u9664");
          }
          for (const k of ["scorerId", "umpireId"]) if (!db.players.some((p) => !p.deleted && p.id === db.setup[k])) throw Error("\u8BF7\u9009\u62E9\u8BB0\u5F55\u8005\u548C\u88C1\u5224");
          const n = newGame(db.setup.sport, db.setup.teams);
          n.scorerId = db.setup.scorerId;
          n.umpireId = db.setup.umpireId;
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
        case "ruling":
          if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
          panel = "ruling";
          break;
        case "rulingAdvance":
          updateGame(stageRuling(g, { kind: "advanceAward", bases: +v.n }));
          panel = null;
          break;
        case "rulingWalk":
          updateGame(stageRuling(g, { kind: "awardWalk" }));
          panel = null;
          break;
        case "rulingOut":
          updateGame(stageRuling(g, { kind: "runnerOut", runnerId: $("#penaltyRunner").value, runnerName: name($("#penaltyRunner").value) }));
          panel = null;
          break;
        case "rulingEject":
          ejectId = $("#ejectPerson").value;
          if (!ejectId) throw Error("\u8BF7\u9009\u62E9\u9A71\u9010\u4EBA\u5458");
          panel = "eject";
          break;
        case "ejectReady": {
          const replacementId = (_d = $("#ejectReplacement")) == null ? void 0 : _d.value;
          if ($("#ejectReplacement") && !replacementId) throw Error("\u8BF7\u9009\u62E9\u66FF\u6362\u4EBA\u5458");
          updateGame(stageRuling(g, { kind: "eject", personId: v.id, personName: name(v.id), replacementName: replacementId ? name(replacementId) : null, replacementId, team: +v.team }));
          panel = null;
          break;
        }
        case "archiveExport":
          dialog("<h2>\u6309\u5E74\u4EFD\u5BFC\u51FA\u5DF2\u5B8C\u6210\u6BD4\u8D5B</h2>" + years(db.games.filter((g2) => g2.ended)).map((y) => '<label class="row"><input class="check fit" type="checkbox" name="archiveYear" value="' + y + '" ' + (y === historyYear ? "checked" : "") + ">" + y + " \u5E74</label>").join("") + btn("\u5BFC\u51FA JSON", "archiveSave", "", "primary wide") + btn("\u5173\u95ED", "close"));
          return;
        case "archiveSave": {
          const ys = [...document.querySelectorAll('input[name="archiveYear"]:checked')].map((el) => el.value);
          if (!ys.length) throw Error("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u4E2A\u5E74\u4EFD");
          downloadJson(exportArchive(db, ys), "\u94BB\u77F3\u8BB0\u5206-" + ys.join("-") + ".json");
          (_e = $("dialog")) == null ? void 0 : _e.close();
          return;
        }
        case "archiveImport":
          if (window.AndroidStore) {
            window.AndroidStore.importJson();
            return;
          }
          {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".json,application/json";
            input.onchange = () => {
              const f = input.files[0];
              if (!f) return;
              if (f.size > 20 * 1024 * 1024) {
                toast("\u6587\u4EF6\u8D85\u8FC7 20 MB");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => window.receiveArchive(reader.result);
              reader.readAsText(f);
            };
            input.click();
          }
          return;
        case "pitchStage":
          stage = "pitch";
          g.uiStage = "pitch";
          break;
        case "pitch":
          if (g.draft) throw Error("\u8BF7\u5148\u5904\u7406\u5F53\u524D Fair");
          g.uiStage = "pitch";
          updateGame(recordCount(g, v.kind));
          stage = "pitch";
          break;
        case "contact":
          if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u5B8C\u6210\u5F53\u524D\u8BB0\u5F55");
          if (replay(g).halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E00\u534A\u5C40");
          g.draft = {
            type: "pitch",
            id: uid(),
            kind: "contact",
            time: (/* @__PURE__ */ new Date()).toISOString(),
            actions: [],
            pitcher: pitcher(replay(g))
          };
          break;
        case "zone":
          if (v.value !== "\u754C\u5916") g.draft.zone = v.value;
          break;
        case "award": {
          const s = replay(g), n = +v.n;
          Object.assign(g.draft, {
            trajectory: "fly",
            awardBases: n,
            result: "stop",
            fielder: pitcher(s),
            actions: runnerQueue(s).map((r) => ({
              id: r.id,
              mode: "advance",
              advance: Math.min(n, 4 - r.from)
            }))
          });
          break;
        }
        case "trajectory":
          if (g.sport === "softball" && v.value === "bunt") throw Error("\u6162\u6295\u5792\u7403\u4E0D\u5141\u8BB8\u89E6\u51FB");
          g.draft.trajectory = v.value;
          break;
        case "result":
          if (v.value === "catch" && g.draft.trajectory === "ground")
            throw Error("\u5730\u6EDA\u7403\u4E0D\u80FD\u76F4\u63A5\u63A5\u6740\uFF0C\u8BF7\u9009\u62E9\u62E6\u622A\u540E\u8BB0\u5F55\u5C01\u6740\u6216\u89E6\u6740");
          g.draft.fielder = $("#fielder").value;
          g.draft.result = v.value;
          break;
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
          const d = g.draft, a2 = {
            id: v.id,
            mode: "advance",
            advance: +$("#normalAdvance").value,
            errorAdvance: $("#errorAdvance") ? +$("#errorAdvance").value : 0,
            errorFielder: (_f = $("#errorFielder")) == null ? void 0 : _f.value
          };
          d.actions.push(a2);
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
            putout: $("#putout").value
          });
          d.outForm = null;
          d.pending = null;
          d.errorOpen = false;
          break;
        }
        case "draftBack": {
          const d = g.draft;
          if (d.awardBases) {
            delete d.awardBases;
            d.actions = [];
            delete d.result;
            delete d.trajectory;
            break;
          }
          d.pending = null;
          d.errorOpen = false;
          d.outForm = null;
          if (d.actions.length) {
            d.actions.pop();
            delete d.scoring;
            delete d.rbi;
          } else if (d.result) delete d.result;
          else if (d.trajectory) delete d.trajectory;
          else delete d.zone;
          break;
        }
        case "cancelDraft":
          if (!await ask("\u53D6\u6D88\u5F53\u524D\u5C1A\u672A\u786E\u8BA4\u7684\u6295\u7403\u5F55\u5165\uFF1F")) return;
          g.draft = null;
          (_g = $("dialog")) == null ? void 0 : _g.close();
          break;
        case "commitContact":
          updateGame(commit(g, g.draft));
          (_h = $("dialog")) == null ? void 0 : _h.close();
          stage = "pitch";
          break;
        case "confirmCount":
          updateGame(confirmCount(g));
          (_i = $("dialog")) == null ? void 0 : _i.close();
          break;
        case "cancelCount":
          updateGame(cancelCount(g));
          (_j = $("dialog")) == null ? void 0 : _j.close();
          break;
        case "undo":
          updateGame(undo(g).game);
          toast("\u5DF2\u64A4\u9500\u5F53\u524D\u6253\u5E2D\u4E0A\u4E00\u6761\u8BB0\u5F55");
          break;
        case "half":
          updateGame(commit(g, { type: "half" }));
          stage = "pitch";
          break;
        case "sub":
          panel = "sub";
          sub = true;
          break;
        case "subBack":
          panel = null;
          (_k = $("dialog")) == null ? void 0 : _k.close();
          sub = false;
          break;
        case "doSub":
        case "doSwap": {
          const s = replay(g), index = +$("#subout").value;
          const event = { type: "sub", team: 1 - s.side, index };
          if (a === "doSub") {
            event.id = $("#subin").value;
            if (!event.id) throw Error("\u8BF7\u9009\u62E9\u6362\u5165\u7403\u5458");
          } else {
            event.swap = +$("#swapin").value;
            if (event.swap === index) throw Error("\u8BF7\u9009\u62E9\u53E6\u4E00\u4F4D\u573A\u4E0A\u7403\u5458");
          }
          const draft = g.draft;
          const n = commit(g, event);
          n.draft = draft;
          updateGame(n);
          sub = false;
          panel = null;
          (_l = $("dialog")) == null ? void 0 : _l.close();
          toast("\u5B88\u5907\u9635\u5BB9\u5DF2\u66F4\u65B0");
          break;
        }
        case "end":
          if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u6295\u7403\uFF0C\u518D\u7ED3\u675F\u6BD4\u8D5B");
          if (!await ask("\u7ED3\u675F\u8FD9\u573A\u6BD4\u8D5B\u5E76\u4FDD\u5B58\u6700\u7EC8\u6570\u636E\uFF1F")) return;
          g.ended = true;
          g.endedAt = (/* @__PURE__ */ new Date()).toISOString();
          viewGame = g.id;
          db.active = null;
          page = "summary";
          break;
        case "view":
          viewGame = v.id;
          page = "summary";
          break;
        case "deleteGame":
          if (!await ask("\u6C38\u4E45\u5220\u9664\u8BE5\u6BD4\u8D5B\u53CA\u5176\u5BF9\u6240\u6709\u7403\u5458\u7D2F\u8BA1\u7EDF\u8BA1\u7684\u8D21\u732E\uFF1F"))
            return;
          db.games = db.games.filter((g2) => g2.id !== v.id);
          if (db.active === v.id) db.active = null;
          break;
        case "exportGame": {
          const x = db.games.find((g2) => g2.id === viewGame), s = replay(x, true), st = Object.fromEntries(
            Object.entries(s.stats).map(([id, x2]) => [id, rates(x2)])
          ), ids = [
            .../* @__PURE__ */ new Set([
              ...x.teams.flatMap((t) => t.lineup.map((p) => p.id)),
              ...Object.keys(st)
            ])
          ];
          const groups = x.teams.map((t, i) => ({
            name: t.name,
            ids: teamIds(x, i),
            stats: st
          }));
          exportStats(groups, "\u6BD4\u8D5B\u7EDF\u8BA1-" + x.created.slice(0, 10), {
            sport: x.sport,
            startedAt: x.startedAt || x.created,
            endedAt: x.endedAt
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
  function searchPlayers(e) {
    if (e.target.id !== "playerSearch" || e.isComposing) return;
    playerQuery = e.target.value;
    playerPage = 1;
    const cursor = e.target.selectionStart;
    render();
    const input = $("#playerSearch");
    input == null ? void 0 : input.focus();
    if (cursor !== null) try {
      input.setSelectionRange(cursor, cursor);
    } catch (e2) {
    }
  }
  document.addEventListener("input", searchPlayers);
  document.addEventListener("compositionend", searchPlayers);
  document.addEventListener("change", (e) => {
    var _a, _b, _c, _d;
    const el = e.target;
    if (![...el.attributes].some((a) => a.name.startsWith("data-"))) return;
    const before = clone(db);
    try {
      if (el.dataset.year) {
        if (el.dataset.year === "season") season = el.value;
        else historyYear = el.value;
        selected.clear();
        render();
        return;
      }
      if (el.dataset.official) {
        db.setup[el.dataset.official] = el.value;
        save();
        return;
      }
      if (el.dataset.select) {
        el.checked ? selected.add(el.dataset.select) : selected.delete(el.dataset.select);
        return;
      }
      if (el.dataset.teamName !== void 0) {
        db.setup.teams[+el.dataset.teamName].name = el.value;
        save();
        return;
      }
      if (el.dataset.position) {
        const [t, i] = el.dataset.position.split(":").map(Number);
        db.setup.teams[t].lineup[i].pos = el.value;
      }
      const d = (_a = game()) == null ? void 0 : _a.draft;
      if (el.hasAttribute("data-contact-fielder")) d.fielder = el.value;
      if (el.hasAttribute("data-normal-advance")) {
        (_b = d.pending) != null ? _b : d.pending = {};
        d.pending.advance = +el.value;
        d.pending.errorAdvance = 1;
      }
      if (el.hasAttribute("data-error-fielder")) {
        (_c = d.pending) != null ? _c : d.pending = {};
        d.pending.errorFielder = el.value;
      }
      if (el.hasAttribute("data-error-advance")) {
        (_d = d.pending) != null ? _d : d.pending = {};
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
      if (d == null ? void 0 : d.result) replay(game(), true);
      save();
      render();
    } catch (err) {
      db = before;
      render();
      toast(err.message);
    }
  });
  function bindDrag() {
    document.querySelectorAll("[data-drag]").forEach(
      (h) => h.addEventListener("pointerdown", (e) => {
        const [t, i] = h.dataset.drag.split(":").map(Number), rows = [
          ...document.querySelectorAll('[data-lineup="' + t + '"] .lineup')
        ], row = h.parentElement, bounds = rows.map((r) => r.getBoundingClientRect()), start = e.clientY;
        let target = i;
        h.setPointerCapture(e.pointerId);
        row.classList.add("dragging");
        const move = (ev) => {
          row.style.transform = "translateY(" + (ev.clientY - start) + "px)";
          target = bounds.reduce(
            (best, b, j) => Math.abs(ev.clientY - (b.top + b.height / 2)) < Math.abs(ev.clientY - (bounds[best].top + bounds[best].height / 2)) ? j : best,
            i
          );
          rows.forEach((r, j) => {
            if (j !== i)
              r.style.transform = "translateY(" + (i < target && j > i && j <= target ? -bounds[i].height : i > target && j >= target && j < i ? bounds[i].height : 0) + "px)";
          });
        };
        const end = (ev) => {
          h.removeEventListener("pointermove", move);
          h.removeEventListener("pointerup", end);
          h.removeEventListener("pointercancel", end);
          if (ev.type === "pointercancel") {
            rows.forEach((r) => r.style.transform = "");
            row.classList.remove("dragging");
            return;
          }
          const list = db.setup.teams[t].lineup;
          list.splice(target, 0, list.splice(i, 1)[0]);
          save();
          render();
          const moved = document.querySelector(
            '[data-lineup="' + t + '"] .lineup:nth-child(' + (target + 1) + ")"
          );
          moved == null ? void 0 : moved.classList.add("dropped");
        };
        h.addEventListener("pointermove", move);
        h.addEventListener("pointerup", end);
        h.addEventListener("pointercancel", end);
      })
    );
  }
  render();
})();
