// ─── Dashboard API barrel ─────────────────────────────────────────────────────
// All public exports are re-exported from their respective modules.
// Importing from dashboardApi.js continues to work without any changes.

export {
  buildDealsQuery,
  buildQuotesQuery,
  buildJobsQuery,
  buildUrgentCallsQuery,
  buildOpenTasksQuery,
  buildUrgentCallsDealQuery,
  buildOpenTasksDealQuery,
  buildPaymentsQuery,
  buildActiveJobsQuery,
} from "./dashboardQueries.js";

export {
  fetchTabCounts,
  fetchTabCountByTab,
  fetchCalendarDataByTab,
  fetchCalendarData,
} from "./dashboardCounting.js";

export { fetchServiceProviders } from "./dashboardServiceProviders.js";

export {
  createJobRecord,
  cancelInquiryById,
  cancelDashboardRecord,
  cancelDashboardRecordsByUniqueIds,
  fetchNotifications,
  createTask,
} from "./dashboardMutations.js";
