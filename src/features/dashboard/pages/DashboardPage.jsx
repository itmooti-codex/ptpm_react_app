import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { getFriendlyServiceMessage } from "../../../shared/utils/userFacingErrors.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { useDashboardBootstrap } from "../hooks/useDashboardBootstrap.js";
import { useDashboardFilters } from "../hooks/useDashboardFilters.js";
import { useDashboardData } from "../hooks/useDashboardData.js";
import {
  cancelDashboardRecord,
  cancelDashboardRecordsByUniqueIds,
  createJobRecord,
  fetchTabCountByTab,
  fetchCalendarDataByTab,
} from "../sdk/dashboardSdk.js";
import { TAB_IDS, TAB_LIST } from "../constants/tabs.js";
import { readDashboardCache, writeDashboardCache } from "../sdk/dashboardCache.js";
import { DashboardSidebar } from "../components/DashboardSidebar.jsx";
import { DashboardContent } from "../components/DashboardContent.jsx";
import { DashboardBatchDeleteModal } from "../components/modals/DashboardBatchDeleteModal.jsx";
import { TasksModal } from "@modules/job-workspace/public/components.js";

function FullPageLoader({ text = "Loading dashboard..." }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
            <div className="text-sm font-semibold text-slate-800">{text}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FullPageError({
  title = "Unable to load dashboard.",
  description = "Please try refreshing the page.",
}) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-red-700">{title}</div>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
      </div>
    </main>
  );
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "";
  return n.toFixed(2);
}

function getTableExportSchema(activeTab) {
  if (activeTab === TAB_IDS.INQUIRY) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Date", (r) => r.date || ""],
      ["Client", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Address", (r) => r.address || ""],
      ["Source", (r) => r.source || ""],
      ["Status", (r) => r.status || ""],
      ["Service Provider", (r) => r.serviceProvider || ""],
    ];
  }
  if (activeTab === TAB_IDS.QUOTE) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Date", (r) => r.date || ""],
      ["Client", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Address", (r) => r.address || ""],
      ["Quote #", (r) => r.quoteNumber || ""],
      ["Amount", (r) => normalizeMoney(r.amount)],
      ["Status", (r) => r.status || ""],
    ];
  }
  if (activeTab === TAB_IDS.PAYMENT) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Date", (r) => r.date || ""],
      ["Client", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Address", (r) => r.address || ""],
      ["Invoice #", (r) => r.invoiceNumber || ""],
      ["Amount", (r) => normalizeMoney(r.amount)],
      ["Paid", (r) => normalizeMoney(r.paid)],
      ["Balance", (r) => normalizeMoney(r.balance)],
      ["Status", (r) => r.status || ""],
    ];
  }
  if (activeTab === TAB_IDS.ACTIVE_JOBS) {
    return [
      ["ID", (r) => r.uid || ""],
      ["Scheduled", (r) => r.scheduledDate || ""],
      ["Client", (r) => r.clientName || ""],
      ["Phone", (r) => r.phone || ""],
      ["Email", (r) => r.email || ""],
      ["Address", (r) => r.address || ""],
      ["Status", (r) => r.status || ""],
      ["Service Provider", (r) => r.serviceProvider || ""],
      ["Invoice #", (r) => r.invoiceNumber || ""],
    ];
  }
  return [
    ["ID", (r) => r.uid || ""],
    ["Date", (r) => r.date || ""],
    ["Client", (r) => r.clientName || ""],
    ["Phone", (r) => r.phone || ""],
    ["Email", (r) => r.email || ""],
    ["Address", (r) => r.address || ""],
    ["Job #", (r) => r.jobNumber || ""],
    ["Status", (r) => r.status || ""],
    ["Service Provider", (r) => r.serviceProvider || ""],
  ];
}

function toCsvBlob(headers, rows) {
  const escape = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return new Blob([`\uFEFF${lines.join("\n")}`], { type: "text/csv;charset=utf-8;" });
}

function downloadBlobFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getLocalDateTag(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const DASHBOARD_UI_PREFS_KEY = "ui-prefs";
const DASHBOARD_TAB_COUNTS_KEY = "tab-counts";
const DASHBOARD_CALENDAR_KEY_PREFIX = "calendar";
const DASHBOARD_COUNTS_TTL_MS = 10 * 60 * 1000;
const DASHBOARD_CALENDAR_TTL_MS = 5 * 60 * 1000;

function defaultTabCounts() {
  return {
    [TAB_IDS.INQUIRY]: 0,
    [TAB_IDS.QUOTE]: 0,
    [TAB_IDS.JOBS]: 0,
    [TAB_IDS.PAYMENT]: 0,
    [TAB_IDS.ACTIVE_JOBS]: 0,
    [TAB_IDS.URGENT_CALLS]: 0,
    [TAB_IDS.OPEN_TASKS]: 0,
  };
}

function readUiPrefs() {
  const cached = readDashboardCache(DASHBOARD_UI_PREFS_KEY, {
    maxAgeMs: 90 * 24 * 60 * 60 * 1000,
  });
  return cached && typeof cached === "object" ? cached : {};
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const { plugin, isBootstrapping, statusText, error, serviceProviders } =
    useDashboardBootstrap();

  const initialUiPrefs = useMemo(() => readUiPrefs(), []);
  const [activeTab, setActiveTab] = useState(() => {
    const tab = String(initialUiPrefs.activeTab || "").trim();
    return TAB_LIST.includes(tab) ? tab : TAB_IDS.INQUIRY;
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => {
    const size = Number(initialUiPrefs.pageSize || 10);
    return [5, 10, 25, 50].includes(size) ? size : 10;
  });
  const [sortOrder, setSortOrder] = useState(() => {
    return initialUiPrefs.sortOrder === "asc" ? "asc" : "desc";
  });
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    return initialUiPrefs.sidebarOpen === true;
  });
  const [tabCounts, setTabCounts] = useState(() => {
    const cached = readDashboardCache(DASHBOARD_TAB_COUNTS_KEY, {
      maxAgeMs: DASHBOARD_COUNTS_TTL_MS,
    });
    return {
      ...defaultTabCounts(),
      ...(cached && typeof cached === "object" ? cached : {}),
    };
  });
  const [batchSelectedIds, setBatchSelectedIds] = useState([]);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [taskModal, setTaskModal] = useState({
    open: false,
    row: null,
    contextType: "job",
    contextId: "",
  });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDeletingInquiry, setIsDeletingInquiry] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);
  const [calendarData, setCalendarData] = useState(() => {
    const cached = readDashboardCache(`${DASHBOARD_CALENDAR_KEY_PREFIX}:${activeTab}`, {
      maxAgeMs: DASHBOARD_CALENDAR_TTL_MS,
    });
    return cached && typeof cached === "object" ? cached : {};
  });

  const filterHook = useDashboardFilters();
  const currentFilters = filterHook.getFiltersForTab(activeTab);
  const currentAppliedFilters = filterHook.getAppliedFiltersForTab(activeTab);

  const handleToggleSortOrder = useCallback(() => {
    setSortOrder((prev) => (prev === "desc" ? "asc" : "desc"));
    setCurrentPage(1);
  }, []);

  useEffect(() => {
    writeDashboardCache(DASHBOARD_UI_PREFS_KEY, {
      activeTab,
      pageSize,
      sortOrder,
      sidebarOpen,
    });
  }, [activeTab, pageSize, sortOrder, sidebarOpen]);

  useEffect(() => {
    writeDashboardCache(DASHBOARD_TAB_COUNTS_KEY, tabCounts);
  }, [tabCounts]);

  const { rows, isLoading, totalCount: filteredTotalCount } = useDashboardData({
    plugin,
    activeTab,
    appliedFilters: currentAppliedFilters,
    currentPage,
    pageSize,
    sortOrder,
  });

  // Preload tab counts on page load (sequential to avoid API spikes).
  useEffect(() => {
    if (!plugin) return;
    let cancelled = false;
    const tabsForCounts = TAB_LIST;
    (async () => {
      for (const tabId of tabsForCounts) {
        try {
          const count = await fetchTabCountByTab({ plugin, tabId });
          if (cancelled) return;
          setTabCounts((prev) => ({
            ...prev,
            [tabId]: Number.isFinite(count) ? count : 0,
          }));
        } catch (err) {
          if (cancelled) return;
          console.warn(`[DashboardPage] fetchTabCountByTab failed for ${tabId}:`, err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [plugin]);

  // Fetch calendar card counts for the active tab after primary data settles.
  useEffect(() => {
    if (!plugin) return;
    const cached = readDashboardCache(`${DASHBOARD_CALENDAR_KEY_PREFIX}:${activeTab}`, {
      maxAgeMs: DASHBOARD_CALENDAR_TTL_MS,
    });
    if (cached && typeof cached === "object") {
      setCalendarData(cached);
    }
    fetchCalendarDataByTab({
      plugin,
      activeTab,
      lookbackDays: 365,
      lookaheadDays: 365,
    })
      .then((nextCalendarData) => {
        setCalendarData(nextCalendarData);
        writeDashboardCache(`${DASHBOARD_CALENDAR_KEY_PREFIX}:${activeTab}`, nextCalendarData);
      })
      .catch((err) => console.warn("[DashboardPage] fetchCalendarDataByTab failed:", err));
  }, [plugin, activeTab]);

  // Derive pagination from tab count badge (calc total)
  const totalCount = Number.isFinite(filteredTotalCount)
    ? filteredTotalCount
    : (tabCounts[activeTab] ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handleTabChange = useCallback(
    (tab) => {
      setActiveTab(tab);
      setCurrentPage(1);
      setBatchSelectedIds([]);
      setIsBatchMode(false);
    },
    []
  );

  const handleOpenTaskModal = useCallback(
    (row) => {
      if (!row?.id) return;
      const contextType = activeTab === TAB_IDS.INQUIRY ? "deal" : "job";
      setTaskModal({
        open: true,
        row: row || null,
        contextType,
        contextId: row.id,
      });
    },
    [activeTab]
  );

  const handleCloseTaskModal = useCallback(() => {
    setTaskModal({ open: false, row: null, contextType: "job", contextId: "" });
  }, []);

  const handleOpenDeleteModal = useCallback((row) => {
    if (!row?.id) return;
    setDeleteTarget({
      ...row,
      tabId: activeTab,
    });
  }, [activeTab]);

  const handleConfirmDeleteInquiry = useCallback(async () => {
    if (!plugin || !deleteTarget?.id || isDeletingInquiry) return;
    setIsDeletingInquiry(true);
    try {
      await cancelDashboardRecord({
        plugin,
        tabId: deleteTarget.tabId,
        recordId: deleteTarget.id,
      });
      success("Record cancelled", "Status has been updated to Cancelled.");
      setDeleteTarget(null);
      setTabCounts((prev) => ({
        ...prev,
        [deleteTarget.tabId]: Math.max(0, (prev?.[deleteTarget.tabId] ?? 0) - 1),
      }));
    } catch (deleteError) {
      console.error("[Dashboard] Failed to cancel record", deleteError);
      showError(
        "Delete failed",
        deleteError?.message || "Unable to cancel record."
      );
    } finally {
      setIsDeletingInquiry(false);
    }
  }, [plugin, deleteTarget, isDeletingInquiry, success, showError]);

  // Temporary compatibility path: global header now owns create CTAs.
  // Keep these handlers for safe transition and easy rollback if needed.
  const handleCreateJob = useCallback(async () => {
    if (!plugin || isCreatingJob) return;
    setIsCreatingJob(true);
    try {
      const created = await createJobRecord({ plugin, payload: null });
      const uniqueId = String(created?.unique_id || "").trim();
      if (!uniqueId) {
        throw new Error("Created job did not return a unique ID.");
      }
      success("Job created", "Opening the new job page...");
      navigate(`/job-direct/${encodeURIComponent(uniqueId)}`);
    } catch (createError) {
      console.error("[Dashboard] Failed creating job", createError);
      showError("Create failed", createError?.message || "Unable to create job.");
      setIsCreatingJob(false);
    }
  }, [plugin, isCreatingJob, success, showError, navigate]);

  // Temporary compatibility path: global header now owns create CTAs.
  const handleCreateInquiry = useCallback(() => {
    navigate("/inquiry-details/new");
  }, [navigate]);

  const handleEnableBatchDelete = useCallback(() => {
    setIsBatchMode(true);
    setBatchSelectedIds([]);
  }, []);

  const handleBatchDeleteConfirm = useCallback(() => {
    if (!plugin || !batchSelectedIds.length || isBatchDeleting) return;
    setIsBatchDeleting(true);
    cancelDashboardRecordsByUniqueIds({
      plugin,
      tabId: activeTab,
      uniqueIds: batchSelectedIds,
    })
      .then(({ cancelled }) => {
        success("Records cancelled", `${cancelled || 0} record(s) were marked as Cancelled.`);
        setBatchDeleteModal(false);
        setBatchSelectedIds([]);
        setIsBatchMode(false);
        setTabCounts((prev) => ({
          ...prev,
          [activeTab]: Math.max(0, (prev?.[activeTab] ?? 0) - batchSelectedIds.length),
        }));
      })
      .catch((batchError) => {
        console.error("[Dashboard] Failed batch cancel", batchError);
        showError("Batch delete failed", batchError?.message || "Unable to cancel selected records.");
      })
      .finally(() => setIsBatchDeleting(false));
  }, [
    plugin,
    batchSelectedIds,
    isBatchDeleting,
    activeTab,
    success,
    showError,
  ]);

  const handleApplyFilters = useCallback(() => {
    filterHook.applyFilters(activeTab);
    setCurrentPage(1);
  }, [filterHook, activeTab]);

  const handleResetFilters = useCallback(() => {
    filterHook.resetFilters(activeTab);
    setCurrentPage(1);
  }, [filterHook, activeTab]);

  const handleSelectCalendarRange = useCallback(
    ({ dateFrom = "", dateTo = "" } = {}) => {
      filterHook.applyDateRange(activeTab, { dateFrom, dateTo });
      setCurrentPage(1);
    },
    [filterHook, activeTab]
  );

  const handleClearCalendarRange = useCallback(() => {
    filterHook.applyDateRange(activeTab, { dateFrom: "", dateTo: "" });
    setCurrentPage(1);
  }, [filterHook, activeTab]);

  const handlePageSizeChange = useCallback((nextSize) => {
    const size = Number(nextSize);
    if (![5, 10, 25, 50].includes(size)) return;
    setPageSize(size);
    setCurrentPage(1);
  }, []);

  const handleViewRecord = useCallback(
    (row) => {
      const uid = String(row?.uid || "").trim();
      if (!uid) return;
      if (activeTab === TAB_IDS.INQUIRY) {
        navigate(`/inquiry-details/${encodeURIComponent(uid)}`, {
          state: {
            sourceTab: activeTab,
            sourceId: row?.id ?? "",
            sourceUid: uid,
          },
        });
        return;
      }
      navigate(`/job-details/${encodeURIComponent(uid)}`, {
        state: {
          sourceTab: activeTab,
          sourceId: row?.id ?? "",
          sourceUid: uid,
        },
      });
    },
    [activeTab, navigate]
  );

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

  if (isBootstrapping || isCreatingJob) {
    const loaderText = isCreatingJob ? "Creating job..." : statusText;
    return <FullPageLoader text={loaderText} />;
  }

  if (error) {
    const friendlyMessage = getFriendlyServiceMessage(error);
    return (
      <FullPageError
        title={friendlyMessage ? "Temporary maintenance" : "Unable to load dashboard."}
        description={friendlyMessage || "Please try refreshing the page."}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 font-['Inter']">
      <GlobalTopHeader />

      <div className="flex min-h-0 flex-1">
        {sidebarOpen && (
          <DashboardSidebar
            activeTab={activeTab}
            filters={currentFilters}
            onPatchFilter={(key, value) => filterHook.patchFilter(activeTab, key, value)}
            onToggleArrayFilter={(key, value) =>
              filterHook.toggleArrayFilter(activeTab, key, value)
            }
            onApply={handleApplyFilters}
            onReset={handleResetFilters}
            onClose={() => setSidebarOpen(false)}
            serviceProviders={serviceProviders}
          />
        )}

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DashboardContent
            activeTab={activeTab}
            onTabChange={handleTabChange}
            tabCounts={tabCounts}
            onEnableBatchDelete={handleEnableBatchDelete}
            isBatchMode={isBatchMode}
            batchSelectedCount={batchSelectedIds.length}
            onBatchDeleteClick={() => setBatchDeleteModal(true)}
            onPrintCurrentTable={handlePrintCurrentTable}
            onExportCurrentTable={handleExportCurrentTable}
            onExportServiceProviders={handleExportServiceProviders}
            calendarData={calendarData}
            selectedDateFrom={currentAppliedFilters?.dateFrom || ""}
            selectedDateTo={currentAppliedFilters?.dateTo || ""}
            onSelectCalendarRange={handleSelectCalendarRange}
            onClearCalendarRange={handleClearCalendarRange}
            activeChips={filterHook.getActiveChips(currentAppliedFilters, { serviceProviders })}
            onRemoveChip={(key, value) => filterHook.removeAppliedFilter(activeTab, key, value)}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            pageSize={pageSize}
            onPageSizeChange={handlePageSizeChange}
            rows={rows}
            totalCount={totalCount}
            totalPages={totalPages}
            isLoading={isLoading}
            batchSelectedIds={batchSelectedIds}
            onBatchSelectionChange={setBatchSelectedIds}
            onOpenTaskModal={handleOpenTaskModal}
            onDeleteInquiry={handleOpenDeleteModal}
            onViewInquiry={handleViewRecord}
            sortOrder={sortOrder}
            onToggleSortOrder={handleToggleSortOrder}
          />
        </main>
      </div>

      {!sidebarOpen ? (
        <button
          type="button"
          className="fixed bottom-[88px] -left-3 z-[59] inline-flex h-10 w-10 items-center justify-end rounded-full border border-[#003882]/35 bg-[#003882] pr-2 text-white shadow-[0_8px_22px_rgba(0,56,130,0.28)] transition hover:bg-[#0A4A9E]"
          onClick={() => setSidebarOpen(true)}
          aria-label="Open filters panel"
          title="Open filters panel"
        >
          <ChevronRightIcon />
        </button>
      ) : null}

      <TasksModal
        open={taskModal.open}
        contextType={taskModal.contextType || "job"}
        contextId={taskModal.contextId || ""}
        plugin={plugin}
        onClose={handleCloseTaskModal}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeletingInquiry) return;
          setDeleteTarget(null);
        }}
        title="Cancel Record?"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeletingInquiry}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteInquiry}
              disabled={isDeletingInquiry}
            >
              {isDeletingInquiry ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to mark this record as Cancelled?
        </p>
      </Modal>

      <DashboardBatchDeleteModal
        open={batchDeleteModal}
        count={batchSelectedIds.length}
        isProcessing={isBatchDeleting}
        onClose={() => {
          if (isBatchDeleting) return;
          setBatchDeleteModal(false);
        }}
        onConfirm={handleBatchDeleteConfirm}
      />
    </div>
  );
}
