import { useEffect, useMemo, useState } from "react";
import { toText } from "@shared/utils/formatters.js";

const TYPE_STYLES = {
  "landing page": "bg-emerald-100 text-emerald-800",
  email: "bg-orange-100 text-orange-800",
  "form fillout": "bg-cyan-100 text-cyan-800",
};

const STATUS_STYLES = {
  sent: "bg-emerald-50 text-emerald-700",
  received: "bg-sky-50 text-sky-700",
};

function formatLogDateTime(value) {
  const text = toText(value);
  if (!text) return "-";

  let date = null;
  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      date = new Date(asMs);
    }
  } else {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) {
      date = parsed;
    }
  }

  if (!date || Number.isNaN(date.getTime())) return "-";

  const day = String(date.getDate());
  const month = String(date.getMonth() + 1);
  const year = String(date.getFullYear());
  const hours24 = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const suffix = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${day}/${month}/${year} ${hours12}:${minutes} ${suffix}`;
}

function normalizeLogHtml(details) {
  return toText(details)
    .replace(/`/g, "")
    .replace(/{{TRACKING}}/gi, "")
    .replace(/{{UNSUB}}/gi, "");
}

function sanitizeLogHtml(details) {
  return normalizeLogHtml(details)
    .replace(/<!DOCTYPE[^>]*>/gi, "")
    .replace(/<\/?(html|head|body|meta|title|style|script|iframe|object|embed|link)[^>]*>/gi, "")
    .replace(/<img[^>]*>/gi, "")
    .replace(/\son\w+=(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(href|src)=("|')\s*javascript:[^"']*\2/gi, ' $1="#"');
}

function getTypeBadgeClass(type) {
  return TYPE_STYLES[toText(type).toLowerCase()] || "bg-slate-100 text-slate-700";
}

function getStatusBadgeClass(status) {
  return STATUS_STYLES[toText(status).toLowerCase()] || "bg-slate-100 text-slate-700";
}

export function ContactLogsPanel({
  title = "Contact Logs",
  unavailableMessage = "Contact logs are available when the job has a linked contact context.",
  hasContactContext = false,
  isLoading = false,
  errorMessage = "",
  logs = [],
  panelClassName = "",
}) {
  const [expandedLogId, setExpandedLogId] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const totalLogs = Array.isArray(logs) ? logs.length : 0;
  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize) || 1);

  const pagedLogs = useMemo(() => {
    const list = Array.isArray(logs) ? logs : [];
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  }, [logs, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, totalLogs]);

  useEffect(() => {
    if (page <= totalPages) return;
    setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!pagedLogs.length) {
      setExpandedLogId(null);
      return;
    }
    const hasExpandedOnPage = pagedLogs.some((item) => toText(item?.id) === expandedLogId);
    if (expandedLogId && !hasExpandedOnPage) {
      setExpandedLogId(null);
    }
  }, [expandedLogId, pagedLogs]);

  const rangeStart = totalLogs ? (page - 1) * pageSize + 1 : 0;
  const rangeEnd = totalLogs ? Math.min(totalLogs, page * pageSize) : 0;

  return (
    <section className={`flex min-h-[420px] flex-col rounded-[4px] border border-[#003882] bg-white ${panelClassName}`}>
      <div className="rounded-t-[4px] border-b border-[#003882] bg-[#003882] px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-white">{title}</div>
      </div>

      {!hasContactContext ? (
        <div className="min-h-0 flex-1 p-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            {unavailableMessage}
          </div>
        </div>
      ) : isLoading ? (
        <div className="min-h-0 flex-1 p-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            Loading contact logs...
          </div>
        </div>
      ) : errorMessage ? (
        <div className="min-h-0 flex-1 p-3">
          <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
            {errorMessage}
          </div>
        </div>
      ) : !totalLogs ? (
        <div className="min-h-0 flex-1 p-3">
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No contact logs found.
          </div>
        </div>
      ) : (
        <>
          <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2">
            <div className="grid grid-cols-12 gap-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <div className="col-span-3">Time</div>
              <div className="col-span-2">Type</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-4">Subject</div>
              <div className="col-span-1" />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {pagedLogs.map((log, index) => {
              const logId = toText(log?.id) || `contact-log-${index}`;
              const isExpanded = expandedLogId === logId;
              const detailsHtml = sanitizeLogHtml(log?.details);
              const hasHtml = /<[^>]+>/.test(detailsHtml);

              return (
                <div key={logId} className="border-b border-slate-200 last:border-b-0">
                  <button
                    type="button"
                    className="grid w-full grid-cols-12 items-center gap-3 px-3 py-3 text-left transition hover:bg-slate-50"
                    onClick={() =>
                      setExpandedLogId((previous) => (previous === logId ? "" : logId))
                    }
                    aria-expanded={isExpanded}
                  >
                    <div className="col-span-3 text-sm font-semibold text-slate-700">
                      {formatLogDateTime(log?.created_at)}
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${getTypeBadgeClass(log?.type)}`}
                      >
                        {toText(log?.type) || "-"}
                      </span>
                    </div>
                    <div className="col-span-2">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusBadgeClass(log?.status)}`}
                      >
                        {toText(log?.status) || "-"}
                        {toText(log?.status).toLowerCase() === "sent" ? (
                          <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                            <path
                              d="m3.5 8.5 2.6 2.6L12.5 4.7"
                              stroke="currentColor"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        ) : null}
                      </span>
                    </div>
                    <div className="col-span-4 truncate text-sm font-semibold text-slate-800">
                      {toText(log?.subject) || "-"}
                    </div>
                    <div className="col-span-1 flex justify-end text-slate-400">
                      <svg
                        viewBox="0 0 20 20"
                        width="16"
                        height="16"
                        fill="none"
                        aria-hidden="true"
                        className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
                      >
                        <path
                          d="m5 7 5 6 5-6"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </button>

                  {isExpanded ? (
                    <div className="bg-slate-50/70 px-3 pb-3">
                      <div className="rounded border border-slate-200 bg-white px-4 py-4">
                        <div className="text-[24px] font-medium tracking-tight text-[#0A4A9E]">
                          {toText(log?.type) || "Log"} Details
                        </div>
                        <div className="mt-3 border-t border-slate-200 pt-3">
                          {hasHtml ? (
                            <div
                              className="max-h-[420px] overflow-auto text-sm leading-6 text-slate-700 [&_a]:text-[#0A4A9E] [&_a]:underline [&_b]:font-semibold [&_br]:leading-6 [&_strong]:font-semibold [&_table]:w-full"
                              dangerouslySetInnerHTML={{ __html: detailsHtml }}
                            />
                          ) : (
                            <div className="whitespace-pre-wrap text-sm leading-6 text-slate-700">
                              {normalizeLogHtml(log?.details) || "No details available."}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-3 py-3 text-sm text-slate-600">
            <div>
              Results {rangeStart}-{rangeEnd} of {totalLogs}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage((previous) => Math.max(1, previous - 1))}
                  disabled={page <= 1}
                  aria-label="Previous page"
                >
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="m12.5 5-5 5 5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <div>
                  Page {page} of {totalPages}
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded border border-slate-300 text-slate-500 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  onClick={() => setPage((previous) => Math.min(totalPages, previous + 1))}
                  disabled={page >= totalPages}
                  aria-label="Next page"
                >
                  <svg viewBox="0 0 20 20" width="14" height="14" fill="none" aria-hidden="true">
                    <path
                      d="m7.5 5 5 5-5 5"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <label className="flex items-center gap-2">
                <span>Records Per Page</span>
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value) || 50)}
                  className="h-8 rounded border border-slate-300 bg-white px-2.5 text-sm text-slate-700 outline-none focus:border-slate-400"
                >
                  {[25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
