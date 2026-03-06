import { useCallback } from "react";
import {
  JobDirectTable,
  JobDirectEmptyTableRow,
  useRenderWindow,
} from "@modules/job-workspace/public/components.js";
import { TAB_IDS } from "../../constants/tabs.js";
import { getInquiryColumns } from "./columns/inquiryColumns.jsx";
import { getQuoteColumns } from "./columns/quoteColumns.jsx";
import { getJobsColumns } from "./columns/jobsColumns.jsx";
import { getPaymentColumns } from "./columns/paymentColumns.jsx";
import { getActiveJobsColumns } from "./columns/activeJobsColumns.jsx";

function getColumns(activeTab, opts) {
  switch (activeTab) {
    case TAB_IDS.INQUIRY:
      return getInquiryColumns(opts);
    case TAB_IDS.QUOTE:
      return getQuoteColumns(opts);
    case TAB_IDS.JOBS:
      return getJobsColumns(opts);
    case TAB_IDS.PAYMENT:
      return getPaymentColumns(opts);
    case TAB_IDS.ACTIVE_JOBS:
      return getActiveJobsColumns(opts);
    case TAB_IDS.URGENT_CALLS:
    case TAB_IDS.OPEN_TASKS:
      return getJobsColumns(opts);
    default:
      return [];
  }
}

export function DashboardTable({
  activeTab,
  rows = [],
  isLoading = false,
  isBatchMode = false,
  batchSelectedIds = [],
  onBatchSelectionChange,
  onOpenTaskModal,
  onDeleteInquiry,
  onViewInquiry,
  sortOrder = "desc",
  onToggleSortOrder,
}) {
  const { visibleRows, hasMore, remainingCount, showMore } = useRenderWindow(rows);

  const handleToggleSelect = useCallback(
    (rowKey) => {
      onBatchSelectionChange?.((prev) => {
        const ids = Array.isArray(prev) ? prev : [];
        return ids.includes(rowKey) ? ids.filter((x) => x !== rowKey) : [...ids, rowKey];
      });
    },
    [onBatchSelectionChange]
  );

  const colOpts = {
    isBatchMode,
    onView: (row) => onViewInquiry?.(row),
    onAddTask: (row) => onOpenTaskModal?.(row),
    onDelete: (row) => onDeleteInquiry?.(row),
    sortOrder,
    onToggleSortOrder,
  };

  const columns = getColumns(activeTab, colOpts);

  const rowCtx = {
    selectedIds: batchSelectedIds,
    onToggleSelect: handleToggleSelect,
  };

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <JobDirectTable minWidthClass="min-w-full" className="table-auto text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-2.5 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 ${col.thClass ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {isLoading ? (
            <JobDirectEmptyTableRow colSpan={columns.length} message="Loading…" />
          ) : visibleRows.length === 0 ? (
            <JobDirectEmptyTableRow
              colSpan={columns.length}
              message="No records found."
            />
          ) : (
            visibleRows.map((row, i) => (
              <tr
                key={row.id ?? i}
                className={`${i % 2 === 0 ? "bg-white" : "bg-slate-50/55"} hover:bg-slate-100/70`}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-2.5 py-1.5 align-middle text-[12px] ${col.tdClass ?? ""}`}
                  >
                    {col.render(row, rowCtx)}
                  </td>
                ))}
              </tr>
            ))
          )}
          {hasMore && (
            <tr>
              <td colSpan={columns.length} className="px-3 py-2 text-center">
                <button
                  type="button"
                  className="text-sm text-[#003882] hover:underline"
                  onClick={showMore}
                >
                  Show more ({remainingCount} remaining)
                </button>
              </td>
            </tr>
          )}
        </tbody>
      </JobDirectTable>
    </div>
  );
}
