export const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .toLocaleLowerCase();
export function validatePlayer(players, player) {
  if (!player.name?.trim()) throw Error("请输入姓名");
  if (
    players.some(
      (p) =>
        p.id !== player.id &&
        normalizeName(p.name) === normalizeName(player.name),
    )
  )
    throw Error("球员姓名已存在，请使用不同姓名（含已删除球员）");
  if (
    !["L", "R", "S"].includes(player.bats) ||
    !["L", "R"].includes(player.throws)
  )
    throw Error("请选择打击手和投球手");
  return { ...player, name: player.name.trim() };
}
// Old duplicates are disambiguated without merging IDs or losing match history.
export function migrateRoster(players) {
  const used = new Set();
  for (const p of players) {
    let n = p.name?.trim() || "未命名球员",
      i = 2,
      base = n;
    while (used.has(normalizeName(n))) n = `${base}（${i++}）`;
    if (n !== p.name) p.previousName = p.name;
    p.name = n;
    used.add(normalizeName(n));
    p.bats = p.bats || "";
    p.throws = p.throws || "";
  }
}
