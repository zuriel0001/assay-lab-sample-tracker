
/* ---------- v34 (22 Oct): the month's audit pack ----------
   For the lab supervisor and manager, on the Ledger: one Excel workbook or one PDF for the month chosen, made in the page from the records
   already kept: the In / Out ledger, the disposals and their witnesses, the critical samples' witness confirmations and the month's
   sign-offs, with the month check. Nothing new is stored; the file goes only where the person saves it. */
let auditBusy = "";
const auditButtons = () => `<span class="aud-pk" role="group" aria-label="Audit pack"><span class="lbl">Audit pack</span>${["xlsx", "pdf"].map(k =>
  `<button type="button" class="btn small" data-audit="${k}"${auditBusy ? " disabled" : ""}>${auditBusy === k ? "Making…" : k === "xlsx" ? "Excel" : "PDF"}</button>`).join("")}</span>`;
async function saveAudit(kind){
  const m = ledgerFilter.month || monthKey(Date.now());
  if (!canApprove() || auditBusy || !db) return;
  const dl = window.claude?.use ? await claude.use("downloads") : null;
  if (!dl){ toast("Downloads are not available in this view."); return; }
  auditBusy = kind; if (tab === "ledger") renderLedger();
  let data;
  try { const d = await auditData(m); data = kind === "pdf" ? auditPdf(d) : auditXlsx(d); }
  catch { auditBusy = ""; if (tab === "ledger") renderLedger(); toast("The audit pack could not be made. Try again."); return; }
  try { await dl.save({ filename: `audit-pack-${m}.${kind}`, data }); toast(`Audit pack ${m} saved`); }
  catch { toast("Download was not saved."); }
  finally { auditBusy = ""; if (tab === "ledger") renderLedger(); }
}
/* The month read afresh (whatever the Ledger's filters show): its movements, the stock records of the samples on hand in it, its sign-offs,
   and the witness confirmations on its critical samples (kept on each sample's record: the samples on hand marked two-person, and any
   whose movement a witness confirmed). */
async function auditData(m){
  const start = monthStart(m), end = monthEnd(m);
  const [lg, st, so] = await Promise.all([db.collection("ledger").where("month", "==", m).get(),
    db.collection("stock").where("recvAt", "<", end).where("gone", ">=", start).get(), db.doc("signoff/" + m).get()]);
  const rows = ledgerRows(lg.docs.map(d => d.data())).reverse(), stock = st.docs.map(d => d.data()).filter(x => x && x.id);
  const ids = [...new Set([...stock.filter(x => x.two).map(x => x.id), ...rows.filter(r => r.note === "Confirmed by the witness").map(r => r.sid)])], docs = [];
  await pool(ids, 6, async id => { const d = await db.doc("samples/" + skey(id)).get(); if (d.exists && d.data()?.id) docs.push(d.data()); return true; });
  const conf = [];
  for (const s of docs) for (const h of s.history || []){
    const q = h.wcf || h.wsb; if (!q || !(h.at >= start && h.at < end)) continue;
    const req = (s.history || []).find(x => x.wreq === q);
    conf.push({ at: h.at, sid: s.id, tag: tagText(s), sec: s.section || "", type: s.type || "", what: auditWhat(s, h, rows, req), by: h.put || req?.tech || "", wit: h.tech || "", ok: !!h.wcf, note: h.note || "", id: q });
  }
  conf.sort((a, b) => a.at - b.at);
  return { m, rows, rc: reconOf(m, stock, rows), signs: so.exists ? so.data().signs || [] : [], conf, disp: rows.filter(r => r.dir === "out" && r.kind === "disposed"), made: Date.now(), by: session?.name || "" };
}
/* What a confirmation was for: the storage, or a material and where it went (from its movement, or from the request). */
function auditWhat(s, h, rows, req){
  if (!h.mat) return "Storage";
  const r = rows.find(x => x.sid === s.id && x.at === h.at && x.dir === "out"), m = (s.materials || []).find(x => x.k === h.mat);
  const how = r ? DISPO[r.kind] || r.kind : ((/ to be ([^.(]+)/.exec(req?.note || "") || [])[1] || "").trim();
  return [m?.item, how ? how[0].toUpperCase() + how.slice(1) : ""].filter(Boolean).join(": ") || "Material";
}
/* The pack's tables, the same in the workbook and the PDF. */
function auditTables(d){
  const rc = d.rc, last = d.signs.at(-1), act = d.rows.filter(r => !r.reversed && r.dir !== "rev");
  const changed = last && ["opening", "ins", "outs", "closing"].some(k => last[k] !== rc[k]);
  const facts = [["On hand at the start", rc.opening], ["Received", rc.ins], ["Fully out (returned, disposed, sent on, archived)", rc.outs], ["On hand at the end", rc.closing],
    ...(rc.now != null ? [["On hand now", rc.now]] : []),
    ["Movements", `${act.filter(r => r.dir === "in").length} in, ${act.filter(r => r.dir === "out").length} out, ${d.rows.filter(r => r.dir === "rev").length} reversed`],
    ["Disposals", `${d.disp.length}${d.disp.some(r => !r.wit) ? `, ${d.disp.filter(r => !r.wit).length} without a witness` : ""}`],
    ["Witness confirmations (critical samples)", `${d.conf.filter(x => x.ok).length} confirmed${d.conf.some(x => !x.ok) ? `, ${d.conf.filter(x => !x.ok).length} sent back` : ""}`],
    ["Sign-off", last ? `Signed off by ${last.tech} on ${fmtFull(last.at)}${changed ? " (the month changed after sign-off)" : ""}` : "Not signed off"]];
  return {
    facts,
    signs: { head: ["Signed off (site time)", "By", "Role", "On hand at the start", "Received", "Fully out", "On hand at the end", "Reversals", "Note"],
      rows: d.signs.map(s => [fmtFull(s.at), s.tech, ROLE_SIGN[s.role] || ROLES[s.role] || s.role || "", s.opening, s.ins, s.outs, s.closing, s.rev || 0, s.note || ""]) },
    disp: { head: ["Date time (site)", "Sample ID", "Site sample code", "Section", "Type", "Material", "Recorded by", "Witness", "Witness confirmed in own account", "Reference", "Reversed", "Movement ID"],
      rows: d.disp.map(r => [fmtFull(r.at), r.sid, r.tag, r.sec, r.type, r.item, r.tech, r.wit || "None", r.note === "Confirmed by the witness" ? "Yes" : "", r.ref, r.reversed ? "Yes" : "", r.mid]) },
    conf: { head: ["Date time (site)", "Sample ID", "Site sample code", "Section", "Type", "What", "Recorded by", "Witness", "Outcome", "Note", "Request"],
      rows: d.conf.map(x => [fmtFull(x.at), x.sid, x.tag, x.sec, x.type, x.what, x.by, x.wit, x.ok ? "Confirmed" : "Sent back", x.note, x.id]) },
    ledger: { head: LEDGER_HEAD, rows: d.rows.map(ledgerLine) }
  };
}
const AUDIT_ORG = "ZIJIN · Assay Laboratory";
function auditXlsx(d){
  const t = auditTables(d), sheet = (name, x, widths) => ({ name, head: 1, widths, rows: [x.head, ...x.rows] });
  return xlsxBook([
    { name: "Summary", bold0: true, widths: [44, 70], rows: [[AUDIT_ORG], ["Audit pack", monthText(d.m)], ["Times", TZ() || "this device's time"], ["Made", `${fmtFull(d.made)} by ${d.by}`], [], ...t.facts] },
    sheet("Ledger", t.ledger, [18, 10, 9, 22, 18, 9, 18, 12, 18, 12, 22, 18, 18, 16, 16, 30, 30]),
    sheet("Disposals", t.disp, [18, 22, 18, 9, 18, 18, 16, 16, 14, 18, 9, 30]),
    sheet("Witness confirmations", t.conf, [18, 22, 18, 9, 18, 26, 16, 16, 11, 50, 12]),
    sheet("Sign-offs", t.signs, [18, 18, 16, 12, 10, 10, 12, 10, 36])]);
}

/* ----- A small Excel writer: one workbook of plain sheets (bold header row, frozen), stored in a zip without compression. ----- */
const xmlEsc = v => String(v ?? "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function xlsxBook(sheets){
  const X = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n', NS = "http://schemas.openxmlformats.org", col = i => { let s = ""; for (i++; i; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
  const cell = (v, r, c, st) => v == null || v === "" ? "" : typeof v === "number" && isFinite(v) ? `<c r="${col(c)}${r}"${st}><v>${v}</v></c>` : `<c r="${col(c)}${r}"${st} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
  const ws = sh => `${X}<worksheet xmlns="${NS}/spreadsheetml/2006/main">${sh.head ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="${sh.head}" topLeftCell="A${sh.head + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` : ""}<cols>${sh.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${sh.rows.map((r, ri) =>
    `<row r="${ri + 1}">${r.map((v, ci) => cell(v, ri + 1, ci, ri < (sh.head || 0) ? ' s="1"' : sh.bold0 && ci === 0 ? ' s="2"' : "")).join("")}</row>`).join("")}</sheetData></worksheet>`;
  const files = [
    ["[Content_Types].xml", `${X}<Types xmlns="${NS}/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`],
    ["_rels/.rels", `${X}<Relationships xmlns="${NS}/package/2006/relationships"><Relationship Id="rId1" Type="${NS}/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${X}<workbook xmlns="${NS}/spreadsheetml/2006/main" xmlns:r="${NS}/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${xmlEsc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("")}</sheets></workbook>`],
    ["xl/_rels/workbook.xml.rels", `${X}<Relationships xmlns="${NS}/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="${NS}/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${sheets.length + 1}" Type="${NS}/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ["xl/styles.xml", `${X}<styleSheet xmlns="${NS}/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8ECF1"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, ws(s)])];
  return zipStore(files);
}
function zipStore(files){
  const enc = new TextEncoder(), T = zipStore.t || (zipStore.t = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; }));
  const crc = b => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const d = new Date(), time = d.getHours() << 11 | d.getMinutes() << 5 | d.getSeconds() >> 1, date = (d.getFullYear() - 1980) << 9 | (d.getMonth() + 1) << 5 | d.getDate();
  const parts = [], cen = []; let off = 0;
  for (const [n, s] of files){
    const name = enc.encode(n), data = enc.encode(s), c = crc(data), h = new DataView(new ArrayBuffer(30)), e = new DataView(new ArrayBuffer(46));
    [[0, 0x04034b50, 4], [4, 20, 2], [6, 0x0800, 2], [8, 0, 2], [10, time, 2], [12, date, 2], [14, c, 4], [18, data.length, 4], [22, data.length, 4], [26, name.length, 2], [28, 0, 2]].forEach(([o, v, z]) => z === 4 ? h.setUint32(o, v, true) : h.setUint16(o, v, true));
    [[0, 0x02014b50, 4], [4, 20, 2], [6, 20, 2], [8, 0x0800, 2], [10, 0, 2], [12, time, 2], [14, date, 2], [16, c, 4], [20, data.length, 4], [24, data.length, 4], [28, name.length, 2], [42, off, 4]].forEach(([o, v, z]) => z === 4 ? e.setUint32(o, v, true) : e.setUint16(o, v, true));
    parts.push(new Uint8Array(h.buffer), name, data); cen.push(new Uint8Array(e.buffer), name); off += 30 + name.length + data.length;
  }
  const size = cen.reduce((n, x) => n + x.length, 0), end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, size, true); end.setUint32(16, off, true);
  const all = [...parts, ...cen, new Uint8Array(end.buffer)], out = new Uint8Array(all.reduce((n, x) => n + x.length, 0));
  let p = 0; for (const x of all){ out.set(x, p); p += x.length; }
  return out;
}

/* ----- A small PDF writer: A4 landscape pages of text tables in the standard Helvetica fonts (nothing embedded). ----- */
const PDF_W = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,500,722,500,500,500,334,260,334,584];
const PDF_WB = [278,333,474,556,556,889,722,238,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,333,333,584,584,584,611,975,722,722,722,722,667,611,778,722,278,556,722,611,833,722,778,667,778,722,667,611,722,667,944,667,667,611,333,278,333,584,556,333,556,611,556,611,556,333,611,611,278,278,556,278,889,611,611,611,611,389,556,333,611,556,778,556,556,500,389,280,389,584];
const PDF_MAP = { 0x20ac: 128, 0x201a: 130, 0x192: 131, 0x201e: 132, 0x2026: 133, 0x2020: 134, 0x2021: 135, 0x2c6: 136, 0x2030: 137, 0x160: 138, 0x2039: 139, 0x152: 140, 0x17d: 142,
  0x2018: 145, 0x2019: 146, 0x201c: 147, 0x201d: 148, 0x2022: 149, 0x2013: 150, 0x2014: 151, 0x2dc: 152, 0x2122: 153, 0x161: 154, 0x203a: 155, 0x153: 156, 0x17e: 158, 0x178: 159 };
/* Text in the fonts' own encoding (one byte a character); a character they do not have becomes "?". */
function pdfTxt(v){
  let o = "";
  for (const ch of String(v ?? "").replace(/−/g, "-").replace(/→/g, "->").replace(/≥/g, ">=").replace(/≤/g, "<=").replace(/\s+/g, " ")){
    const c = ch.codePointAt(0); o += String.fromCharCode(c < 32 ? 32 : c < 127 || (c >= 160 && c < 256) ? c : PDF_MAP[c] || 63);
  }
  return o;
}
const pdfWidth = (t, size, bold) => { const W = bold ? PDF_WB : PDF_W; let n = 0; for (let i = 0; i < t.length; i++){ const c = t.charCodeAt(i); n += c >= 32 && c < 127 ? W[c - 32] : c === 183 ? 278 : c === 133 || c === 151 ? 1000 : 556; } return n * size / 1000; };
function pdfWrap(t, w, size, bold, max = 3){
  const fit = x => pdfWidth(x, size, bold) <= w, lines = []; let cur = "";
  for (let wd of t.split(" ")){
    while (wd.length > 1 && !fit(wd)){ let k = wd.length - 1; while (k > 1 && !fit(wd.slice(0, k))) k--; if (cur){ lines.push(cur); cur = ""; } lines.push(wd.slice(0, k)); wd = wd.slice(k); }
    const nx = cur ? cur + " " + wd : wd;
    if (fit(nx)) cur = nx; else { lines.push(cur); cur = wd; }
  }
  lines.push(cur);
  if (lines.length <= max) return lines;
  const l = lines.slice(0, max); let last = l[max - 1]; while (last && !fit(last + "\x85")) last = last.slice(0, -1); l[max - 1] = last + "\x85";
  return l;
}
function pdfDoc(){
  const W = 842, H = 595, M = 36, pages = [], f = n => +n.toFixed(2), esc = t => t.replace(/[\\()]/g, "\\$&");
  let ops = null;
  const P = { W, H, M, y: 0, pages,
    page(){ ops = []; pages.push(ops); P.y = H - M; },
    on(i){ ops = pages[i]; },
    text(x, y, t, size = 7.5, bold = false, grey = false){ ops.push(`BT ${grey ? "0.38 g " : ""}/${bold ? "F2" : "F1"} ${size} Tf ${f(x)} ${f(y)} Td (${esc(t)}) Tj ET${grey ? " 0 g" : ""}`); },
    rect(x, y, w, h, g){ ops.push(`${g} g ${f(x)} ${f(y)} ${f(w)} ${f(h)} re f 0 g`); },
    line(x1, y1, x2, y2, g = 0.82){ ops.push(`${g} G 0.4 w ${f(x1)} ${f(y1)} m ${f(x2)} ${f(y2)} l S`); },
    room(h){ if (P.y - h < M + 16) P.page(); },
    bytes(title){
      const objs = ["<< /Type /Catalog /Pages 2 0 R >>", "", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"], kids = [];
      for (const p of pages){ const body = p.join("\n"); objs.push(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`); objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${objs.length} 0 R >>`); kids.push(objs.length); }
      objs[1] = `<< /Type /Pages /Kids [${kids.map(k => k + " 0 R").join(" ")}] /Count ${kids.length} >>`;
      const d = new Date(), two = n => String(n).padStart(2, "0");
      objs.push(`<< /Title (${esc(pdfTxt(title))}) /Producer (Assay Lab Sample Tracker) /CreationDate (D:${d.getUTCFullYear()}${two(d.getUTCMonth() + 1)}${two(d.getUTCDate())}${two(d.getUTCHours())}${two(d.getUTCMinutes())}${two(d.getUTCSeconds())}Z) >>`);
      let out = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"; const offs = [];
      objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
      const x = out.length;
      out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map(o => String(o).padStart(10, "0") + " 00000 n \n").join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R /Info ${objs.length} 0 R >>\nstartxref\n${x}\n%%EOF\n`;
      const b = new Uint8Array(out.length); for (let i = 0; i < out.length; i++) b[i] = out.charCodeAt(i) & 255;
      return b;
    } };
  return P;
}
/* A titled table that carries on over pages, its header row repeated; widths in points, 770 in all. */
function pdfTable(P, title, cols, rows){
  const size = 7.5, lh = 9, pad = 3, x0 = P.M, tw = cols.reduce((n, c) => n + c.w, 0);
  const cells = (r, bold, max) => cols.map((c, i) => pdfWrap(pdfTxt(r[i]), c.w - 2 * pad, size, bold, max)), hgt = ls => Math.max(1, ...ls.map(l => l.length)) * lh + 2 * pad;
  const draw = (ls, bold) => { let x = x0; ls.forEach((l, i) => { l.forEach((t, j) => P.text(x + pad, P.y - pad - (j + 1) * lh + 2.2, t, size, bold)); x += cols[i].w; }); };
  const hl = cells(cols.map(c => c.h), true, 2), head = () => { const h = hgt(hl); P.rect(x0, P.y - h, tw, h, 0.91); draw(hl, true); P.y -= h; };
  P.room(54); P.text(x0, P.y - 12, pdfTxt(title), 11, true); P.y -= 18;
  if (!rows.length){ P.text(x0, P.y - 9, pdfTxt("None this month."), 8, false, true); P.y -= 24; return; }
  head();
  for (const r of rows){
    const ls = cells(r, false, 3), h = hgt(ls);
    if (P.y - h < P.M + 16){ P.page(); head(); }
    draw(ls, false); P.y -= h; P.line(x0, P.y, x0 + tw, P.y);
  }
  P.y -= 18;
}
function auditPdf(d){
  const t = auditTables(d), P = pdfDoc(), x0 = P.M, title = `Audit pack: ${monthText(d.m)}`;
  P.page();
  P.text(x0, P.y - 9, pdfTxt(AUDIT_ORG), 9, false, true);
  P.text(x0, P.y - 28, pdfTxt(title), 16, true);
  P.text(x0, P.y - 42, pdfTxt(`In / out ledger, disposals and witnesses, witness confirmations on critical samples, sign-offs. Times in ${TZ() || "this device's time"}. Made ${fmtFull(d.made)} by ${d.by}.`), 8, false, true);
  P.y -= 60;
  for (const [k, v] of t.facts){ P.text(x0, P.y - 10, pdfTxt(k), 8.5, true); P.text(x0 + 260, P.y - 10, pdfTxt(v), 8.5); P.y -= 14; P.line(x0, P.y + 1, x0 + 770, P.y + 1); }
  P.y -= 14;
  const w = (h, ...ws) => h.map((x, i) => ({ h: x, w: ws[i] }));
  pdfTable(P, "Sign-offs", w(["Signed off", "By", "Role", "Start", "Received", "Out", "End", "Reversals", "Note"], 90, 100, 90, 50, 55, 50, 50, 55, 230), t.signs.rows);
  pdfTable(P, "Disposals and witnesses", w(["Date & time", "Sample", "Site code", "Type", "Material", "Recorded by", "Witness", "Own account", "Reference", "Reversed"], 92, 100, 76, 80, 90, 80, 80, 56, 66, 50),
    t.disp.rows.map(r => [r[0], r[1], r[2], r[4], r[5], r[6], r[7], r[8], r[9], r[10]]));
  pdfTable(P, "Witness confirmations on critical samples", w(["Date & time", "Sample", "Type", "What", "Recorded by", "Witness", "Outcome", "Note"], 92, 100, 80, 115, 80, 80, 55, 168),
    t.conf.rows.map(r => [r[0], r[1], r[4], r[5], r[6], r[7], r[8], r[9]]));
  pdfTable(P, "In / out ledger", w(["Date & time", "Dir.", "Sample", "Site code", "Type", "Material", "Qty", "From / to", "Lab", "Witness", "Reference · note"], 90, 34, 92, 70, 66, 66, 44, 76, 70, 60, 102),
    d.rows.map(r => [fmtFull(r.at), (r.dir === "rev" ? "REV" : r.dir.toUpperCase()) + (r.reversed ? " (reversed)" : ""), r.sid, r.tag, r.type, r.item, r.qty, r.dir === "in" ? r.from : r.dir === "rev" ? "Reversal" : DISPO[r.kind] || r.kind, r.tech, r.wit, [r.ref, r.note].filter(Boolean).join(" · ")]));
  P.pages.forEach((_, i) => { P.on(i); const n = pdfTxt(`Page ${i + 1} of ${P.pages.length}`); P.text(x0, 22, pdfTxt(`${AUDIT_ORG} · ${title}`), 7, false, true); P.text(P.W - P.M - pdfWidth(n, 7, false), 22, n, 7, false, true); });
  return P.bytes(title);
}

/* ---------- v34 (22 Oct): the daily storage to-do (lab staff) ----------
   Released samples still to put away and retained materials past their date, each with its action on the row: Store (the last location
   typed is filled in) or what the retention says (Dispose, Return, Archive, Send out). A disposal needs the second person; on a critical
   sample that person confirms it, and the storage, from their own account, as on the sample's page. On the Board the two tiles open it, and
   a one-line reminder shows at the top on the first visit of the day until it is opened or closed. A batch processed as one is one row. */
const TODO_K = ["todo", "unstored", "retention"];
let todoBusy = false;
function todoUnits(pass){
  const now = Date.now(), store = new Map(), due = new Map();
  for (const s of samples.values()){
    if (!pass(s)) continue;
    const key = unitKey(s), wait = wqOf(s) ? s.wq.wit : "";
    const left = s.stageKey === "released" ? keptMaterials(s).filter(m => !m.loc) : [];
    if (left.length || wait && s.stageKey === "released" || (s.stageKey === "released" && twoPerson(s) && shelvedAll(s))){
      const u = store.get(key) || { key, ids: [], s, items: new Set(), two: false, at: s.relAt || s.stageAt || 0, late: false, wait: "" };
      u.ids.push(s.id); left.forEach(m => u.items.add(m.item));
      u.two ||= twoPerson(s); u.late ||= !!(stageDue(s) && now > stageDue(s)); u.wait ||= wait; store.set(key, u);
    }
    for (const m of overdueMaterials(s, now)){
      const k = key + "|" + matKey(m), u = due.get(k) || { key: k, ids: [], s, mat: m, dispo: m.dispo || dispoOf(m.then), dueAt: m.dueAt, two: false, wait: "" };
      u.ids.push(s.id); u.two ||= twoPerson(s); u.wait ||= wait; due.set(k, u);
    }
  }
  for (const x of storeDue.values()){
    if (samples.has(x.id) || !pass({ section: x.sec, route: x.route })) continue;
    for (const m of x.m || []) if (m.dueAt && now > m.dueAt) due.set(x.id + "|" + matKey(m), { key: x.id + "|" + matKey(m), ids: [x.id], x, mat: m, dispo: dispoOf(m.then), dueAt: m.dueAt, two: !!x.two, wait: "" });
  }
  return { store: [...store.values()].sort((a, b) => a.at - b.at), due: [...due.values()].sort((a, b) => a.dueAt - b.dueAt) };
}
const TODO_DO = { disposed: "Dispose", returned: "Return", archived: "Archive", external: "Send out" };
const todoFind = (t, key) => t && (t.store.find(u => u.key === key) || t.due.find(u => u.key === key));
function todoNote(t){
  if (!t || !session) return "";
  const a = t.store.filter(u => !u.wait).length, b = t.due.filter(u => !u.wait).length;
  if ((!a && !b) || boardPick === "todo" || lsGet("todoSeen:" + session.u) === dayKey(Date.now())) return "";
  return `<div class="todo-note" id="tdNote"><b>To do today</b>${a ? `<span>${a} to put away</span>` : ""}${b ? `<span>${b} past retention</span>` : ""}<span class="grow"></span><button type="button" class="btn small primary" data-tdopen>Open</button><button type="button" class="pk-x" data-tdseen aria-label="Close" title="Close">×</button></div>`;
}
function todoPanel(c, t, chip){
  const show = c.k === "unstored" ? ["store"] : c.k === "retention" ? ["due"] : ["store", "due"], now = Date.now(), loc = lsGet("todoLoc");
  const st = show.includes("store") ? t.store : [], du = show.includes("due") ? t.due : [];
  const needWit = st.some(u => u.two && !u.wait) || du.some(u => !u.wait && (u.dispo === "disposed" || u.two));
  const who = u => { const s = u.s, b = u.ids.length > 1 && s && grouped(s); return `<button type="button" class="linkish mono" data-open="${esc(b ? s.batchId : u.ids[0])}">${esc(b ? s.batchId : u.ids[0])}</button>${b ? ` <span class="muted">${nS(u.ids.length)}</span>` : ""}`; };
  const typeOfU = u => esc(u.s ? u.s.type || "" : u.x.type || "");
  const waitHtml = u => `<span class="pill info">Waiting for ${esc(u.wait)} to confirm</span>`;
  const sRow = u => `<div class="todo-row" data-tdrow="${esc(u.key)}"><div class="td-what">${who(u)} · ${typeOfU(u)}${u.two ? ` <span class="haz two" title="Two-person custody">2P</span>` : ""}
      <div class="small muted">${u.items.size ? esc([...u.items].join(", ")) : "On the shelf"} · released ${esc(fmt(u.at))}${u.late ? ` <span class="pill warn">Over a day</span>` : ""}</div></div>
    <div class="td-act">${u.wait ? waitHtml(u) : `${u.items.size ? `<input class="inp td-loc" id="tdl-${esc(u.key)}" data-tdloc="${esc(u.key)}" value="${esc(todoVals.get("l" + u.key) ?? loc)}" placeholder="Location" aria-label="Storage location" autocomplete="off">` : ""}<button type="button" class="btn small primary" data-tdstore="${esc(u.key)}">${u.items.size ? "Store" : "Ask to confirm"}</button>`}</div></div>`;
  const dRow = u => { const days = Math.floor((now - u.dueAt) / 86400e3); return `<div class="todo-row" data-tdrow="${esc(u.key)}"><div class="td-what">${who(u)} · ${typeOfU(u)}${u.two ? ` <span class="haz two" title="Two-person custody">2P</span>` : ""}
      <div class="small muted">${esc(u.mat.item || "Material")}${u.mat.loc ? ` at ${esc(u.mat.loc)}` : ""} · kept until ${esc(fmtDate(u.dueAt))} <span class="pill bad">${days > 0 ? `${days} d over` : "Due"}</span></div></div>
    <div class="td-act">${u.wait ? waitHtml(u) : `${u.dispo === "external" ? `<input class="inp td-ref" id="tdr-${esc(u.key)}" data-tdref="${esc(u.key)}" value="${esc(todoVals.get("r" + u.key) || "")}" placeholder="External lab and waybill" aria-label="External lab and waybill" autocomplete="off">` : ""}<button type="button" class="btn small${u.dispo === "disposed" ? " primary" : ""}" data-tddue="${esc(u.key)}">${TODO_DO[u.dispo] || "Dispose"}</button>`}</div></div>`; };
  const sec = (id, label, list, row) => `<div class="todo-sec" id="${id}"><div class="todo-h">${label} <span class="pill">${list.length}</span></div>${list.length ? `<div class="todo-list">${list.slice(0, 60).map(row).join("")}</div>${list.length > 60 ? `<div class="small muted">+${list.length - 60} more on the Storage tab</div>` : ""}` : `<div class="small muted">Nothing</div>`}</div>`;
  return `<div class="panel pick-list stack todo" id="bdPick">
    <div class="row todo-top">${chip({ ...c, n: st.length + du.length, link: c.k === "retention" ? c.link : null })}${needWit ? `<span class="grow"></span><label class="td-wit"><span>Witness</span>${witSel()}</label>` : ""}</div>
    ${show.includes("store") ? sec("tdStore", "To put away", st, sRow) : ""}${show.includes("due") ? sec("tdDue", "Past retention", du, dRow) : ""}</div>`;
}
/* The second person and what is typed on the rows, kept while the board redraws. */
let todoWit = "";
const todoVals = new Map();
const witSel = () => `<select id="tdWit" aria-label="Witness"><option value="">Choose…</option>${(cfg.users || []).filter(x => x.u !== session?.u && LAB_ROLES.includes(x.role)).map(x => `<option value="${esc(x.name)}"${x.name === todoWit ? " selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
function bindTodo(v, t){
  if (!t) return;
  const seen = () => lsSet("todoSeen:" + session.u, dayKey(Date.now()));
  v.querySelector("[data-tdopen]")?.addEventListener("click", () => { seen(); boardPick = "todo"; renderBoard(); });
  v.querySelector("[data-tdseen]")?.addEventListener("click", () => { seen(); renderBoard(); });
  $("#tdWit", v)?.addEventListener("change", e => { todoWit = e.target.value; });
  v.querySelectorAll("[data-tdstore]").forEach(b => b.onclick = () => { const u = todoFind(t, b.dataset.tdstore); if (u) todoStore(u, (v.querySelector(`[data-tdloc="${CSS.escape(u.key)}"]`)?.value || "").trim()); });
  v.querySelectorAll("[data-tddue]").forEach(b => b.onclick = () => { const u = todoFind(t, b.dataset.tddue); if (u) todoOut(u, (v.querySelector(`[data-tdref="${CSS.escape(u.key)}"]`)?.value || "").trim()); });
  v.querySelectorAll("[data-tdloc],[data-tdref]").forEach(i => i.addEventListener("input", () => todoVals.set((i.dataset.tdloc != null ? "l" + i.dataset.tdloc : "r" + i.dataset.tdref), i.value)));
  v.querySelectorAll("[data-tdloc],[data-tdref]").forEach(i => i.addEventListener("keydown", e => { if (e.key === "Enter"){ e.preventDefault(); i.closest(".todo-row")?.querySelector("[data-tdstore],[data-tddue]")?.click(); } }));
  if (todoBusy) v.querySelectorAll("#bdPick button, #bdPick input, #bdPick select").forEach(b => b.disabled = true);
}
async function todoRun(ids, fn){
  if (todoBusy || !canEdit() || !ids.length) return 0;
  todoBusy = true; document.querySelectorAll("#bdPick button, #bdPick input, #bdPick select").forEach(b => b.disabled = true);
  try { return await pool(ids, 4, id => sampleWrite(id, fn)); }
  finally { todoBusy = false; if (tab === "board") renderBoard(); }
}
const todoWho = u => u.ids.length > 1 && u.s && grouped(u.s) ? `Batch ${u.s.batchId}` : u.ids[0];
const todoSaid = (u, ok, done) => toast(ok === u.ids.length ? `${todoWho(u)}: ${done}` : ok ? `${todoWho(u)}: ${ok} of ${u.ids.length} done; the others changed meanwhile` : `Nothing was recorded: ${todoWho(u)} changed meanwhile. Open it to check.`);
function witUser(what){
  const w = userByName(val("#tdWit"));
  if (!w){ toast(`Two-person custody: choose the witness who confirms the ${what}.`); $("#tdWit")?.focus(); return null; }
  if (w.u === session.u){ toast("The witness must be someone other than you."); return null; }
  return w;
}
/* Every material still to put away goes to the one location; on a critical sample the witness is then asked to confirm the storage. */
function storeAllUpd(s, loc, w, id, bref){
  if (s.stageKey !== "released" || wqOf(s)) return null;
  let cur = s; const upd = {};
  const add = r => { if (r){ Object.assign(upd, r.upd); cur = { ...cur, ...r.upd }; } };
  for (const m of keptMaterials(s).filter(m => !m.loc)) add(matUpd(cur, m.k, "store", loc, "", bref));
  if (w) add(askStoreUpd(cur, w, id, bref));
  return Object.keys(upd).length ? { upd } : null;
}
async function todoStore(u, loc){
  if (u.items.size && !loc){ toast("Type the storage location first."); document.querySelector(`[data-tdloc="${CSS.escape(u.key)}"]`)?.focus(); return; }
  const w = u.two ? witUser("storage") : null; if (u.two && !w) return;
  if (loc){ lsSet("todoLoc", loc); todoVals.clear(); }
  const id = wqId(Date.now()), bref = u.s && grouped(u.s) ? u.s.batchId : "";
  const ok = await todoRun(u.ids, s => storeAllUpd(s, loc, w, id, bref));
  todoSaid(u, ok, `${u.items.size ? `stored at ${loc}` : "storage"}${w ? `. Asked ${w.name} to confirm` : ""}`);
}
/* What the retention says for the material: the same rules as on the sample's page (doMaterial). */
async function todoOut(u, ref){
  const what = u.dispo, bref = u.s && grouped(u.s) ? u.s.batchId : "", mk = matKey(u.mat), slot = s => keptMaterials(s).find(m => matKey(m) === mk)?.k;
  if (what === "external" && !ref){ toast("Type the external lab and waybill number first."); document.querySelector(`[data-tdref="${CSS.escape(u.key)}"]`)?.focus(); return; }
  if (u.two && what === "disposed"){
    const w = witUser("disposal"); if (!w) return;
    const id = wqId(Date.now());
    todoSaid(u, await todoRun(u.ids, s => slot(s) ? askOutUpd(s, slot(s), what, ref, w, id, bref) : null), `asked ${w.name} to confirm the disposal`);
    return;
  }
  const wit = what === "disposed" ? disposalWitness("#tdWit") : u.two ? needWitness({ two: true }, "#tdWit") : ""; if (wit === null) return;
  todoSaid(u, await todoRun(u.ids, s => slot(s) && !wqOf(s) ? matUpd(s, slot(s), what, ref, wit, bref) : null), `${(u.mat.item || "material").toLowerCase()} ${DISPO[what].toLowerCase()}`);
}
