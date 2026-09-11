/** Reconstruct an error-free inning independently for each pitcher.
 * Shadows retain runners who actually scored on an error until later legal advances establish ER.
 * Only actual runs can become earned runs; virtual runs never alter the scoreboard.
 */
export function earnedRunDetails(log) {
  const result = {},
    tracks = new Map(), audit = [];
  let eventIndex = -1;
  let half = "";
  const collect = (closed = false) => {
    for (const [p, t] of tracks)
      for (const [token, detail] of t.actual) {
        if (t.scored.has(token) && !t.credited.has(token)) {
          result[p] = (result[p] || 0) + 1;
          t.credited.add(token);
        }
        detail.earned = t.scored.has(token);
        detail.final = closed || t.outs >= 3 || detail.earned || t.excluded.has(token) || t.retired.has(token);
        detail.shadowScoredAt = t.scored.get(token) ?? null;
        detail.reason = detail.earned
          ? (detail.shadowScoredAt > detail.actualScoredAt ? 'later-legal-advance' : 'error-free-score')
          : t.excluded.has(token) ? 'reached-on-error'
          : t.retired.has(token) ? 'shadow-runner-retired'
          : t.outs >= 3 ? 'shadow-inning-ended'
          : closed ? 'insufficient-legal-advance' : 'not-yet-established';
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
          l.beforeBases
            .filter(Boolean)
            .map((r) => [r.token, { ...r, pos: r.from }]),
        ),
        scored: new Map(),
        actual: new Map(),
        excluded: new Set(),
        retired: new Set(),
        steps: [],
        credited: new Set(),
        missedBatters: new Set(),
      });
    if (l.foulError) for (const t of tracks.values()) {
      const token = `${l.side}:${l.pa}`;
      if (!t.missedBatters.has(token) && t.outs < 3) {
        t.missedBatters.add(token);t.excluded.add(token);t.outs++;
        t.steps.push({eventIndex, reason:'missed-foul-out', token, outs:t.outs});
      }
    }
    const play = l.play;
    if (!play) continue;
    for (const r of play.runs || []) {
      const t = tracks.get(r.pitcher);
      if (t) {
        const detail = {inning:l.inning, side:l.side, pitcher:r.pitcher,
          token:r.token, runnerId:r.id, actualScoredAt:eventIndex, steps:t.steps};
        t.actual.set(r.token, detail);
        audit.push(detail);
      }
    }
    for (const t of tracks.values()) {
      if (t.outs >= 3) continue;
      const step = {eventIndex, result:play.result, beforeOuts:t.outs,
        beforeBases:[...t.bases.values()].map(r=>({token:r.token,pos:r.pos})), decisions:[]};
      t.steps.push(step);
      try {
        const score = (r) => {
          if (t.outs < 3) t.scored.set(r.token, eventIndex);
          t.bases.delete(r.token);
        };
        const safe = (r, pos) => {
          if (pos >= 4) score(r);
          else t.bases.set(r.token, { ...r, pos });
        };
        if ((play.result === "BB" || play.result === "HBP") && !play.specialWalk) {
          if (t.missedBatters.has(play.batter.token)) continue;
          const at = (n) => [...t.bases.values()].find((r) => r.pos === n),
            a = at(1),
            b = at(2),
            c = at(3);
          if (a) {
            if (b) {
              if (c) score(c);
              safe(b, 3);
            }
            safe(a, 2);
          }
          safe(play.batter, 1);
          step.decisions.push({token:play.batter.token,reason:'forced-walk-chain'});
          continue;
        }
        if(play.interference){t.excluded.add(play.batter.token);}
        const missedBatter = t.missedBatters.has(play.batter?.token);
        const lostOut = play.reachedError && !play.batterOut && !missedBatter ? 1 : 0;
        if (lostOut) t.excluded.add(play.batter.token);
        // Validate actual retirements against this track's own starting occupancy.
        // A tag at a different starting base cannot be inferred from the input.
        const available = new Map(t.bases);
        let batterForces = Boolean(play.batter && !missedBatter && !lostOut &&
          !(play.outs || []).some(o=>o.from===0 && ['catch','strike'].includes(o.mode)));
        const outs = (play.outs || []).filter(o=>{
          let valid;
          if (o.from===0) {valid = !missedBatter && !lostOut;batterForces=false;}
          else {
            const r = available.get(o.token);
            valid = Boolean(r);
            if (valid && o.mode==='force') {
              valid = batterForces && o.base===r.pos+1;
              for(let pos=1;valid && pos<r.pos;pos++)
                valid = [...available.values()].some(x=>x.pos===pos);
            } else if (valid && o.mode==='tag' && play.result!=='PENALTY') valid = r.pos===o.from;
            if (valid) {available.delete(o.token);t.retired.add(o.token);}
          }
          step.decisions.push({token:o.token, reason:valid?'shadow-out':'out-not-established', mode:o.mode});
          return valid;
        });
        if (lostOut) step.decisions.push({token:play.batter.token,reason:'missed-out'});
        const virtualThird = outs[2 - t.outs - lostOut];
        const thirdForce =
          t.outs + lostOut >= 3 ||
          (t.outs + lostOut + outs.length >= 3 &&
            virtualThird &&
            (virtualThird.mode === "force" ||
              (virtualThird.from === 0 && !virtualThird.safeBases)));
        if (thirdForce) {
          t.outs += lostOut + outs.length;
          continue;
        }
        const beforeTokens = new Set(t.bases.keys());
        for (const o of outs) t.bases.delete(o.token);
        // Process leaders first so shadows never share a base or pass one another.
        const ordered = [...t.bases.values()].sort((a,b)=>b.pos-a.pos);
        let limit = 4;
        for (const old of ordered) {
          const a = (play.actions || []).find(a=>a.token===old.token);
          let advance = 0, reason = 'hold';
          if (play.hitBases===4) {advance=4;reason='home-run';}
          else if (a && !['force','tag'].includes(a.mode)) {
            advance=a.shadowAdvance ?? a.advance ?? 0;reason='recorded-legal-advance';
          } else if (!a && play.hitBases) {
            advance=play.hitBases;reason='inferred-hit-advance';
          }
          let pos = Math.min(limit, old.pos+advance);
          safe(old,pos);
          if(pos<4) limit=pos-1;
          step.decisions.push({token:old.token,reason,from:old.pos,to:pos});
        }
        if (play.result === "H" && !missedBatter) {
          // A batter's awarded bases displace any lagging shadow runners.
          let minimum = play.hitBases+1;
          const displaced = [...t.bases.values()].sort((a,b)=>a.pos-b.pos).map(r=>{
            const pos=Math.max(r.pos,minimum);minimum=pos+1;return {r,pos};
          });
          for (const {r,pos} of displaced.reverse()) {
            safe(r,pos);
            if(pos!==r.pos) step.decisions.push({token:r.token,reason:'hit-award-displacement',from:r.pos,to:pos});
          }
          safe(play.batter, play.hitBases);
        }
        else if (play.result === "FC" && !play.batterOut && !missedBatter) {
          // A fielder's choice preserves the responsibility of the retired runner.
          const retired = (play.outs || []).find((o) => o.from > 0);
          if (!retired || beforeTokens.has(retired.token)) {
            // Rebuild the force chain instead of overwriting a shadow on first.
            const force = pos => {
              const r=[...t.bases.values()].find(r=>r.pos===pos);
              if(r){
                if(pos<3)force(pos+1);
                safe(r,pos+1);
                step.decisions.push({token:r.token,reason:'inferred-choice-force',from:pos,to:pos+1});
              }
            };
            force(1);safe(play.batter, 1);
          } else t.excluded.add(play.batter.token);
        }
        if(play.specialWalk&&!missedBatter){
          const force=pos=>{const r=[...t.bases.values()].find(r=>r.pos===pos);if(r){if(pos<3)force(pos+1);safe(r,pos+1);}};
          force(1);safe(play.batter,1);
        }
        if(play.result==='SO'&&!play.batterOut&&!lostOut&&!missedBatter){const a=play.actions.find(a=>a.from===0);if(a)safe(play.batter,a.advance);}
        t.outs += lostOut + outs.length;
      } finally {
        step.afterOuts = t.outs;
        step.afterBases = [...t.bases.values()].map(r=>({token:r.token,pos:r.pos}));
      }
    }
    collect();
  }
  collect(log.at(-1)?.o >= 3);
  return {totals:result, runs:audit};
}

export function earnedRuns(log) {
  return earnedRunDetails(log).totals;
}
