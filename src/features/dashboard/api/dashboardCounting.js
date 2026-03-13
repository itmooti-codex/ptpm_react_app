import { fetchDirectWithTimeout, extractFromPayload, toEpochRange } from "@shared/api/dashboardCore.js";
import { hasAnyDashboardFilterValues } from "../constants/filters.js";
import { TAB_IDS } from "../constants/tabs.js";
import {
  resolveBaseFactoryByTab,
  createDealsBaseQuery,
  createQuotesBaseQuery,
  createJobsBaseQuery,
  createPaymentsBaseQuery,
  createActiveJobsBaseQuery,
  createUrgentCallsBaseQuery,
  createOpenTasksBaseQuery,
  createUrgentCallsDealBaseQuery,
  createOpenTasksDealBaseQuery,
} from "./dashboardQueries.js";
import {
  applyTabFiltersToQuery,
  applyQuickSearchDeal,
  applyQuickSearchJob,
  isDealTab,
} from "./dashboardFilters.js";

// ─── Private Helpers ──────────────────────────────────────────────────────────

function firstRecordFromAnyPayload(payload) {
  const records = extractFromPayload(payload);
  return Array.isArray(records) && records.length ? records[0] : null;
}

function mapCalendarCounts(records = []) {
  const toMillis = (raw) => {
    const numeric = Number(raw);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return numeric > 1e12 ? Math.trunc(numeric) : Math.trunc(numeric * 1000);
  };

  const counts = {};
  const seenIds = new Set();
  for (const rec of records) {
    const rawId = rec?.id ?? rec?.ID;
    const normalizedId = rawId == null ? "" : String(rawId).trim();
    if (normalizedId) {
      if (seenIds.has(normalizedId)) continue;
      seenIds.add(normalizedId);
    }

    const ts =
      rec?.created_at ??
      rec?.Created_At ??
      rec?.date_added ??
      rec?.Date_Added;
    if (!ts) continue;
    const millis = toMillis(ts);
    if (!millis) continue;
    const date = new Date(millis);
    if (Number.isNaN(date.getTime())) continue;
    // Use local date parts to match DashboardCalendar period bucketing.
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    const iso = `${y}-${m}-${d}`;
    counts[iso] = (counts[iso] ?? 0) + 1;
  }
  return counts;
}

async function fetchDirectRecords(query) {
  query.getOrInitQueryCalc?.();
  const result = await fetchDirectWithTimeout(query);
  return extractFromPayload(result);
}

function buildCountPageQuery(baseFactory, plugin, { limit, offset }) {
  return baseFactory(plugin)
    .deSelectAll()
    .select(["id"])
    .orderBy("id", "asc")
    .limit(limit)
    .offset(offset)
    .noDestroy();
}

function buildFilteredCountPageQuery({
  plugin,
  tabId,
  filters = {},
  limit,
  offset,
  searchQuery = "",
  searchSpIds = [],
} = {}) {
  const baseFactory = resolveBaseFactoryByTab(tabId);
  if (!baseFactory) return null;

  let q = applyTabFiltersToQuery(baseFactory(plugin, filters), tabId, filters);
  if (searchQuery) {
    q = isDealTab(tabId)
      ? applyQuickSearchDeal(q, searchQuery, searchSpIds)
      : applyQuickSearchJob(q, searchQuery, searchSpIds);
  }
  return q
    .deSelectAll()
    .select(["id"])
    .orderBy("id", "asc")
    .limit(limit)
    .offset(offset)
    .noDestroy();
}

async function fetchCountByPagedQuery(buildPageQuery, { pageSize = 250, maxPages = null } = {}) {
  let total = 0;
  const normalizedMaxPages =
    Number.isFinite(maxPages) && Number(maxPages) > 0 ? Math.floor(Number(maxPages)) : null;

  for (let page = 0; ; page += 1) {
    if (normalizedMaxPages !== null && page >= normalizedMaxPages) break;
    const query = buildPageQuery({
      limit: pageSize,
      offset: page * pageSize,
    });
    if (!query) break;
    const rows = await fetchDirectRecords(query);
    const size = Array.isArray(rows) ? rows.length : 0;
    total += size;
    if (size < pageSize) break;
  }

  return total;
}

async function fetchCountByPaging(baseFactory, plugin, options = {}) {
  return fetchCountByPagedQuery(
    ({ limit, offset }) => buildCountPageQuery(baseFactory, plugin, { limit, offset }),
    options
  );
}

function buildCalendarRange({ lookbackDays = 180, lookaheadDays = 180 } = {}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - Math.max(0, Number(lookbackDays) || 0));
  const startEpoch = Math.floor(startDate.getTime() / 1000);

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + Math.max(0, Number(lookaheadDays) || 0));
  endDate.setHours(23, 59, 59, 999);
  const endEpoch = Math.floor(endDate.getTime() / 1000);

  return { startEpoch, endEpoch };
}

function applyCalendarEpochFilter(q, lookbackDays, lookaheadDays) {
  const { startEpoch, endEpoch } = buildCalendarRange({ lookbackDays, lookaheadDays });
  return q.andWhere("created_at", ">=", startEpoch).andWhere("created_at", "<=", endEpoch);
}

async function fetchCalendarRecordsByPaging(
  baseFactory,
  plugin,
  {
    tabId,
    filters = {},
    lookbackDays = 180,
    lookaheadDays = 180,
    pageSize = 400,
    maxPages = 300,
  } = {}
) {
  const all = [];

  for (let page = 0; page < maxPages; page += 1) {
    let query = baseFactory(plugin, filters);
    query = applyTabFiltersToQuery(query, tabId, filters)
      .deSelectAll()
      .select(["id", "created_at"])
      .orderBy("id", "asc")
      .limit(pageSize)
      .offset(page * pageSize);
    query = applyCalendarEpochFilter(query, lookbackDays, lookaheadDays).noDestroy();

    const rows = await fetchDirectRecords(query);
    const size = Array.isArray(rows) ? rows.length : 0;
    if (!size) break;
    all.push(...rows);
    if (size < pageSize) break;
  }

  return all;
}

// ─── fetchTabCounts — runs calc queries on page load ─────────────────────────
// Uses countDistinct calc queries (no tab-click required, no filter conditions yet).

export async function fetchTabCounts({ plugin } = {}) {
  if (!plugin) {
    return {
      inquiry: 0,
      quote: 0,
      jobs: 0,
      payment: 0,
      "active-jobs": 0,
      "urgent-calls": 0,
      "open-tasks": 0,
    };
  }

  const [
    dealResult, quoteResult, jobsResult, paymentResult, activeResult,
    urgentJobsResult, openTasksJobsResult,
    urgentDealsResult, openTasksDealsResult,
  ] = await Promise.allSettled([
    fetchCountByPaging(createDealsBaseQuery, plugin),
    fetchCountByPaging(createQuotesBaseQuery, plugin),
    fetchCountByPaging(createJobsBaseQuery, plugin),
    fetchCountByPaging(createPaymentsBaseQuery, plugin),
    fetchCountByPaging(createActiveJobsBaseQuery, plugin),
    fetchCountByPaging(createUrgentCallsBaseQuery, plugin),
    fetchCountByPaging(createOpenTasksBaseQuery, plugin),
    fetchCountByPaging(createUrgentCallsDealBaseQuery, plugin),
    fetchCountByPaging(createOpenTasksDealBaseQuery, plugin),
  ]);

  if (dealResult.status === "rejected") console.warn("[fetchTabCounts] inquiry count failed:", dealResult.reason);
  if (quoteResult.status === "rejected") console.warn("[fetchTabCounts] quote count failed:", quoteResult.reason);
  if (jobsResult.status === "rejected") console.warn("[fetchTabCounts] jobs count failed:", jobsResult.reason);
  if (paymentResult.status === "rejected") console.warn("[fetchTabCounts] payment count failed:", paymentResult.reason);
  if (activeResult.status === "rejected") console.warn("[fetchTabCounts] active-jobs count failed:", activeResult.reason);
  if (urgentJobsResult.status === "rejected") console.warn("[fetchTabCounts] urgent-calls jobs count failed:", urgentJobsResult.reason);
  if (openTasksJobsResult.status === "rejected") console.warn("[fetchTabCounts] open-tasks jobs count failed:", openTasksJobsResult.reason);
  if (urgentDealsResult.status === "rejected") console.warn("[fetchTabCounts] urgent-calls deals count failed:", urgentDealsResult.reason);
  if (openTasksDealsResult.status === "rejected") console.warn("[fetchTabCounts] open-tasks deals count failed:", openTasksDealsResult.reason);

  return {
    inquiry: dealResult.status === "fulfilled" ? dealResult.value : 0,
    quote: quoteResult.status === "fulfilled" ? quoteResult.value : 0,
    jobs: jobsResult.status === "fulfilled" ? jobsResult.value : 0,
    payment: paymentResult.status === "fulfilled" ? paymentResult.value : 0,
    "active-jobs": activeResult.status === "fulfilled" ? activeResult.value : 0,
    "urgent-calls": (urgentJobsResult.status === "fulfilled" ? urgentJobsResult.value : 0)
      + (urgentDealsResult.status === "fulfilled" ? urgentDealsResult.value : 0),
    "open-tasks": (openTasksJobsResult.status === "fulfilled" ? openTasksJobsResult.value : 0)
      + (openTasksDealsResult.status === "fulfilled" ? openTasksDealsResult.value : 0),
  };
}

export async function fetchTabCountByTab({ plugin, tabId, filters = null, searchQuery = "", searchSpIds = [] } = {}) {
  if (!plugin) return 0;

  const isCombined = tabId === TAB_IDS.URGENT_CALLS || tabId === TAB_IDS.OPEN_TASKS;

  if (isCombined) {
    const dealFactory = tabId === TAB_IDS.URGENT_CALLS ? createUrgentCallsDealBaseQuery : createOpenTasksDealBaseQuery;
    try {
      const [jobCount, dealCount] = await Promise.all([
        fetchCountByPaging(resolveBaseFactoryByTab(tabId), plugin).catch(() => 0),
        fetchCountByPaging(dealFactory, plugin).catch(() => 0),
      ]);
      return jobCount + dealCount;
    } catch (error) {
      console.warn(`[fetchTabCountByTab] ${String(tabId)} combined count failed:`, error);
      return 0;
    }
  }

  const baseFactory = resolveBaseFactoryByTab(tabId);
  if (!baseFactory) return 0;
  try {
    if (hasAnyDashboardFilterValues(filters || {}) || searchQuery) {
      return await fetchCountByPagedQuery(
        ({ limit, offset }) =>
          buildFilteredCountPageQuery({
            plugin,
            tabId,
            filters,
            limit,
            offset,
            searchQuery,
            searchSpIds,
          }),
        { pageSize: 250 }
      );
    }
    return await fetchCountByPaging(baseFactory, plugin);
  } catch (error) {
    console.warn(`[fetchTabCountByTab] ${String(tabId)} count failed:`, error);
    return 0;
  }
}

// ─── fetchCalendarDataByTab ───────────────────────────────────────────────────
// Returns a map of { "YYYY-MM-DD": count } for selected dashboard tab,
// always grouped by `created_at`.

export async function fetchCalendarDataByTab({
  plugin,
  activeTab = TAB_IDS.INQUIRY,
  filters = {},
  lookbackDays = 180,
  lookaheadDays = 180,
} = {}) {
  if (!plugin) return {};
  try {
    const baseFactory = resolveBaseFactoryByTab(activeTab);
    if (!baseFactory) return {};

    const records = await fetchCalendarRecordsByPaging(
      baseFactory,
      plugin,
      {
        tabId: activeTab,
        filters,
        lookbackDays,
        lookaheadDays,
      }
    );
    return mapCalendarCounts(records);
  } catch (err) {
    console.error("[dashboardSdk] fetchCalendarDataByTab failed", err);
    return {};
  }
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

export async function fetchCalendarData(_args = {}) {
  return {};
}
