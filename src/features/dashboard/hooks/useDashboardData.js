import { useEffect, useState } from "react";
import { extractFromPayload, fetchDirectWithTimeout } from "@shared/api/dashboardCore.js";
import { TAB_IDS } from "../constants/tabs.js";
import { hasAnyDashboardFilterValues } from "../constants/filters.js";
import {
  buildRowsCacheKey,
  readDashboardCache,
  writeDashboardCache,
} from "../api/dashboardCache.js";
import {
  buildDealsQuery,
  buildQuotesQuery,
  buildJobsQuery,
  buildPaymentsQuery,
  buildActiveJobsQuery,
  buildUrgentCallsQuery,
  buildOpenTasksQuery,
  buildUrgentCallsDealQuery,
  buildOpenTasksDealQuery,
  fetchTabCountByTab,
} from "../api/dashboardApi.js";

const COMBINED_TABS = new Set([TAB_IDS.URGENT_CALLS, TAB_IDS.OPEN_TASKS]);

const TAB_QUERY_BUILDERS = {
  [TAB_IDS.INQUIRY]: buildDealsQuery,
  [TAB_IDS.QUOTE]: buildQuotesQuery,
  [TAB_IDS.JOBS]: buildJobsQuery,
  [TAB_IDS.PAYMENT]: buildPaymentsQuery,
  [TAB_IDS.ACTIVE_JOBS]: buildActiveJobsQuery,
  [TAB_IDS.URGENT_CALLS]: buildUrgentCallsQuery,
  [TAB_IDS.OPEN_TASKS]: buildOpenTasksQuery,
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

  const hasActiveFilters = hasAnyDashboardFilterValues(appliedFilters || {});

  useEffect(() => {
    if (!plugin) return;

    // ── Combined tabs: run two parallel fetches (jobs + deals) and merge ──
    if (COMBINED_TABS.has(activeTab)) {
      setRows([]);
      setTotalCount(null);
      setIsLoading(true);
      setError(null);

      let cancelled = false;

      const jobsBuilder = activeTab === TAB_IDS.URGENT_CALLS ? buildUrgentCallsQuery : buildOpenTasksQuery;
      const dealsBuilder = activeTab === TAB_IDS.URGENT_CALLS ? buildUrgentCallsDealQuery : buildOpenTasksDealQuery;

      const fetchRows = async (built) => {
        const { query, normalize } = built;
        query.getOrInitQueryCalc?.();
        const payload = await fetchDirectWithTimeout(query, null, 30000);
        const records = extractFromPayload(payload);
        return records.map(normalize);
      };

      Promise.allSettled([
        fetchRows(jobsBuilder(plugin, appliedFilters, currentPage, pageSize, sortOrder)),
        fetchRows(dealsBuilder(plugin, appliedFilters, currentPage, pageSize, sortOrder)),
      ]).then(([jobsResult, dealsResult]) => {
        if (cancelled) return;
        if (jobsResult.status === "rejected") {
          console.warn("[useDashboardData] combined jobs fetch failed:", jobsResult.reason);
        }
        if (dealsResult.status === "rejected") {
          console.warn("[useDashboardData] combined deals fetch failed:", dealsResult.reason);
        }
        const jobRows = jobsResult.status === "fulfilled" ? jobsResult.value : [];
        const dealRows = dealsResult.status === "fulfilled" ? dealsResult.value : [];
        const merged = [...jobRows, ...dealRows].sort((a, b) =>
          sortOrder === "desc" ? b._rawTs - a._rawTs : a._rawTs - b._rawTs
        );
        setRows(merged);
        setIsLoading(false);
      }).catch((err) => {
        if (cancelled) return;
        console.error("[useDashboardData] combined fetch error:", err);
        setError(err);
        setIsLoading(false);
      });

      return () => { cancelled = true; };
    }

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
    let resolvedFilteredTotalCount = Number.isFinite(cachedRowsState?.totalCount)
      ? cachedRowsState.totalCount
      : null;

    try {
      const built = builder(plugin, appliedFilters, currentPage, pageSize, sortOrder);
      const query = built.query;
      const { normalize } = built;
      activeQuery = query;

      if (hasActiveFilters) {
        fetchTabCountByTab({
          plugin,
          tabId: activeTab,
          filters: appliedFilters,
        })
          .then((count) => {
            if (cancelled) return;
            const normalizedCount = Number.isFinite(count) ? count : 0;
            resolvedFilteredTotalCount = normalizedCount;
            setTotalCount(normalizedCount);
            if (cachedRowsState && Array.isArray(cachedRowsState.rows)) {
              writeDashboardCache(rowsCacheKey, {
                rows: cachedRowsState.rows,
                totalCount: normalizedCount,
              });
            }
          })
          .catch((countError) => {
            if (cancelled) return;
            console.warn("[useDashboardData] filtered count fetch failed:", countError);
          });
      } else {
        setTotalCount(null);
      }

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
          setRows(normalized);
          writeDashboardCache(rowsCacheKey, {
            rows: normalized,
            totalCount: hasActiveFilters ? resolvedFilteredTotalCount : null,
          });
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
