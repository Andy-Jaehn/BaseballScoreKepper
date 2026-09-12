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

  // app/src/main/assets/web/special-engine.js
  var specialNames = { wp: "\u66B4\u6295", pb: "\u6355\u9038", balk: "\u6295\u624B\u72AF\u89C4", foulCatch: "\u754C\u5916\u63A5\u6740", foulDrop: "\u754C\u5916\u6F0F\u63A5", pickoff: "\u7275\u5236", droppedThird: "\u4E0D\u6B7B\u4E09\u632F", interference: "\u6355\u624B\u59A8\u788D\u6253\u51FB", steal: "\u76D7\u5792" };
  function applySpecial(s, g, e, h) {
    var _a;
    const { batter: batter2, pitcher: pitcher2, runnerQueue: runnerQueue2, clone: clone2, add: add2, out: out2, run: run2, plate: plate2, finish: finish2, reset: reset2, apply: apply2, isDefender: isDefender2 } = h;
    if (s.halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40");
    if (!specialNames[e.kind]) throw Error("\u672A\u77E5\u7279\u6B8A\u60C5\u51B5");
    const id = batter2(s), p = e.pitcher || pitcher2(s), pa = s.pa, slot = s.order[s.side] + 1, paStartedAt = s.paStartedAt, beforeOut = s.o, beforeBases = runnerQueue2(s).filter((r) => r.from), br = { id, pitcher: p, token: s.side + ":" + pa, from: 0 };
    const defense = s.teams[1 - s.side].lineup.filter(isDefender2), validFielder = (id2) => defense.some((f) => f.id === id2), catcher = (_a = defense.find((f) => f.pos === "\u6355\u624B")) == null ? void 0 : _a.id;
    const requireFielder = (id2) => {
      if (!validFielder(id2)) throw Error("\u8BF7\u9009\u62E9\u6709\u6548\u7684\u5B88\u5907\u7403\u5458");
    };
    const markLast = (label) => {
      const l = s.log.at(-1);
      l.kind = e.kind;
      l.summary = label + " \xB7 " + l.summary;
      l.special = true;
    };
    if (e.kind === "balk" && !beforeBases.length) {
      add2(s, p, "BK");
      apply2(s, g, { ...e, type: "pitch", kind: "ball", countsAsNonPitch: true });
      markLast("\u6295\u624B\u72AF\u89C4\uFF08\u65E0\u4EBA\u4E0A\u5792\uFF0C\u8BB0\u4E00\u4E2A\u574F\u7403\uFF09");
      return;
    }
    if (e.kind === "droppedThird" && s.s !== 2) throw Error("\u4E0D\u6B7B\u4E09\u632F\u4EC5\u53EF\u5728\u4E24\u597D\u7403\u65F6\u8BB0\u5F55");
    if (e.kind === "foulDrop") {
      requireFielder(e.errorFielder);
      add2(s, e.errorFielder, "F_FOUL_E");
      apply2(s, g, { ...e, type: "pitch", kind: "foul", twoStrikeFoulOut: false, foulErrorFielder: e.errorFielder });
      markLast("\u754C\u5916\u6F0F\u63A5");
      return;
    }
    let result = "SPECIAL", summary2 = specialNames[e.kind], terminal = false, actions = [], runs = [], outs = [], errors = /* @__PURE__ */ new Set();
    let queue = beforeBases.slice(), source = e.actions || [];
    if (["wp", "pb"].includes(e.kind)) {
      if (!beforeBases.length) throw Error("\u5F53\u524D\u6CA1\u6709\u5792\u4E0A\u8DD1\u8005");
      add2(s, p, "P");
      add2(s, id, "NP");
      if (e.kind === "wp") add2(s, p, "WP");
      else {
        if (!catcher) throw Error("\u8BF7\u6307\u5B9A\u6355\u624B");
        add2(s, catcher, "PB");
      }
    }
    if (e.kind === "balk") {
      add2(s, p, "BK");
      source = queue.map((r) => ({ id: r.id, mode: "advance", advance: 1 }));
    }
    if (e.kind === "pickoff") {
      const target = beforeBases.find((r) => r.from === e.base);
      if (!target) throw Error("\u8BF7\u9009\u62E9\u6709\u8DD1\u8005\u7684\u7275\u5236\u5792\u5305");
      if (e.putout && e.errorFielder) throw Error("\u7275\u5236\u51FA\u5C40\u4E0E\u7275\u5236\u5931\u8BEF\u4E0D\u80FD\u540C\u65F6\u586B\u5199");
      add2(s, p, "PICK");
      if (e.putout) {
        requireFielder(e.putout);
        source = queue.map((r) => r.id === target.id ? { id: r.id, mode: "tag", putout: e.putout, assist: p } : { id: r.id, mode: "advance", advance: 0 });
      } else if (e.errorFielder) {
        requireFielder(e.errorFielder);
        errors.add(e.errorFielder);
      } else source = queue.map((r) => ({ id: r.id, mode: "advance", advance: 0 }));
    }
    if (e.kind === "steal" && !beforeBases.length) throw Error("\u5F53\u524D\u6CA1\u6709\u5792\u4E0A\u8DD1\u8005");
    if (e.kind === "droppedThird") {
      add2(s, id, "D3K");
      if (e.cause === "pb") {
        if (!catcher) throw Error("\u8BF7\u6307\u5B9A\u6355\u624B");
        add2(s, catcher, "PB");
        summary2 = "\u6355\u9038 \xB7 \u4E0D\u6B7B\u4E09\u632F";
      }
      queue = [...queue, br];
      terminal = true;
      result = "SO";
      plate2(s, id, p, "SO");
      add2(s, p, "P");
      add2(s, id, "NP");
      add2(s, p, "STR");
    }
    if (e.kind === "foulCatch") {
      requireFielder(e.fielder);
      terminal = true;
      result = "OUT";
      plate2(s, id, p, result);
      add2(s, p, "P");
      add2(s, id, "NP");
      add2(s, p, "STR");
      out2(s, p, e.fielder);
      outs.push({ ...br, mode: "catch", putout: e.fielder });
      source = queue.map((r) => ({ id: r.id, mode: "advance", advance: 0 }));
    }
    if (e.kind === "interference") {
      if (!catcher) throw Error("\u8BF7\u6307\u5B9A\u6355\u624B");
      errors.add(catcher);
      terminal = true;
      result = "CI";
      plate2(s, id, p, result);
      add2(s, id, "CI");
      add2(s, catcher, "F_CI");
      let forced = true;
      const advances = /* @__PURE__ */ new Map();
      for (let base = 1; base <= 3; base++) {
        if (!s.bases[base - 1]) forced = false;
        advances.set(base, forced ? 1 : 0);
      }
      queue = [...queue, br];
      source = queue.map((r) => ({ id: r.id, mode: "advance", advance: r.from ? advances.get(r.from) : 1 }));
    }
    const pitchBall = e.kind === "wp" || e.kind === "pb" && e.pitchResult !== "strike";
    if (pitchBall) s.b++;
    if (e.kind === "pb" && e.pitchResult === "strike") {
      if (s.s >= 2) throw Error("\u7B2C\u4E09\u597D\u7403\u6355\u9038\u8BF7\u4F7F\u7528\u4E0D\u6B7B\u4E09\u632F");
      s.s++;
      add2(s, p, "STR");
    }
    const walk = pitchBall && s.b >= 4;
    const forcedBase = (r) => walk && Array.from({ length: r.from }, (_, i) => s.bases[i]).every(Boolean);
    if (walk) {
      terminal = true;
      result = "BB";
      plate2(s, id, p, "BB");
      summary2 += " \xB7 \u56DB\u574F\u7403\u4FDD\u9001";
    }
    const dest = /* @__PURE__ */ new Map();
    let limit = 4;
    for (const r of queue) {
      if (s.o >= 3) {
        actions.push({ ...r, mode: "inningEnd" });
        continue;
      }
      const a = source.find((a2) => a2.id === r.id);
      if (!a) throw Error("\u8BF7\u9010\u4E2A\u786E\u8BA4\u6240\u6709\u8DD1\u8005");
      if (a.mode === "tag") {
        requireFielder(a.putout);
        if (e.kind === "steal" && !defense.some((f) => f.id === a.assist && ["\u6295\u624B", "\u6355\u624B"].includes(f.pos))) throw Error("\u8BF7\u9009\u62E9\u53D1\u52A8\u963B\u76D7\u7684\u6295\u624B\u6216\u6355\u624B");
        if (a.assist) requireFielder(a.assist);
        out2(s, p, a.putout);
        if (a.assist && a.assist !== a.putout) add2(s, a.assist, "A");
        if (e.kind === "steal") add2(s, r.id, "CS");
        outs.push({ ...r, ...a });
        actions.push({ ...r, ...a });
        if (s.o === 3 && !a.runsBeforeThird) {
          for (const run3 of runs) {
            add2(s, run3.id, "R", -1);
            add2(s, run3.pitcher, "RA", -1);
            s.score[s.side].R--;
            s.lines[s.side][s.inning - 1]--;
          }
          runs = [];
        }
        continue;
      }
      if (a.mode !== "advance") throw Error("\u65E0\u6548\u8DD1\u8005\u5904\u7406");
      const advance = Number(a.advance || 0), errorAdvance = Number(a.errorAdvance || 0), to = r.from + advance + errorAdvance;
      if (!Number.isInteger(advance) || !Number.isInteger(errorAdvance) || advance < 0 || errorAdvance < 0 || to > 4 || to > limit) throw Error("\u8DD1\u8005\u4E0D\u80FD\u91CD\u53E0\u3001\u8D8A\u8FC7\u524D\u4F4D\u8DD1\u8005\u6216\u8D85\u8FC7\u672C\u5792");
      if (forcedBase(r) && advance < 1) throw Error("\u7B2C\u56DB\u574F\u7403\u65F6\u53D7\u8FEB\u8DD1\u8005\u81F3\u5C11\u6B63\u5E38\u524D\u8FDB\u4E00\u5792");
      if (!r.from && to < 1) throw Error("\u4E0D\u6B7B\u4E09\u632F\u6253\u8005\u81F3\u5C11\u5230\u8FBE\u4E00\u5792");
      if (errorAdvance) {
        requireFielder(a.errorFielder);
        errors.add(a.errorFielder);
      }
      const action2 = { ...r, ...a, advance, errorAdvance };
      if (e.kind === "pb" || e.cause === "pb") action2.shadowAdvance = forcedBase(r) ? 1 : 0;
      if (e.kind === "interference") action2.shadowAdvance = 0;
      actions.push(action2);
      if (e.kind === "steal" && advance > 0) add2(s, r.id, "SB", advance);
      if (to === 4) {
        run2(s, r);
        runs.push({ ...r });
      } else {
        dest.set(to, { ...r });
        limit = to - 1;
      }
    }
    if (source.some((a) => !queue.some((r) => r.id === a.id)) || new Set(source.map((a) => a.id)).size !== source.length) throw Error("\u8DD1\u8005\u8BB0\u5F55\u65E0\u6548\u6216\u91CD\u590D");
    for (const f of errors) {
      add2(s, f, "E");
      s.score[1 - s.side].E++;
    }
    if (walk) {
      actions.push({ ...br, mode: "advance", advance: 1, errorAdvance: 0 });
      if (s.o < 3) dest.set(1, br);
    }
    s.bases = [1, 2, 3].map((n) => dest.get(n) || null);
    const attempts = e.kind === "steal" ? actions.filter((a) => a.mode === "tag" || a.advance > 0).length : 0;
    if (e.kind === "steal" && !attempts && !actions.some((a) => a.errorAdvance)) throw Error("\u8BF7\u8BB0\u5F55\u81F3\u5C11\u4E00\u4F4D\u8DD1\u8005\u7684\u76D7\u5792\u5C1D\u8BD5");
    if (attempts >= 2) {
      summary2 = "\u53CC\u76D7\u5792";
      for (const a of actions.filter((a2) => a2.advance > 0)) add2(s, a.id, "DS");
    }
    if (terminal) finish2(s, g, e.completedAt || e.time);
    else if (s.o >= 3) {
      s.o = 3;
      s.halfEnded = true;
      s.bases = [null, null, null];
      reset2(s, g);
    }
    const batterAction = actions.find((a) => a.from === 0), play = { result, actions, runs, outs, rbi: 0, batter: terminal ? br : null, batterOut: outs.some((o) => o.from === 0), reachedError: e.kind === "droppedThird" && (!!(batterAction == null ? void 0 : batterAction.errorAdvance) || e.cause === "pb") };
    if (walk) {
      play.specialWalk = true;
      const forcedRun = beforeBases.length === 3 && runs.some((r) => {
        var _a2;
        return r.id === ((_a2 = beforeBases.find((r2) => r2.from === 3)) == null ? void 0 : _a2.id);
      });
      if (forcedRun) {
        play.rbi = 1;
        add2(s, id, "RBI");
      }
    }
    if (e.kind === "interference") play.interference = true;
    if (runs.length) summary2 += " \xB7 " + runs.length + " \u5F97\u5206";
    if (outs.length) summary2 += " \xB7 " + outs.length + " \u51FA\u5C40";
    if (errors.size) summary2 += " \xB7 " + errors.size + " E";
    if (e.kind === "pickoff") summary2 += " \xB7 " + e.base + " \u5792\u7275\u5236" + (e.putout ? "\u51FA\u5C40" : e.errorFielder ? "\u5931\u8BEF" : "\u5C1D\u8BD5");
    s.log.push({ id: e.id, pa, slot, paStartedAt, completedAt: terminal ? e.completedAt || e.time : null, inning: s.inning, side: s.side, defense: 1 - s.side, pitcher: p, batter: id, kind: e.kind, isPitch: e.isPitch, summary: summary2, result, terminal, b: s.b, s: s.s, o: s.o, beforeOut, beforeBases, afterBases: clone2(s.bases), play, time: e.time, special: true, errorFielder: e.errorFielder || (e.kind === "interference" ? catcher : null), pickoffBase: e.base, putout: e.putout });
  }

  // app/src/main/assets/web/earned.js
  function earnedRunDetails(log) {
    var _a, _b, _c, _d;
    const result = {}, tracks = /* @__PURE__ */ new Map(), audit = [];
    let eventIndex = -1;
    let half = "";
    const collect = (closed = false) => {
      var _a2;
      for (const [p, t] of tracks)
        for (const [token, detail] of t.actual) {
          if (t.scored.has(token) && !t.credited.has(token)) {
            result[p] = (result[p] || 0) + 1;
            t.credited.add(token);
          }
          detail.earned = t.scored.has(token);
          detail.final = closed || t.outs >= 3 || detail.earned || t.excluded.has(token) || t.retired.has(token);
          detail.shadowScoredAt = (_a2 = t.scored.get(token)) != null ? _a2 : null;
          detail.reason = detail.earned ? detail.shadowScoredAt > detail.actualScoredAt ? "later-legal-advance" : "error-free-score" : t.excluded.has(token) ? "reached-on-error" : t.retired.has(token) ? "shadow-runner-retired" : t.outs >= 3 ? "shadow-inning-ended" : closed ? "insufficient-legal-advance" : "not-yet-established";
        }
    };
    for (const l of log) {
      eventIndex++;
      const key = `${l.inning}:${l.side}`;
      if (key !== half) {
        collect(true);
        tracks.clear();
        half = key;
      }
      if (!tracks.has(l.pitcher))
        tracks.set(l.pitcher, {
          outs: l.beforeOut,
          bases: new Map(
            l.beforeBases.filter(Boolean).map((r) => [r.token, { ...r, pos: r.from }])
          ),
          scored: /* @__PURE__ */ new Map(),
          actual: /* @__PURE__ */ new Map(),
          excluded: /* @__PURE__ */ new Set(),
          retired: /* @__PURE__ */ new Set(),
          steps: [],
          credited: /* @__PURE__ */ new Set(),
          missedBatters: /* @__PURE__ */ new Set()
        });
      if (l.foulError) for (const t of tracks.values()) {
        const token = `${l.side}:${l.pa}`;
        if (!t.missedBatters.has(token) && t.outs < 3) {
          t.missedBatters.add(token);
          t.excluded.add(token);
          t.outs++;
          t.steps.push({ eventIndex, reason: "missed-foul-out", token, outs: t.outs });
        }
      }
      const play = l.play;
      if (!play) continue;
      for (const r of play.runs || []) {
        const t = tracks.get(r.pitcher);
        if (t) {
          const detail = {
            inning: l.inning,
            side: l.side,
            pitcher: r.pitcher,
            token: r.token,
            runnerId: r.id,
            actualScoredAt: eventIndex,
            steps: t.steps
          };
          t.actual.set(r.token, detail);
          audit.push(detail);
        }
      }
      for (const t of tracks.values()) {
        if (t.outs >= 3) continue;
        const step = {
          eventIndex,
          result: play.result,
          beforeOuts: t.outs,
          beforeBases: [...t.bases.values()].map((r) => ({ token: r.token, pos: r.pos })),
          decisions: []
        };
        t.steps.push(step);
        try {
          const score3 = (r) => {
            if (t.outs < 3) t.scored.set(r.token, eventIndex);
            t.bases.delete(r.token);
          };
          const safe = (r, pos) => {
            if (pos >= 4) score3(r);
            else t.bases.set(r.token, { ...r, pos });
          };
          if ((play.result === "BB" || play.result === "HBP") && !play.specialWalk) {
            if (t.missedBatters.has(play.batter.token)) continue;
            const at = (n) => [...t.bases.values()].find((r) => r.pos === n), a = at(1), b = at(2), c = at(3);
            if (a) {
              if (b) {
                if (c) score3(c);
                safe(b, 3);
              }
              safe(a, 2);
            }
            safe(play.batter, 1);
            step.decisions.push({ token: play.batter.token, reason: "forced-walk-chain" });
            continue;
          }
          if (play.interference) {
            t.excluded.add(play.batter.token);
          }
          const missedBatter = t.missedBatters.has((_a = play.batter) == null ? void 0 : _a.token);
          const lostOut = play.reachedError && !play.batterOut && !missedBatter ? 1 : 0;
          if (lostOut) t.excluded.add(play.batter.token);
          const available = new Map(t.bases);
          let batterForces = Boolean(play.batter && !missedBatter && !lostOut && !(play.outs || []).some((o) => o.from === 0 && ["catch", "strike"].includes(o.mode)));
          const outs = (play.outs || []).filter((o) => {
            let valid;
            if (o.from === 0) {
              valid = !missedBatter && !lostOut;
              batterForces = false;
            } else {
              const r = available.get(o.token);
              valid = Boolean(r);
              if (valid && o.mode === "force") {
                valid = batterForces && o.base === r.pos + 1;
                for (let pos = 1; valid && pos < r.pos; pos++)
                  valid = [...available.values()].some((x) => x.pos === pos);
              } else if (valid && o.mode === "tag" && play.result !== "PENALTY") valid = r.pos === o.from;
              if (valid) {
                available.delete(o.token);
                t.retired.add(o.token);
              }
            }
            step.decisions.push({ token: o.token, reason: valid ? "shadow-out" : "out-not-established", mode: o.mode });
            return valid;
          });
          if (lostOut) step.decisions.push({ token: play.batter.token, reason: "missed-out" });
          const virtualThird = outs[2 - t.outs - lostOut];
          const thirdForce = t.outs + lostOut >= 3 || t.outs + lostOut + outs.length >= 3 && virtualThird && (virtualThird.mode === "force" || virtualThird.from === 0 && !virtualThird.safeBases);
          if (thirdForce) {
            t.outs += lostOut + outs.length;
            continue;
          }
          const beforeTokens = new Set(t.bases.keys());
          for (const o of outs) t.bases.delete(o.token);
          const ordered = [...t.bases.values()].sort((a, b) => b.pos - a.pos);
          let limit = 4;
          for (const old of ordered) {
            const a = (play.actions || []).find((a2) => a2.token === old.token);
            let advance = 0, reason = "hold";
            if (play.hitBases === 4) {
              advance = 4;
              reason = "home-run";
            } else if (a && !["force", "tag"].includes(a.mode)) {
              advance = (_c = (_b = a.shadowAdvance) != null ? _b : a.advance) != null ? _c : 0;
              reason = "recorded-legal-advance";
            } else if (!a && play.hitBases) {
              advance = play.hitBases;
              reason = "inferred-hit-advance";
            }
            let pos = Math.min(limit, old.pos + advance);
            safe(old, pos);
            if (pos < 4) limit = pos - 1;
            step.decisions.push({ token: old.token, reason, from: old.pos, to: pos });
          }
          if (play.result === "H" && !missedBatter) {
            let minimum = play.hitBases + 1;
            const displaced = [...t.bases.values()].sort((a, b) => a.pos - b.pos).map((r) => {
              const pos = Math.max(r.pos, minimum);
              minimum = pos + 1;
              return { r, pos };
            });
            for (const { r, pos } of displaced.reverse()) {
              safe(r, pos);
              if (pos !== r.pos) step.decisions.push({ token: r.token, reason: "hit-award-displacement", from: r.pos, to: pos });
            }
            safe(play.batter, play.hitBases);
          } else if (play.result === "FC" && !play.batterOut && !missedBatter) {
            const retired = (play.outs || []).find((o) => o.from > 0);
            if (!retired || beforeTokens.has(retired.token)) {
              const force = (pos) => {
                const r = [...t.bases.values()].find((r2) => r2.pos === pos);
                if (r) {
                  if (pos < 3) force(pos + 1);
                  safe(r, pos + 1);
                  step.decisions.push({ token: r.token, reason: "inferred-choice-force", from: pos, to: pos + 1 });
                }
              };
              force(1);
              safe(play.batter, 1);
            } else t.excluded.add(play.batter.token);
          }
          if (play.specialWalk && !missedBatter) {
            const force = (pos) => {
              const r = [...t.bases.values()].find((r2) => r2.pos === pos);
              if (r) {
                if (pos < 3) force(pos + 1);
                safe(r, pos + 1);
              }
            };
            force(1);
            safe(play.batter, 1);
          }
          if (play.result === "SO" && !play.batterOut && !lostOut && !missedBatter) {
            const a = play.actions.find((a2) => a2.from === 0);
            if (a) safe(play.batter, a.advance);
          }
          t.outs += lostOut + outs.length;
        } finally {
          step.afterOuts = t.outs;
          step.afterBases = [...t.bases.values()].map((r) => ({ token: r.token, pos: r.pos }));
        }
      }
      collect();
    }
    collect(((_d = log.at(-1)) == null ? void 0 : _d.o) >= 3);
    return { totals: result, runs: audit };
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
    "\u81EA\u7531\u4EBA",
    "\u589E\u989D\u7403\u5458",
    "\u6307\u5B9A\u6253\u51FB DH"
  ];
  var lineupPositions = (sport2) => sport2 === "baseball" ? [...POSITIONS.slice(0, 9), "\u6307\u5B9A\u6253\u51FB DH"] : POSITIONS.slice(0, 11);
  var isDefender = (p) => !["\u589E\u989D\u7403\u5458", "\u6307\u5B9A\u6253\u51FB DH"].includes(p.pos);
  var clone = (x) => JSON.parse(JSON.stringify(x));
  var uid = () => {
    var _a, _b;
    return ((_b = (_a = globalThis.crypto) == null ? void 0 : _a.randomUUID) == null ? void 0 : _b.call(_a)) || Date.now().toString(36) + Math.random().toString(36).slice(2);
  };
  var emptyStats = () => Object.fromEntries(
    [
      "FB",
      "LD",
      "IFF",
      "GB",
      "P_FB",
      "P_LD",
      "P_IFF",
      "P_GB",
      "F_FB",
      "F_LD",
      "F_IFF",
      "F_GB",
      "WP",
      "PB",
      "BK",
      "PICK",
      "SB",
      "CS",
      "DS",
      "CI",
      "F_CI",
      "D3K",
      "F_FOUL_E",
      "NP",
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
      RA9: div(27 * s.RA, s.OUT),
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
      twoStrikeFoulOut: sport2 === "softball",
      sport: sport2,
      teams: clone(teams),
      created: now,
      startedAt: now,
      events: [],
      substitutions: [],
      draft: null,
      ended: false
    };
  }
  function initial(g) {
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
    if (r.from === 0) return s.sport === "softball" ? [1, 4] : [1];
    const own = [r.from];
    const forced = !["catch", "infieldFly"].includes(result) && Array.from({ length: r.from - 1 }, (_, i) => s.bases[i]).every(Boolean);
    return [.../* @__PURE__ */ new Set([...forced ? [...own, r.from + 1] : own, ...s.sport === "softball" ? [4] : []])];
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
  function apply(s, g, e, provisional = false) {
    var _a, _b, _c;
    if (e.type === "special") return applySpecial(s, g, e, { batter, pitcher, runnerQueue, clone, add, out, run, plate, finish, reset, apply, isDefender });
    if (e.type === "ruling" && e.kind !== "awardWalk") return applyRuling(s, g, e);
    if (e.type === "sub") {
      if (e.team !== 0 && e.team !== 1) throw Error("\u65E0\u6548\u7403\u961F");
      const l = s.teams[e.team].lineup, old = l[e.index];
      if (!old) throw Error("\u65E0\u6548\u6362\u4EBA\u4F4D\u7F6E");
      const runner = s.bases.find((r) => (r == null ? void 0 : r.id) === old.id), offense = e.team === s.side;
      const record2 = { eventId: e.eventId, time: e.time, inning: s.inning, side: s.side, team: e.team, slot: e.index + 1, outId: old.id, inId: e.id || null, position: old.pos, kind: e.swap !== void 0 ? "\u6362\u4F4D" : offense ? runner ? "\u4EE3\u8DD1" : "\u4EE3\u6253" : "\u5B88\u5907\u6362\u4EBA", balls: s.b, strikes: s.s, base: runner ? s.bases.indexOf(runner) + 1 : null };
      if (e.swap !== void 0) {
        if (!l[e.swap] || e.swap === e.index) throw Error("\u65E0\u6548\u6362\u4F4D");
        record2.otherId = l[e.swap].id;
        record2.otherSlot = e.swap + 1;
        record2.otherPosition = l[e.swap].pos;
        [old.pos, l[e.swap].pos] = [l[e.swap].pos, old.pos];
      } else {
        if (!e.id || s.ejected.includes(e.id) || s.teams.some((t) => t.lineup.some((p2) => p2.id === e.id))) throw Error("\u8BF7\u9009\u62E9\u672A\u5728\u573A\u4E14\u672A\u88AB\u9A71\u9010\u7684\u66FF\u8865");
        if (offense && old.id !== batter(s) && !runner) throw Error("\u8FDB\u653B\u6362\u4EBA\u53EA\u80FD\u66FF\u6362\u5F53\u524D\u6253\u8005\u6216\u5792\u4E0A\u8DD1\u8005");
        if (offense && old.id === batter(s) && s.s === 2 && g.sport === "baseball") s.strikeoutBatter || (s.strikeoutBatter = old.id);
        l[e.index] = { id: e.id, pos: old.pos };
        if (runner) runner.id = e.id;
      }
      s.substitutions.push(record2);
      return;
    }
    if (e.type === "half") {
      if (!s.halfEnded) throw Error("\u5C1A\u672A\u4E09\u51FA\u5C40");
      s.paStartedAt = e.time;
      s.side = 1 - s.side;
      if (!s.side) s.inning++;
      s.o = 0;
      s.halfEnded = false;
      s.lines[s.side][s.inning - 1] = 0;
      reset(s, g);
      return;
    }
    if (s.halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40");
    const id = batter(s), p = e.pitcher || pitcher(s), beforeOut = s.o, pa = s.pa, slot = s.order[s.side] + 1, paStartedAt = s.paStartedAt, creditedBatter = s.strikeoutBatter || id, beforeBases = runnerQueue(s).filter((r) => r.from), br = { id, pitcher: p, token: `${s.side}:${pa}`, from: 0 };
    if (s.bases.some((r) => (r == null ? void 0 : r.id) === id))
      throw Error("\u5F53\u524D\u6253\u8005\u4ECD\u5728\u5792\u4E0A\uFF0C\u8BF7\u4F7F\u7528\u5B8C\u6574\u6253\u5E8F");
    if (!["ball", "strike", "foul", "hbp", "contact", "ibb", "awardWalk"].includes(e.kind))
      throw Error("\u672A\u77E5\u6295\u7403\u7C7B\u578B");
    if (!["awardWalk", "ibb"].includes(e.kind) && !e.countsAsNonPitch) {
      add(s, p, "P");
      add(s, id, "NP");
    }
    if (["strike", "foul", "contact"].includes(e.kind)) add(s, p, "STR");
    let summary2 = "", result = "", play = null, foulError = false;
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
        finish(s, g, e.completedAt || e.time);
        summary2 = result === "BB" ? "\u56DB\u574F\u7403\u4FDD\u9001" : "\u89E6\u8EAB\u7403\u4FDD\u9001";
        if (e.kind === "ibb") summary2 = "\u6545\u610F\u56DB\u574F\u7403\u4FDD\u9001 IBB";
        if (e.kind === "awardWalk") summary2 = "\u88C1\u5224\u5224\u7F5A\uFF1A\u5F53\u524D\u6253\u8005\u4FDD\u9001";
      } else summary2 = "\u574F\u7403";
    } else if (e.kind === "strike" || e.kind === "foul") {
      const foulOut = g.sport === "softball" && ((_b = (_a = e.twoStrikeFoulOut) != null ? _a : g.twoStrikeFoulOut) != null ? _b : true);
      if (e.kind === "strike" || s.s < 2 || foulOut) s.s++;
      summary2 = e.kind === "foul" ? "\u754C\u5916\u7403" : "\u597D\u7403";
      if (e.kind === "foul" && e.foulErrorFielder && s.s < 3) {
        if (!s.teams[1 - s.side].lineup.some((f) => f.id === e.foulErrorFielder)) throw Error("\u8BF7\u9009\u62E9\u5931\u8BEF\u91CE\u624B");
        add(s, e.foulErrorFielder, "E");
        s.score[1 - s.side].E++;
        foulError = true;
        summary2 += " \xB7 \u754C\u5916\u6F0F\u63A5\u5931\u8BEF E";
      }
      if (s.s >= 3) {
        result = "SO";
        plate(s, creditedBatter, p, result);
        out(s, p, (_c = s.teams[1 - s.side].lineup.find((x) => x.pos === "\u6355\u624B")) == null ? void 0 : _c.id);
        play = {
          result,
          batter: br,
          runs: [],
          outs: [{ ...br, mode: "strike" }],
          actions: []
        };
        finish(s, g, e.completedAt || e.time);
        summary2 = e.kind === "foul" ? "\u4E24\u597D\u7403\u540E\u754C\u5916\u51FA\u5C40" : "\u4E09\u632F\u51FA\u5C40";
      }
    } else {
      const q = runnerQueue(s).map((r) => r.from === 0 ? br : r), recoveredForce = e.result === "error" && (e.actions || []).some((a) => a.mode === "force"), actions = (e.actions || []).map((a) => recoveredForce && a.id === id && a.mode === "advance" && !a.advance && a.errorAdvance && a.errorFielder === e.fielder ? { ...a, advance: 1, errorAdvance: a.errorAdvance - 1 } : a), caught = ["catch", "infieldFly"].includes(e.result), error = e.result === "error" && !recoveredForce;
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
        if (a.mode === "force" && !forceBases(s, a.id, e.result).includes(a.base)) throw Error("\u5F53\u524D\u8DD1\u8005\u4E0D\u6EE1\u8DB3\u8BE5\u5792\u5305\u5C01\u6740\u6761\u4EF6");
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
      if (error && !e.fielder) throw Error("\u8BF7\u9009\u62E9\u5904\u7406\u5931\u8BEF\u7684\u91CE\u624B");
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
      const ba = actions.find((a) => a.id === id), runnerOut = outs.some((o) => o.from > 0), batterOut = caught || outs.some((o) => o.from === 0), complete = s.o >= 3 || q.every(
        (r) => !r.from && caught || actions.some((a) => a.id === r.id)
      );
      const third = s.o >= 3 ? e.thirdOutId ? outs.find((o) => o.id === e.thirdOutId) || outs[2 - beforeOut] : outs[2 - beforeOut] : null;
      const cancel = third && (third.mode === "force" || third.from === 0 && !third.safeBases), valid = cancel ? [] : runs.filter(
        (r) => {
          var _a2;
          return !third || e.runsBeforeThird === true || ((_a2 = actions.find((a) => a.id === r.id)) == null ? void 0 : _a2.beforeThird) === true;
        }
      );
      const forceEndsHalf = Boolean(cancel && !caught);
      const effectiveActions = cancel ? actions.filter((a) => outs.some((o) => o.id === a.id)) : actions;
      if (cancel) dest.clear();
      valid.forEach((r) => run(s, r));
      let hitBases = 0;
      result = "OUT";
      if (caught || error) {
        if (beforeOut < 2 && valid.some((r) => r.normalScore) && e.zone !== "\u5185\u91CE" && ["fly", "line"].includes(e.trajectory))
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
      if (e.trajectory === "bunt" && beforeOut < 2 && !runnerOut && actions.some((a) => a.id !== id && a.advance > 0) && (batterOut || error))
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
        if (!complete) throw Error("\u8BF7\u5B8C\u6210\u6240\u6709\u8DD1\u8005\u7684\u8BB0\u5F55");
        if (result === "H" && (!hitBases || hitBases > 4))
          throw Error("\u5B89\u6253\u5792\u6570\u65E0\u6548");
        const ballType = { fly: "FB", line: "LD", popup: "IFF", ground: "GB", bunt: "GB" }[e.trajectory];
        if (ballType) {
          add(s, id, ballType);
          add(s, p, "P_" + ballType);
          if (e.fielder && !e.awardBases) add(s, e.fielder, "F_" + ballType);
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
        const dp = outs.length === 2, tp = outs.length >= 3, groundDP = ["ground", "bunt"].includes(e.trajectory) && dp && outs.some((o) => o.mode === "force");
        if (dp || tp) {
          involved.forEach((f) => add(s, f, tp ? "TP" : "DP"));
          if (groundDP) add(s, id, "GDP");
        }
        let rbi = cancel || groundDP || error && !batterOut && beforeOut + outs.length >= 2 ? 0 : valid.filter((r) => r.normalScore).length;
        if (!g.rulesVersion && Number.isInteger(e.rbi)) rbi = e.rbi;
        add(s, id, "RBI", rbi);
        const outLabel = tp ? "\u4E09\u6740\u6253" : dp ? "\u53CC\u6740\u6253" : forceEndsHalf && !batterOut ? "\u5C01\u6740\u7ED3\u675F\u534A\u5C40" : e.result === "infieldFly" ? "\u5185\u91CE\u9AD8\u98DE\u7403\u51FA\u5C40" : caught ? e.trajectory === "popup" ? "\u5185\u91CE\u9AD8\u98DE\u63A5\u6740" : e.trajectory === "fly" ? "\u9AD8\u98DE\u7403\u51FA\u5C40" : "\u5E73\u98DE\u63A5\u6740\u51FA\u5C40" : ["ground", "bunt"].includes(e.trajectory) ? "\u5730\u6EDA\u7403\u51FA\u5C40" : "\u51FB\u7403\u51FA\u5C40";
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
        const errorBases = effectiveActions.reduce((n, a) => n + (a.errorAdvance || 0), 0), errorRuns = valid.filter((r) => !r.normalScore).length;
        if (errors.size)
          summary2 += ` \xB7 ${errors.size} E / \u5931\u8BEF\u8FDB\u5792 ${errorBases} / \u5931\u8BEF\u5F97\u5206 ${errorRuns}`;
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
      if (complete || !provisional) finish(s, g, e.completedAt || e.time);
    }
    s.log.push({
      id: e.id,
      pa,
      slot,
      paStartedAt,
      completedAt: pa !== s.pa ? e.completedAt || e.time : null,
      creditedBatter: result === "SO" ? creditedBatter : id,
      afterBases: clone(s.bases),
      errorFielder: e.result === "error" && !(e.actions || []).some((a) => a.mode === "force") ? e.fielder : foulError ? e.foulErrorFielder : null,
      foulError,
      inning: s.inning,
      side: s.side,
      defense: 1 - s.side,
      pitcher: p,
      batter: id,
      kind: e.kind,
      isPitch: e.isPitch,
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
      trajectory: e.trajectory,
      throwingPath: e.throwingPath || ""
    });
  }
  function replay(g, includeDraft = false) {
    var _a;
    const s = initial(g);
    for (const e of g.events) apply(s, g, e);
    if (includeDraft && g.pendingPitch) apply(s, g, g.pendingPitch);
    if (includeDraft && ((_a = g.draft) == null ? void 0 : _a.result)) apply(s, g, g.draft, true);
    const er = earnedRunDetails(s.log);
    s.earnedRunAudit = er.runs;
    for (const [id, st] of Object.entries(s.stats)) st.ER = er.totals[id] || 0;
    return s;
  }
  function commit(g, e) {
    if (g.ended) throw Error("\u6BD4\u8D5B\u5DF2\u7ED3\u675F");
    const n = clone(g), s = replay(g);
    if (e.kind === "ibb" && s.bases.every(Boolean)) throw Error("\u6EE1\u5792\u65F6\u7981\u6B62\u6545\u610F\u56DB\u574F\u7403\u4FDD\u9001\uFF1B\u4ECD\u53EF\u6B63\u5E38\u8BB0\u5F55\u574F\u7403\u6216\u89E6\u8EAB\u7403");
    if (e.kind === "contact") {
      if (!(g.sport === "softball" ? /^[0-9]*$/ : /^[1-9]*$/).test(e.throwingPath || "")) throw Error(g.sport === "softball" ? "\u4F20\u7403\u8DEF\u5F84\u4EC5\u53EF\u8F93\u5165 0\u20139" : "\u4F20\u7403\u8DEF\u5F84\u4EC5\u53EF\u8F93\u5165 1\u20139");
      if (g.sport === "softball" && e.trajectory === "bunt") throw Error("\u6162\u6295\u5792\u7403\u4E0D\u5141\u8BB8\u89E6\u51FB");
      for (const a of e.actions || []) if (a.mode === "force" && !forceBases(s, a.id, e.result).includes(a.base)) throw Error("\u5F53\u524D\u8DD1\u8005\u4E0D\u6EE1\u8DB3\u8BE5\u5792\u5305\u5C01\u6740\u6761\u4EF6");
    }
    e = {
      ...e,
      isPitch: e.type === "pitch" || e.type === "special" && !["steal", "pickoff", "interference"].includes(e.kind),
      eventId: e.eventId || uid(),
      completedAt: (/* @__PURE__ */ new Date()).toISOString(),
      pitcher: e.pitcher || pitcher(s),
      time: e.time || (/* @__PURE__ */ new Date()).toISOString()
    };
    if (e.type === "pitch" && e.kind === "foul") e.twoStrikeFoulOut = g.sport === "softball";
    if (e.type === "pitch" || e.type === "ruling" || e.type === "special") {
      e.id = e.id || uid();
      e.pa = s.pa;
      n.editing = false;
      n.pendingPitch = null;
    }
    apply(s, g, e);
    n.events.push(e);
    n.substitutions = clone(s.substitutions);
    n.draft = null;
    n.specialDraft = null;
    return n;
  }
  function settleContact(g) {
    var _a;
    if (!((_a = g.draft) == null ? void 0 : _a.result)) return g;
    const shown = replay(g, true);
    if (!shown.halfEnded) return g;
    const n = clone(g), d = n.draft;
    for (const r of runnerQueue(replay(g))) {
      if (!d.actions.some((a) => a.id === r.id) && (r.from || !["catch", "infieldFly"].includes(d.result)))
        d.actions.push({ id: r.id, mode: "inningEnd", automatic: true });
    }
    return n;
  }
  function canUndo(g) {
    var _a;
    if (g.ended || g.draft || g.pendingPitch || g.specialDraft || ((_a = g.events.at(-1)) == null ? void 0 : _a.type) !== "pitch") return false;
    const s = replay(g), last = s.log.at(-1);
    return !!last && last.pa === s.pa && ["ball", "strike", "foul"].includes(last.kind) && !last.terminal;
  }
  function recordCount(g, kind, details = {}) {
    if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
    const next = commit(g, { ...details, type: "pitch", kind }), last = replay(next).log.at(-1);
    if (last.terminal) {
      const pending = clone(g);
      pending.pendingPitch = next.events.at(-1);
      return pending;
    }
    return next;
  }
  function stageSpecial(g, event) {
    if (g.draft || g.pendingPitch) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
    const n = clone(g), next = commit(g, { ...event, type: "special" });
    n.pendingPitch = next.events.at(-1);
    return n;
  }
  function confirmCount(g) {
    if (!g.pendingPitch) throw Error("\u6CA1\u6709\u5F85\u786E\u8BA4\u8BB0\u5F55");
    return commit(g, g.pendingPitch);
  }
  function cancelCount(g) {
    const n = clone(g);
    n.pendingPitch = null;
    n.specialDraft = null;
    return n;
  }
  function stageRuling(g, event) {
    if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
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
      summary2 = `\u88C1\u5224\u5224\u7F5A\uFF1A\u5792\u4E0A\u8DD1\u8005\u524D\u8FDB ${e.bases} \u5792` + (runs.length ? ` \xB7 ${runs.length} \u5F97\u5206` : "");
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
        s.substitutions.push({ eventId: e.eventId, time: e.time, inning: s.inning, side: s.side, team: s.teams.indexOf(t), slot: t.lineup.indexOf(slot) + 1, outId: e.personId, inId: e.replacementId, position: slot.pos, kind: "\u9A71\u9010\u66FF\u6362", balls: s.b, strikes: s.s });
        if (e.personId === batter(s) && s.s === 2 && g.sport === "baseball") s.strikeoutBatter || (s.strikeoutBatter = e.personId);
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
    s.log.push({ id: e.id, pa, paStartedAt: s.paStartedAt, slot: s.order[s.side] + 1, afterBases: clone(s.bases), inning: s.inning, side: s.side, defense: 1 - s.side, pitcher: p, batter: id, kind: e.kind, summary: summary2, result: "PENALTY", terminal: false, b: s.b, s: s.s, o: s.o, beforeOut, beforeBases, play, time: e.time });
  }
  function undo(g) {
    if (!canUndo(g)) throw Error("\u53EA\u80FD\u64A4\u9500\u5F53\u524D\u672A\u7ED3\u675F\u6253\u5E2D\u7684 B\u3001S\u3001Foul");
    const n = clone(g);
    let i = n.events.length - 1;
    while (i >= 0 && n.events[i].type !== "pitch") i--;
    const removed = n.events.splice(i, 1)[0];
    n.substitutions = replay(n).substitutions;
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

  // app/src/main/assets/web/throwing-path.js
  var positions = ["\u81EA\u7531\u4EBA", "\u6295\u624B", "\u6355\u624B", "\u4E00\u5792\u624B", "\u4E8C\u5792\u624B", "\u4E09\u5792\u624B", "\u6E38\u51FB\u624B", "\u5DE6\u5916\u91CE", "\u4E2D\u5916\u91CE", "\u53F3\u5916\u91CE"];
  var throwingPathLabel = (value) => [...String(value || "")].map((d) => positions[d] || "\u65E0\u6548\u7F16\u53F7").join("\u27A1");

  // app/src/main/assets/web/plate-records.js
  var pitchLabel = (k) => specialNames[k] || { ball: "B", strike: "S", foul: "Foul", contact: "Fair", hbp: "HBP", ibb: "IBB", awardWalk: "\u5224\u7F5A\u4FDD\u9001", advanceAward: "\u5224\u7F5A\u8FDB\u5792", runnerOut: "\u5224\u7F5A\u51FA\u5C40", eject: "\u9A71\u9010" }[k] || k;
  function plateRecords(g) {
    const s = replay(g, true), records = [];
    for (const l of s.log) {
      let r = records.at(-1);
      if (!r || r.pa !== l.pa || r.side !== l.side || r.inning !== l.inning) {
        r = { pa: l.pa, side: l.side, inning: l.inning, slot: l.slot, logs: [] };
        records.push(r);
      }
      r.logs.push(l);
      r.complete = r.logs.some((x) => x.terminal);
      r.startedAt = r.logs[0].paStartedAt || r.logs[0].time;
      r.endedAt = r.complete ? l.completedAt || l.time : l.o >= 3 ? l.time : null;
    }
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      if (!r.endedAt && records[i + 1]) r.endedAt = records[i + 1].startedAt;
      if (!r.endedAt && g.ended) r.endedAt = g.endedAt;
    }
    return records;
  }
  function resultLines(l, person) {
    if (!l) return [];
    const p = l.play || {}, actions = p.actions || [], runs = p.runs || [], outs = p.outs || [], bases = l.afterBases || [];
    const queue = [...(l.beforeBases || []).slice().sort((a, b) => b.from - a.from), { id: l.batter, from: 0 }], lines = [];
    for (const r of queue) {
      const a = actions.find((x) => x.id === r.id), o = outs.find((x) => x.id === r.id), dest = bases.findIndex((x) => (x == null ? void 0 : x.id) === r.id) + 1, scored = runs.some((x) => x.id === r.id);
      let text = "";
      if (o) text = o.mode === "force" ? ["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][o.base || (a == null ? void 0 : a.base) || 1] + "\u5904\u88AB\u5C01\u6740" : o.mode === "tag" ? "\u88AB\u89E6\u6740" : o.mode === "strike" ? "\u4E09\u632F\u51FA\u5C40" : "\u88AB\u63A5\u6740 / \u89C4\u5219\u51FA\u5C40";
      else if (a) {
        text = (a.advance ? "\u8FDB " + a.advance + " \u4E2A\u5792" : "\u505C\u7559") + (a.errorAdvance ? " + \u5931\u8BEF\u8FDB " + a.errorAdvance + " \u4E2A\u5792" : "") + " \u2192 " + (scored ? "\u5F97\u5206" : r.from + (a.advance || 0) + (a.errorAdvance || 0) >= 4 ? "\u5230\u672C\u5792\uFF0C\u5F97\u5206\u65E0\u6548" : dest ? dest + " \u5792" : "\u534A\u5C40\u7ED3\u675F");
      } else if (scored) text = "\u8FDB " + (4 - r.from) + " \u4E2A\u5792 \u2192 \u5F97\u5206";
      else if (dest) text = dest === r.from ? "\u505C\u7559\u5728 " + dest + " \u5792" : "\u8FDB " + (dest - r.from) + " \u4E2A\u5792 \u2192 " + dest + " \u5792";
      else text = l.o >= 3 ? "\u534A\u5C40\u7ED3\u675F\uFF0C\u672A\u5F97\u5206" : r.from ? "\u505C\u7559\u5728 " + r.from + " \u5792" : "\u7EE7\u7EED\u6253\u51FB";
      lines.push("\uFF08" + (r.from ? r.from + " \u5792\u8DD1\u8005" : "\u6253\u8005") + " " + person(r.id) + "\uFF09" + text);
    }
    const list = (ids) => [...new Set(ids)].map(person).join("\uFF0C") || "\u65E0";
    if (l.pickoffBase) lines.push("\u7275\u5236\u5792\u5305\uFF1A" + l.pickoffBase + " \u5792");
    for (const a of outs) {
      if (a.putout) lines.push("\u5B8C\u6210\u523A\u6740\uFF1A" + person(a.putout));
      if (a.assist && a.assist !== a.putout) lines.push("\u53D1\u52A8\u963B\u76D7 / \u52A9\u6740\uFF1A" + person(a.assist));
    }
    if (runs.length) lines.push("R\uFF1A" + list(runs.map((r) => r.id)));
    const errs = actions.filter((a) => a.errorAdvance).map((a) => a.errorFielder);
    if (l.errorFielder) errs.push(l.errorFielder);
    if (errs.length) lines.push("E\uFF1A" + list(errs));
    if (["SH", "SF"].includes(l.result)) lines.push("SAC\uFF1A" + person(l.batter) + "\uFF08" + (l.result === "SH" ? "\u727A\u7272\u89E6\u51FB" : "\u727A\u7272\u98DE\u7403") + "\uFF09\uFF1B\u63A8\u8FDB\u8DD1\u8005\uFF1A" + list(actions.filter((a) => a.from && a.advance).map((a) => a.id)));
    if (p.dp) lines.push("DP\uFF1A\u53CC\u6740");
    if (p.tp) lines.push("TP\uFF1A\u4E09\u6740");
    if (p.hitBases) lines.push((p.hitBases === 4 ? "HR" : p.hitBases + "B") + "\uFF1A" + person(l.batter));
    if (l.throwingPath) lines.push("\u4F20\u7403\u8DEF\u5F84\uFF1A" + l.throwingPath + " \xB7 " + throwingPathLabel(l.throwingPath));
    if (p.rbi) lines.push("RBI\uFF1A" + p.rbi);
    if (l.creditedBatter && l.creditedBatter !== l.batter) lines.push("\u4E09\u632F\u53CA\u6253\u6570\u5F52\u5C5E\uFF1A" + person(l.creditedBatter));
    return lines;
  }
  function recordSheets(g, person) {
    const records = plateRecords(g);
    return [{ name: "\u6BD4\u8D5B\u73AF\u5883", rows: [["\u6E29\u5EA6\uFF08\u2103\uFF09", g.temperature || ""], ["\u5929\u6C14", g.weather || ""], ["\u5730\u70B9", g.location || ""]] }, { name: "\u6362\u4EBA\u6362\u4F4D\u8BB0\u5F55", rows: [["\u65F6\u95F4", "\u5C40", "\u7403\u961F", "\u7C7B\u578B", "\u6253\u5E8F", "\u6362\u51FA / \u7403\u5458", "\u6362\u5165 / \u53E6\u4E00\u7403\u5458", "\u4F4D\u7F6E\u53D8\u5316", "\u7403\u6570 / \u5792\u4F4D"], ...substitutionRows(g, person)] }, { name: "\u6253\u51FB\u5E2D\u4F4D", rows: [["\u7403\u961F", "\u6253\u5E8F\u5E2D\u4F4D", "\u7403\u5458\u53CA\u80CC\u53F7", "\u5B88\u5907\u4F4D\u7F6E", "\u5165\u573A\u65B9\u5F0F"], ...lineupRows(g, person)] }, { name: "\u9010\u6253\u5E2D\u8BB0\u5F55", rows: [["\u6253\u5E2D", "\u7403\u961F", "\u5C40", "\u6253\u5E8F\u5E2D\u4F4D", "\u6253\u8005\uFF08\u4F9D\u6B21\uFF09", "\u72B6\u6001", "\u7ED3\u679C", "\u5F00\u59CB\u65F6\u95F4", "\u7ED3\u675F\u65F6\u95F4", "\u4F20\u7403\u8DEF\u5F84"], ...records.map((r, i) => [i + 1, g.teams[r.side].name, r.inning + (r.side ? "\u4E0B" : "\u4E0A"), r.slot, [...new Set(r.logs.map((l) => l.batter))].map(person).join(" \u2192 "), r.complete ? "\u5DF2\u5B8C\u6210" : "\u672A\u5B8C\u6210", r.logs.at(-1).summary, r.startedAt || "", r.endedAt || "", r.logs.filter((l) => l.throwingPath).map((l) => l.throwingPath + " \xB7 " + throwingPathLabel(l.throwingPath)).join("\uFF1B")])] }, { name: "\u6253\u5E2D\u5185\u6295\u7403\u4E0E\u8DD1\u5792", rows: [["\u6253\u5E2D", "\u7403\u5E8F/\u4E8B\u4EF6\u5E8F", "\u6295\u624B", "\u6253\u8005", "\u6295\u7403 / \u5224\u7F5A", "\u7ED3\u679C", "\u8DD1\u8005\u53CA\u7EDF\u8BA1", "\u65F6\u95F4"], ...records.flatMap((r, i) => r.logs.map((l, j) => [i + 1, j + 1, person(l.pitcher), person(l.batter), pitchLabel(l.kind), l.summary, resultLines(l, person).join("\uFF1B"), l.time || ""]))] }];
  }
  function lineupRows(g, person) {
    const teams = g.teams.map((t) => ({ ...t, lineup: t.lineup.map((p) => ({ ...p })) })), rows = [];
    teams.forEach((t) => t.lineup.forEach((p, i) => rows.push([t.name, i + 1, person(p.id), p.pos, "\u9996\u53D1"])));
    for (const e of g.events) {
      if (e.type === "sub") {
        const t = teams[e.team];
        if (e.swap !== void 0) {
          [t.lineup[e.index].pos, t.lineup[e.swap].pos] = [t.lineup[e.swap].pos, t.lineup[e.index].pos];
        } else {
          const p = t.lineup[e.index];
          p.id = e.id;
          rows.push([t.name, e.index + 1, person(p.id), p.pos, "\u66FF\u8865"]);
        }
      }
      if (e.kind === "eject" && e.replacementId) {
        for (const t of teams) {
          const i = t.lineup.findIndex((p) => p.id === e.personId);
          if (i >= 0) {
            t.lineup[i].id = e.replacementId;
            rows.push([t.name, i + 1, person(e.replacementId), t.lineup[i].pos, "\u5224\u7F5A\u66FF\u6362\uFF08\u539F\u7403\u5458 " + person(e.personId) + "\uFF09"]);
          }
        }
      }
    }
    return rows;
  }
  function substitutionRows(g, person) {
    return replay(g).substitutions.map((r) => [r.time || "", r.inning + " \u5C40" + (r.side ? "\u4E0B" : "\u4E0A"), g.teams[r.team].name, r.kind, "\u7B2C " + r.slot + " \u68D2" + (r.otherSlot ? " \u2194 \u7B2C " + r.otherSlot + " \u68D2" : ""), person(r.outId), person(r.inId || r.otherId), r.otherPosition ? r.position + " \u2194 " + r.otherPosition : r.position, "B " + r.balls + " / S " + r.strikes + (r.base ? " \xB7 " + r.base + " \u5792" : "")]);
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
  function score(s, ended, esc2, players2 = "") {
    const innings = Math.max(9, s.inning);
    return `<section class="score match-score"><div class="inning-board"><table><thead><tr><th>\u7403\u961F</th>${Array.from({ length: innings }, (_, i) => `<th>${i + 1}</th>`).join("")}<th>R</th><th>H</th><th>E</th></tr></thead><tbody>${s.teams.map((t, i) => `<tr><th title="${esc2(t.name)}">${i ? "\u4E3B" : "\u5BA2"} ${esc2(t.name)}</th>${Array.from({ length: innings }, (_, j) => {
      var _a;
      return `<td class="${s.inning === j + 1 && s.side === i ? "current" : ""}">${(_a = s.lines[i][j]) != null ? _a : "\u2013"}</td>`;
    }).join("")}<td><b>${s.score[i].R}</b></td><td>${s.score[i].H}</td><td>${s.score[i].E}</td></tr>`).join("")}</tbody></table></div><div class="score-details">${players2}<div class="inning-indicator" aria-label="${s.inning} \u5C40${s.side ? "\u4E0B" : "\u4E0A"}"><b>${s.inning}</b><span><i class="half-up ${s.side === 0 ? "lit" : ""}"></i><i class="half-down ${s.side === 1 ? "lit" : ""}"></i></span></div><div class="lamp-counts">${[
      ["B", 3, s.b],
      ["S", 2, s.s],
      ["O", 2, s.o]
    ].map(
      ([k, n, v]) => `<div aria-label="${k} ${v}"><b>${k}</b><span>${Array.from({ length: n }, (_, i) => `<i class="lamp ${i < v ? "on " + k : ""}"></i>`).join("")}</span></div>`
    ).join("")}</div></div></section>`;
  }
  function matchView(g, ctx) {
    var _a, _b;
    const { esc: esc2, name: name2, btn: btn2, career } = ctx, s = replay(g), b = batter(s), p = pitcher(s), next = s.teams[s.side].lineup[(s.order[s.side] + 1) % s.teams[s.side].lineup.length].id;
    const batting2 = (id) => {
      const logs = s.log.filter((l) => l.terminal && (l.creditedBatter || l.batter) === id), hits = logs.filter((l) => l.result === "H").length, tags = logs.map((l) => l.result === "H" ? l.play.hitBases === 4 ? "HR" : l.play.hitBases + "B" : l.result === "SO" ? "K" : l.result);
      return hits + "-" + logs.length + (tags.length ? " " + tags.join(", ") : "");
    };
    const batterCard = (id, label) => {
      var _a2;
      return '<div class="score-person"><small>' + label + '</small><b title="' + esc2(name2(id)) + '">' + esc2(name2(id)) + "</b><span>\u5386\u53F2 AVG " + (((_a2 = career[id]) == null ? void 0 : _a2.AVG) || 0).toFixed(3) + '</span><span title="' + esc2(batting2(id)) + '">' + esc2(batting2(id)) + "</span></div>";
    };
    const ps = rates(s.stats[p], g.sport), cards = '<div class="score-players">' + batterCard(b, "\u5F53\u524D\u6253\u8005") + batterCard(next, "\u4E0B\u4E00\u4F4D\u6253\u8005") + '<div class="score-person"><small>\u6295\u624B</small><b title="' + esc2(name2(p)) + '">' + esc2(name2(p)) + "</b><span>P-S " + ps["P-S"] + "</span><span>\u5386\u53F2 ERA " + (((_a = career[p]) == null ? void 0 : _a.ERA) || 0).toFixed(2) + "</span></div></div>";
    return score(s, g.ended, esc2, cards) + '<div class="live-field"><div class="field-center">' + defenseField(s, ctx) + "</div></div>" + (s.halfEnded ? '<div class="half-actions"><span>\u4E09\u51FA\u5C40 \xB7 \u534A\u5C40\u7ED3\u675F</span><div class="row">' + btn2("\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40", "half", "", "primary") + btn2("\u7ED3\u675F\u6BD4\u8D5B", "end", "", "danger") + "</div></div>" : '<div class="pitch-actions">' + btn2("B<small>\u574F\u7403</small>", "pitch", 'data-kind="ball"') + btn2("S<small>\u597D\u7403</small>", "pitch", 'data-kind="strike"') + btn2("Foul<small>\u754C\u5916</small>", "pitch", 'data-kind="foul"') + btn2("Fair<small>\u754C\u5185</small>", "contact", "", "primary") + '</div><div class="special-entry">' + btn2("\u88C1\u5224\u5224\u7F5A", "ruling") + btn2("\u7279\u6B8A\u60C5\u51B5", "specialMenu") + "</div>") + '<div class="record-tools">' + btn2("\u64A4\u9500\u8BB0\u5F55", "undo", canUndo(g) ? "" : "disabled", "ghost") + btn2("\u9010\u6253\u5E2D\u8BB0\u5F55", "showLog", "", "ghost") + '<div class="sub-tools">' + btn2("\u5B88\u5907\u6362\u4EBA", "sub", "", "ghost") + btn2("\u8FDB\u653B\u6362\u4EBA", "offenseSub", "", "ghost") + '</div></div><div class="last-play">' + esc2(((_b = s.log.at(-1)) == null ? void 0 : _b.summary) || "\u51C6\u5907\u5C31\u7EEA\uFF0C\u5F00\u59CB\u8BB0\u5F55\u5F53\u524D\u6253\u5E2D") + "</div>";
  }
  function playDialog(g, ctx) {
    var _a;
    const { btn: btn2, esc: esc2, name: name2 } = ctx, s = replay(g), d = g.draft, fielders = s.teams[1 - s.side].lineup.filter(isDefender), fopts = (value) => fielders.map(
      (p) => `<option value="${p.id}" ${p.id === value ? "selected" : ""}>${p.pos} \xB7 ${esc2(name2(p.id))}</option>`
    ).join("");
    if (!d.result)
      return `<h2>\u91CE\u624B\u5904\u7406</h2><label>\u5904\u7406\u7403\u7684\u91CE\u624B</label><select id="fielder" data-contact-fielder>${fopts(d.fielder)}</select><div class="contact-options"><div class="contact-row catches">${btn2("\u9AD8\u98DE\u63A5\u6740", "result", 'data-value="catch" data-trajectory="fly"', "primary")}${btn2("\u5E73\u98DE\u63A5\u6740", "result", 'data-value="catch" data-trajectory="line"', "primary")}${btn2("\u5185\u91CE\u9AD8\u98DE", "result", 'data-value="catch" data-trajectory="popup"', "primary")}</div><div class="contact-row stops">${btn2("\u5730\u6EDA\u62E6\u622A", "result", 'data-value="stop" data-trajectory="ground"')}${btn2("\u5E73\u98DE\u62E6\u622A", "result", 'data-value="stop" data-trajectory="line"')}</div>${btn2("\u5904\u7406\u5931\u8BEF", "result", 'data-value="error"', "gold wide")}<div class="contact-row awards">${[1, 2, 3, 4].map((n) => btn2(n === 4 ? "<span>\u5168\u5792</span><span>\u6253</span>" : "<span>\u573A\u5730</span><span>" + ["", "\u4E00", "\u4E8C", "\u4E09"][n] + "\u5792</span>", "award", 'data-n="' + n + '"', "primary")).join("")}</div></div>`;
    const q = runnerQueue(s).filter(
      (r2) => r2.from || !["catch", "infieldFly"].includes(d.result)
    ), r = q.find((r2) => !d.actions.some((a) => a.id === r2.id));
    if (d.outForm) {
      const f = d.outForm, shown = replay(g, true);
      return `<h2>${f.mode === "force" ? "\u5C01\u6740" : "\u89E6\u6740"} \xB7 ${esc2(name2(f.id))}</h2>${f.mode === "force" ? `<label>\u51FA\u5C40\u5792\u5305</label><select id="outbase">${forceBases(s, f.id, d.result).map((n) => `<option value="${n}">${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][n]}</option>`).join("")}</select>` : ""}<label>\u5B8C\u6210\u523A\u6740\u7684\u91CE\u624B</label><select id="putout">${fopts(d.fielder)}</select>${shown.o === 2 ? `<label>\u5DF2\u8BB0\u5F55\u7684\u5F97\u5206\u8DD1\u8005\u4E0E\u672C\u6B21\u51FA\u5C40\u7684\u5148\u540E</label><select id="outTiming"><option value="after">\u51FA\u5C40\u5728\u5148 / \u672A\u786E\u8BA4\u5F97\u5206\u5728\u5148</option><option value="before">\u8DD1\u8005\u5148\u56DE\u672C\u5792\uFF0C\u518D\u53D1\u751F\u51FA\u5C40</option></select>` : ""}${btn2("\u786E\u8BA4\u51FA\u5C40", "runnerOut", `data-id="${f.id}" data-mode="${f.mode}"`, "danger")}${btn2("\u8FD4\u56DE\u8DD1\u8005", "cancelOut")}`;
    }
    if (r) {
      const limit = advanceLimit(s, d.actions, r.id), pending = d.pending || {}, isError = d.result === "error" && !r.from, normal = (_a = pending.advance) != null ? _a : isError ? 0 : r.from ? 0 : 1, showError = d.errorOpen || isError;
      return `<h2>\u8DD1\u8005\u5904\u7406 \xB7 ${esc2(name2(r.id))}</h2><div class="runner-mini">${field(s)}</div><p class="muted">${r.from ? ["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792"][r.from] : "\u6253\u8005"} \xB7 ${q.findIndex((x) => x.id === r.id) + 1}/${q.length}\u3000\u6309\u524D\u4F4D\u81F3\u540E\u4F4D\u5904\u7406</p><label>\u6B63\u5E38\u51FB\u7403\u5230\u8FBE\u5792\u5305</label><select id="normalAdvance" data-normal-advance>${Array.from({ length: (isError ? 0 : Math.max(0, limit)) + 1 }, (_, n) => `<option value="${n}" ${n === normal ? "selected" : ""}>${n === 0 ? r.from ? `\u505C\u7559${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792"][r.from]}` : "\u672A\u56E0\u51FB\u7403\u4E0A\u5792" : `\u5230\u8FBE${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][r.from + n]}`}</option>`).join("")}</select>${btn2(showError ? "\u53D6\u6D88\u989D\u5916\u5931\u8BEF" : "\u56E0\u5931\u8BEF\u8FDB\u5792", "toggleError", "", "gold")}${showError ? `<div class="error-box"><label>\u5931\u8BEF\u91CE\u624B</label><select id="errorFielder" data-error-fielder>${fopts(pending.errorFielder || d.fielder)}</select><label>\u56E0\u5931\u8BEF\u6700\u7EC8\u5230\u8FBE\u5792\u5305</label><select id="errorAdvance" data-error-advance>${Array.from({ length: Math.max(0, limit - normal) }, (_, i) => `<option value="${i + 1}" ${pending.errorAdvance === i + 1 ? "selected" : ""}>\u5230\u8FBE${["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][r.from + normal + i + 1]}</option>`).join("")}</select></div>` : ""}<div class="actions">${btn2("\u786E\u8BA4\u8DD1\u8005", "saveRunner", `data-id="${r.id}"`, "primary wide")}${btn2("\u88AB\u5C01\u6740", "force", `data-id="${r.id}"`, "danger")}${btn2("\u88AB\u89E6\u6740", "tag", `data-id="${r.id}"`, "danger")}</div>`;
    }
    return resultPanel(g, ctx);
  }
  function resultPanel(g, ctx) {
    var _a, _b;
    const { esc: esc2, btn: btn2 } = ctx, last = replay(g, true).log.at(-1), pending = g.pendingPitch;
    const body = "<h2>" + ((pending == null ? void 0 : pending.type) === "special" && !(last == null ? void 0 : last.terminal) ? specialNames[pending.kind] + "\u7ED3\u679C" : (pending == null ? void 0 : pending.type) === "ruling" ? "\u5224\u7F5A\u786E\u8BA4" : "\u672C\u6253\u5E2D\u7ED3\u679C") + '</h2><div class="result-only"><h3>' + esc2(((last == null ? void 0 : last.summary) || "").replace(/ \/ 0 RBI/g, "")) + '</h3><div class="runner-summary">' + resultLines(last, (id) => {
      var _a2;
      return ctx.name(id) + " #" + (((_a2 = ctx.player(id)) == null ? void 0 : _a2.number) || "\u2014");
    }).map((line) => "<p>" + esc2(line) + "</p>").join("") + "</div></div>";
    if (!pending) return body + '<label for="throwingPath">\u4F20\u7403\u8DEF\u5F84\uFF08\u53EF\u9009\uFF09</label><input id="throwingPath" type="text" inputmode="numeric" autocomplete="off" value="' + esc2(((_a = g.draft) == null ? void 0 : _a.throwingPath) || "") + '" placeholder="' + (g.sport === "softball" ? "\u8F93\u5165 0\u20139\uFF0C0 \u8868\u793A 10 \u53F7\u81EA\u7531\u4EBA" : "\u8F93\u5165 1\u20139") + '"><p id="throwingPathPreview" class="muted" aria-live="polite">' + esc2(throwingPathLabel(((_b = g.draft) == null ? void 0 : _b.throwingPath) || "") || "\u672A\u586B\u5199\u4F20\u7403\u8DEF\u5F84") + "</p>" + btn2("\u786E\u8BA4\u6253\u5E2D\u7ED3\u679C", "commitContact", "", "primary wide");
    return '<div class="dialog-body">' + body + '</div><div class="dialog-actions">' + btn2(pending.type === "special" ? "\u786E\u8BA4\u7ED3\u679C" : pending.type === "ruling" ? "\u786E\u8BA4\u5224\u7F5A" : ["ball", "ibb", "hbp"].includes(pending.kind) ? "\u786E\u8BA4\u4FDD\u9001" : pending.kind === "foul" ? "\u786E\u8BA4\u754C\u5916\u51FA\u5C40" : "\u786E\u8BA4\u4E09\u632F", "confirmCount", "", "primary wide") + '<div class="row">' + btn2("\u4E0A\u4E00\u6B65", "pendingBack", "", "ghost") + btn2("\u53D6\u6D88\u672C\u7403", "cancelCount", "", "ghost") + "</div></div>";
  }
  function pitchLog(g, ctx) {
    const { name: name2, esc: esc2, btn: btn2 } = ctx, s = replay(g, true), records = plateRecords(g);
    let index = ctx.logIndex;
    if (index == null) {
      index = records.map((r2, i) => r2.side === s.side && r2.complete ? i : -1).filter((i) => i >= 0).at(-1);
      if (index == null) index = Math.max(0, records.length - 1);
    }
    index = Math.max(0, Math.min(index, records.length - 1));
    const r = records[index], person = (id) => {
      var _a;
      return name2(id) + " #" + (((_a = ctx.player(id)) == null ? void 0 : _a.number) || "\u2014");
    };
    return '<div class="log-header"><h2>\u9010\u6253\u5E2D\u8BB0\u5F55</h2>' + btn2("\u5173\u95ED", "closePanel", "", "small") + '</div><div class="row">' + btn2("\u2190 \u4E0A\u4E00\u6253\u5E2D", "logMove", 'data-index="' + (index - 1) + '" ' + (index <= 0 ? "disabled" : "")) + "<span>" + (records.length ? index + 1 : 0) + " / " + records.length + "</span>" + btn2("\u4E0B\u4E00\u6253\u5E2D \u2192", "logMove", 'data-index="' + (index + 1) + '" ' + (index >= records.length - 1 ? "disabled" : "")) + '</div><div class="pitch-log-list" data-plate-index="' + index + '">' + (r ? "<h3>" + esc2(s.teams[r.side].name) + " \xB7 " + r.inning + " \u5C40" + (r.side ? "\u4E0B" : "\u4E0A") + " \xB7 \u7B2C " + r.slot + " \u68D2</h3><p>" + esc2([...new Set(r.logs.map((l) => l.batter))].map(person).join(" \u2192 ")) + " \xB7 " + (r.complete ? "\u5DF2\u5B8C\u6210" : "\u672A\u5B8C\u6210") + '</p><p class="muted">\u5F00\u59CB\uFF1A' + esc2(r.startedAt ? new Date(r.startedAt).toLocaleString("zh-CN") : "\u2014") + "<br>\u7ED3\u675F\uFF1A" + esc2(r.endedAt ? new Date(r.endedAt).toLocaleString("zh-CN") : "\u8FDB\u884C\u4E2D") + "</p><h3>" + esc2(r.logs.at(-1).summary) + "</h3>" + r.logs.map((l, i) => '<div class="log"><small>\u8BB0\u5F55 ' + (i + 1) + " \xB7 " + esc2(person(l.pitcher)) + " \u6295\u7403</small><b>" + pitchLabel(l.kind) + " \xB7 " + esc2(l.summary) + "</b>" + resultLines(l, person).map((t) => "<p>" + esc2(t) + "</p>").join("") + "</div>").join("") : "<p>\u5C1A\u65E0\u6253\u5E2D\u8BB0\u5F55</p>") + "</div>";
  }
  function defenseField(s, ctx) {
    const positions2 = { "\u5DE6\u5916\u91CE": [16, 17], "\u4E2D\u5916\u91CE": [50, 2], "\u53F3\u5916\u91CE": [84, 17], "\u81EA\u7531\u4EBA": [84, 34], "\u6E38\u51FB\u624B": [16, 34], "\u4E8C\u5792\u624B": [50, 34], "\u6295\u624B": [25, 90], "\u4E09\u5792\u624B": [16, 59], "\u4E00\u5792\u624B": [84, 59], "\u6355\u624B": [75, 90] };
    return `<div class="defense-field"><svg viewBox="0 0 200 160" role="img" aria-label="\u5185\u91CE\u5792\u5305\uFF0C\u7EA2\u8272\u8868\u793A\u6709\u4EBA"><path d="M100 140L140 100L100 60L60 100Z" fill="#927650" stroke="#c5ae85" stroke-width="2"/>${[[140, 100, s.bases[0]], [100, 60, s.bases[1]], [60, 100, s.bases[2]]].map(([x, y, r]) => `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="2" transform="rotate(45 ${x} ${y})" fill="${r ? "#ff203f" : "#655137"}" stroke="white" stroke-width="4"/>`).join("")}<path d="M95 136H105V142L100 147L95 142Z" fill="white"/></svg>${Object.entries(positions2).filter(([pos]) => pos !== "\u81EA\u7531\u4EBA" || ctx.sport === "softball").map(([pos, xy]) => {
      const p = s.teams[1 - s.side].lineup.find((p2) => p2.pos === pos), player = p ? ctx.player(p.id) : null, label = p ? ctx.name(p.id) + ((player == null ? void 0 : player.number) ? " #" + player.number : "") : "\u2014";
      return `<div class="defender-label" style="left:${xy[0]}%;top:${xy[1]}%" title="${ctx.esc(pos + " \xB7 " + label)}">${ctx.esc(label)}</div>`;
    }).join("")}</div>`;
  }

  // app/src/main/assets/web/special-ui.js
  function specialMenu(g, ctx) {
    const { btn: btn2 } = ctx, s = replay(g), hasRunner = s.bases.some(Boolean), slowPitch = g.sport === "softball", disabled = (kind) => {
      const unavailable = slowPitch && ["hbp", "wp", "pb", "pickoff", "droppedThird", "interference", "steal"].includes(kind), needsRunner = ["pickoff", "steal"].includes(kind) && !hasRunner;
      return unavailable ? 'disabled title="\u6162\u6295\u5792\u7403\u4E0D\u9002\u7528"' : needsRunner ? 'disabled title="\u5F53\u524D\u6CA1\u6709\u5792\u4E0A\u8DD1\u8005"' : "";
    };
    return '<div class="dialog-body"><h2>\u7279\u6B8A\u60C5\u51B5</h2>' + [
      [["HBP", "pitch", "hbp"], ["IBB", "pitch", "ibb"]],
      [["\u66B4\u6295", "specialStart", "wp"], ["\u6355\u9038", "specialStart", "pb"], ["\u6295\u624B\u72AF\u89C4", "specialStart", "balk"]],
      [["\u754C\u5916\u63A5\u6740", "specialStart", "foulCatch"], ["\u754C\u5916\u6F0F\u63A5", "specialStart", "foulDrop"], ["\u7275\u5236", "specialStart", "pickoff"]],
      [["\u4E0D\u6B7B\u4E09\u632F", "specialStart", "droppedThird"], ["\u6355\u624B\u59A8\u788D\u6253\u51FB", "specialStart", "interference"], ["\u76D7\u5792", "specialStart", "steal"]]
    ].map((row) => '<div class="special-row">' + row.map(([label, action2, kind]) => btn2(label, action2, 'data-kind="' + kind + '" ' + (disabled(kind) || (kind === "droppedThird" && s.s !== 2 ? 'disabled title="\u4EC5\u4E24\u597D\u7403\u65F6\u53EF\u7528"' : "")))).join("") + "</div>").join("") + '</div><div class="dialog-actions">' + btn2("\u8FD4\u56DE\u8BB0\u5206", "closePanel", "", "ghost wide") + "</div>";
  }
  var queueFor = (s, d) => runnerQueue(s).filter((r) => r.from || d.kind === "droppedThird");
  function specialDialog(g, ctx) {
    const { btn: btn2, esc: esc2, name: name2 } = ctx, s = replay(g), d = g.specialDraft, defense = s.teams[1 - s.side].lineup.filter(isDefender);
    const options = (list = defense, selected2 = "", blank = true) => (blank ? '<option value="">\u8BF7\u9009\u62E9\u2026</option>' : "") + list.map((p) => '<option value="' + esc2(p.id) + '" ' + (selected2 === p.id ? "selected" : "") + ">" + esc2(p.pos + " \xB7 " + name2(p.id)) + "</option>").join("");
    const select = (label, id, list = defense, selected2 = "") => '<label for="' + id + '">' + label + '</label><select id="' + id + '">' + options(list, selected2) + "</select>";
    const footer = btn2("\u4E0A\u4E00\u6B65", "specialBack", "", "ghost") + btn2("\u53D6\u6D88\u672C\u6B21\u8BB0\u5F55", "specialCancel", "", "ghost");
    let body = "<h2>" + specialNames[d.kind] + "</h2>";
    if (d.step === "pitch") return '<div class="dialog-body">' + body + '<label for="specialPitchResult">\u672C\u6B21\u6295\u7403\u5224\u5B9A</label><select id="specialPitchResult"><option value="ball">\u574F\u7403</option><option value="strike">\u597D\u7403</option></select></div><div class="dialog-actions">' + btn2("\u4E0B\u4E00\u6B65", "specialPitchNext", "", "primary wide") + footer + "</div>";
    if (d.step === "choose") {
      if (d.kind === "pickoff") body += '<label for="specialBase">\u7275\u5236\u5792\u5305</label><select id="specialBase"><option value="">\u9009\u62E9\u6709\u8DD1\u8005\u7684\u5792\u5305\u2026</option>' + queueFor(s, d).map((r2) => '<option value="' + r2.from + '" ' + (d.base === r2.from ? "selected" : "") + ">" + r2.from + " \u5792 \xB7 " + esc2(name2(r2.id)) + "</option>").join("") + "</select>" + select("\u5B8C\u6210\u89E6\u6740\u7684\u91CE\u624B\uFF08\u53EF\u9009\uFF09", "specialPutout", defense, d.putout) + select("\u7275\u5236\u5931\u8BEF\u7403\u5458\uFF08\u53EF\u9009\uFF09", "specialError", defense, d.errorFielder) + '<p class="special-note">\u53EA\u9009\u5792\u5305\u8BB0\u5F55\u4E00\u6B21\u7275\u5236\uFF1B\u9009\u62E9\u89E6\u6740\u91CE\u624B\u8BB0\u5F55\u51FA\u5C40\uFF1B\u9009\u62E9\u5931\u8BEF\u7403\u5458\u540E\u9010\u4E2A\u66F4\u65B0\u8DD1\u8005\u3002\u51FA\u5C40\u4E0E\u5931\u8BEF\u8BF7\u62E9\u4E00\u586B\u5199\u3002</p>';
      else body += select(d.kind === "foulDrop" ? "\u6F0F\u63A5\u5931\u8BEF\u7403\u5458" : "\u5B8C\u6210\u63A5\u6740\u7684\u91CE\u624B", "specialFielder");
      return '<div class="dialog-body">' + body + '</div><div class="dialog-actions">' + btn2("\u4E0B\u4E00\u6B65", "specialChoose", "", "primary wide") + footer + "</div>";
    }
    const queue = queueFor(s, d), r = queue.find((r2) => !d.actions.some((a) => a.id === r2.id));
    if (!r) return body + btn2("\u67E5\u770B\u7ED3\u679C", "specialReady", "", "primary wide") + footer;
    if (d.outId) {
      const currentOuts = s.o + d.actions.filter((a) => a.mode === "tag").length;
      body += "<h3>\u89E6\u6740 \xB7 " + esc2(name2(r.id)) + "</h3>" + select("\u5B8C\u6210\u523A\u6740\u7684\u91CE\u624B", "specialPutout");
      if (d.kind === "steal") body += select("\u53D1\u52A8\u963B\u76D7\u7684\u6295\u624B\u6216\u6355\u624B", "specialAssist", defense.filter((f) => ["\u6295\u624B", "\u6355\u624B"].includes(f.pos)));
      if (currentOuts === 2) body += '<label for="specialTiming">\u6B64\u524D\u5DF2\u5F55\u5165\u5F97\u5206\u4E0E\u7B2C\u4E09\u51FA\u5C40\u7684\u5148\u540E</label><select id="specialTiming"><option value="after">\u7B2C\u4E09\u51FA\u5C40\u5728\u5148 / \u672A\u786E\u8BA4\u5F97\u5206\u5728\u5148</option><option value="before">\u8DD1\u8005\u5148\u56DE\u672C\u5792\uFF0C\u518D\u53D1\u751F\u7B2C\u4E09\u51FA\u5C40</option></select>';
      return '<div class="dialog-body">' + body + '</div><div class="dialog-actions">' + btn2("\u786E\u8BA4\u8DD1\u8005\u51FA\u5C40", "specialOut", "", "danger wide") + btn2("\u8FD4\u56DE\u8DD1\u8005", "specialOutBack", "", "ghost") + btn2("\u53D6\u6D88\u672C\u6B21\u8BB0\u5F55", "specialCancel", "", "ghost") + "</div>";
    }
    const limit = Math.max(0, advanceLimit(s, d.actions, r.id)), walk = (d.kind === "wp" || d.kind === "pb" && d.pitchResult !== "strike") && s.b === 3, min = walk && Array.from({ length: r.from }, (_, i) => s.bases[i]).every(Boolean) ? 1 : 0;
    body += "<h3>\u8DD1\u8005\u5904\u7406 \xB7 " + esc2(name2(r.id)) + '</h3><div class="runner-mini">' + field(s) + '</div><p class="muted">' + (r.from ? r.from + " \u5792\u8DD1\u8005" : "\u6253\u8005") + " \xB7 " + (d.actions.length + 1) + " / " + queue.length + '</p><label for="specialAdvance">\u6B63\u5E38\u8FDB\u5792\u6570\u91CF</label><select id="specialAdvance">' + Array.from({ length: Math.max(0, limit - min + 1) }, (_, i) => i + min).map((n) => '<option value="' + n + '" ' + (n === (r.from ? min : Math.min(1, limit)) ? "selected" : "") + ">" + n + " \u4E2A\u5792" + (n ? " \u2192 " + ["", "\u4E00\u5792", "\u4E8C\u5792", "\u4E09\u5792", "\u672C\u5792"][r.from + n] : "\uFF08\u505C\u7559\uFF09") + "</option>").join("") + '</select><label for="specialErrorAdvance">\u989D\u5916\u56E0\u5931\u8BEF\u8FDB\u5792\u6570\u91CF</label><select id="specialErrorAdvance">' + Array.from({ length: limit + 1 }, (_, n) => '<option value="' + n + '">' + n + " \u4E2A\u5792</option>").join("") + "</select>" + select("\u5931\u8BEF\u7403\u5458\uFF08\u56E0\u5931\u8BEF\u8FDB\u5792\u65F6\u5FC5\u9009\uFF09", "specialError", defense, d.errorFielder || "");
    if (!r.from) body += '<p class="special-note">\u4E0D\u6B7B\u4E09\u632F\u6253\u8005\u81F3\u5C11\u5230\u8FBE\u4E00\u5792\uFF1B\u53EF\u5C06\u8FDB\u5792\u8BB0\u4E3A\u6B63\u5E38\u8FDB\u5792\u6216\u5931\u8BEF\u8FDB\u5792\u3002</p>';
    return '<div class="dialog-body">' + body + '</div><div class="dialog-actions">' + btn2("\u786E\u8BA4\u8DD1\u8005", "specialRunner", "", "primary wide") + (r.from ? btn2("\u88AB\u89E6\u6740", "specialTag", "", "danger wide") : "") + footer + "</div>";
  }
  function handleSpecial(action2, v, g, ctx) {
    var _a, _b;
    if (!action2.startsWith("special") || action2 === "specialMenu") return false;
    const { $: $2, updateGame: updateGame2, close } = ctx, s = replay(g);
    let d = g.specialDraft;
    const ready = () => {
      updateGame2(stageSpecial(g, { ...d, type: "special" }));
      close();
    };
    const advance = () => {
      const q = queueFor(s, d);
      if (s.o + d.actions.filter((a) => a.mode === "tag").length >= 3 || q.every((r) => d.actions.some((a) => a.id === r.id))) ready();
    };
    if (action2 === "specialStart") {
      if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
      if (s.halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E2A\u534A\u5C40");
      if (g.sport === "softball" && ["wp", "pb", "pickoff", "droppedThird", "interference", "steal"].includes(v.kind)) throw Error("\u6162\u6295\u5792\u7403\u4E0D\u9002\u7528\u6B64\u9879\u8BB0\u5F55");
      if (v.kind === "droppedThird" && s.s !== 2) throw Error("\u4E0D\u6B7B\u4E09\u632F\u4EC5\u53EF\u5728\u4E24\u597D\u7403\u65F6\u8BB0\u5F55");
      if (!specialNames[v.kind]) throw Error("\u672A\u77E5\u7279\u6B8A\u60C5\u51B5");
      if (["wp", "pb", "pickoff", "steal"].includes(v.kind) && !s.bases.some(Boolean)) throw Error("\u5F53\u524D\u6CA1\u6709\u5792\u4E0A\u8DD1\u8005");
      d = g.specialDraft = { type: "special", id: uid(), kind: v.kind, time: (/* @__PURE__ */ new Date()).toISOString(), actions: [], step: v.kind === "pb" ? "pitch" : ["pickoff", "foulDrop", "foulCatch"].includes(v.kind) ? "choose" : "runners" };
      if (["balk", "interference"].includes(v.kind)) ready();
      return true;
    }
    if (action2 === "specialCancel") {
      g.specialDraft = null;
      close();
      return true;
    }
    if (!d) throw Error("\u6CA1\u6709\u6B63\u5728\u5F55\u5165\u7684\u7279\u6B8A\u60C5\u51B5");
    if (action2 === "specialPitchNext") {
      d.pitchResult = $2("#specialPitchResult").value;
      d.step = "runners";
      if (d.pitchResult === "strike" && s.s === 2) {
        d.kind = "droppedThird";
        d.cause = "pb";
      }
    } else if (action2 === "specialChoose") {
      if (d.kind === "pickoff") {
        d.base = Number($2("#specialBase").value);
        d.putout = $2("#specialPutout").value;
        d.errorFielder = $2("#specialError").value;
        if (!s.bases[d.base - 1]) throw Error("\u8BF7\u9009\u62E9\u6709\u8DD1\u8005\u7684\u5792\u5305");
        if (d.putout && d.errorFielder) throw Error("\u89E6\u6740\u91CE\u624B\u4E0E\u5931\u8BEF\u7403\u5458\u8BF7\u62E9\u4E00\u586B\u5199");
        if (d.errorFielder) d.step = "runners";
        else ready();
      } else {
        const id = $2("#specialFielder").value;
        if (!id) throw Error("\u8BF7\u9009\u62E9\u5B88\u5907\u7403\u5458");
        d[d.kind === "foulDrop" ? "errorFielder" : "fielder"] = id;
        ready();
      }
    } else if (action2 === "specialRunner") {
      const r = queueFor(s, d).find((r2) => !d.actions.some((a) => a.id === r2.id)), advance2 = Number($2("#specialAdvance").value), errorAdvance = Number($2("#specialErrorAdvance").value), errorFielder = $2("#specialError").value;
      if (advance2 + errorAdvance > advanceLimit(s, d.actions, r.id)) throw Error("\u603B\u8FDB\u5792\u6570\u4E0D\u80FD\u8D85\u8FC7\u524D\u4F4D\u8DD1\u8005\u6216\u672C\u5792");
      if (!r.from && advance2 + errorAdvance < 1) throw Error("\u4E0D\u6B7B\u4E09\u632F\u6253\u8005\u81F3\u5C11\u5230\u8FBE\u4E00\u5792");
      if (errorAdvance && !errorFielder) throw Error("\u8BF7\u9009\u62E9\u5931\u8BEF\u7403\u5458");
      d.actions.push({ id: r.id, mode: "advance", advance: advance2, errorAdvance, errorFielder });
      const q = queueFor(s, d);
      if (q.every((r2) => d.actions.some((a) => a.id === r2.id))) ready();
    } else if (action2 === "specialTag") {
      d.outId = queueFor(s, d).find((r) => !d.actions.some((a) => a.id === r.id)).id;
    } else if (action2 === "specialOutBack") {
      delete d.outId;
    } else if (action2 === "specialOut") {
      const putout = $2("#specialPutout").value, assist = (_a = $2("#specialAssist")) == null ? void 0 : _a.value;
      if (!putout) throw Error("\u8BF7\u9009\u62E9\u5B8C\u6210\u523A\u6740\u7684\u91CE\u624B");
      if (d.kind === "steal" && !assist) throw Error("\u8BF7\u9009\u62E9\u53D1\u52A8\u963B\u76D7\u7684\u6295\u624B\u6216\u6355\u624B");
      d.actions.push({ id: d.outId, mode: "tag", putout, assist, runsBeforeThird: ((_b = $2("#specialTiming")) == null ? void 0 : _b.value) === "before" });
      delete d.outId;
      advance();
    } else if (action2 === "specialReady") {
      ready();
    } else if (action2 === "specialBack") {
      if (d.actions.length) d.actions.pop();
      else if (d.kind === "pickoff" && d.step === "runners") d.step = "choose";
      else {
        g.specialDraft = null;
        close();
      }
    }
    return true;
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
      for (const k of ["pitcher", "fielder", "putout", "errorFielder", "thirdOutId", "runnerId", "personId", "replacementId", "foulErrorFielder"]) add2(e[k]);
      for (const a of e.actions || []) {
        add2(a.id);
        add2(a.putout);
        add2(a.errorFielder);
        add2(a.assist);
      }
    }
    return set;
  }
  function exportArchive(db2, selectedYears, byGame = false) {
    const games = db2.games.filter((g) => g.ended && selectedYears.includes(byGame ? g.id : gameYear(g))).map((g) => ({ ...clone(g), archiveId: archiveId(g), substitutions: replay(g).substitutions, draft: null, pendingPitch: null, specialDraft: null }));
    if (!games.length) throw Error("\u6240\u9009\u8303\u56F4\u6CA1\u6709\u5DF2\u5B8C\u6210\u7684\u6BD4\u8D5B");
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
      for (const t of g.teams) if (typeof t.name !== "string" || !Array.isArray(t.lineup) || t.lineup.length < 2 || t.lineup.some((p) => !POSITIONS.includes(p.pos))) throw Error("\u7403\u961F\u9635\u5BB9\u65E0\u6548");
      for (const e of g.events) if (!["pitch", "sub", "half", "ruling", "special"].includes(e.type)) throw Error("\u672A\u77E5\u6BD4\u8D5B\u4E8B\u4EF6");
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
        for (const k of ["pitcher", "fielder", "putout", "errorFielder", "thirdOutId", "runnerId", "personId", "replacementId", "foulErrorFielder"]) remap(e, k);
        for (const a of e.actions || []) {
          remap(a, "id");
          remap(a, "putout");
          remap(a, "errorFielder");
          remap(a, "assist");
        }
      }
      const lineup = g.teams.flatMap((t) => t.lineup.map((p) => p.id));
      if (new Set(lineup).size !== lineup.length) throw Error("\u540C\u540D\u6620\u5C04\u5BFC\u81F4\u9635\u5BB9\u91CD\u590D\uFF0C\u8BF7\u6838\u5BF9\u7403\u5458\u59D3\u540D");
      g.id = uid();
      g.draft = null;
      g.pendingPitch = null;
      g.specialDraft = null;
      g.rulesVersion = 2;
      const state = replay(g);
      g.substitutions = clone(state.substitutions);
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
  var statLabel = (k) => ({ WP: "WP \u66B4\u6295", PB: "PB \u6355\u9038", BK: "BK \u975E\u6CD5\u6295\u7403\uFF08\u6295\u624B\u72AF\u89C4\uFF09", PICK: "PICK \u7275\u5236\u5C1D\u8BD5", SB: "SB \u76D7\u5792", CS: "CS \u76D7\u5792\u5931\u8D25", DS: "DS \u53CC\u76D7\u5792", CI: "CI \u59A8\u788D\u4E0A\u5792", F_CI: "CI \u6355\u624B\u59A8\u788D", D3K: "D3K \u4E0D\u6B7B\u4E09\u632F", F_FOUL_E: "\u754C\u5916\u6F0F\u63A5\u5931\u8BEF", NP: "NP \u9762\u5BF9\u6295\u7403\u6570", RA9: "RA9 \u6BCF\u4E5D\u5C40\u5931\u5206" })[k] || k.replace(/^[PF]_/, "");
  var BATTING = [
    "FB",
    "LD",
    "IFF",
    "GB",
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
    "SB",
    "CS",
    "DS",
    "CI",
    "D3K",
    "NP",
    "PA",
    "TB"
  ];
  var FIELDING = ["PB", "F_CI", "F_FOUL_E", "E", "PO", "A", "DP", "TP", "FPCT", "F_FB", "F_LD", "F_IFF", "F_GB"];
  var PITCHING = [
    "P_FB",
    "P_LD",
    "P_IFF",
    "P_GB",
    "WP",
    "BK",
    "PICK",
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
    "RA9",
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
      ["\u7403\u961F", "\u59D3\u540D", "\u6253\u51FB\u624B", "\u6295\u7403\u624B", ...all.map((k) => k.startsWith("P_") ? "\u6295\u7403 " + statLabel(k) : k.startsWith("F_") ? "\u5B88\u5907 " + statLabel(k) : ["FB", "LD", "IFF", "GB"].includes(k) ? "\u6253\u51FB " + k : statLabel(k))]
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
            ["\u7403\u961F", "\u7403\u5458", "\u6253\u51FB\u624B", "\u6295\u7403\u624B", ...keys.map(statLabel)],
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
    return '<section class="card officials"><h3>\u6BD4\u8D5B\u5DE5\u4F5C\u4EBA\u5458</h3>' + [["scorerId", "\u8BB0\u5F55\u8005"], ["umpireId", "\u88C1\u5224"]].map(([key, label]) => {
      var _a;
      return "<label>" + label + '</label><button data-action="pickOfficial" data-role="' + key + '" class="wide">' + esc2(((_a = players2.find((p) => p.id === setup2[key])) == null ? void 0 : _a.name) || "\u641C\u7D22\u5E76\u9009\u62E9" + label) + "</button>";
    }).join("") + '<small class="muted">\u8BB0\u5F55\u8005\u4E0E\u88C1\u5224\u53EF\u4EE5\u662F\u540C\u4E00\u4EBA\uFF0C\u4E5F\u53EF\u4EE5\u53C2\u4E0E\u6BD4\u8D5B\u3002</small></section>';
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
    const { esc: esc2, name: name2 } = ctx, s = replay(g, true), fmt = (v, k) => ["AVG", "OBP", "SLG", "OPS", "FPCT"].includes(k) ? Number(v || 0).toFixed(3) : ["ERA", "RA9", "WHIP", "K/9"].includes(k) ? Number(v || 0).toFixed(2) : v != null ? v : 0;
    const table2 = (ids, keys, st, label) => `<h3>${label}</h3><div class="box-table"><table><thead><tr><th>\u7403\u5458</th>${keys.map((k) => `<th>${statLabel(k)}</th>`).join("")}</tr></thead><tbody>${ids.map((id) => `<tr><th title="${esc2(name2(id))}">${esc2(name2(id))}</th>${keys.map((k) => `<td>${fmt(st[id][k], k)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    return `<div class="box-score">${g.teams.map((t, i) => {
      const ids = teamIds(g, i), st = Object.fromEntries(ids.map((id) => [id, rates(s.stats[id] || emptyStats(), g.sport)])), pitchers = ids.filter((id) => st[id].P > 0);
      const notes = (keys, list = ids) => keys.map((k) => {
        const values = list.filter((id) => Number(st[id][k]) > 0).map((id) => `${name2(id)} ${fmt(st[id][k], k)}`);
        return values.length ? `<p><b>${k}</b> ${esc2(values.join("\uFF1B"))}</p>` : "";
      }).join("");
      return `<section class="box-team"><h2>${i ? "\u4E3B\u961F" : "\u5BA2\u961F"} \xB7 ${esc2(t.name)} <strong>${s.score[i].R}</strong></h2>${table2(ids, ["AB", "R", "H", "RBI", "BB", "SO"], st, "\u6253\u51FB")}<div class="box-notes">${notes(["2B", "3B", "HR", "HBP", "IBB", "SF", "SH", "GDP", "SB", "CS", "DS", "CI"])}</div><details><summary>\u9AD8\u7EA7\u6253\u51FB\u6570\u636E</summary>${table2(ids, ["AVG", "OBP", "SLG", "OPS", "SB", "CS", "DS", "CI", "D3K", "NP", "FB", "LD", "IFF", "GB"], st, "\u672C\u573A\u6BD4\u7387")}</details>${pitchers.length ? table2(pitchers, ["IP", "HA", "RA", "RA9", "ER", "BBA", "K"], st, "\u6295\u7403") + table2(pitchers, ["P-S", "HBPA", "IBBA", "ERA", "K/9", "WP", "BK", "PICK", "P_FB", "P_LD", "P_IFF", "P_GB"], st, "\u6295\u7403\u660E\u7EC6") : ""}${table2(ids, FIELDING, st, "\u5B88\u5907")}</section>`;
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
  var logIndex = null;
  var subMode = "defense";
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
    return `<div class="tablewrap"><table><thead><tr><th>\u7403\u5458</th>${keys.map((k) => `<th>${statLabel(k)}</th>`).join("")}</tr></thead><tbody>${ids.map((id) => {
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
    return `${header("\u94BB\u77F3\u8BB0\u5206", btn("\u8F6F\u4EF6\u4F5C\u8005", "author", "", "ghost fit"))}<section class="hero"><div class="eyebrow">DIAMOND NOTEBOOK</div><h1>\u4E13\u6CE8\u6BD4\u8D5B\u3002<br>\u8BB0\u4E0B\u6BCF\u4E00\u4E2A\u77AC\u95F4\u3002</h1><p>\u4ECE\u7B2C\u4E00\u7403\u5230\u6700\u540E\u4E00\u4E2A\u51FA\u5C40\uFF0C<br>\u4F60\u7684\u7403\u573A\u8BB0\u5F55\u7C3F\u3002</p><div class="mark">\u25C7</div></section>${db.active ? `<div class="card row"><div><b>\u6709\u4E00\u573A\u6BD4\u8D5B\u6B63\u5728\u8FDB\u884C</b><p class="muted">\u6240\u6709\u6295\u7403\u4E0E\u672A\u5B8C\u6210\u6B65\u9AA4\u5DF2\u4FDD\u5B58</p></div>${btn("\u7EE7\u7EED\u8BB0\u5F55", "resume", "", "primary fit")}</div>` : ""}<div class="grid">${btn("\u25C9<b>\u7403\u5458</b><span>\u6CE8\u518C \xB7 \u7EDF\u8BA1 \xB7 \u5BFC\u51FA</span>", "players", "", "homebtn")}${btn("\u26BE<b>\u5F00\u59CB\u68D2\u7403\u6BD4\u8D5B</b><span>\u6807\u51C6\u9010\u7403\u8BB0\u5206</span>", "setup", 'data-sport="baseball"', "homebtn primary")}${btn("\u25C7<b>\u5F00\u59CB\u5792\u7403\u6BD4\u8D5B</b><span>\u6162\u6295 \xB7 1\u20131 \u8D77\u59CB\u7403\u6570</span>", "setup", 'data-sport="softball"', "homebtn")}${btn("\u25A4<b>\u8BB0\u5F55\u67E5\u770B</b><span>\u8D5B\u540E\u56DE\u987E \xB7 \u5168\u90E8\u6295\u7403</span>", "history", "", "homebtn")}</div>`;
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
        '<div class="dialog-body"><h2>\u8BF7\u786E\u8BA4</h2><p>' + esc(message) + '</p></div><div class="dialog-actions row"><button id="askNo">\u53D6\u6D88</button><button class="primary" id="askYes">\u786E\u8BA4</button></div>'
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
    if (d.querySelector(".dialog-body")) d.classList.add("fixed-dialog");
    document.body.append(d);
    d.showModal();
  }
  function setup() {
    const d = db.setup;
    if (!d) {
      page = db.active ? "game" : "home";
      return db.active ? record() : home();
    }
    return header("\u7EC4\u961F \xB7 " + sportName(d.sport)) + (d.sport === "softball" ? '<p class="muted">\u589E\u989D\u7403\u5458\uFF1A\u52A0\u5165\u7403\u5458\u540E\u9009\u62E9\u589E\u989D\u7403\u5458\uFF0C\u53C2\u4E0E\u6253\u5E8F\u3001\u4E0D\u5360\u5B88\u5907\u4F4D\u7F6E\u3002\u5B88\u5907\u6EE1\u5458\u540E\u65B0\u589E\u7403\u5458\u81EA\u52A8\u8BBE\u4E3A\u589E\u989D\u7403\u5458\u3002</p>' : "") + officialFields(d, db.players, esc) + '<section class="card"><h3>\u6BD4\u8D5B\u73AF\u5883\uFF08\u53EF\u9009\uFF09</h3>' + [["temperature", "\u6E29\u5EA6\uFF08\u2103\uFF09"], ["weather", "\u5929\u6C14"], ["location", "\u5730\u70B9"]].map(([key, label]) => "<label>" + label + '<input data-environment="' + key + '" maxlength="100" value="' + esc(d[key] || "") + '" placeholder="\u53EF\u4E0D\u586B\u5199"></label>').join("") + '</section><p class="muted">\u6309\u4F4F \u2261 \u62D6\u52A8\u6253\u5E8F \xB7 L \u5DE6\u6253 / R \u53F3\u6253 / S \u5DE6\u53F3\u5F00\u5F13</p>' + d.teams.map(
      (t, i) => `<section class="card compact-team"><div class="row"><b class="fit">${i ? "\u4E3B\u961F" : "\u5BA2\u961F"}</b><input aria-label="${i ? "\u4E3B" : "\u5BA2"}\u961F\u540D\u79F0" data-team-name="${i}" value="${esc(t.name)}" maxlength="30"></div><div data-lineup="${i}">${t.lineup.map(
        (p, j) => {
          var _a;
          return `<div class="lineup" data-team="${i}" data-index="${j}"><div class="handle" data-drag="${i}:${j}" aria-label="\u62D6\u52A8\u6253\u5E8F">\u2261</div><div class="clip"><b>${j + 1}. ${esc(name(p.id))}</b> <span class="hand">${((_a = db.players.find((x) => x.id === p.id)) == null ? void 0 : _a.bats) || "\u2014"}</span></div><select aria-label="${esc(name(p.id))}\u5B88\u5907\u4F4D\u7F6E" data-position="${i}:${j}">${lineupPositions(d.sport).map(
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
      logIndex,
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
      '<details class="menu"><summary aria-label="\u6BD4\u8D5B\u83DC\u5355">\u22EE</summary><div>' + btn("\u7ED3\u675F\u6BD4\u8D5B", "end", "", "danger") + "</div></details>"
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
    if (panel === "special") {
      dialog(specialMenu(g, context(g)));
      return;
    }
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
    if (g.specialDraft) {
      dialog(specialDialog(g, context(g)));
      $("dialog").addEventListener("cancel", (e) => e.preventDefault());
      return;
    }
    if (d) {
      const holder = document.createElement("div");
      holder.innerHTML = playDialog(g, context(g));
      const confirm = holder.querySelector('[data-action="commitContact"]');
      const confirmHtml = (confirm == null ? void 0 : confirm.outerHTML) || "";
      confirm == null ? void 0 : confirm.remove();
      dialog('<div class="dialog-body">' + holder.innerHTML + '</div><div class="dialog-actions">' + confirmHtml + '<div class="row">' + btn("\u4E0A\u4E00\u6B65", "draftBack", "", "ghost") + btn("\u53D6\u6D88\u672C\u7403", "cancelDraft", "", "ghost") + "</div></div>");
      $("dialog").addEventListener("cancel", (e) => e.preventDefault());
    }
  }
  function pickPlayer(team, role = null) {
    dialog(
      "<h2>\u52A0\u5165" + (role ? role === "scorerId" ? "\u8BB0\u5F55\u8005" : "\u88C1\u5224" : team ? "\u4E3B\u961F" : "\u5BA2\u961F") + '</h2><input id="rosterSearch" placeholder="\u641C\u7D22\u7403\u5458\u59D3\u540D" autocomplete="off"><div id="rosterOptions" class="search-options"></div>' + btn("\u5173\u95ED", "close")
    );
    const input = $("#rosterSearch");
    const refresh = () => {
      $("#rosterOptions").innerHTML = db.players.filter(
        (p) => !p.deleted && (role || !db.setup.teams.some((t) => t.lineup.some((x) => x.id === p.id))) && p.name.toLocaleLowerCase().includes(input.value.trim().toLocaleLowerCase())
      ).map(
        (p) => btn(
          esc(p.name) + " \xB7 " + p.bats + "\u6253/" + p.throws + "\u6295",
          role ? "setOfficial" : "addLine",
          `data-team="${team}" data-role="${role || ""}" data-id="${p.id}"`,
          "ghost"
        )
      ).join("") || '<p class="muted">\u65E0\u5339\u914D\u7403\u5458</p>';
    };
    input.addEventListener("input", refresh);
    refresh();
    input.focus();
  }
  function subPanel(s) {
    const offense = subMode === "offense", team = offense ? s.side : 1 - s.side, lineup = s.teams[team].lineup;
    const slots = lineup.map((p, i) => ({ ...p, index: i })).filter((p) => !offense || p.id === batter(s) || s.bases.some((r) => (r == null ? void 0 : r.id) === p.id));
    return '<div class="dialog-body"><h2>' + (offense ? "\u8FDB\u653B\u6362\u4EBA" : "\u5B88\u5907\u6362\u4EBA / \u6362\u4F4D") + "</h2><p>" + esc(s.teams[team].name) + '</p><p class="muted">' + (offense ? "\u4EE3\u6253\u7EE7\u627F\u7403\u6570\uFF1B\u4EE3\u8DD1\u7EE7\u627F\u5792\u4F4D\uFF0C\u540E\u7EED\u5F97\u5206\u8BB0\u7ED9\u4EE3\u8DD1\u3002\u66FF\u8865\u7EE7\u627F\u539F\u6253\u5E8F\u548C\u5B88\u5907\u4F4D\u7F6E\u3002" : "\u66FF\u8865\u7EE7\u627F\u539F\u6253\u5E8F\uFF1B\u6B64\u524D\u6570\u636E\u4FDD\u7559\u5728\u539F\u7403\u5458\u540D\u4E0B\u3002") + '</p><label>\u66FF\u6362\u573A\u4E0A\u7403\u5458</label><select id="subout">' + slots.map((p) => '<option value="' + p.index + '">' + (offense ? (p.id === batter(s) ? "\u5F53\u524D\u6253\u8005" : "\u5792\u4E0A\u8DD1\u8005") + " \xB7 " : "") + "\u7B2C " + (p.index + 1) + " \u68D2 \xB7 " + esc(name(p.id)) + "</option>").join("") + '</select><label>\u6362\u5165\u6CE8\u518C\u7403\u5458</label><select id="subin"><option value="">\u9009\u62E9\u66FF\u8865\u2026</option>' + db.players.filter((p) => !p.deleted && !s.ejected.includes(p.id) && !s.teams.some((t) => t.lineup.some((x) => x.id === p.id))).map((p) => '<option value="' + p.id + '">' + esc(p.name) + " #" + esc(p.number || "\u2014") + "</option>").join("") + "</select>" + (offense ? "" : '<label>\u6216\u4E0E\u573A\u4E0A\u7403\u5458\u4EA4\u6362\u5B88\u5907\u4F4D\u7F6E</label><select id="swapin">' + lineup.map((p, i) => '<option value="' + i + '">' + p.pos + " \xB7 " + esc(name(p.id)) + "</option>").join("") + "</select>") + '</div><div class="dialog-actions">' + btn("\u786E\u8BA4\u6362\u4EBA", "doSub", "", "primary wide") + (offense ? "" : btn("\u4EA4\u6362\u4F4D\u7F6E", "doSwap", "", "wide")) + btn("\u8FD4\u56DE\u8BB0\u5206", "subBack", "", "ghost wide") + "</div>";
  }
  function recent(s) {
    return '<div class="card">' + btn(
      "\u9010\u6253\u5E2D\u8BB0\u5F55",
      "showLog",
      'data-id="' + (viewGame || db.active) + '"',
      "ghost wide"
    ) + "</div>";
  }
  function yearSelect(kind, value) {
    return `<label class="year-select">\u5E74\u4EFD<select data-year="${kind}">${[.../* @__PURE__ */ new Set([String((/* @__PURE__ */ new Date()).getFullYear()), ...years(db.games), value])].sort().reverse().map((y) => `<option ${y === value ? "selected" : ""}>${y}</option>`).join("")}</select></label>`;
  }
  function history() {
    return `${header("\u8BB0\u5F55\u67E5\u770B")}${yearSelect("history", historyYear)}<div class="row">${btn("\u9009\u62E9\u6BD4\u8D5B\u5BFC\u51FA JSON", "archiveExport", "", "primary")}${btn("\u5BFC\u5165\u6BD4\u8D5B JSON", "archiveImport")}</div>${db.games.length ? db.games.filter((g) => gameYear(g) === historyYear).slice().reverse().map((g) => {
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
    return `${header("\u6BD4\u8D5B\u6570\u636E")}${score2(s, g.ended)}<p class="muted">\u5F00\u59CB\uFF1A${new Date(g.startedAt).toLocaleString("zh-CN")}<br>\u7ED3\u675F\uFF1A${g.endedAt ? new Date(g.endedAt).toLocaleString("zh-CN") : "\u8FDB\u884C\u4E2D"}<br>${[["\u6E29\u5EA6", g.temperature ? g.temperature + " \u2103" : ""], ["\u5929\u6C14", g.weather], ["\u5730\u70B9", g.location]].filter((x) => x[1]).map((x) => esc(x.join("\uFF1A"))).join(" \xB7 ")}<br>\u8BB0\u5F55\u8005\uFF1A${esc(name(s.scorerId))} \xB7 \u88C1\u5224\uFF1A${esc(name(s.umpireId))}</p><div class="row">${btn("\u5BFC\u51FA\u672C\u573A Excel", "exportGame", "", "primary")}${g.ended ? btn("\u5BFC\u51FA\u672C\u573A JSON", "archiveOne", 'data-id="' + g.id + '"') : ""}${!g.ended ? btn("\u7EE7\u7EED\u6BD4\u8D5B", "resume") : ""}</div><section class="card"><h2>\u6253\u51FB\u5E2D\u4F4D</h2>${g.teams.map((t, i) => (i ? "<hr>" : "") + `<h3>${i ? "\u4E3B\u961F" : "\u5BA2\u961F"} \xB7 ${esc(t.name)}</h3>` + t.lineup.map((p, j) => {
      var _a;
      return `<p>\u7B2C ${j + 1} \u68D2 \xB7 ${esc(name(p.id))} #${esc(((_a = db.players.find((x) => x.id === p.id)) == null ? void 0 : _a.number) || "\u2014")} \xB7 ${esc(p.pos)} \xB7 \u5148\u53D1</p>`;
    }).join("")).join("")}</section><section class="card"><h2>\u6362\u4EBA / \u6362\u4F4D\u8BB0\u5F55</h2>${`<div class="box-table"><table><thead><tr>${["\u65F6\u95F4", "\u5C40", "\u7403\u961F", "\u7C7B\u578B", "\u6253\u5E8F", "\u6362\u51FA / \u7403\u5458", "\u6362\u5165 / \u53E6\u4E00\u7403\u5458", "\u4F4D\u7F6E\u53D8\u5316", "\u7403\u6570 / \u5792\u4F4D"].map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${substitutionRows(g, (id) => {
      var _a;
      return name(id) + " #" + (((_a = db.players.find((p) => p.id === id)) == null ? void 0 : _a.number) || "\u2014");
    }).map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("") || "<tr><td colspan=9>\u65E0\u6362\u4EBA\u8BB0\u5F55</td></tr>"}</tbody></table></div>`}</section>${boxScore(g, context(g))}${recent(s)}`;
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
      [...statSheets(groups, db.players, { sport, ...meta }), ...meta.game ? recordSheets(meta.game, (id) => {
        var _a;
        return name(id) + " #" + (((_a = db.players.find((p) => p.id === id)) == null ? void 0 : _a.number) || "\u2014");
      }) : []],
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _s;
    const snapshot = clone(db);
    try {
      const g = game();
      if (a.startsWith("special") && a !== "specialMenu") {
        panel = null;
        if (handleSpecial(a, v, g, { $, updateGame, close: () => {
          var _a2;
          (_a2 = $("dialog")) == null ? void 0 : _a2.close();
          panel = null;
        } })) {
          save();
          render();
          return;
        }
      }
      switch (a) {
        case "specialMenu":
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
          panel = "special";
          break;
        case "home":
          window.goHome();
          return;
        case "author":
          dialog('<div class="dialog-body"><h2>\u8F6F\u4EF6\u4F5C\u8005</h2><p>\u4F5C\u8005\uFF1AAndy\uFF08PAVIA\uFF09</p><p>\u8054\u7CFB\u65B9\u5F0F\uFF1A<a href="https://github.com/Andy-Jaehn/BaseballScoreKepper" style="overflow-wrap:anywhere;word-break:break-word">https://github.com/Andy-Jaehn/BaseballScoreKepper</a></p></div><div class="dialog-actions">' + btn("\u5173\u95ED", "close", "", "primary wide") + "</div>");
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
        case "pickOfficial":
          pickPlayer(0, v.role);
          return;
        case "setOfficial":
          db.setup[v.role] = v.id;
          (_b = $("dialog")) == null ? void 0 : _b.close();
          break;
        case "pickPlayer":
          pickPlayer(+v.team);
          return;
        case "logMove":
          logIndex = Number(v.index);
          break;
        case "showLog":
          logIndex = null;
          panel = "log";
          panelGameId = v.id || db.active;
          break;
        case "closePanel":
          panel = null;
          (_c = $("dialog")) == null ? void 0 : _c.close();
          break;
        case "addLine": {
          const t = db.setup.teams[+v.team], id = v.id;
          if (!id) throw Error("\u8BF7\u5148\u9009\u62E9\u7403\u5458");
          const available = lineupPositions(db.setup.sport).find((p) => !t.lineup.some((x) => x.pos === p)) || (db.setup.sport === "softball" ? "\u589E\u989D\u7403\u5458" : null);
          if (!available) throw Error("\u573A\u4E0A\u4F4D\u7F6E\u5DF2\u6EE1");
          if (db.setup.teams.some((t2) => t2.lineup.some((p) => p.id === id)))
            throw Error("\u8BE5\u7403\u5458\u5DF2\u5728\u961F\u4E2D");
          t.lineup.push({ id, pos: available });
          (_d = $("dialog")) == null ? void 0 : _d.close();
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
            if (new Set(t.lineup.filter((p) => p.pos !== "\u589E\u989D\u7403\u5458").map((p) => p.pos)).size !== t.lineup.filter((p) => p.pos !== "\u589E\u989D\u7403\u5458").length)
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
          for (const key of ["temperature", "weather", "location"]) n[key] = db.setup[key] || "";
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
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u8BB0\u5F55");
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
          const replacementId = (_e = $("#ejectReplacement")) == null ? void 0 : _e.value;
          if ($("#ejectReplacement") && !replacementId) throw Error("\u8BF7\u9009\u62E9\u66FF\u6362\u4EBA\u5458");
          updateGame(stageRuling(g, { kind: "eject", personId: v.id, personName: name(v.id), replacementName: replacementId ? name(replacementId) : null, replacementId, team: +v.team }));
          panel = null;
          break;
        }
        case "archiveExport":
          dialog("<h2>\u9009\u62E9\u6BD4\u8D5B\u5BFC\u51FA</h2>" + db.games.filter((g2) => g2.ended).map((g2) => '<label class="row"><input class="check fit" type="checkbox" name="archiveGame" value="' + g2.id + '">' + esc(new Date(g2.startedAt || g2.created).toLocaleString("zh-CN") + " \xB7 " + g2.teams.map((t) => t.name).join(" vs ")) + "</label>").join("") + btn("\u5BFC\u51FA\u6240\u9009 JSON", "archiveSave", "", "primary wide") + btn("\u5173\u95ED", "close"));
          return;
        case "archiveOne":
          downloadJson(exportArchive(db, [v.id], true), "\u94BB\u77F3\u8BB0\u5206-\u5355\u573A.json");
          return;
        case "archiveSave": {
          const ids = [...document.querySelectorAll('[name="archiveGame"]:checked')].map((x) => x.value);
          if (!ids.length) throw Error("\u8BF7\u81F3\u5C11\u9009\u62E9\u4E00\u573A\u6BD4\u8D5B");
          downloadJson(exportArchive(db, ids, true), "\u94BB\u77F3\u8BB0\u5206-\u6240\u9009\u6BD4\u8D5B.json");
          (_f = $("dialog")) == null ? void 0 : _f.close();
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
        case "foulError": {
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u5B8C\u6210\u5F53\u524D\u8BB0\u5F55");
          const s = replay(g);
          dialog('<h2>\u754C\u5916\u6F0F\u63A5\u5931\u8BEF</h2><p>\u4EC5\u8BB0\u5F55\u6B63\u5E38\u9632\u5B88\u5E94\u63A5\u4F4F\u3001\u6F0F\u63A5\u540E\u5EF6\u957F\u6253\u5E2D\u7684\u754C\u5916\u7403\u3002\u6218\u672F\u6027\u653E\u5F03\u63A5\u7403\u4E0D\u8BB0\u5931\u8BEF\u3002</p><label>\u5931\u8BEF\u91CE\u624B</label><select id="foulErrorFielder">' + s.teams[1 - s.side].lineup.filter(isDefender).map((p) => '<option value="' + p.id + '">' + esc(p.pos + " \xB7 " + name(p.id)) + "</option>").join("") + "</select>" + btn("\u8BB0\u5F55\u672C\u7403", "saveFoulError", "", "primary wide") + btn("\u53D6\u6D88", "close", "", "wide"));
          return;
        }
        case "saveFoulError":
          updateGame(recordCount(g, "foul", { foulErrorFielder: $("#foulErrorFielder").value }));
          (_g = $("dialog")) == null ? void 0 : _g.close();
          break;
        case "pitch":
          panel = null;
          if (g.draft) throw Error("\u8BF7\u5148\u5904\u7406\u5F53\u524D Fair");
          if (g.sport === "softball" && v.kind === "hbp") throw Error("\u6162\u6295\u5792\u7403\u4E0D\u9002\u7528 HBP");
          g.uiStage = "pitch";
          updateGame(recordCount(g, v.kind));
          stage = "pitch";
          break;
        case "contact":
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u5B8C\u6210\u5F53\u524D\u8BB0\u5F55");
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
        case "award": {
          const s = replay(g), n = +v.n;
          Object.assign(g.draft, {
            trajectory: null,
            awardBases: n,
            result: "stop",
            fielder: null,
            actions: runnerQueue(s).map((r) => ({
              id: r.id,
              mode: "advance",
              advance: Math.min(n, 4 - r.from)
            }))
          });
          break;
        }
        case "result": {
          const d = g.draft, s = replay(g);
          d.fielder = $("#fielder").value;
          d.result = v.value;
          d.trajectory = v.trajectory || null;
          const pos = (_h = s.teams[1 - s.side].lineup.find((p) => p.id === d.fielder)) == null ? void 0 : _h.pos;
          d.zone = d.trajectory === "popup" || !["\u5DE6\u5916\u91CE", "\u4E2D\u5916\u91CE", "\u53F3\u5916\u91CE"].includes(pos) ? "\u5185\u91CE" : "\u5916\u91CE";
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
          const d = g.draft, a2 = {
            id: v.id,
            mode: "advance",
            advance: +$("#normalAdvance").value,
            errorAdvance: $("#errorAdvance") ? +$("#errorAdvance").value : 0,
            errorFielder: (_i = $("#errorFielder")) == null ? void 0 : _i.value
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
          updateGame(settleContact(g));
          break;
        }
        case "draftBack": {
          const d = g.draft;
          d.actions = d.actions.filter((a2) => !a2.automatic);
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
          } else if (d.result) {
            delete d.result;
            delete d.trajectory;
            delete d.zone;
          } else {
            g.draft = null;
            (_j = $("dialog")) == null ? void 0 : _j.close();
          }
          break;
        }
        case "cancelDraft":
          if (!await ask("\u53D6\u6D88\u5F53\u524D\u5C1A\u672A\u786E\u8BA4\u7684\u6295\u7403\u5F55\u5165\uFF1F")) return;
          g.draft = null;
          (_k = $("dialog")) == null ? void 0 : _k.close();
          break;
        case "commitContact":
          updateGame(commit(g, g.draft));
          (_l = $("dialog")) == null ? void 0 : _l.close();
          stage = "pitch";
          break;
        case "confirmCount":
          updateGame(confirmCount(g));
          (_m = $("dialog")) == null ? void 0 : _m.close();
          break;
        case "pendingBack": {
          const ruling = ((_n = g.pendingPitch) == null ? void 0 : _n.type) === "ruling", special = ((_o = g.pendingPitch) == null ? void 0 : _o.type) === "special", draft = clone(g.specialDraft || null);
          updateGame(cancelCount(g));
          if (special && draft && !["balk", "interference"].includes(draft.kind)) {
            if (draft.actions.length) draft.actions.pop();
            game().specialDraft = draft;
          }
          panel = ruling ? "ruling" : special && !game().specialDraft ? "special" : null;
          (_p = $("dialog")) == null ? void 0 : _p.close();
          break;
        }
        case "cancelCount":
          updateGame(cancelCount(g));
          (_q = $("dialog")) == null ? void 0 : _q.close();
          break;
        case "undo":
          updateGame(undo(g).game);
          toast("\u5DF2\u64A4\u9500\u5F53\u524D\u6253\u5E2D\u4E0A\u4E00\u6761\u8BB0\u5F55");
          break;
        case "half":
          updateGame(commit(g, { type: "half" }));
          stage = "pitch";
          break;
        case "offenseSub":
        case "sub":
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u672C\u7403\u8BB0\u5F55");
          if (a === "offenseSub" && replay(g).halfEnded) throw Error("\u8BF7\u5148\u5F00\u542F\u4E0B\u4E00\u534A\u5C40");
          subMode = a === "offenseSub" ? "offense" : "defense";
          panel = "sub";
          sub = true;
          break;
        case "subBack":
          panel = null;
          (_r = $("dialog")) == null ? void 0 : _r.close();
          sub = false;
          break;
        case "doSub":
        case "doSwap": {
          const s = replay(g), index = +$("#subout").value;
          const event = { type: "sub", team: subMode === "offense" ? s.side : 1 - s.side, index };
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
          (_s = $("dialog")) == null ? void 0 : _s.close();
          toast("\u6362\u4EBA / \u6362\u4F4D\u5DF2\u8BB0\u5F55");
          break;
        }
        case "end":
          if (g.draft || g.pendingPitch || g.specialDraft) throw Error("\u8BF7\u5148\u786E\u8BA4\u6216\u53D6\u6D88\u5F53\u524D\u6295\u7403\uFF0C\u518D\u7ED3\u675F\u6BD4\u8D5B");
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
            game: x,
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
  document.addEventListener("input", (e) => {
    const key = e.target.dataset.environment;
    if (!key || !db.setup) return;
    db.setup[key] = e.target.value;
    save();
  });
  document.addEventListener("input", (e) => {
    if (e.target.id !== "throwingPath") return;
    const g = game();
    if (!(g == null ? void 0 : g.draft)) return;
    const value = e.target.value, valid = (g.sport === "softball" ? /^[0-9]*$/ : /^[1-9]*$/).test(value);
    e.target.setCustomValidity(valid ? "" : "\u8BF7\u8F93\u5165\u6709\u6548\u7684\u5B88\u5907\u7F16\u53F7");
    e.target.setAttribute("aria-invalid", String(!valid));
    g.draft.throwingPath = value;
    save();
    $("#throwingPathPreview").textContent = valid ? throwingPathLabel(value) || "\u672A\u586B\u5199\u4F20\u7403\u8DEF\u5F84" : g.sport === "softball" ? "\u4EC5\u53EF\u8F93\u5165 0\u20139" : "\u4EC5\u53EF\u8F93\u5165 1\u20139";
  });
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
      if (el.dataset.environment) {
        db.setup[el.dataset.environment] = el.value.trim();
        save();
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
  var plateTouch = null;
  document.addEventListener("touchstart", (e) => {
    const el = e.target.closest("[data-plate-index]");
    plateTouch = el ? { x: e.touches[0].clientX, y: e.touches[0].clientY, index: Number(el.dataset.plateIndex) } : null;
  }, { passive: true });
  document.addEventListener("touchend", (e) => {
    if (!plateTouch) return;
    const t = plateTouch;
    plateTouch = null;
    const dx = e.changedTouches[0].clientX - t.x, dy = e.changedTouches[0].clientY - t.y;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      const g = db.games.find((g2) => g2.id === (panelGameId || db.active)), index = t.index + (dx < 0 ? 1 : -1);
      if (g && index >= 0 && index < plateRecords(g).length) action("logMove", { index });
    }
  }, { passive: true });
  var plateMouse = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    const el = e.target.closest("[data-plate-index]");
    plateMouse = el ? { x: e.clientX, y: e.clientY, index: Number(el.dataset.plateIndex) } : null;
  });
  document.addEventListener("pointerup", (e) => {
    if (!plateMouse) return;
    const t = plateMouse;
    plateMouse = null;
    const dx = e.clientX - t.x, dy = e.clientY - t.y;
    const g = db.games.find((g2) => g2.id === (panelGameId || db.active));
    const index = t.index + (dx < 0 ? 1 : -1);
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) && g && index >= 0 && index < plateRecords(g).length) action("logMove", { index });
  });
})();
