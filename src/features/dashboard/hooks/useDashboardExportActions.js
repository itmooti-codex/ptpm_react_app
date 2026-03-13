import { useCallback } from "react";
import {
  getTableExportSchema,
  toCsvBlob,
  downloadBlobFile,
  getLocalDateTag,
  escapeHtml,
} from "../utils/dashboardExport.js";

export function useDashboardExportActions({ activeTab, rows, serviceProviders, showError }) {
  const handlePrintCurrentTable = useCallback(() => {
    const schema = getTableExportSchema(activeTab);
    const headers = schema.map(([label]) => label);
    const dataRows = rows.map((row) => schema.map(([, getter]) => getter(row)));
    const popup = window.open(
      "",
      "_blank",
      "width=1080,height=720,scrollbars=yes,resizable=yes"
    );
    if (!popup) {
      showError("Popup blocked", "Please allow popups to print the current table.");
      return;
    }
    const tableHead = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
    const tableBody = dataRows
      .map(
        (cells) =>
          `<tr>${cells.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`
      )
      .join("");
    popup.document.write(`
      <html>
        <head>
          <title>Dashboard List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 18px; color: #1f2937; }
            h1 { font-size: 16px; margin: 0 0 12px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #d1d5db; padding: 6px 8px; text-align: left; vertical-align: top; }
            th { background: #f3f4f6; }
          </style>
        </head>
        <body>
          <h1>Dashboard List (${escapeHtml(activeTab)})</h1>
          <table>
            <thead><tr>${tableHead}</tr></thead>
            <tbody>${tableBody}</tbody>
          </table>
        </body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  }, [activeTab, rows, showError]);

  const handleExportCurrentTable = useCallback(() => {
    const schema = getTableExportSchema(activeTab);
    const headers = schema.map(([label]) => label);
    const dataRows = rows.map((row) => schema.map(([, getter]) => getter(row)));
    const blob = toCsvBlob(headers, dataRows);
    const dateTag = getLocalDateTag();
    downloadBlobFile(blob, `ecoaccess-report-${activeTab}-${dateTag}.csv`);
  }, [activeTab, rows]);

  const handleExportServiceProviders = useCallback(() => {
    const headers = ["ID", "Service Provider"];
    const dataRows = (serviceProviders || []).map((item) => [item.id || "", item.name || ""]);
    const blob = toCsvBlob(headers, dataRows);
    const dateTag = getLocalDateTag();
    downloadBlobFile(blob, `service-provider-list-${dateTag}.csv`);
  }, [serviceProviders]);

  return {
    handlePrintCurrentTable,
    handleExportCurrentTable,
    handleExportServiceProviders,
  };
}
