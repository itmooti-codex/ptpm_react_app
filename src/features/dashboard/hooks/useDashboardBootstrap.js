import { useEffect, useState } from "react";
import { useVitalStatsPlugin } from "@platform/vitalstats/useVitalStatsPlugin.js";
import { fetchServiceProviders } from "../api/dashboardApi.js";
import { readDashboardCache, writeDashboardCache } from "../api/dashboardCache.js";

const SERVICE_PROVIDER_CACHE_KEY = "service-providers";
const SERVICE_PROVIDER_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export function useDashboardBootstrap() {
  const { plugin, isReady: isSdkReady, error: sdkError } = useVitalStatsPlugin();
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [statusText, setStatusText] = useState("Starting app...");
  const [error, setError] = useState(null);
  const [serviceProviders, setServiceProviders] = useState(() => {
    const cached = readDashboardCache(SERVICE_PROVIDER_CACHE_KEY, {
      maxAgeMs: SERVICE_PROVIDER_CACHE_TTL_MS,
    });
    return Array.isArray(cached) ? cached : [];
  });

  // Unblock the dashboard as soon as the plugin is ready.
  useEffect(() => {
    if (sdkError) {
      setError(sdkError);
      setIsBootstrapping(false);
      setStatusText("Unable to start app.");
      return;
    }

    if (!isSdkReady || !plugin) {
      setStatusText("Starting app...");
      setIsBootstrapping(true);
      return;
    }

    // Plugin ready — show dashboard immediately.
    setError(null);
    setIsBootstrapping(false);
    setStatusText("Ready.");
  }, [plugin, isSdkReady, sdkError]);

  // Load service providers in the background (non-blocking).
  useEffect(() => {
    if (!plugin) return;
    let isActive = true;
    const timer = setTimeout(() => {
      fetchServiceProviders({ plugin })
        .then((records) => {
          if (!isActive) return;
          const next = Array.isArray(records) ? records : [];
          setServiceProviders(next);
          writeDashboardCache(SERVICE_PROVIDER_CACHE_KEY, next);
        })
        .catch((err) => {
          if (!isActive) return;
          console.error("[Dashboard] fetchServiceProviders failed", err);
        });
    }, 2500);

    return () => {
      isActive = false;
      clearTimeout(timer);
    };
  }, [plugin]);

  return {
    plugin,
    isSdkReady,
    isBootstrapping,
    statusText,
    error,
    serviceProviders,
  };
}
