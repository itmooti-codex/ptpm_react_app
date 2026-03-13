import { toEpochRange } from "@shared/api/dashboardCore.js";
import { TAB_IDS } from "../constants/tabs.js";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ACCOUNT_TYPE_MAP = { Individual: "Contact", Entity: "Company" };
export const QUOTE_TAB_QUOTE_STATUSES = ["New", "Requested", "Sent", "Declined"];
export const JOB_TAB_JOB_STATUSES = ["On Hold", "Booked", "Call Back", "Scheduled", "Reschedule"];
export const PAYMENT_TAB_JOB_STATUSES = ["Waiting For Payment", "Completed"];
export const PAYMENT_TAB_PAYMENT_STATUSES = [
  "Invoice Required",
  "Invoice Sent",
  "Paid",
  "Overdue",
  "Written Off",
];
export const ACTIVE_JOB_STATUSES = ["In Progress", "In progress"];

// ─── Deal (Inquiry) Filters ───────────────────────────────────────────────────

export function applyDealFilters(q, f) {
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

export function applyCommonJobFilters(q, f, { dateField = "created_at", statusField } = {}) {
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

export function applyInquiryBaseConditions(q) {
  return q
    .andWhere("inquiry_status", "neq", "Cancelled")
    .andWhere("inquiry_status", "neq", "Expired");
}

export function applyQuoteBaseConditions(q) {
  return q
    .andWhere((sq) => {
      sq.where("quote_status", "in", QUOTE_TAB_QUOTE_STATUSES).orWhere(
        "job_status",
        "eq",
        "Quote"
      );
    });
}

export function applyJobBaseConditions(q) {
  return q.andWhere((sq) => {
    sq.where("job_status", "in", JOB_TAB_JOB_STATUSES).orWhere(
      "quote_status",
      "eq",
      "Accepted"
    );
  });
}

export function applyUrgentCallsBaseConditions(q) {
  return q.andWhere("Urgent_Calls", ">=", 1).andWhere("job_status", "neq", "Cancelled");
}

export function applyOpenTasksBaseConditions(q) {
  return q.andWhere("open_tasks", ">=", 1).andWhere("job_status", "neq", "Cancelled");
}

export function applyPaymentBaseConditions(q) {
  return q
    .andWhere("job_status", "in", PAYMENT_TAB_JOB_STATUSES)
    .andWhere("payment_status", "in", PAYMENT_TAB_PAYMENT_STATUSES);
}

export function applyActiveJobBaseConditions(q) {
  return q.andWhere("job_status", "in", ACTIVE_JOB_STATUSES);
}

export function applyJobsTabStatusFilter(q, f) {
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

export function applyQuoteTabStatusFilter(q, f) {
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

// ─── Quick Search (server-side OR across key fields) ──────────────────────────

export function applyQuickSearchDeal(q, searchQuery, searchSpIds) {
  if (!searchQuery) return q;
  const like = `%${searchQuery}%`;
  return q.andWhere((sq) => {
    sq.where("unique_id", "like", like)
      .orWhere("inquiry_status", "like", like)
      .orWhere("inquiry_source", "like", like)
      .orWhere("Primary_Contact", (sq2) => {
        sq2.where("first_name", "like", like)
          .orWhere("last_name", "like", like)
          .orWhere("email", "like", like)
          .orWhere("sms_number", "like", like);
      })
      .orWhere("Company", (sq2) => sq2.where("name", "like", like))
      .orWhere("Property", (sq2) => sq2.where("property_name", "like", like));
    if (Array.isArray(searchSpIds) && searchSpIds.length) {
      sq.orWhere("service_provider_id", "in", searchSpIds);
    }
  });
}

export function applyQuickSearchJob(q, searchQuery, searchSpIds) {
  if (!searchQuery) return q;
  const like = `%${searchQuery}%`;
  return q.andWhere((sq) => {
    sq.where("unique_id", "like", like)
      .orWhere("job_status", "like", like)
      .orWhere("quote_status", "like", like)
      .orWhere("payment_status", "like", like)
      .orWhere("invoice_number", "like", like)
      .orWhere("Client_Individual", (sq2) => {
        sq2.where("first_name", "like", like)
          .orWhere("last_name", "like", like)
          .orWhere("email", "like", like)
          .orWhere("sms_number", "like", like);
      })
      .orWhere("Client_Entity", (sq2) => sq2.where("name", "like", like))
      .orWhere("Property", (sq2) => sq2.where("property_name", "like", like));
    if (Array.isArray(searchSpIds) && searchSpIds.length) {
      sq.orWhere("primary_service_provider_id", "in", searchSpIds);
    }
  });
}

export function isDealTab(tabId) {
  return tabId === TAB_IDS.INQUIRY;
}

export function applyTabFiltersToQuery(q, tabId, filters = {}) {
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
