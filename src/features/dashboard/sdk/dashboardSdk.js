import {
  fetchDirectWithTimeout,
  extractFromPayload,
  formatUnixDate,
  toEpochRange,
} from "@shared/sdk/dashboardCore.js";
import { hasAnyDashboardFilterValues } from "../constants/filters.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/job-workspace/public/sdk.js";
import { TAB_IDS } from "../constants/tabs.js";

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

function firstRecordFromAnyPayload(payload) {
  const records = extractFromPayload(payload);
  return Array.isArray(records) && records.length ? records[0] : null;
}

function extractCreatedRecordId(result, modelKey) {
  const managed = result?.mutations?.[modelKey]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }

  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }

  return "";
}

function clientName(contact) {
  if (!contact) return "";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

function spName(sp) {
  if (!sp) return "";
  const info = sp.Contact_Information ?? sp;
  return [info.first_name, info.last_name].filter(Boolean).join(" ").trim();
}

// ─── Deal (Inquiry) Filters ───────────────────────────────────────────────────

const ACCOUNT_TYPE_MAP = { Individual: "Contact", Entity: "Company" };
const QUOTE_TAB_QUOTE_STATUSES = ["New", "Requested", "Sent", "Declined"];
const JOB_TAB_JOB_STATUSES = ["On Hold", "Booked", "Call Back", "Scheduled", "Reschedule"];
const PAYMENT_TAB_JOB_STATUSES = ["Waiting For Payment", "Completed"];
const PAYMENT_TAB_PAYMENT_STATUSES = [
  "Invoice Required",
  "Invoice Sent",
  "Paid",
  "Overdue",
  "Written Off",
];
const ACTIVE_JOB_STATUSES = ["In Progress", "In progress"];

function applyDealFilters(q, f) {
  const like = (s) => `%${s}%`;
  const { startEpoch, endEpoch } = toEpochRange(f.dateFrom, f.dateTo);

  if (Array.isArray(f.statuses) && f.statuses.length) {
    q = q.andWhere("inquiry_status", "in", f.statuses);
  }
  if (Array.isArray(f.serviceProviders) && f.serviceProviders.length) {
    q = q.andWhere("service_provider_id", "in", f.serviceProviders);
  }
  if (f.accountName) {
    const lv = like(f.accountName);
    q = q.andWhere((sq) => {
      sq.where("Company", (sq2) => sq2.where("name", "like", lv)).orWhere(
        "Primary_Contact",
        (sq2) => {
          sq2.where("first_name", "like", lv).orWhere("last_name", "like", lv);
        }
      );
    });
  }
  if (Array.isArray(f.accountTypes) && f.accountTypes.length) {
    const mapped = f.accountTypes.map((t) => ACCOUNT_TYPE_MAP[t] ?? t);
    q = q.andWhere("account_type", "in", mapped);
  }
  if (f.address) {
    q = q.andWhere("Property", (sq) => {
      sq.where("property_name", "like", like(f.address));
    });
  }
  if (Array.isArray(f.sources) && f.sources.length) {
    q = q.andWhere("inquiry_source", "in", f.sources);
  }
  if (startEpoch != null || endEpoch != null) {
    q = q.andWhere((sq) => {
      if (startEpoch != null) sq.andWhere("created_at", ">=", startEpoch);
      if (endEpoch != null) sq.andWhere("created_at", "<=", endEpoch);
    });
  }
  return q;
}

// ─── Job Shared Filters ───────────────────────────────────────────────────────

function applyCommonJobFilters(q, f, { dateField = "created_at", statusField } = {}) {
  const like = (s) => `%${s}%`;
  const { startEpoch, endEpoch } = toEpochRange(f.dateFrom, f.dateTo);
  const urgentCallsMin = Number(f.urgentCallsMin);
  const partPaymentMadeMin = Number(f.partPaymentMadeMin);

  if (statusField && Array.isArray(f.statuses) && f.statuses.length) {
    q = q.andWhere(statusField, "in", f.statuses);
  }
  if (Array.isArray(f.jobStatuses) && f.jobStatuses.length) {
    q = q.andWhere("job_status", "in", f.jobStatuses);
  }
  if (Array.isArray(f.priorities) && f.priorities.length) {
    q = q.andWhere("priority", "in", f.priorities);
  }
  if (Array.isArray(f.serviceProviders) && f.serviceProviders.length) {
    q = q.andWhere("primary_service_provider_id", "in", f.serviceProviders);
  }
  if (f.quoteNumber) {
    q = q.andWhere("unique_id", "like", like(f.quoteNumber));
  }
  if (f.invoiceNumber) {
    q = q.andWhere("invoice_number", "like", like(f.invoiceNumber));
  }
  if (f.recommendation) {
    q = q.andWhere("admin_recommendation", "like", like(f.recommendation));
  }
  if (f.priceMin !== "" && f.priceMin != null) {
    q = q.andWhere("quote_total", ">=", Number(f.priceMin));
  }
  if (f.priceMax !== "" && f.priceMax != null) {
    q = q.andWhere("quote_total", "<=", Number(f.priceMax));
  }
  if (f.urgentCallsMin !== "" && Number.isFinite(urgentCallsMin)) {
    q = q.andWhere("Urgent_Calls", ">=", urgentCallsMin);
  }
  if (f.partPaymentMadeMin !== "" && Number.isFinite(partPaymentMadeMin)) {
    q = q.andWhere("Part_Payment_Made", ">", partPaymentMadeMin);
  }
  if (startEpoch != null || endEpoch != null) {
    q = q.andWhere((sq) => {
      if (startEpoch != null && dateField) sq.andWhere(dateField, ">=", startEpoch);
      if (endEpoch != null && dateField) sq.andWhere(dateField, "<=", endEpoch);
    });
  }
  if (f.address) {
    q = q.andWhere("Property", (sq) => {
      sq.andWhere("property_name", "like", like(f.address));
    });
  }
  if (f.accountName) {
    const lv = like(f.accountName);
    q = q.andWhere((sq) => {
      sq.where("Client_Entity", (sq2) => sq2.where("name", "like", lv)).orWhere(
        "Client_Individual",
        (sq2) => {
          sq2.where("first_name", "like", lv).orWhere("last_name", "like", lv);
        }
      );
    });
  }
  if (Array.isArray(f.accountTypes) && f.accountTypes.length) {
    const mapped = f.accountTypes.map((t) => ACCOUNT_TYPE_MAP[t] ?? t);
    q = q.andWhere("Client_Entity", (sq) => {
      sq.andWhere("type", "in", mapped);
    });
  }
  if (Array.isArray(f.sources) && f.sources.length) {
    q = q.andWhere("Inquiry_Record", (sq) => {
      sq.andWhere("how_did_you_hear", "in", f.sources);
    });
  }
  return q;
}

function applyInquiryBaseConditions(q) {
  return q
    .andWhere("inquiry_status", "neq", "Cancelled")
    .andWhere("inquiry_status", "neq", "Expired");
}

function applyQuoteBaseConditions(q) {
  return q
    .andWhere((sq) => {
      sq.where("quote_status", "in", QUOTE_TAB_QUOTE_STATUSES).orWhere(
        "job_status",
        "eq",
        "Quote"
      );
    });
}

function applyJobBaseConditions(q) {
  return q.andWhere((sq) => {
    sq.where("job_status", "in", JOB_TAB_JOB_STATUSES).orWhere(
      "quote_status",
      "eq",
      "Accepted"
    );
  });
}

function applyUrgentCallsBaseConditions(q) {
  return q.andWhere("Urgent_Calls", ">=", 1).andWhere("job_status", "neq", "Cancelled");
}

function applyOpenTasksBaseConditions(q) {
  return q.andWhere("open_tasks", ">=", 1).andWhere("job_status", "neq", "Cancelled");
}

function applyPaymentBaseConditions(q) {
  return q
    .andWhere("job_status", "in", PAYMENT_TAB_JOB_STATUSES)
    .andWhere("payment_status", "in", PAYMENT_TAB_PAYMENT_STATUSES);
}

function applyActiveJobBaseConditions(q) {
  return q.andWhere("job_status", "in", ACTIVE_JOB_STATUSES);
}

function applyJobsTabStatusFilter(q, f) {
  if (!Array.isArray(f.statuses) || !f.statuses.length) return q;
  const requested = f.statuses.map((item) => String(item || "").trim());
  const jobStatuses = requested.filter((status) => JOB_TAB_JOB_STATUSES.includes(status));
  const includeAccepted = requested.includes("Accepted");

  if (!jobStatuses.length && !includeAccepted) return q;

  return q.andWhere((sq) => {
    if (jobStatuses.length) {
      sq.where("job_status", "in", jobStatuses);
    }
    if (includeAccepted) {
      if (jobStatuses.length) {
        sq.orWhere("quote_status", "eq", "Accepted");
      } else {
        sq.where("quote_status", "eq", "Accepted");
      }
    }
  });
}

function applyQuoteTabStatusFilter(q, f) {
  if (!Array.isArray(f.statuses) || !f.statuses.length) return q;
  const requested = f.statuses.map((item) => String(item || "").trim());
  const quoteStatuses = requested.filter((status) => QUOTE_TAB_QUOTE_STATUSES.includes(status));
  const includeQuoteStatus = requested.includes("Quote");
  if (!quoteStatuses.length && !includeQuoteStatus) return q;

  return q.andWhere((sq) => {
    if (quoteStatuses.length) {
      sq.where("quote_status", "in", quoteStatuses);
    }
    if (includeQuoteStatus) {
      if (quoteStatuses.length) {
        sq.orWhere("job_status", "eq", "Quote");
      } else {
        sq.where("job_status", "eq", "Quote");
      }
    }
  });
}

// ─── Shared Job Includes ──────────────────────────────────────────────────────

function applyJobIncludes(q) {
  return q
    .include("Client_Individual", (sq) =>
      sq.select(["id", "first_name", "last_name", "email", "sms_number", "address_1"])
    )
    .include("Property", (sq) => sq.deSelectAll().select(["id", "property_name"]))
    .include("Primary_Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    )
    .include("Client_Entity", (sq) =>
      sq.deSelectAll().select(["id", "name", "type", "account_type", "phone"])
    )
    .include("Inquiry_Record", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "unique_id", "inquiry_status", "type", "how_did_you_hear"])
        .include("Service_Inquiry", (sq2) => sq2.deSelectAll().select(["service_name"]))
    );
}

function resolveClientDetails(rec) {
  const accountType = String(rec?.account_type ?? rec?.Account_Type ?? "").trim();
  const isCompany = accountType === "Company" || accountType === "Entity";

  // Try nested objects first (subscription), then flat fields (fetchDirect)
  const clientIndividual = rec?.Client_Individual ?? rec?.client_individual ?? {
    first_name: rec?.client_individual_first_name ?? rec?.Client_Individual_First_Name,
    last_name: rec?.client_individual_last_name ?? rec?.Client_Individual_Last_Name,
    sms_number: rec?.client_individual_sms_number ?? rec?.Client_Individual_Sms_Number,
    email: rec?.client_individual_email ?? rec?.Client_Individual_Email,
  };
  const clientEntity = rec?.Client_Entity ?? rec?.client_entity ?? {
    name: rec?.client_entity_name ?? rec?.Client_Entity_Name,
    phone: rec?.client_entity_phone ?? rec?.Client_Entity_Phone,
  };

  if (isCompany) {
    return {
      clientName: String(clientEntity?.name || "").trim(),
      phone: String(clientEntity?.phone || "").trim(),
      email: "",
    };
  }

  return {
    clientName: clientName(clientIndividual),
    phone: String(clientIndividual?.sms_number || "").trim(),
    email: String(clientIndividual?.email || "").trim(),
  };
}

// ─── Row Normalizers ──────────────────────────────────────────────────────────

function normalizeDeal(rec) {
  const accountType = (rec.account_type ?? rec.Account_Type ?? "").trim();
  const isCompany = accountType === "Company";

  const company = rec.Company ?? rec.company ?? {
    name: rec?.company_name ?? rec?.Company_Name,
    phone: rec?.company_phone ?? rec?.Company_Phone,
  };
  const primaryContact = rec.Primary_Contact ?? rec.primary_contact ?? {
    first_name: rec?.primary_contact_first_name ?? rec?.Primary_Contact_First_Name,
    last_name: rec?.primary_contact_last_name ?? rec?.Primary_Contact_Last_Name,
    sms_number: rec?.primary_contact_sms_number ?? rec?.Primary_Contact_Sms_Number,
    email: rec?.primary_contact_email ?? rec?.Primary_Contact_Email,
  };
  const property = rec.Property ?? rec.property ?? {
    property_name: rec?.property_property_name ?? rec?.Property_Property_Name,
  };
  const serviceProvider = rec.Service_Provider ?? rec.service_provider ?? {};

  const name = isCompany ? (company?.name ?? "") : clientName(primaryContact);
  const phone = isCompany ? (company?.phone ?? "") : (primaryContact?.sms_number ?? "");
  const email = isCompany ? "" : (primaryContact?.email ?? "");

  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.Date_Added),
    clientName: name,
    phone,
    email,
    address: property?.property_name ?? "",
    source: rec.inquiry_source ?? rec.how_did_you_hear ?? rec.How_did_you_hear ?? "",
    status: rec.inquiry_status ?? rec.Inquiry_Status ?? "",
    serviceProvider: spName(serviceProvider),
  };
}

function normalizeQuote(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.quote_date ?? rec.Quote_Date),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    quoteNumber: rec.unique_id ?? rec.Unique_ID ?? "",
    amount: rec.quote_total ?? rec.Quote_Total ?? 0,
    status: rec.quote_status ?? rec.Quote_Status ?? rec.job_status ?? rec.Job_Status ?? "",
  };
}

function normalizeJob(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(
      rec.created_at ?? rec.date_started ?? rec.Date_Started ?? rec.date_booked ?? rec.Date_Booked
    ),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    jobNumber: rec.unique_id ?? rec.Unique_ID ?? "",
    status: rec.job_status ?? rec.Job_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider ?? rec.primary_service_provider),
  };
}

function normalizePayment(rec) {
  const client = resolveClientDetails(rec);
  const isPaid = !!(rec.bill_time_paid ?? rec.Bill_Time_Paid);
  const total = rec.invoice_total ?? rec.Invoice_Total ?? 0;
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.invoice_date ?? rec.Invoice_Date),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    invoiceNumber: rec.invoice_number ?? rec.Invoice_Number ?? "",
    amount: total,
    paid: isPaid ? total : 0,
    balance: isPaid ? 0 : total,
    jobStatus: rec.job_status ?? rec.Job_Status ?? "",
    status: rec.payment_status ?? rec.Payment_Status ?? "",
  };
}

function normalizeActiveJob(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    scheduledDate: formatUnixDate(rec.created_at ?? rec.date_booked ?? rec.Date_Booked),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: rec.Property?.property_name ?? "",
    status: rec.job_status ?? rec.Job_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider),
    invoiceNumber: rec.invoice_number ?? "",
  };
}

// Typed normalizers for combined tabs (urgent calls / open tasks).
// Add recordType + _rawTs so the combined view can distinguish and sort rows.
function normalizeJobTyped(rec) {
  return {
    ...normalizeJob(rec),
    recordType: "job",
    _rawTs: Number(rec.created_at ?? rec.date_started ?? rec.date_booked ?? 0),
  };
}

function normalizeDealTyped(rec) {
  return {
    ...normalizeDeal(rec),
    recordType: "inquiry",
    _rawTs: Number(rec.created_at ?? rec.Date_Added ?? 0),
  };
}

function applyDealIncludes(q) {
  return q
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
    );
}

// ─── Query Builders (for subscription use) ───────────────────────────────────
// Each returns { query, normalize } where:
//   query    — a .noDestroy() query ready for .subscribe() or .fetchDirect()
//   normalize — a function that maps a raw record to a display row

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

function resolveBaseFactoryByTab(tabId) {
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

function applyTabFiltersToQuery(q, tabId, filters = {}) {
  const f = filters && typeof filters === "object" ? filters : {};
  if (tabId === TAB_IDS.INQUIRY) {
    return applyDealFilters(q, f);
  }
  if (tabId === TAB_IDS.QUOTE) {
    return applyQuoteTabStatusFilter(applyCommonJobFilters(q, f), f);
  }
  if (
    tabId === TAB_IDS.JOBS ||
    tabId === TAB_IDS.URGENT_CALLS ||
    tabId === TAB_IDS.OPEN_TASKS
  ) {
    return applyJobsTabStatusFilter(applyCommonJobFilters(q, f), f);
  }
  if (tabId === TAB_IDS.PAYMENT) {
    return applyCommonJobFilters(q, f, { statusField: "payment_status" });
  }
  if (tabId === TAB_IDS.ACTIVE_JOBS) {
    return applyCommonJobFilters(q, f, { statusField: "job_status" });
  }
  return q;
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
} = {}) {
  const baseFactory = resolveBaseFactoryByTab(tabId);
  if (!baseFactory) return null;

  const q = applyTabFiltersToQuery(baseFactory(plugin, filters), tabId, filters);
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

export function buildDealsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
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
  return { query: q.noDestroy(), normalize: normalizeDeal };
}

export function buildQuotesQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
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
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeQuote };
}

export function buildJobsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
  return buildJobsLikeQuery(
    createJobsBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder
  );
}

function buildJobsLikeQuery(baseFactory, plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
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
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeJob };
}

export function buildUrgentCallsQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc"
) {
  const built = buildJobsLikeQuery(
    createUrgentCallsBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder
  );
  return { ...built, normalize: normalizeJobTyped };
}

export function buildOpenTasksQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc"
) {
  const built = buildJobsLikeQuery(
    createOpenTasksBaseQuery,
    plugin,
    filters,
    page,
    pageSize,
    sortOrder
  );
  return { ...built, normalize: normalizeJobTyped };
}

export function buildUrgentCallsDealQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc"
) {
  const f = filters;
  let q = createUrgentCallsDealBaseQuery(plugin)
    .deSelectAll()
    .select(["id", "unique_id", "inquiry_status", "created_at", "account_type", "inquiry_source"]);
  q = applyDealIncludes(q);
  q = applyDealFilters(q, f);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeDealTyped };
}

export function buildOpenTasksDealQuery(
  plugin,
  filters = {},
  page = 1,
  pageSize = 25,
  sortOrder = "desc"
) {
  const f = filters;
  let q = createOpenTasksDealBaseQuery(plugin)
    .deSelectAll()
    .select(["id", "unique_id", "inquiry_status", "created_at", "account_type", "inquiry_source"]);
  q = applyDealIncludes(q);
  q = applyDealFilters(q, f);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeDealTyped };
}

export function buildPaymentsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
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
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizePayment };
}

export function buildActiveJobsQuery(plugin, filters = {}, page = 1, pageSize = 25, sortOrder = "desc") {
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
  q = applyJobIncludes(q);
  q = q.orderBy("created_at", sortOrder).limit(pageSize).offset(calcOffset(page, pageSize));
  return { query: q.noDestroy(), normalize: normalizeActiveJob };
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

export async function fetchTabCountByTab({ plugin, tabId, filters = null } = {}) {
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
    if (hasAnyDashboardFilterValues(filters || {})) {
      return await fetchCountByPagedQuery(
        ({ limit, offset }) =>
          buildFilteredCountPageQuery({
            plugin,
            tabId,
            filters,
            limit,
            offset,
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

// ─── fetchServiceProviders ────────────────────────────────────────────────────

export async function fetchServiceProviders({ plugin } = {}) {
  if (!plugin) return [];
  const mapServiceProviderRows = (rows) =>
    rows
      .map((rec) => {
        const id = String(rec.id ?? rec.ID ?? "").trim();
        const firstName = String(
          rec?.contact_information_first_name ??
            rec?.Contact_Information_First_Name ??
            rec?.Contact_Information?.first_name ??
            ""
        ).trim();
        const lastName = String(
          rec?.contact_information_last_name ??
            rec?.Contact_Information_Last_Name ??
            rec?.Contact_Information?.last_name ??
            ""
        ).trim();
        const name = [firstName, lastName].filter(Boolean).join(" ").trim();
        return { id, name };
      })
      .filter((sp) => sp.id && sp.name)
      .sort((a, b) => a.name.localeCompare(b.name));

  try {
    const { spModel } = getModels(plugin);
    const gqlQuery = spModel.query().fromGraphql(`
      query calcServiceProviders {
        calcServiceProviders(
          query: [
            { where: { type: "Service Provider" } }
          ]
        ) {
          ID: field(arg: ["id"])
          Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
          Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
        }
      }
    `);
    const res = await fetchDirectWithTimeout(gqlQuery, null, 12000);
    const records = extractFromPayload(res);
    const mapped = mapServiceProviderRows(records);
    if (mapped.length) return mapped;
  } catch (err) {
    console.warn("[dashboardSdk] custom service provider query failed, using include fallback", err);
  }

  try {
    const { spModel } = getModels(plugin);
    const q = spModel
      .query()
      .deSelectAll()
      .select(["id", "type"])
      .where("type", "Service Provider")
      .include("Contact_Information", (sq) =>
        sq.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(100)
      .noDestroy();
    q.getOrInitQueryCalc?.();
    const res = await fetchDirectWithTimeout(q, null, 12000);
    const records = Array.isArray(res?.resp) ? res.resp : [];
    return mapServiceProviderRows(records);
  } catch (err) {
    console.error("[dashboardSdk] fetchServiceProviders failed", err);
    return [];
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

export async function fetchNotifications(_args = {}) {
  return [];
}

export async function fetchCalendarData(_args = {}) {
  return {};
}

export async function createTask(_args = {}) {
  return null;
}

function normalizeMutationError(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    const message = extractMutationErrorMessage(failure.statusMessage);
    if (message) return message;
  }
  return String(fallbackMessage || "Operation failed.");
}

export async function createJobRecord({ plugin, payload = null } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const { jobModel } = getModels(plugin);
  const mutation = await jobModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Job create was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create job."
    );
  }

  const createdId = extractCreatedRecordId(result, "PeterpmJob");
  if (!isPersistedId(createdId)) {
    throw new Error(normalizeMutationError(result, "Job create did not return an ID."));
  }

  const detailQuery = jobModel
    .query()
    .where("id", createdId)
    .deSelectAll()
    .select(["id", "unique_id", "job_status"])
    .noDestroy();
  detailQuery.getOrInitQueryCalc?.();
  const detailResult = await fetchDirectWithTimeout(detailQuery);
  const record = firstRecordFromAnyPayload(detailResult);
  if (!record) {
    throw new Error("Job created but failed to load job details.");
  }

  const id = String(record?.id ?? record?.ID ?? createdId).trim();
  const uniqueId = String(record?.unique_id ?? record?.Unique_ID ?? "").trim();
  const jobStatus = String(record?.job_status ?? record?.Job_Status ?? "").trim();

  return {
    id,
    unique_id: uniqueId,
    job_status: jobStatus,
  };
}

export async function cancelInquiryById({ plugin, dealId } = {}) {
  return cancelDashboardRecord({
    plugin,
    tabId: TAB_IDS.INQUIRY,
    recordId: dealId,
  });
}

export async function cancelDashboardRecord({ plugin, tabId, recordId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = String(recordId ?? "").trim();
  if (!normalizedId) {
    throw new Error("Record ID is missing.");
  }

  const isInquiry = tabId === TAB_IDS.INQUIRY;
  const isQuote = tabId === TAB_IDS.QUOTE;
  const isPayment = tabId === TAB_IDS.PAYMENT;

  const model = isInquiry ? getModels(plugin).dealModel : getModels(plugin).jobModel;
  const statusField = isInquiry
    ? "inquiry_status"
    : isQuote
      ? "quote_status"
      : isPayment
        ? "payment_status"
        : "job_status";

  const mutation = await model.mutation();
  mutation.update((query) =>
    query.where("id", normalizedId).set({
      [statusField]: "Cancelled",
    })
  );

  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Record update was cancelled."));
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to cancel record."
    );
  }

  const verifyQuery = model
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select(["id", statusField])
    .noDestroy();
  verifyQuery.getOrInitQueryCalc?.();
  const verifyResult = await fetchDirectWithTimeout(verifyQuery);
  const record = firstRecordFromAnyPayload(verifyResult);
  if (!record) {
    throw new Error("Record update succeeded but verification failed.");
  }

  const nextStatus = String(record?.[statusField] ?? "").trim();
  if (nextStatus.toLowerCase() !== "cancelled") {
    throw new Error("Record status update was not applied.");
  }

  return {
    statusField,
    status: nextStatus,
  };
}

export async function cancelDashboardRecordsByUniqueIds({
  plugin,
  tabId,
  uniqueIds = [],
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const ids = Array.from(
    new Set(
      (Array.isArray(uniqueIds) ? uniqueIds : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return { cancelled: 0 };

  const isInquiry = tabId === TAB_IDS.INQUIRY;
  const isQuote = tabId === TAB_IDS.QUOTE;
  const isPayment = tabId === TAB_IDS.PAYMENT;

  const model = isInquiry ? getModels(plugin).dealModel : getModels(plugin).jobModel;
  const statusField = isInquiry
    ? "inquiry_status"
    : isQuote
      ? "quote_status"
      : isPayment
        ? "payment_status"
        : "job_status";

  const mutation = await model.mutation();
  ids.forEach((uid) => {
    mutation.update((query) =>
      query.where("unique_id", uid).set({
        [statusField]: "Cancelled",
      })
    );
  });

  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Record update was cancelled."));
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to cancel selected records."
    );
  }

  return { cancelled: ids.length, statusField };
}
