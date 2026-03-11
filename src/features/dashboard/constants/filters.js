export function createInitialFilterState() {
  return {
    accountName: "",
    address: "",
    serviceman: "",
    quoteNumber: "",
    invoiceNumber: "",
    recommendation: "",
    priceMin: "",
    priceMax: "",
    dateFrom: "",
    dateTo: "",
    queryPreset: "",
    statuses: [],
    jobStatuses: [],
    priorities: [],
    serviceProviders: [],
    accountTypes: [],
    sources: [],
    urgentCallsMin: "",
    partPaymentMadeMin: "",
  };
}

export const INITIAL_FILTER_STATE = createInitialFilterState();

export function hasAnyDashboardFilterValues(filters = {}) {
  const f = filters && typeof filters === "object" ? filters : {};
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
  if (String(f.queryPreset || "").trim()) return true;
  if (Array.isArray(f.statuses) && f.statuses.length) return true;
  if (Array.isArray(f.jobStatuses) && f.jobStatuses.length) return true;
  if (Array.isArray(f.priorities) && f.priorities.length) return true;
  if (Array.isArray(f.serviceProviders) && f.serviceProviders.length) return true;
  if (Array.isArray(f.accountTypes) && f.accountTypes.length) return true;
  if (Array.isArray(f.sources) && f.sources.length) return true;
  if (String(f.urgentCallsMin || "").trim()) return true;
  if (String(f.partPaymentMadeMin || "").trim()) return true;
  return false;
}
