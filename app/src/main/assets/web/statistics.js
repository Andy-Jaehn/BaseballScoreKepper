import { rates, emptyStats } from "./engine.js";
export const BATTING = [
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
  "TB",
];
export const FIELDING = ["E", "PO", "A", "DP", "TP", "FPCT"];
export const PITCHING = [
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
  "K/9",
];
/** Shared by player and match exports; every group and every category is included in ONE workbook. */
export function statSheets(groups, players, meta = {}) {
  const player = (id) =>
      players.find((p) => p.id === id) || { name: "已删除球员" },
    st = (g, id) => rates(g.stats[id] || emptyStats(), meta.sport),
    all = [...BATTING, ...FIELDING, ...PITCHING];
  const rows = [
    ["项目", meta.sport === "softball" ? "慢投垒球" : "棒球"],
    ["开始时间", meta.startedAt || "累计统计"],
    ["结束时间", meta.endedAt || "进行中 / 不适用"],
    [],
    ["球队", "姓名", "打击手", "投球手", ...all],
  ];
  for (const g of groups)
    for (const id of g.ids) {
      const p = player(id),
        s = st(g, id);
      rows.push([
        g.name,
        p.name,
        p.bats || "—",
        p.throws || "—",
        ...all.map((k) => (PITCHING.includes(k) && !s.P ? "" : s[k])),
      ]);
    }
  const sheets = [{ name: "全部数据", rows }];
  groups.forEach((g, i) => {
    for (const [category, keys] of [
      ["打击", BATTING],
      ["守备", FIELDING],
      ["投球", PITCHING],
    ])
      sheets.push({
        name: `${i + 1}${g.name}-${category}`
          .replace(/[\[\]:*?/\\]/g, "")
          .slice(0, 31),
        rows: [
          ["球队", "球员", "打击手", "投球手", ...keys],
          ...g.ids
            .filter((id) => category !== "投球" || st(g, id).P > 0)
            .map((id) => [
              g.name,
              player(id).name,
              player(id).bats || "—",
              player(id).throws || "—",
              ...keys.map((k) => st(g, id)[k]),
            ]),
        ],
      });
  });
  return sheets;
}
export function teamIds(g,team){
  return [...new Set([...g.teams[team].lineup.map(p=>p.id),...g.events.filter(e=>e.type==='sub'&&e.team===team&&e.swap===undefined).map(e=>e.id),...g.events.filter(e=>e.type==='ruling'&&e.kind==='eject'&&e.team===team&&e.replacementId).map(e=>e.replacementId)])];
}
