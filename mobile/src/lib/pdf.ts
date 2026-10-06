// PDF roster export, ported from the web app (index.html, "export" section,
// drawPdfMonth). The web app draws the page with jsPDF; here the same page is
// built as a self-contained HTML document and printed to PDF with expo-print.
// Layout numbers are the web's jsPDF coordinates in points on an A4 landscape
// page; u() turns them into page-relative CSS lengths.
//
// Same content as the web PDF: one page per month, shifts and leave only
// (events, notes and birthdays are not part of the roster export).
import {
  EXCESS_ID, EXCESS_TYPE, LEAVE_KINDS, MONTHS, OVERTIME_ID, OVERTIME_TYPE,
  buildMonthCells, effectiveHours, entryExcessHours, entryOTHours, fmtHours, ymd,
  type ShiftType, type Snapshot,
} from "./model.ts";

/** A4 landscape in points (72 per inch), as used by the web's jsPDF page. */
export const PDF_PAGE = { width: 842, height: 595 } as const;

export type PdfData = Pick<Snapshot, "types" | "shifts" | "leave">;

type PdfEntry = {
  name: string; detail: string; color: string; typeId: string; hours: number;
  work?: boolean; ex?: number; ot?: number;
};
type TypesById = { [id: string]: ShiftType };

const COMBO_TYPES: { [id: string]: ShiftType } = { [OVERTIME_ID]: OVERTIME_TYPE, [EXCESS_ID]: EXCESS_TYPE };

const INK = "rgb(20,24,31)";
const DIM = "rgb(107,113,128)";
const LINE = "rgb(218,220,225)";
const NAVY = "rgb(31,58,95)";
const WEEKDAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [120, 120, 120];
}
// Tint a colour toward white (amt 0–1 = how much of the colour is kept)
function tint(rgb: [number, number, number], amt: number): string {
  const c = rgb.map((v) => Math.round(255 - (255 - v) * amt));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
const rgbStr = (rgb: [number, number, number]) => `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
const n = (v: number) => Math.round(v * 100) / 100;
// Lengths are given in the web PDF's points and emitted as a share of the page
// width (vw). expo-print lays the page out at a different CSS-px-to-point ratio
// on iOS (1:1) and Android/web (96 dpi), so a page-relative unit keeps the
// layout identical on every platform.
const u = (pt: number) => `${Math.round((pt / PDF_PAGE.width) * 100 * 10000) / 10000}vw`;

function dayEntries(data: PdfData, typesById: TypesById, key: string): PdfEntry[] {
  const out: PdfEntry[] = [];
  (data.shifts[key] || []).forEach((s) => {
    const t = typesById[s.typeId];
    if (!t) return;
    const comboT = COMBO_TYPES[s.typeId];
    const h = effectiveHours(s, typesById);
    if (comboT) {
      const bt = s.baseTypeId ? typesById[s.baseTypeId] : undefined;
      const split = s.typeId === OVERTIME_ID && s.excessHours > 0;
      const detail = split
        ? "EX " + fmtHours(entryExcessHours(s)) + "h + OT " + fmtHours(entryOTHours(s)) + "h"
        : (comboT === EXCESS_TYPE ? "Excess" : "Overtime") + (h ? " · " + fmtHours(h) + "h" : "");
      let exH = entryExcessHours(s), otH = entryOTHours(s);
      if (!exH && !otH) { if (s.typeId === EXCESS_ID) exH = h; else otH = h; }
      out.push({ name: bt ? bt.name : comboT.name, detail, color: comboT.color, typeId: s.typeId, hours: h, work: true, ex: exH, ot: otH });
    } else if (t.kind === "personal") {
      out.push({ name: t.name, detail: t.allDay || !t.time ? "All day" : t.time, color: t.color, typeId: t.id, hours: 0 });
    } else {
      const times = t.startTime && t.endTime ? t.startTime + "–" + t.endTime : "";
      out.push({ name: t.name, detail: [times, h ? fmtHours(h) + "h" : ""].filter(Boolean).join(" · "), color: t.color, typeId: t.id, hours: h, work: true });
    }
  });
  (data.leave[key] || []).forEach((l) => {
    const def = LEAVE_KINDS[l.kind];
    if (!def) return;
    out.push({ name: def.label, detail: "All day", color: def.color, typeId: "leave_" + l.kind, hours: 0 });
  });
  return out;
}

function monthPage(data: PdfData, typesById: TypesById, monthDate: Date, today: Date): string {
  const W = PDF_PAGE.width, H = PDF_PAGE.height, margin = 34;
  const monthLabel = MONTHS[monthDate.getMonth()] + " " + monthDate.getFullYear();
  const cells = buildMonthCells(monthDate);
  const rows = cells.length / 7;

  // month totals for the header and legend
  const totals: { [id: string]: { name: string; color: string; count: number; hours: number } } = {};
  const order: string[] = [];
  let hours = 0, shifts = 0;
  const add = (id: string, name: string, color: string, hrs: number) => {
    if (!totals[id]) { totals[id] = { name, color, count: 0, hours: 0 }; order.push(id); }
    totals[id].count++; totals[id].hours += hrs || 0;
  };
  cells.forEach((cell) => {
    if (!cell.inMonth) return;
    dayEntries(data, typesById, ymd(cell.date)).forEach((e) => {
      if (COMBO_TYPES[e.typeId]) {
        // excess and overtime counted separately, so a split shift adds to both
        if (e.ex) add(EXCESS_ID, "Excess", "#F7B3CE", e.ex);
        if (e.ot) add(OVERTIME_ID, "Overtime", "#F0679E", e.ot);
      } else add(e.typeId, e.name, e.color, e.hours);
      if (e.work) { hours += e.hours || 0; if (!COMBO_TYPES[e.typeId]) shifts++; }
    });
  });

  const summary = [shifts + (shifts === 1 ? " shift" : " shifts"), fmtHours(hours) + " hours"];
  if (totals[OVERTIME_ID]) summary.push(fmtHours(totals[OVERTIME_ID].hours) + "h overtime");
  if (totals[EXCESS_ID]) summary.push(fmtHours(totals[EXCESS_ID].hours) + "h excess");

  const gridLeft = margin, gridW = W - margin * 2, colW = gridW / 7;
  const headY = margin + 58;
  const legendH = order.length ? 22 : 0;
  const footerH = 20;
  const gridTop = headY + 8;
  const gridBottom = H - margin - footerH - legendH;
  const rowH = (gridBottom - gridTop) / rows;
  const todayKey = ymd(today);

  const parts: string[] = [];
  // header (jsPDF y is the text baseline; boxes below are positioned by their top)
  parts.push(`<div class="title" style="left:${u(margin)};top:${u(n(margin + 18 - 17))}">${esc(monthLabel)}</div>`);
  parts.push(`<div class="summary" style="left:${u(margin)};top:${u(n(margin + 34 - 7.5))}">${summary.map(esc).join("&nbsp;&nbsp;&nbsp;·&nbsp;&nbsp;&nbsp;")}</div>`);
  parts.push(`<div class="brand" style="right:${u(margin)};top:${u(n(margin + 15.5 - 9))}">Roster Board</div>`);

  // weekday header
  WEEKDAYS.forEach((w, i) => {
    parts.push(`<div class="wd" style="left:${u(n(gridLeft + i * colW))};width:${u(n(colW))};top:${u(n(headY - 6))}">${w}</div>`);
  });

  // grid: cells (out-of-month washed out), lines, outer rounded frame
  parts.push(`<div class="grid" style="left:${u(gridLeft)};top:${u(n(gridTop))};width:${u(n(gridW))};height:${u(n(gridBottom - gridTop))}">`);
  cells.forEach((cell, idx) => {
    const row = Math.floor(idx / 7), col = idx % 7;
    const x = col * colW, y = row * rowH;
    const key = ymd(cell.date);
    const borders = (col ? `border-left:${u(0.6)} solid ${LINE};` : "") + (row ? `border-top:${u(0.6)} solid ${LINE};` : "");
    const inner: string[] = [];
    if (!cell.inMonth) {
      inner.push(`<div class="dn out">${cell.date.getDate()}</div>`);
    } else {
      if (key === todayKey) inner.push(`<div class="today">${cell.date.getDate()}</div>`);
      else inner.push(`<div class="dn">${cell.date.getDate()}</div>`);

      const entries = dayEntries(data, typesById, key);
      const pad = 5, blockH = 19, gap = 3, top = 20;
      const room = Math.max(1, Math.floor((rowH - 22 + gap) / (blockH + gap)));
      const shown = entries.length > room ? entries.slice(0, room - 1) : entries;
      shown.forEach((e, i) => {
        const rgb = hexToRgb(e.color);
        inner.push(
          `<div class="blk" style="left:${u(pad)};right:${u(pad)};top:${u(n(top + i * (blockH + gap)))};background:${tint(rgb, 0.16)}">` +
          `<div class="bar" style="background:${rgbStr(rgb)}"></div>` +
          `<div class="bn">${esc(e.name)}</div>` +
          (e.detail ? `<div class="bd">${esc(e.detail)}</div>` : "") +
          `</div>`,
        );
      });
      if (entries.length > shown.length) {
        inner.push(`<div class="more" style="left:${u(pad + 2)};top:${u(n(top + shown.length * (blockH + gap) + 8 - 5))}">+${entries.length - shown.length} more</div>`);
      }
    }
    parts.push(
      `<div class="cell${cell.inMonth ? "" : " oom"}" style="left:${u(n(x))};top:${u(n(y))};width:${u(n(colW))};height:${u(n(rowH))};${borders}">` +
      inner.join("") + `</div>`,
    );
  });
  parts.push(`</div>`);

  // legend: each type used this month with its count and hours
  if (order.length) {
    const items = order.map((id) => {
      const t = totals[id];
      const label = t.name + "  " + t.count + (t.hours ? " · " + fmtHours(t.hours) + "h" : "");
      return `<span class="li"><span class="sw" style="background:${rgbStr(hexToRgb(t.color))}"></span>${esc(label).replace(/ {2}/g, "&nbsp;&nbsp;")}</span>`;
    });
    parts.push(`<div class="legend" style="left:${u(gridLeft)};top:${u(n(gridBottom + 16 - 7.5))};width:${u(n(gridW))}">${items.join("")}</div>`);
  }

  // footer
  const fy = H - margin + 4 - 6;
  parts.push(`<div class="foot" style="left:${u(gridLeft)};top:${u(n(fy))}">Printed ${esc(today.toLocaleDateString())}</div>`);
  parts.push(`<div class="foot" style="right:${u(margin)};top:${u(n(fy))}">Made with Roster Board&nbsp;&nbsp;·&nbsp;&nbsp;rosterboard.net</div>`);

  return `<section class="page">${parts.join("\n")}</section>`;
}

const CSS = `
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: Helvetica, "Helvetica Neue", Arial, sans-serif; color: ${INK}; }
.page { position: relative; width: 100vw; height: ${u(PDF_PAGE.height - 1)}; overflow: hidden; page-break-after: always; break-after: page; }
.page:last-child { page-break-after: auto; break-after: auto; }
.page > div { position: absolute; white-space: nowrap; }
.title { font-size: ${u(22)}; font-weight: 700; line-height: ${u(22)}; color: ${INK}; }
.summary { font-size: ${u(9)}; line-height: ${u(9)}; color: ${DIM}; }
.brand { font-size: ${u(11)}; font-weight: 700; line-height: ${u(11)}; color: ${NAVY}; }
.wd { font-size: ${u(7.5)}; line-height: ${u(7.5)}; font-weight: 700; color: ${DIM}; text-align: center; letter-spacing: ${u(0.6)}; }
.grid { border: ${u(0.8)} solid rgb(190,194,202); border-radius: ${u(4)}; overflow: hidden; }
.cell { position: absolute; }
.cell.oom { background: rgb(246,246,248); }
.dn { position: absolute; right: ${u(7)}; top: ${u(6)}; font-size: ${u(9)}; line-height: ${u(9)}; font-weight: 700; color: ${INK}; }
.dn.out { color: rgb(185,189,197); }
.today { position: absolute; right: ${u(3.5)}; top: ${u(2.5)}; width: ${u(15)}; height: ${u(15)}; border-radius: ${u(7.5)}; background: ${NAVY}; color: #fff;
  font-size: ${u(9)}; line-height: ${u(15)}; font-weight: 700; text-align: center; }
.blk { position: absolute; height: ${u(19)}; border-radius: ${u(3)}; overflow: hidden; padding-left: ${u(7)}; padding-right: ${u(3)}; }
.bar { position: absolute; left: 0; top: 0; bottom: 0; width: ${u(3)}; border-radius: ${u(1.5)}; }
.bn, .bd { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bn { font-size: ${u(7)}; line-height: ${u(7)}; font-weight: 700; color: ${INK}; margin-top: ${u(2.5)}; }
.bd { font-size: ${u(6)}; line-height: ${u(6)}; color: ${DIM}; margin-top: ${u(2)}; }
.more { position: absolute; font-size: ${u(6.5)}; line-height: ${u(6.5)}; font-weight: 700; color: ${DIM}; }
.legend { height: ${u(10)}; overflow: hidden; display: flex; flex-wrap: wrap; font-size: ${u(7.5)}; line-height: ${u(10)}; color: ${INK}; }
.li { display: inline-flex; align-items: center; margin-right: ${u(14)}; white-space: nowrap; }
.sw { display: inline-block; width: ${u(8)}; height: ${u(8)}; border-radius: ${u(2)}; margin-right: ${u(4)}; }
.foot { font-size: ${u(7)}; line-height: ${u(7)}; color: rgb(150,155,165); }
`;

/** True when there's nothing at all to put in a roster (same check as the web). */
export function nothingToExport(data: PdfData): boolean {
  return !data.types.length && !Object.keys(data.shifts).length;
}

/** File name the web app gives the same export. */
export function rosterFileName(months: Date[]): string {
  if (months.length > 1) return "roster-" + months[0].getFullYear() + ".pdf";
  const m = months[0];
  return "roster-" + m.getFullYear() + "-" + String(m.getMonth() + 1).padStart(2, "0") + ".pdf";
}

/**
 * Self-contained HTML for the roster PDF: one A4 landscape page per month.
 * `months` are any dates inside the months to print (one month, or all 12 of a year).
 */
export function buildRosterHtml(data: PdfData, months: Date[], today: Date = new Date()): string {
  const typesById: TypesById = { [OVERTIME_ID]: OVERTIME_TYPE, [EXCESS_ID]: EXCESS_TYPE };
  data.types.forEach((t) => { typesById[t.id] = t; });
  const pages = months.map((m) => monthPage(data, typesById, new Date(m.getFullYear(), m.getMonth(), 1), today));
  const title = esc(rosterFileName(months).replace(/\.pdf$/, ""));
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>${CSS}</style>
</head><body>
${pages.join("\n")}
</body></html>`;
}
