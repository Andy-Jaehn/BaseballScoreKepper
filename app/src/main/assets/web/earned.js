/** Reconstruct error-free innings independently for every pitcher's entry point (OBR 9.16).
 * Shadows retain runners who actually scored on an error until later legal advances establish ER.
 * Only actual runs can become earned runs; virtual runs never alter the scoreboard.
 */
export function earnedRuns(log) {
  const result = {},
    tracks = new Map();
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
          l.beforeBases
            .filter(Boolean)
            .map((r) => [r.token, { ...r, pos: r.from }]),
        ),
        scored: new Set(),
        actual: new Set(),
        credited: new Set(),
      });
    const play = l.play;
    if (!play) continue;
    for (const r of play.runs || []) {
      const t = tracks.get(r.pitcher);
      if (t) t.actual.add(r.token);
    }
    for (const t of tracks.values()) {
      if (t.outs >= 3) continue;
      const score = (r) => {
        if (t.outs < 3) t.scored.add(r.token);
        t.bases.delete(r.token);
      };
      const safe = (r, pos) => {
        if (pos >= 4) score(r);
        else t.bases.set(r.token, { ...r, pos });
      };
      if (play.result === "BB" || play.result === "HBP") {
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
        continue;
      }
      const lostOut = play.reachedError ? 1 : 0;
      const outs = play.outs || [];
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
      const observed = new Set(),
        beforeTokens = new Set(t.bases.keys());
      for (const a of play.actions || []) {
        observed.add(a.token);
        const old = t.bases.get(a.token);
        if (a.mode === "force" || a.mode === "tag") {
          t.bases.delete(a.token);
          continue;
        }
        if (a.from === 0) continue;
        if (old) safe(old, old.pos + (a.advance>0?Math.max(a.advance,play.hitBases||0):0));
      }
      // Already-scored real runners remain as shadows, advancing on subsequent hits.
      if (play.hitBases)
        for (const r of [...t.bases.values()])
          if (!observed.has(r.token)) safe(r, r.pos + play.hitBases);
      if (play.result === "H") safe(play.batter, play.hitBases);
      else if (play.result === "FC" && !play.batterOut) {
        // A fielder's choice preserves the responsibility of the retired runner.
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
