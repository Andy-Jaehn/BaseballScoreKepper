// Minimal standards-compliant XLSX writer: UTF-8 XML inside an uncompressed ZIP.
const enc = new TextEncoder();
const xml = (s) =>
  String(s)
    .replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&apos;",
        })[c],
    )
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
function crc32(b) {
  let c = 0xffffffff;
  for (const n of b) {
    c ^= n;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}
function zip(files) {
  let offset = 0;
  const chunks = [],
    central = [];
  const hdr = (size) => new DataView(new ArrayBuffer(size));
  const u16 = (v, o, n) => v.setUint16(o, n, true),
    u32 = (v, o, n) => v.setUint32(o, n, true);
  for (const [name, content] of Object.entries(files)) {
    const n = enc.encode(name),
      b = enc.encode(content),
      crc = crc32(b),
      h = hdr(30);
    u32(h, 0, 0x04034b50);
    u16(h, 4, 20);
    u16(h, 6, 0x800);
    u32(h, 14, crc);
    u32(h, 18, b.length);
    u32(h, 22, b.length);
    u16(h, 26, n.length);
    chunks.push(new Uint8Array(h.buffer), n, b);
    const c = hdr(46);
    u32(c, 0, 0x02014b50);
    u16(c, 4, 20);
    u16(c, 6, 20);
    u16(c, 8, 0x800);
    u32(c, 16, crc);
    u32(c, 20, b.length);
    u32(c, 24, b.length);
    u16(c, 28, n.length);
    u32(c, 42, offset);
    central.push(new Uint8Array(c.buffer), n);
    offset += 30 + n.length + b.length;
  }
  const cs = central.reduce((n, x) => n + x.length, 0),
    end = hdr(22);
  u32(end, 0, 0x06054b50);
  u16(end, 8, Object.keys(files).length);
  u16(end, 10, Object.keys(files).length);
  u32(end, 12, cs);
  u32(end, 16, offset);
  const all = [...chunks, ...central, new Uint8Array(end.buffer)],
    out = new Uint8Array(offset + cs + 22);
  let p = 0;
  for (const b of all) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}
export function workbook(sheets) {
  if (!sheets.length) throw Error("没有可导出的数据");
  const column = (n) => {
    let s = "";
    for (n++; n; n = Math.floor((n - 1) / 26))
      s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
    return s;
  };
  const files = {};
  files["[Content_Types].xml"] =
    `<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  files["_rels/.rels"] =
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  files["xl/workbook.xml"] =
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`;
  files["xl/_rels/workbook.xml.rels"] =
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}</Relationships>`;
  for (const [i, s] of sheets.entries())
    files[`xl/worksheets/sheet${i + 1}.xml`] =
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${column(Math.max(1, ...s.rows.map((r) => r.length)) - 1)}${Math.max(1, s.rows.length)}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols><col min="1" max="2" width="20" customWidth="1"/><col min="3" max="80" width="12" customWidth="1"/></cols><sheetData>${s.rows.map((row, j) => `<row r="${j + 1}">${row.map((v, k) => (typeof v === "number" ? `<c r="${column(k)}${j + 1}" t="n"><v>${Number.isFinite(v) ? v : 0}</v></c>` : `<c r="${column(k)}${j + 1}" t="inlineStr"><is><t xml:space="preserve">${xml(v ?? "")}</t></is></c>`)).join("")}</row>`).join("")}</sheetData></worksheet>`;
  return zip(files);
}
export function downloadXlsx(sheets, name) {
  const bytes = workbook(sheets);
  if (window.AndroidStore) {
    let s = "";
    for (const b of bytes) s += String.fromCharCode(b);
    window.AndroidStore.exportFile(name, btoa(s));
  } else {
    const url = URL.createObjectURL(
      new Blob([bytes], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
