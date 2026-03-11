import { useCallback, useState } from "react";
import { createInitialFilterState } from "../constants/filters.js";
import { TAB_LIST, TAB_IDS } from "../constants/tabs.js";

function normalizeFilterState(nextState = {}) {
  const initialState = createInitialFilterState();
  const source = nextState && typeof nextState === "object" ? nextState : {};
  return {
    ...initialState,
    ...source,
    statuses: Array.isArray(source.statuses) ? [...source.statuses] : [],
    jobStatuses: Array.isArray(source.jobStatuses) ? [...source.jobStatuses] : [],
    priorities: Array.isArray(source.priorities) ? [...source.priorities] : [],
    serviceProviders: Array.isArray(source.serviceProviders) ? [...source.serviceProviders] : [],
    accountTypes: Array.isArray(source.accountTypes) ? [...source.accountTypes] : [],
    sources: Array.isArray(source.sources) ? [...source.sources] : [],
  };
}

function createTabFilterMap() {
  return TAB_LIST.reduce((acc, tabId) => {
    acc[tabId] = createInitialFilterState();
    return acc;
  }, {});
}

export function useDashboardFilters() {
  const [filtersByTab, setFiltersByTab] = useState(() => createTabFilterMap());
  const [appliedFiltersByTab, setAppliedFiltersByTab] = useState(() => createTabFilterMap());

  const resolveTab = useCallback((tabId) => {
    return TAB_LIST.includes(tabId) ? tabId : TAB_IDS.INQUIRY;
  }, []);

  const getFiltersForTab = useCallback(
    (tabId) => filtersByTab[resolveTab(tabId)] || createInitialFilterState(),
    [filtersByTab, resolveTab]
  );

  const getAppliedFiltersForTab = useCallback(
    (tabId) => appliedFiltersByTab[resolveTab(tabId)] || createInitialFilterState(),
    [appliedFiltersByTab, resolveTab]
  );

  const patchFilter = useCallback((tabId, key, value) => {
    const resolvedTab = resolveTab(tabId);
    setFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: {
        ...(prev[resolvedTab] || createInitialFilterState()),
        [key]: value,
      },
    }));
  }, [resolveTab]);

  const toggleArrayFilter = useCallback((tabId, key, value) => {
    const resolvedTab = resolveTab(tabId);
    setFiltersByTab((prev) => {
      const currentTab = prev[resolvedTab] || createInitialFilterState();
      const current = Array.isArray(currentTab[key]) ? currentTab[key] : [];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];
      return {
        ...prev,
        [resolvedTab]: {
          ...currentTab,
          [key]: next,
        },
      };
    });
  }, [resolveTab]);

  const applyFilters = useCallback((tabId) => {
    const resolvedTab = resolveTab(tabId);
    const next = filtersByTab[resolvedTab] || createInitialFilterState();
    setAppliedFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: next,
    }));
    return next;
  }, [filtersByTab, resolveTab]);

  const applyPresetFilters = useCallback((tabId, nextFilters = {}) => {
    const resolvedTab = resolveTab(tabId);
    const next = normalizeFilterState(nextFilters);
    setFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: next,
    }));
    setAppliedFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: next,
    }));
    return next;
  }, [resolveTab]);

  const resetFilters = useCallback((tabId) => {
    const resolvedTab = resolveTab(tabId);
    const resetState = createInitialFilterState();
    setFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: resetState,
    }));
    setAppliedFiltersByTab((prev) => ({
      ...prev,
      [resolvedTab]: resetState,
    }));
    return resetState;
  }, [resolveTab]);

  const applyDateRange = useCallback((tabId, { dateFrom = "", dateTo = "" } = {}) => {
    const resolvedTab = resolveTab(tabId);
    const normalizedFrom = String(dateFrom || "").trim();
    const normalizedTo = String(dateTo || "").trim();

    setFiltersByTab((prev) => {
      const currentTab = prev[resolvedTab] || createInitialFilterState();
      const next = {
        ...currentTab,
        dateFrom: normalizedFrom,
        dateTo: normalizedTo,
      };
      setAppliedFiltersByTab((appliedPrev) => ({
        ...appliedPrev,
        [resolvedTab]: next,
      }));
      return {
        ...prev,
        [resolvedTab]: next,
      };
    });
    return { dateFrom: normalizedFrom, dateTo: normalizedTo };
  }, [resolveTab]);

  const removeAppliedFilter = useCallback((tabId, key, value) => {
    const resolvedTab = resolveTab(tabId);
    setAppliedFiltersByTab((prev) => {
      const currentTab = prev[resolvedTab] || createInitialFilterState();
      if (Array.isArray(currentTab[key])) {
        return {
          ...prev,
          [resolvedTab]: {
            ...currentTab,
            [key]: currentTab[key].filter((item) => item !== value),
          },
        };
      }
      return {
        ...prev,
        [resolvedTab]: {
          ...currentTab,
          [key]: "",
        },
      };
    });
    setFiltersByTab((prev) => {
      const currentTab = prev[resolvedTab] || createInitialFilterState();
      if (Array.isArray(currentTab[key])) {
        return {
          ...prev,
          [resolvedTab]: {
            ...currentTab,
            [key]: currentTab[key].filter((item) => item !== value),
          },
        };
      }
      return {
        ...prev,
        [resolvedTab]: {
          ...currentTab,
          [key]: "",
        },
      };
    });
  }, [resolveTab]);

  function getActiveChips(applied, { serviceProviders = [] } = {}) {
    const spById = Object.fromEntries(serviceProviders.map((sp) => [sp.id, sp.name]));
    const chips = [];
    Object.entries(applied).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          let label = item;
          if (key === "serviceProviders") {
            label = spById[item] || item;
          } else if (key === "jobStatuses") {
            label = `Job Status: ${item}`;
          } else if (key === "priorities") {
            label = `Priority: ${item}`;
          }
          chips.push({ key, value: item, label });
        });
      } else if (value) {
        const labelMap = {
          accountName: "Account",
          address: "Address",
          serviceman: "Serviceman",
          quoteNumber: "Quote #",
          invoiceNumber: "Invoice #",
          recommendation: "Recommendation",
          priceMin: "Min Price",
          priceMax: "Max Price",
          dateFrom: "From",
          dateTo: "To",
        };
        const label =
          key === "queryPreset"
            ? value === "jobs-to-check"
              ? "Jobs To Check"
              : value === "list-unpaid-invoices"
                ? "List Unpaid Invoices"
                : value === "list-part-payments"
                  ? "List Part Payments"
                  : `${value}`
            : key === "urgentCallsMin"
            ? `Urgent Calls >= ${value}`
            : key === "partPaymentMadeMin"
              ? `Part Payment > ${value}`
              : `${labelMap[key] || key}: ${value}`;
        chips.push({ key, value, label });
      }
    });
    return chips;
  }

  return {
    filtersByTab,
    appliedFiltersByTab,
    getFiltersForTab,
    getAppliedFiltersForTab,
    patchFilter,
    toggleArrayFilter,
    applyFilters,
    applyPresetFilters,
    applyDateRange,
    resetFilters,
    removeAppliedFilter,
    getActiveChips,
  };
}
