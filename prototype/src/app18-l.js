/* ---------- results files: read a lab report (Excel .xls or .xlsx, CSV or text) into a grid of cell texts, in the page ---------- */
/* Excel 97-2003 (.xls) files are a compound file holding a "Workbook" stream of BIFF records; .xlsx files are a zip of XML parts. Only the
   first worksheet is read. Numbers come out as the report shows them where the cell has a fixed-decimals format (0.900 stays 0.900). */
const FILE_MAX = 5 * 1024 * 1024;   // v24: any file, up to 5 MB
async function readGrid(file){
  const buf = new Uint8Array(await file.arrayBuffer());
  if (buf.length >= 8 && buf[0] === 0xD0 && buf[1] === 0xCF && buf[2] === 0x11 && buf[3] === 0xE0) return { kind: "xls", grid: xlsGrid(buf), bytes: buf };
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 3 && buf[3] === 4) return { kind: "xlsx", grid: await xlsxGrid(buf), bytes: buf };
  return { kind: "csv", grid: textGrid(decodeText(buf)), bytes: buf };
}
function decodeText(buf){
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf).replace(/^﻿/, ""); }
  catch { return new TextDecoder("windows-1252").decode(buf); }
}
/* Delimited text: tabs, semicolons or commas, whichever splits the first lines most evenly; quoted fields may hold the delimiter. */
function textGrid(t){
  const sample = t.split(/\r?\n/).filter(l => l.trim()).slice(0, 20);
  const score = d => { const n = sample.map(l => splitQuoted(l, d).length); return n.length ? Math.min(...n) > 1 ? n.reduce((a, b) => a + b, 0) : 0 : 0; };
  const d = ["\t", ";", ","].map(x => [x, score(x)]).reduce((a, b) => b[1] > a[1] ? b : a, [",", 0])[0];
  const rows = [], n = t.length; let row = [], cur = "", q = false;
  for (let i = 0; i < n; i++){
    const c = t[i];
    if (q){ if (c === '"'){ if (t[i + 1] === '"'){ cur += '"'; i++; } else q = false; } else cur += c; continue; }
    if (c === '"' && cur.trim() === "") { q = true; cur = ""; }
    else if (c === d){ row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && t[i + 1] === "\n") i++; row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += c;
  }
  if (cur !== "" || row.length){ row.push(cur); rows.push(row); }
  return tidyGrid(rows);
}
const splitQuoted = (l, d) => { const out = []; let cur = "", q = false; for (const c of l){ if (c === '"') q = !q; else if (c === d && !q){ out.push(cur); cur = ""; } else cur += c; } out.push(cur); return out; };
const tidyGrid = rows => rows.map(r => r.map(x => String(x ?? "").replace(/ /g, " ").trim()));

/* A number as a report shows it: the fixed decimals of the cell's format ("0.000", "#,##0.00"), without thousands separators; otherwise
   the shortest form that reads back as the same number. */
function numText(v, fmt){
  if (!isFinite(v)) return "";
  const f = String(fmt || "").replace(/"[^"]*"|\[[^\]]*\]|\\./g, "").split(";")[0];
  if (/[dy]/i.test(f) || /h/i.test(f) && /m/i.test(f)){   // a date or time: Excel counts days from 30 December 1899
    const d = new Date(Math.round((v - 25569) * 86400) * 1000), iso = d.toISOString();
    return /[dy]/i.test(f) ? iso.slice(0, 10) + (/h/i.test(f) ? " " + iso.slice(11, 16) : "") : iso.slice(11, 16);
  }
  const pct = /%/.test(f), m = f.match(/0\.(0+)/), x = pct ? v * 100 : v;
  if (/E[+-]/i.test(f)) return String(+x.toPrecision(15));   // scientific: the full value, not 1.20E-04 rounded
  if (m) return x.toFixed(m[1].length);
  if (/^#?,?#*0%?$/.test(f.trim()) && f.trim()) return String(Math.round(x));
  return String(+x.toPrecision(15));
}
const XL_FORMATS = { 1: "0", 2: "0.00", 3: "#,##0", 4: "#,##0.00", 9: "0%", 10: "0.00%", 11: "0.00E+00", 14: "m/d/yyyy", 15: "d-mmm-yy", 16: "d-mmm", 17: "mmm-yy", 18: "h:mm", 19: "h:mm:ss", 20: "h:mm", 21: "h:mm:ss", 22: "m/d/yyyy h:mm",
  37: "#,##0", 38: "#,##0", 39: "#,##0.00", 40: "#,##0.00", 45: "mm:ss", 46: "[h]:mm:ss", 47: "mm:ss.0", 48: "##0.0E+0" };

/* ---- .xls: compound file, then the BIFF8 (Excel 97-2003) or BIFF5 records of the first worksheet ---- */
function cfbStream(u8, names){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), len = u8.length;
  const ssz = 1 << dv.getUint16(30, true), mssz = 1 << dv.getUint16(32, true);
  if (ssz < 128 || ssz > 65536 || mssz > ssz) throw new Error("not a valid Excel file");
  const off = i => (i + 1) * ssz, END = -2, sectors = Math.floor(len / ssz);
  const difat = [];
  for (let i = 0; i < 109; i++){ const s = dv.getInt32(76 + i * 4, true); if (s >= 0) difat.push(s); }
  for (let s = dv.getInt32(68, true), guard = 0; s >= 0 && s < sectors && guard < 10000; guard++){
    const per = ssz / 4 - 1;
    for (let i = 0; i < per; i++){ const x = dv.getInt32(off(s) + i * 4, true); if (x >= 0) difat.push(x); }
    s = dv.getInt32(off(s) + per * 4, true);
  }
  const fat = [];
  for (const s of difat){ if (off(s) + ssz > len) continue; for (let i = 0; i < ssz / 4; i++) fat.push(dv.getInt32(off(s) + i * 4, true)); }
  const chain = (start, table) => { const out = []; for (let s = start, g = 0; s >= 0 && s < table.length && g < 1e6; g++){ out.push(s); s = table[s]; if (s === END) break; } return out; };
  const read = (start, size) => {
    const out = new Uint8Array(size); let p = 0;
    for (const s of chain(start, fat)){ if (p >= size) break; const o = off(s), n = Math.min(ssz, size - p, Math.max(0, len - o)); out.set(u8.subarray(o, o + n), p); p += n; }
    return out;
  };
  const dirs = [], dirBytes = read(dv.getInt32(48, true), chain(dv.getInt32(48, true), fat).length * ssz);
  const ddv = new DataView(dirBytes.buffer);
  for (let o = 0; o + 128 <= dirBytes.length; o += 128){
    const nl = ddv.getUint16(o + 64, true); let name = "";
    for (let i = 0; i + 2 < nl && i < 64; i += 2) name += String.fromCharCode(ddv.getUint16(o + i, true));
    dirs.push({ name, type: dirBytes[o + 66], start: ddv.getInt32(o + 116, true), size: ddv.getUint32(o + 120, true) });
  }
  const root = dirs[0], cutoff = dv.getUint32(56, true);
  const e = dirs.find(d => d.type === 2 && names.includes(d.name.toLowerCase()));
  if (!e) throw new Error("no workbook in this file");
  if (e.size >= cutoff) return read(e.start, e.size);
  const mini = read(root.start, root.size), mfat = [];
  const mf = read(dv.getInt32(60, true), dv.getUint32(64, true) * ssz), mdv = new DataView(mf.buffer);
  for (let i = 0; i + 4 <= mf.length; i += 4) mfat.push(mdv.getInt32(i, true));
  const out = new Uint8Array(e.size); let p = 0;
  for (const s of chain(e.start, mfat)){ if (p >= e.size) break; const n = Math.min(mssz, e.size - p); out.set(mini.subarray(s * mssz, s * mssz + n), p); p += n; }
  return out;
}
function xlsGrid(u8){
  const wb = cfbStream(u8, ["workbook", "book"]), dv = new DataView(wb.buffer, wb.byteOffset, wb.byteLength);
  const recs = [];
  for (let o = 0; o + 4 <= wb.length; ){ const t = dv.getUint16(o, true), n = dv.getUint16(o + 2, true); recs.push({ t, o: o + 4, n }); o += 4 + n; }
  const body = r => wb.subarray(r.o, r.o + r.n);
  let biff = 8, cp = 1252;
  const bof = recs.find(r => r.t === 0x0809); if (bof && dv.getUint16(bof.o, true) === 0x0500) biff = 5;
  const latin = new TextDecoder("windows-1252");
  /* A string spread over a record and its CONTINUE records: each continuation of the characters starts with a fresh flags byte. */
  const cursor = chunks => {
    let i = 0, o = 0;
    const av = () => chunks[i] ? chunks[i].length - o : 0, adv = () => { i++; o = 0; };
    const u8_ = () => { while (i < chunks.length && !av()) adv(); return i < chunks.length ? chunks[i][o++] : 0; };
    return {
      u8: u8_, u16: () => u8_() | u8_() << 8, u32: () => (u8_() | u8_() << 8 | u8_() << 16 | u8_() << 24) >>> 0,
      skip(n){ while (n > 0 && i < chunks.length){ if (!av()){ adv(); continue; } const k = Math.min(n, av()); o += k; n -= k; } },
      chars(n, hi){
        let s = "";
        while (n > 0 && i < chunks.length){
          if (!av()){ adv(); if (i >= chunks.length) break; hi = chunks[i][o++] & 1; continue; }
          const c = chunks[i];
          if (hi){ const k = Math.min(n, av() >> 1); for (let j = 0; j < k; j++) s += String.fromCharCode(c[o + 2 * j] | c[o + 2 * j + 1] << 8); o += 2 * k; n -= k; if (k === 0) o = c.length; }
          else { const k = Math.min(n, av()); s += latin.decode(c.subarray(o, o + k)); o += k; n -= k; }
        }
        return s;
      },
      done: () => { while (i < chunks.length && !av()) adv(); return i >= chunks.length; }
    };
  };
  const ustr = (c, cch) => { if (biff === 5) return c.chars(cch, 0); const f = c.u8(), runs = f & 8 ? c.u16() : 0, ext = f & 4 ? c.u32() : 0; const s = c.chars(cch, f & 1); c.skip(runs * 4 + ext); return s; };
  const sst = [], fmts = { ...XL_FORMATS }, xfs = [];
  const sheets = [];
  for (let k = 0; k < recs.length; k++){
    const r = recs[k];
    if (r.t === 0x0042 && r.n >= 2) cp = dv.getUint16(r.o, true);
    else if (r.t === 0x0085){ const c = cursor([body(r)]); const pos = c.u32(); c.u8(); const typ = c.u8(); if (typ === 0) sheets.push(pos); }
    else if (r.t === 0x041E || r.t === 0x001E){ const c = cursor([body(r)]); const id = c.u16(), cch = biff === 5 ? c.u8() : c.u16(); fmts[id] = biff === 5 ? c.chars(cch, 0) : ustr(c, cch); }
    else if (r.t === 0x00E0){ xfs.push(dv.getUint16(r.o + 2, true)); }
    else if (r.t === 0x00FC){
      const chunks = [body(r)]; for (let j = k + 1; j < recs.length && recs[j].t === 0x003C; j++) chunks.push(body(recs[j]));
      const c = cursor(chunks); c.u32(); const unique = c.u32();
      for (let j = 0; j < unique && !c.done(); j++) sst.push(ustr(c, c.u16()));
    }
  }
  const start = sheets.length ? sheets[0] : (recs.find((r, j) => j > 0 && r.t === 0x0809)?.o ?? 4) - 4;
  const cells = [];
  const put = (row, col, s) => { (cells[row] = cells[row] || [])[col] = s; };
  const num = (xf, v) => numText(v, fmts[xfs[xf]]);
  const rk = (x, xf) => { let v; if (x & 2) v = (x | 0) >> 2; else { const b = new DataView(new ArrayBuffer(8)); b.setUint32(4, x & 0xFFFFFFFC, true); v = b.getFloat64(0, true); } return num(xf, x & 1 ? v / 100 : v); };
  let k0 = recs.findIndex(r => r.o - 4 === start); if (k0 < 0) k0 = 0;
  let pendingStr = null;
  for (let k = k0 + 1; k < recs.length; k++){
    const r = recs[k], o = r.o;
    if (r.t === 0x000A) break;
    if (r.n < 6 && r.t !== 0x0207) continue;
    const row = r.n >= 2 ? dv.getUint16(o, true) : 0, col = r.n >= 4 ? dv.getUint16(o + 2, true) : 0, xf = r.n >= 6 ? dv.getUint16(o + 4, true) : 0;
    if (r.t === 0x00FD) put(row, col, sst[dv.getUint32(o + 6, true)] ?? "");
    else if (r.t === 0x0203) put(row, col, num(xf, dv.getFloat64(o + 6, true)));
    else if (r.t === 0x027E) put(row, col, rk(dv.getInt32(o + 6, true), xf));
    else if (r.t === 0x00BD){ const n = (r.n - 6) / 6; for (let j = 0; j < n; j++) put(row, col + j, rk(dv.getInt32(o + 4 + j * 6 + 2, true), dv.getUint16(o + 4 + j * 6, true))); }
    else if (r.t === 0x0204 || r.t === 0x00D6){ const c = cursor([body(r)]); c.skip(6); const cch = c.u16(); put(row, col, biff === 5 ? c.chars(cch, 0) : ustr(c, cch)); }
    else if (r.t === 0x0205){ const v = wb[o + 6], err = wb[o + 7]; put(row, col, err ? "" : v ? "TRUE" : "FALSE"); }
    else if (r.t === 0x0006){
      if (dv.getUint16(o + 12, true) === 0xFFFF){ const typ = wb[o + 6]; if (typ === 0) pendingStr = [row, col]; else if (typ === 1) put(row, col, wb[o + 8] ? "TRUE" : "FALSE"); }
      else put(row, col, num(xf, dv.getFloat64(o + 6, true)));
    } else if (r.t === 0x0207 && pendingStr){
      const chunks = [body(r)]; for (let j = k + 1; j < recs.length && recs[j].t === 0x003C; j++) chunks.push(body(recs[j]));
      const c = cursor(chunks), cch = c.u16(); put(pendingStr[0], pendingStr[1], biff === 5 ? c.chars(cch, 0) : ustr(c, cch)); pendingStr = null;
    }
  }
  void cp;
  return tidyGrid(Array.from({ length: cells.length }, (_, i) => Array.from({ length: (cells[i] || []).length }, (_, j) => (cells[i] || [])[j] ?? "")));
}

/* ---- .xlsx: the zip's central directory, then the first worksheet's XML ---- */
async function unzip(u8, want){
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 66000); i--) if (dv.getUint32(i, true) === 0x06054b50){ e = i; break; }
  if (e < 0) throw new Error("not a valid Excel file");
  const n = dv.getUint16(e + 10, true), out = {};
  const dec = new TextDecoder();
  for (let p = dv.getUint32(e + 16, true), k = 0; k < n && p + 46 <= u8.length; k++){
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true), csize = dv.getUint32(p + 20, true), nl = dv.getUint16(p + 28, true), xl = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
    p += 46 + nl + xl + cl;
    if (!want(name)) continue;
    const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true), raw = u8.subarray(start, start + csize);
    if (method === 0) out[name] = dec.decode(raw);
    else if (method === 8) out[name] = await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  }
  return out;
}
const xmlText = s => s.replace(/&(lt|gt|amp|quot|apos|#\d+|#x[0-9a-f]+);/gi, (m, g) => ({ lt: "<", gt: ">", amp: "&", quot: '"', apos: "'" })[g.toLowerCase()] ?? String.fromCodePoint(g[1].toLowerCase() === "x" ? parseInt(g.slice(2), 16) : +g.slice(1)));
const xmlAttr = (tag, a) => { const m = tag.match(new RegExp(`\\s${a}="([^"]*)"`)); return m ? xmlText(m[1]) : null; };
const siText = x => [...x.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "").matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => xmlText(m[1])).join("");
async function xlsxGrid(u8){
  const parts = await unzip(u8, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|styles\.xml|worksheets\/[^/]+\.xml)$/.test(n));
  const first = (parts["xl/workbook.xml"] || "").match(/<sheet\b[^>]*>/), rid = first ? xmlAttr(first[0], "r:id") : null;
  let path = "xl/worksheets/sheet1.xml";
  if (rid){ const rel = [...(parts["xl/_rels/workbook.xml.rels"] || "").matchAll(/<Relationship\b[^>]*>/g)].map(m => m[0]).find(t => xmlAttr(t, "Id") === rid); const tg = rel && xmlAttr(rel, "Target"); if (tg) path = tg.startsWith("/") ? tg.slice(1) : "xl/" + tg.replace(/^\.\//, ""); }
  const sheet = parts[path] || parts[Object.keys(parts).find(k => k.startsWith("xl/worksheets/")) || ""];
  if (!sheet) throw new Error("no worksheet in this file");
  const ss = [...(parts["xl/sharedStrings.xml"] || "").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m => siText(m[1]));
  const st = parts["xl/styles.xml"] || "", fmts = { ...XL_FORMATS };
  for (const m of st.matchAll(/<numFmt\b[^>]*>/g)) fmts[+xmlAttr(m[0], "numFmtId")] = xmlAttr(m[0], "formatCode");
  const cx = (st.match(/<cellXfs\b[\s\S]*?<\/cellXfs>/) || [""])[0], xfs = [...cx.matchAll(/<xf\b[^>]*>/g)].map(m => +xmlAttr(m[0], "numFmtId") || 0);
  const colOf = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const rows = [];
  for (const rm of sheet.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
    const ri = (+xmlAttr("<r" + rm[1], "r") || rows.length + 1) - 1, row = [];
    let auto = 0;
    for (const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
      const tag = "<c" + cm[1], ref = xmlAttr(tag, "r"), ci = ref ? colOf(ref) : auto, t = xmlAttr(tag, "t"), s = +xmlAttr(tag, "s") || 0, inner = cm[2] || "";
      auto = ci + 1;
      const v = (inner.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let txt = "";
      if (t === "s") txt = ss[+v] ?? "";
      else if (t === "inlineStr") txt = siText(inner);
      else if (t === "str" || t === "e") txt = t === "e" ? "" : xmlText(v || "");
      else if (t === "b") txt = v === "1" ? "TRUE" : "FALSE";
      else if (v != null) txt = numText(+v, fmts[xfs[s]]);
      row[ci] = txt;
    }
    rows[ri] = Array.from({ length: row.length }, (_, j) => row[j] ?? "");
  }
  return tidyGrid(Array.from({ length: rows.length }, (_, i) => rows[i] || []));
}
/* The file kept with the results, as base64 pieces small enough for one record each. */
const FILE_PIECE = 180000;
function b64(bytes){ let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); }
function unb64(s){ const t = atob(s), out = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i); return out; }
async function sha256(bytes){ try { return [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(x => x.toString(16).padStart(2, "0")).join(""); } catch { return ""; } }
