import { rates, emptyStats } from "./engine.js";
export const statLabel = k => ({WP:'WP 暴投',PB:'PB 捕逸',BK:'BK 非法投球（投手犯规）',PICK:'PICK 牵制尝试',SB:'SB 盗垒',CS:'CS 盗垒失败',DS:'DS 双盗垒',CI:'CI 妨碍上垒',F_CI:'CI 捕手妨碍',D3K:'D3K 不死三振',F_FOUL_E:'界外漏接失误',NP:'NP 面对投球数',RA9:'RA9 每九局失分'})[k] || k.replace(/^[PF]_/, "");
export const BATTING = [
  "FB", "LD", "IFF", "GB",
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
  "SB", "CS", "DS", "CI", "D3K", "NP",
  "PA",
  "TB",
];
export const FIELDING = ["PB", "F_CI", "F_FOUL_E", "E", "PO", "A", "DP", "TP", "FPCT", "F_FB", "F_LD", "F_IFF", "F_GB"];
export const PITCHING = [
  "P_FB", "P_LD", "P_IFF", "P_GB",
  "WP", "BK", "PICK",
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
    ["球队", "姓名", "打击手", "投球手", ...all.map(k=>k.startsWith("P_")?"投球 "+statLabel(k):k.startsWith("F_")?"守备 "+statLabel(k):["FB","LD","IFF","GB"].includes(k)?"打击 "+k:statLabel(k))],
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
          ["球队", "球员", "打击手", "投球手", ...keys.map(statLabel)],
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
