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
