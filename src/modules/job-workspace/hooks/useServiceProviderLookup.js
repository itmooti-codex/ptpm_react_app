import { useCallback } from "react";
import { useLookupFetch } from "@shared/hooks/useLookupFetch.js";
import { createTtlCache } from "@shared/utils/ttlCache.js";
import { fetchServiceProvidersForSearch } from "../sdk/core/runtime.js";

const SP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const spAllCache = createTtlCache("ptpm:sp-all:v1:", SP_TTL_MS);
const spAdminCache = createTtlCache("ptpm:sp-admin:v1:", SP_TTL_MS);

async function fetchAllServiceProviders({ plugin }) {
  const cached = spAllCache.get("records");
  if (cached) return cached;
  const records = await fetchServiceProvidersForSearch({ plugin });
  spAllCache.set("records", Array.isArray(records) ? records : []);
  return records;
}

async function fetchAdminProviders({ plugin }) {
  const cached = spAdminCache.get("records");
  if (cached) return cached;
  const records = await fetchServiceProvidersForSearch({ plugin, providerType: "Admin", status: "" });
  spAdminCache.set("records", Array.isArray(records) ? records : []);
  return records;
}

/**
 * Loads all service providers on mount with 5-minute in-memory + localStorage cache.
 * Suitable for the SP allocation dropdown.
 */
export function useServiceProviderLookup({ plugin, isSdkReady }) {
  return useLookupFetch({
    plugin,
    isSdkReady,
    fetchFn: fetchAllServiceProviders,
    logPrefix: "[ServiceProviderLookup]",
  });
}

/**
 * Loads Admin-type service providers on mount with 5-minute cache.
 * Suitable for "Taken By" / "Inquiry Taken By" dropdowns.
 */
export function useAdminProviderLookup({ plugin, isSdkReady }) {
  return useLookupFetch({
    plugin,
    isSdkReady,
    fetchFn: fetchAdminProviders,
    logPrefix: "[AdminProviderLookup]",
  });
}

/**
 * Wraps an async search callback with loading state management.
 * Useful for on-demand contact/company/property search inputs.
 *
 * @param {object} options
 * @param {boolean} options.isSdkReady
 * @param {object|null} options.plugin
 * @param {function} options.searchFn - async ({ plugin, query, ...opts }) => records[]
 * @param {object} [options.searchOptions] - extra options forwarded to searchFn
 * @param {function} options.setRecords - state setter for results
 * @param {function} options.setIsLoading - state setter for loading flag
 * @param {string} [options.logPrefix]
 * @returns {function} search callback that accepts a query string
 */
export function useSearchCallback({
  isSdkReady,
  plugin,
  searchFn,
  searchOptions,
  setRecords,
  setIsLoading,
  logPrefix = "[SearchCallback]",
}) {
  return useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setRecords([]);
        setIsLoading(false);
        return [];
      }
      setIsLoading(true);
      try {
        const results = await searchFn({ plugin, query: String(query || "").trim(), ...(searchOptions || {}) });
        const normalized = Array.isArray(results) ? results : [];
        setRecords(normalized);
        return normalized;
      } catch (error) {
        console.error(logPrefix, "Search failed", error);
        setRecords([]);
        return [];
      } finally {
        setIsLoading(false);
      }
    },
    [isSdkReady, plugin, searchFn, searchOptions, setRecords, setIsLoading, logPrefix]
  );
}
