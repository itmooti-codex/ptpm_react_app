import { useEffect, useState } from "react";
import { extractFromPayload } from "../sdk/dashboardCore.js";
import { TAB_IDS } from "../constants/tabs.js";
import {
  buildRowsCacheKey,
  readDashboardCache,
  writeDashboardCache,
} from "../sdk/dashboardCache.js";
import {
  buildDealsQuery,
  buildQuotesQuery,
  buildJobsQuery,
  buildPaymentsQuery,
  buildActiveJobsQuery,
} from "../sdk/dashboardSdk.js";

const TAB_QUERY_BUILDERS = {
  [TAB_IDS.INQUIRY]: buildDealsQuery,
  [TAB_IDS.QUOTE]: buildQuotesQuery,
  [TAB_IDS.JOBS]: buildJobsQuery,
  [TAB_IDS.PAYMENT]: buildPaymentsQuery,
  [TAB_IDS.ACTIVE_JOBS]: buildActiveJobsQuery,
};

export function useDashboardData({
  plugin,
  activeTab,
  appliedFilters,
  currentPage,
  pageSize = 25,
  sortOrder = "desc",
}) {
  const [rows, setRows] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [totalCount, setTotalCount] = useState(null);

  const hasActiveFilters = (() => {
    const f = appliedFilters || {};
    if (String(f.accountName || "").trim()) return true;
    if (String(f.address || "").trim()) return true;
    if (String(f.serviceman || "").trim()) return true;
    if (String(f.quoteNumber || "").trim()) return true;
    if (String(f.invoiceNumber || "").trim()) return true;
    if (String(f.recommendation || "").trim()) return true;
    if (String(f.priceMin || "").trim()) return true;
    if (String(f.priceMax || "").trim()) return true;
    if (String(f.dateFrom || "").trim()) return true;
    if (String(f.dateTo || "").trim()) return true;
    if (Array.isArray(f.statuses) && f.statuses.length) return true;
    if (Array.isArray(f.serviceProviders) && f.serviceProviders.length) return true;
    if (Array.isArray(f.accountTypes) && f.accountTypes.length) return true;
    if (Array.isArray(f.sources) && f.sources.length) return true;
    return false;
  })();

  useEffect(() => {
    if (!plugin) return;

    const builder = TAB_QUERY_BUILDERS[activeTab];
    if (!builder) {
      setRows([]);
      setTotalCount(null);
      setIsLoading(false);
      return;
    }

    const rowsCacheKey = buildRowsCacheKey({
      tab: activeTab,
      filters: appliedFilters,
      page: currentPage,
      pageSize,
      sort: sortOrder,
    });
    const cachedRowsState = readDashboardCache(rowsCacheKey, {
      maxAgeMs: 2 * 60 * 1000,
    });

    if (cachedRowsState && Array.isArray(cachedRowsState.rows)) {
      setRows(cachedRowsState.rows);
      setTotalCount(
        Number.isFinite(cachedRowsState.totalCount) ? cachedRowsState.totalCount : null
      );
      setIsLoading(false);
    } else {
      setRows([]);
      setTotalCount(null);
      setIsLoading(true);
    }
    setError(null);

    let cancelled = false;
    let activeQuery = null;
    let activeSubscription = null;
    let loadTimeoutId = null;

    try {
      const queryPage = hasActiveFilters ? 1 : currentPage;
      const queryPageSize = hasActiveFilters ? 1000 : pageSize;
      const built = builder(plugin, appliedFilters, queryPage, queryPageSize, sortOrder);
      const query = built.query;
      const { normalize } = built;
      activeQuery = query;

      const subscribeSource =
        (typeof query.subscribe === "function" && query.subscribe()) ||
        (typeof query.localSubscribe === "function" && query.localSubscribe()) ||
        null;

      if (!subscribeSource || typeof subscribeSource.subscribe !== "function") {
        throw new Error("Dashboard data stream is unavailable.");
      }

      let stream = subscribeSource;
      if (
        typeof window !== "undefined" &&
        typeof window.toMainInstance === "function" &&
        typeof stream.pipe === "function"
      ) {
        stream = stream.pipe(window.toMainInstance(true));
      }

      loadTimeoutId = setTimeout(() => {
        if (cancelled) return;
        setIsLoading(false);
        setError(new Error("Dashboard query timed out waiting for data."));
      }, 30000);

      activeSubscription = stream.subscribe({
        next: (payload) => {
          if (cancelled) return;
          if (loadTimeoutId) {
            clearTimeout(loadTimeoutId);
            loadTimeoutId = null;
          }
          const records = extractFromPayload(payload);
          const normalized = records.map(normalize);
          if (hasActiveFilters) {
            const total = normalized.length;
            const start = Math.max(0, (currentPage - 1) * pageSize);
            const end = start + pageSize;
            const pagedRows = normalized.slice(start, end);
            setTotalCount(total);
            setRows(pagedRows);
            writeDashboardCache(rowsCacheKey, {
              rows: pagedRows,
              totalCount: total,
            });
          } else {
            setTotalCount(null);
            setRows(normalized);
            writeDashboardCache(rowsCacheKey, {
              rows: normalized,
              totalCount: null,
            });
          }
          setError(null);
          setIsLoading(false);
        },
        error: (err) => {
          if (cancelled) return;
          if (loadTimeoutId) {
            clearTimeout(loadTimeoutId);
            loadTimeoutId = null;
          }
          console.error("[useDashboardData] query/subscribe error:", err);
          setError(err);
          setRows([]);
          setIsLoading(false);
        },
      });
    } catch (err) {
      console.error("[useDashboardData] query setup error:", err);
      setError(err);
      setRows([]);
      setIsLoading(false);
    }

    return () => {
      cancelled = true;
      if (loadTimeoutId) clearTimeout(loadTimeoutId);
      try {
        activeSubscription?.unsubscribe?.();
      } catch (_) {}
      try {
        activeQuery?.destroy?.();
      } catch (_) {}
    };
  }, [plugin, activeTab, appliedFilters, currentPage, pageSize, sortOrder, hasActiveFilters]);

  return { rows, isLoading, error, totalCount };
}
