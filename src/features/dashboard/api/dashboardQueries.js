import { TAB_IDS } from "../constants/tabs.js";
import {
  applyDealFilters,
  applyCommonJobFilters,
  applyInquiryBaseConditions,
  applyQuoteBaseConditions,
  applyJobBaseConditions,
  applyUrgentCallsBaseConditions,
  applyOpenTasksBaseConditions,
  applyPaymentBaseConditions,
  applyActiveJobBaseConditions,
  applyJobsTabStatusFilter,
  applyQuoteTabStatusFilter,
  applyQuickSearchDeal,
  applyQuickSearchJob,
} from "./dashboardFilters.js";
import {
  applyJobIncludes,
  applyDealIncludes,
  normalizeDeal,
  normalizeQuote,
  normalizeJob,
  normalizePayment,
  normalizeActiveJob,
  normalizeJobTyped,
  normalizeDealTyped,
} from "./dashboardNormalizers.js";

// ─── Shared Helpers ───────────────────────────────────────────────────────────

function getModels(plugin) {
  return {
    dealModel: plugin.switchTo("PeterpmDeal"),
    jobModel: plugin.switchTo("PeterpmJob"),
    spModel: plugin.switchTo("PeterpmServiceProvider"),
  };
}

function calcOffset(page, pageSize) {
  return (page - 1) * pageSize;
}

// ─── Base Query Factories ─────────────────────────────────────────────────────

function createDealsBaseQuery(plugin) {
  const { dealModel } = getModels(plugin);
  return applyInquiryBaseConditions(dealModel.query());
}

function createQuotesBaseQuery(plugin) {
  const { jobModel } = getModels(plugin);
  return applyQuoteBaseConditions(jobModel.query());
}

function createJobsBaseQuery(plugin, filters = {}) {
  const { jobModel } = getModels(plugin);
  if (String(filters?.queryPreset || "").trim() === "jobs-to-check") {
    return jobModel
      .query()
      .andWhere("job_status", "eq", "Call Back")
      .andWhere("priority", "eq", "High")
      .andWhere("Urgent_Calls", ">=", 1);
  }
  return applyJobBaseConditions(jobModel.query());
}

function createPaymentsBaseQuery(plugin, filters = {}) {
  const { jobModel } = getModels(plugin);
  const preset = String(filters?.queryPreset || "").trim();
  if (preset === "list-unpaid-invoices") {
    return jobModel.query().andWhere("job_status", "eq", "Waiting For Payment");
  }
  if (preset === "list-part-payments") {
    return jobModel
      .query()
      .andWhere("Part_Payment_Made", ">", 0)
      .andWhere("payment_status", "in", ["Invoice Sent", "Overdue"]);
  }
  return applyPaymentBaseConditions(jobModel.query());
}

function createActiveJobsBaseQuery(plugin) {
  const { jobModel } = getModels(plugin);
  return applyActiveJobBaseConditions(jobModel.query());
}

function createUrgentCallsBaseQuery(plugin) {
  const { jobModel } = getModels(plugin);
  return applyUrgentCallsBaseConditions(jobModel.query());
}

function createOpenTasksBaseQuery(plugin) {
  const { jobModel } = getModels(plugin);
  return applyOpenTasksBaseConditions(jobModel.query());
}

function createUrgentCallsDealBaseQuery(plugin) {
  const { dealModel } = getModels(plugin);
  return dealModel.query().andWhere("Urgent_Calls", ">=", 1).andWhere("inquiry_status", "neq", "Cancelled");
}

function createOpenTasksDealBaseQuery(plugin) {
  const { dealModel } = getModels(plugin);
  return dealModel.query().andWhere("open_tasks", ">=", 1).andWhere("inquiry_status", "neq", "Cancelled");
}

export function resolveBaseFactoryByTab(tabId) {
  switch (tabId) {
    case TAB_IDS.INQUIRY:
      return createDealsBaseQuery;
    case TAB_IDS.QUOTE:
      return createQuotesBaseQuery;
    case TAB_IDS.JOBS:
      return createJobsBaseQuery;
    case TAB_IDS.PAYMENT:
      return createPaymentsBaseQuery;
    case TAB_IDS.ACTIVE_JOBS:
      return createActiveJobsBaseQuery;
    case TAB_IDS.URGENT_CALLS:
      return createUrgentCallsBaseQuery;
    case TAB_IDS.OPEN_TASKS:
      return createOpenTasksBaseQuery;
    default:
      return null;
  }
}

// ─── Query Builders (for subscription use) ───────────────────────────────────
// Each returns { query, normalize } where:
//   query    — a .noDestroy() query ready for .subscribe() or .fetchDirect()
//   normalize — a function that maps a raw record to a display row

export function buildDealsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  const f = filters;

  let q = createDealsBaseQuery(plugin)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "created_at",
      "account_type",
      "inquiry_source",
    ])
    .include("Company", (sq) => sq.deSelectAll().select(["id", "name", "phone"]))
    .include("Primary_Contact", (sq) =>
      sq.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .include("Property", (sq) => sq.deSelectAll().select(["id", "property_name"]))
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    )
    .orderBy("created_at", sortOrder)
    .limit(pageSize)
    .offset(calcOffset(page, pageSize));

  q = applyDealFilters(q, f);
  q = applyQuickSearchDeal(q, searchQuery, searchSpIds);
  return { query: q.noDestroy(), normalize: normalizeDeal };
}

export function buildQuotesQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  const f = filters;
  let q = createQuotesBaseQuery(plugin)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "quote_status",
      "quote_total",
      "quote_date",
      "date_quoted_accepted",
      "account_type",
      "job_status",
      "created_at",
    ]);
  q = applyCommonJobFilters(q, f);
  q = applyQuoteTabStatusFilter(q, f);
  q = applyQuickSearchJob(q, searchQuery, searchSpIds);
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeQuote };
}

export function buildJobsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  return buildJobsLikeQuery(
    createJobsBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder,
    { searchQuery, searchSpIds }
  );
}

function buildJobsLikeQuery(baseFactory, plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  const f = filters;

  let q = baseFactory(plugin, f)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "date_started",
      "date_booked",
      "job_status",
      "job_total",
      "invoice_number",
      "account_type",
      "quote_status",
      "created_at",
    ]);
  q = applyCommonJobFilters(q, f);
  q = applyJobsTabStatusFilter(q, f);
  q = applyQuickSearchJob(q, searchQuery, searchSpIds);
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeJob };
}

export function buildUrgentCallsQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc",
  { searchQuery = "", searchSpIds = [] } = {}
) {
  const built = buildJobsLikeQuery(
    createUrgentCallsBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder,
    { searchQuery, searchSpIds }
  );
  return { ...built, normalize: normalizeJobTyped };
}

export function buildOpenTasksQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc",
  { searchQuery = "", searchSpIds = [] } = {}
) {
  const built = buildJobsLikeQuery(
    createOpenTasksBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder,
    { searchQuery, searchSpIds }
  );
  return { ...built, normalize: normalizeJobTyped };
}

export function buildUrgentCallsDealQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc",
  { searchQuery = "", searchSpIds = [] } = {}
) {
  const f = filters;
  let q = createUrgentCallsDealBaseQuery(plugin)
    .deSelectAll()
    .select(["id", "unique_id", "inquiry_status", "created_at", "account_type", "inquiry_source"]);
  q = applyDealIncludes(q);
  q = applyDealFilters(q, f);
  q = applyQuickSearchDeal(q, searchQuery, searchSpIds);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeDealTyped };
}

export function buildOpenTasksDealQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc",
  { searchQuery = "", searchSpIds = [] } = {}
) {
  const f = filters;
  let q = createOpenTasksDealBaseQuery(plugin)
    .deSelectAll()
    .select(["id", "unique_id", "inquiry_status", "created_at", "account_type", "inquiry_source"]);
  q = applyDealIncludes(q);
  q = applyDealFilters(q, f);
  q = applyQuickSearchDeal(q, searchQuery, searchSpIds);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeDealTyped };
}

export function buildPaymentsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  const f = filters;

  let q = createPaymentsBaseQuery(plugin, f)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "job_status",
      "invoice_number",
      "invoice_date",
      "invoice_total",
      "bill_time_paid",
      "xero_invoice_status",
      "account_type",
      "payment_status",
      "created_at",
    ]);
  q = applyCommonJobFilters(q, f, { statusField: "payment_status" });
  q = applyQuickSearchJob(q, searchQuery, searchSpIds);
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizePayment };
}

export function buildActiveJobsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc", { searchQuery = "", searchSpIds = [] } = {}) {
  const f = filters;
  let q = createActiveJobsBaseQuery(plugin)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "date_started",
      "date_completed",
      "job_status",
      "date_booked",
      "invoice_number",
      "account_type",
      "created_at",
    ]);
  q = applyCommonJobFilters(q, f, { statusField: "job_status" });
  q = applyQuickSearchJob(q, searchQuery, searchSpIds);
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeActiveJob };
}

// Re-export base query factories for use in dashboardCounting.js
export {
  createDealsBaseQuery,
  createQuotesBaseQuery,
  createJobsBaseQuery,
  createPaymentsBaseQuery,
  createActiveJobsBaseQuery,
  createUrgentCallsBaseQuery,
  createOpenTasksBaseQuery,
  createUrgentCallsDealBaseQuery,
  createOpenTasksDealBaseQuery,
};
