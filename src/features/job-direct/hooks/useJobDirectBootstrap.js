import { useEffect, useState } from "react";
import {
  fetchCompaniesForSearch,
  fetchContactsForSearch,
  fetchJobDirectDataByUid,
  fetchPropertiesForSearch,
  fetchServiceProvidersForSearch,
} from "@modules/job-workspace/public/sdk.js";

const LOOKUP_CACHE_TTL_MS = 5 * 60 * 1000;
const LOOKUP_CACHE_KEY = "ptpm:job-direct:lookup-cache:v2";
const ENABLE_BACKGROUND_LOOKUP_PRELOAD = false;

function getDefaultLookupData() {
  return {
    contacts: [],
    companies: [],
    properties: [],
    serviceProviders: [],
  };
}

function toSafeArray(value) {
  return Array.isArray(value) ? value : [];
}

function readLookupCache() {
  try {
    const raw = window.localStorage.getItem(LOOKUP_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!cachedAt || Date.now() - cachedAt > LOOKUP_CACHE_TTL_MS) {
      return null;
    }

    return {
      contacts: toSafeArray(parsed?.contacts),
      companies: toSafeArray(parsed?.companies),
      properties: toSafeArray(parsed?.properties),
      serviceProviders: toSafeArray(parsed?.serviceProviders),
    };
  } catch (error) {
    console.warn("[JobDirect] Failed to read lookup cache", error);
    return null;
  }
}

function writeLookupCache(lookupData) {
  try {
    window.localStorage.setItem(
      LOOKUP_CACHE_KEY,
      JSON.stringify({
        cachedAt: Date.now(),
        contacts: toSafeArray(lookupData?.contacts),
        companies: toSafeArray(lookupData?.companies),
        properties: toSafeArray(lookupData?.properties),
        serviceProviders: toSafeArray(lookupData?.serviceProviders),
      })
    );
  } catch (error) {
    console.warn("[JobDirect] Failed to write lookup cache", error);
  }
}

async function fetchLookupDataWithStatus(plugin, setStatusText) {
  setStatusText("Fetching lookup data...");
  const [contacts, companies, properties, serviceProviders] = await Promise.all([
    fetchContactsForSearch({ plugin }),
    fetchCompaniesForSearch({ plugin }),
    fetchPropertiesForSearch({ plugin }),
    fetchServiceProvidersForSearch({ plugin }),
  ]);

  return {
    contacts: toSafeArray(contacts),
    companies: toSafeArray(companies),
    properties: toSafeArray(properties),
    serviceProviders: toSafeArray(serviceProviders),
  };
}

export function useJobDirectBootstrap({
  jobUid,
  plugin,
  isSdkReady,
  sdkError,
} = {}) {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [statusText, setStatusText] = useState("Starting app...");
  const [error, setError] = useState(null);
  const [jobData, setJobData] = useState(null);
  const [lookupData, setLookupData] = useState(getDefaultLookupData());

  useEffect(() => {
    let isActive = true;

    if (sdkError) {
      setError(sdkError);
      setIsBootstrapping(false);
      setStatusText("SDK initialization failed.");
      return undefined;
    }

    if (!jobUid) {
      setJobData(null);
      setLookupData(getDefaultLookupData());
      setStatusText("Waiting for job UID...");
      setIsBootstrapping(false);
      return undefined;
    }

    if (!isSdkReady || !plugin) {
      setStatusText("Starting app...");
      setIsBootstrapping(true);
      return undefined;
    }

    setError(null);
    setIsBootstrapping(true);

    (async () => {
      setStatusText("Fetching job data...");
      const nextJobData = await fetchJobDirectDataByUid({ jobUid, plugin });
      if (!isActive) return;
      setJobData(nextJobData);

      const cachedLookupData = readLookupCache();
      if (cachedLookupData) {
        setStatusText("Applying cached lookup data...");
        setLookupData(cachedLookupData);
        setStatusText("Preparing page...");
        setIsBootstrapping(false);
      } else {
        setStatusText("Preparing page...");
        setIsBootstrapping(false);
        if (ENABLE_BACKGROUND_LOOKUP_PRELOAD) {
          fetchLookupDataWithStatus(plugin, setStatusText)
            .then((fetchedLookupData) => {
              if (!isActive) return;
              setLookupData(fetchedLookupData);
              writeLookupCache(fetchedLookupData);
            })
            .catch((lookupError) => {
              if (!isActive) return;
              console.warn("[JobDirect] Lookup background fetch failed", lookupError);
            });
        }
      }
    })().catch((bootstrapError) => {
      if (!isActive) return;
      console.error("[JobDirect] Bootstrap failed", bootstrapError);
      setError(bootstrapError);
      setStatusText("Failed loading page data.");
      setIsBootstrapping(false);
    });

    return () => {
      isActive = false;
    };
  }, [jobUid, plugin, isSdkReady, sdkError]);

  return {
    isBootstrapping,
    statusText,
    error,
    jobData,
    lookupData,
  };
}
