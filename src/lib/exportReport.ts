import type { Period, Settings } from "./billing";
import { yearlyReport } from "./report";

export async function exportExcel(periods: Period[], s: Settings, year: number) {
  const XLSX = await import("xlsx");
  const r = yearlyReport(periods, s, year);
  const wb = XLSX.utils.book_new();
  wb.Workbook = { Views: [{ RTL: true }] };
  const t = XLSX.utils.aoa_to_sheet([r.header, ...r.rows]);
  t["!cols"] = r.header.map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, t, `תקופות ${year}`);
  const sum = XLSX.utils.aoa_to_sheet([[`סיכום שנתי ${year}`], [], ...r.summary, [], ["חודשים חסרים", r.missing.join(", ") || "אין"]]);
  sum["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, sum, "סיכום");
  XLSX.writeFile(wb, `דוח-שנתי-${year}.xlsx`);
}

const esc = (v: unknown) => String(v).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

/** Opens a printable RTL report; the browser's print dialog saves it as PDF. */
export function exportPdf(periods: Period[], s: Settings, year: number) {
  const r = yearlyReport(periods, s, year);
  const table = (head: (string | number)[], rows: (string | number)[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(`<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8"><title>דוח שנתי ${year}</title>
<style>body{font-family:Arial,sans-serif;margin:24px}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:12px 0;font-size:12px}th,td{border:1px solid #999;padding:4px 6px;text-align:right}th{background:#eee}</style></head><body>
<h1>דוח שנתי ${year}</h1><h2>סיכום</h2>${table(r.summary[0]!, r.summary.slice(1))}
<p>חודשים חסרים: ${esc(r.missing.join(", ") || "אין")}</p><h2>תקופות (${r.count})</h2>${table(r.header, r.rows)}
<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
  return true;
}
