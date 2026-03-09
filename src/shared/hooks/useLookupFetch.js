import { useEffect, useRef, useState } from "react";

/**
 * Fetches a list of records once on mount (and whenever plugin/isSdkReady changes).
 * Handles the cancelled-flag pattern to avoid setState after unmount.
 *
 * @param {object} options
 * @param {object|null} options.plugin - VitalStats plugin instance
 * @param {boolean} options.isSdkReady - whether the SDK is ready to use
 * @param {function} options.fetchFn - async ({ plugin, ...fetchOptions }) => records[]
 * @param {object} [options.fetchOptions] - extra args forwarded to fetchFn (must be stable)
 * @param {string} [options.logPrefix] - prefix for console.error messages
 * @returns {{ records: any[], isLoading: boolean }}
 */
export function useLookupFetch({ plugin, isSdkReady, fetchFn, fetchOptions, logPrefix = "[useLookupFetch]" }) {
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const fetchOptionsRef = useRef(fetchOptions);
  fetchOptionsRef.current = fetchOptions;

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setRecords([]);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    fetchFn({ plugin, ...(fetchOptionsRef.current || {}) })
      .then((result) => {
        if (cancelled) return;
        setRecords(Array.isArray(result) ? result : []);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error(logPrefix, "Failed to fetch lookup data", error);
        setRecords([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, fetchFn, logPrefix]);

  return { records, isLoading };
}
