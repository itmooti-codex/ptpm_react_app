import { TAB_IDS } from "../constants/tabs.js";
import { getServicePersonName } from "../components/table/columns/sharedCells.jsx";

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function normalizeMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

export function getTableExportSchema(activeTab) {
  if (activeTab === TAB_IDS.INQUIRY) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Job Date", (r) => r.date || ""],
      ["Account Name", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Job Address", (r) => r.address || ""],
      ["Source", (r) => r.source || ""],
      ["Status", (r) => r.status || ""],
      ["Service Person", (r) => getServicePersonName(r)],
    ];
  }
  if (activeTab === TAB_IDS.QUOTE) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Job Date", (r) => r.date || ""],
      ["Account Name", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Job Address", (r) => r.address || ""],
      ["Quote #", (r) => r.quoteNumber || ""],
      ["Quote Amount", (r) => normalizeMoney(r.amount)],
      ["Status", (r) => r.status || ""],
      ["Service Person", (r) => getServicePersonName(r)],
    ];
  }
  if (activeTab === TAB_IDS.JOBS) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Job Date", (r) => r.date || ""],
      ["Account Name", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Job Address", (r) => r.address || ""],
      ["Job #", (r) => r.jobNumber || ""],
      ["Status", (r) => r.status || ""],
      ["Service Person", (r) => getServicePersonName(r)],
    ];
  }
  if (activeTab === TAB_IDS.PAYMENT) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Job Date", (r) => r.date || ""],
      ["Account Name", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Job Address", (r) => r.address || ""],
      ["Invoice #", (r) => r.invoiceNumber || ""],
      ["Amount", (r) => normalizeMoney(r.amount)],
      ["Paid", (r) => normalizeMoney(r.paid)],
      ["Balance", (r) => normalizeMoney(r.balance)],
      ["Status", (r) => r.status || ""],
      ["Service Person", (r) => getServicePersonName(r)],
    ];
  }
  if (activeTab === TAB_IDS.ACTIVE_JOBS) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Scheduled", (r) => r.scheduledDate || ""],
      ["Account Name", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Job Address", (r) => r.address || ""],
      ["Status", (r) => r.status || ""],
      ["Service Person", (r) => getServicePersonName(r)],
      ["Invoice #", (r) => r.invoiceNumber || ""],
    ];
  }
  return [
    ["ID", (r) => r.uid || ""],
    ["Type", (r) => (r.recordType === "inquiry" ? "Inquiry" : "Job")],
    ["Date Added", (r) => r.date || ""],
    ["Account Name", (r) => r.clientName || ""],
    ["Phone", (r) => r.phone || ""],
    ["Email", (r) => r.email || ""],
    ["Job Address", (r) => r.address || ""],
    ["Status", (r) => r.status || ""],
    ["Service Person", (r) => getServicePersonName(r)],
  ];
}

export function toCsvBlob(headers, rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
}

export function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function getLocalDateTag(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
