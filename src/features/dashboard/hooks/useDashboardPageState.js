import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useDashboardBootstrap } from "./useDashboardBootstrap.js";
import { useDashboardFilters } from "./useDashboardFilters.js";
import { useDashboardData } from "./useDashboardData.js";
import { hasAnyDashboardFilterValues } from "../constants/filters.js";
import {
  createJobRecord,
  fetchTabCountByTab,
  fetchCalendarDataByTab,
} from "../api/dashboardApi.js";
import { TAB_IDS, TAB_LIST } from "../constants/tabs.js";
import { useDashboardRecordActions } from "./useDashboardRecordActions.js";
import {
  buildCalendarCacheKey,
  readDashboardCache,
  writeDashboardCache,
} from "../api/dashboardCache.js";
import { useDashboardExportActions } from "./useDashboardExportActions.js";

const DASHBOARD_UI_PREFS_KEY = "ui-prefs";
const DASHBOARD_TAB_COUNTS_KEY = "tab-counts";
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

export function useDashboardPageState() {
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
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [taskModal, setTaskModal] = useState({
    open: false,
    row: null,
    contextType: "job",
    contextId: "",
  });
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [calendarData, setCalendarData] = useState({});

  const filterHook = useDashboardFilters();
  const currentFilters = filterHook.getFiltersForTab(activeTab);
  const currentAppliedFilters = filterHook.getAppliedFiltersForTab(activeTab);
  const hasActiveFilters = hasAnyDashboardFilterValues(currentAppliedFilters);

  const [tabCounts, setTabCounts] = useState(() => {
    const cached = readDashboardCache(DASHBOARD_TAB_COUNTS_KEY, {
      maxAgeMs: DASHBOARD_COUNTS_TTL_MS,
    });
    return {
      ...defaultTabCounts(),
      ...(cached && typeof cached === "object" ? cached : {}),
    };
  });

  const {
    deleteTarget,
    setDeleteTarget,
    isDeletingInquiry,
    handleOpenDeleteModal,
    handleConfirmDeleteInquiry,
    batchSelectedIds,
    setBatchSelectedIds,
    isBatchMode,
    setIsBatchMode,
    batchDeleteModal,
    setBatchDeleteModal,
    isBatchDeleting,
    handleEnableBatchDelete,
    handleSelectBatchAction,
    handleBatchDeleteConfirm,
  } = useDashboardRecordActions({
    plugin,
    activeTab,
    setActiveTab,
    setCurrentPage,
    setTabCounts,
    filterHook,
    success,
    showError,
  });

  // Debounce search input → committed query
  useEffect(() => {
    const q = searchInput.trim();
    if (!q) { setSearchQuery(""); return; }
    const t = setTimeout(() => setSearchQuery(q), 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Resolve SP IDs matching the search text for service person search
  const searchSpIds = useMemo(() => {
    if (!searchQuery || !serviceProviders?.length) return [];
    const q = searchQuery.toLowerCase();
    return serviceProviders
      .filter((sp) => sp.name?.toLowerCase().includes(q))
      .map((sp) => sp.id);
  }, [searchQuery, serviceProviders]);

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
    searchQuery,
    searchSpIds,
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
    const calendarCacheKey = buildCalendarCacheKey({
      tab: activeTab,
      filters: currentAppliedFilters,
    });
    const cached = readDashboardCache(calendarCacheKey, {
      maxAgeMs: DASHBOARD_CALENDAR_TTL_MS,
    });
    setCalendarData(cached && typeof cached === "object" ? cached : {});
    fetchCalendarDataByTab({
      plugin,
      activeTab,
      filters: currentAppliedFilters,
      lookbackDays: 365,
      lookaheadDays: 365,
    })
      .then((nextCalendarData) => {
        setCalendarData(nextCalendarData);
        writeDashboardCache(calendarCacheKey, nextCalendarData);
      })
      .catch((err) => console.warn("[DashboardPage] fetchCalendarDataByTab failed:", err));
  }, [plugin, activeTab, currentAppliedFilters]);

  // Derive pagination from tab count badge (calc total)
  const totalCount = Number.isFinite(filteredTotalCount)
    ? filteredTotalCount
    : (tabCounts[activeTab] ?? 0);
  const displayTabCounts = useMemo(() => {
    if (!hasActiveFilters || !Number.isFinite(filteredTotalCount)) return tabCounts;
    return {
      ...tabCounts,
      [activeTab]: filteredTotalCount,
    };
  }, [activeTab, filteredTotalCount, hasActiveFilters, tabCounts]);
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
      setSearchInput("");
      setSearchQuery("");
    },
    []
  );

  const handleOpenTaskModal = useCallback(
    (row) => {
      if (!row?.id) return;
      const isInquiry = activeTab === TAB_IDS.INQUIRY || row?.recordType === "inquiry";
      const contextType = isInquiry ? "deal" : "job";
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
      const isInquiry = activeTab === TAB_IDS.INQUIRY || row?.recordType === "inquiry";
      if (isInquiry) {
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

  const {
    handlePrintCurrentTable,
    handleExportCurrentTable,
    handleExportServiceProviders,
  } = useDashboardExportActions({ activeTab, rows, serviceProviders, showError });

  return {
    // Bootstrap state
    plugin,
    isBootstrapping,
    statusText,
    error,
    serviceProviders,
    isCreatingJob,

    // Tab / pagination state
    activeTab,
    currentPage,
    setCurrentPage,
    pageSize,
    sortOrder,
    handleToggleSortOrder,
    handleTabChange,
    handlePageSizeChange,
    displayTabCounts,
    totalCount,
    totalPages,

    // Sidebar
    sidebarOpen,
    setSidebarOpen,

    // Search
    searchInput,
    setSearchInput,

    // Data
    rows,
    isLoading,

    // Filter hook pass-throughs
    filterHook,
    currentFilters,
    currentAppliedFilters,

    // Calendar
    calendarData,
    handleSelectCalendarRange,
    handleClearCalendarRange,

    // Batch
    batchSelectedIds,
    setBatchSelectedIds,
    isBatchMode,
    setIsBatchMode,
    batchDeleteModal,
    setBatchDeleteModal,
    isBatchDeleting,
    handleEnableBatchDelete,
    handleSelectBatchAction,
    handleBatchDeleteConfirm,

    // Task modal
    taskModal,
    handleOpenTaskModal,
    handleCloseTaskModal,

    // Delete modal
    deleteTarget,
    setDeleteTarget,
    isDeletingInquiry,
    handleOpenDeleteModal,
    handleConfirmDeleteInquiry,

    // Actions
    handleCreateJob,
    handleCreateInquiry,
    handleViewRecord,
    handlePrintCurrentTable,
    handleExportCurrentTable,
    handleExportServiceProviders,
    handleApplyFilters,
    handleResetFilters,
  };
}
