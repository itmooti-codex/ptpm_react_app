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
    statuses: [],
    serviceProviders: [],
    accountTypes: [],
    sources: [],
  };
}

export const INITIAL_FILTER_STATE = createInitialFilterState();
