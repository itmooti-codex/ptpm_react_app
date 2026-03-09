import { useEffect, useState } from "react";
import {
  fetchLinkedDealsByAccount,
  fetchLinkedJobsByAccount,
} from "@modules/job-workspace/public/sdk.js";

const RELATED_RECORDS_CACHE_TTL_MS = 2 * 60 * 1000;
const RELATED_RECORDS_STORAGE_KEY_PREFIX = "ptpm:inquiry-details:related-records:v2:";
const relatedRecordsCache = new Map();

function normalizeAccountType(accountType = "") {
  const normalized = String(accountType || "").trim().toLowerCase();
  return normalized === "company" || normalized === "entity" ? "Company" : "Contact";
}

function buildCacheKey(accountType = "", accountId = "") {
  const type = normalizeAccountType(accountType);
  const id = String(accountId || "").trim();
  if (!id) return "";
  return `${type}:${id}`;
}

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function buildStorageKey(cacheKey = "") {
  const normalized = String(cacheKey || "").trim();
  if (!normalized) return "";
  return `${RELATED_RECORDS_STORAGE_KEY_PREFIX}${normalized}`;
}

function readCachedRelatedRecordsFromStorage(cacheKey = "") {
  if (!canUseLocalStorage()) return null;
  const storageKey = buildStorageKey(cacheKey);
  if (!storageKey) return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const createdAt = Number(parsed?.createdAt || 0);
    if (!Number.isFinite(createdAt) || Date.now() - createdAt > RELATED_RECORDS_CACHE_TTL_MS) {
      return null;
    }
    return {
      createdAt,
      deals: Array.isArray(parsed?.deals) ? parsed.deals : [],
      jobs: Array.isArray(parsed?.jobs) ? parsed.jobs : [],
    };
  } catch {
    return null;
  }
}

function writeCachedRelatedRecordsToStorage(cacheKey = "", value = {}) {
  if (!canUseLocalStorage()) return;
  const storageKey = buildStorageKey(cacheKey);
  if (!storageKey) return;
  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        createdAt: Date.now(),
        deals: Array.isArray(value?.deals) ? value.deals : [],
        jobs: Array.isArray(value?.jobs) ? value.jobs : [],
      })
    );
  } catch {
    // Ignore local storage write failures.
  }
}

function readCachedRelatedRecords(cacheKey = "") {
  if (!cacheKey) return null;
  const cached = relatedRecordsCache.get(cacheKey);
  if (cached && typeof cached === "object") {
    const createdAt = Number(cached.createdAt || 0);
    if (Number.isFinite(createdAt) && Date.now() - createdAt <= RELATED_RECORDS_CACHE_TTL_MS) {
      return cached;
    }
    relatedRecordsCache.delete(cacheKey);
  }

  const stored = readCachedRelatedRecordsFromStorage(cacheKey);
  if (!stored) return null;
  relatedRecordsCache.set(cacheKey, stored);
  return stored;
}

function writeCachedRelatedRecords(cacheKey = "", value = {}) {
  if (!cacheKey) return;
  const normalized = {
    createdAt: Date.now(),
    deals: Array.isArray(value.deals) ? value.deals : [],
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
  };
  relatedRecordsCache.set(cacheKey, normalized);
  writeCachedRelatedRecordsToStorage(cacheKey, normalized);
}

function clearCachedRelatedRecords(cacheKey = "") {
  if (!cacheKey) return;
  relatedRecordsCache.delete(cacheKey);
  if (!canUseLocalStorage()) return;
  const storageKey = buildStorageKey(cacheKey);
  if (!storageKey) return;
  try {
    window.localStorage.removeItem(storageKey);
  } catch {
    // Ignore cleanup failures.
  }
}

export function useRelatedRecordsData({
  plugin,
  accountType = "",
  accountId = "",
  refreshKey = 0,
} = {}) {
  const [relatedDeals, setRelatedDeals] = useState([]);
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let isActive = true;
    const normalizedAccountId = String(accountId || "").trim();
    if (!plugin || !normalizedAccountId) {
      setRelatedDeals([]);
      setRelatedJobs([]);
      setIsLoading(false);
      setError("");
      return undefined;
    }

    const normalizedAccountType = normalizeAccountType(accountType);
    const cacheKey = buildCacheKey(normalizedAccountType, normalizedAccountId);
    const shouldBypassCache = Boolean(refreshKey);
    if (shouldBypassCache) {
      clearCachedRelatedRecords(cacheKey);
    }
    if (!shouldBypassCache) {
      const cached = readCachedRelatedRecords(cacheKey);
      if (cached) {
        setRelatedDeals(Array.isArray(cached.deals) ? cached.deals : []);
        setRelatedJobs(Array.isArray(cached.jobs) ? cached.jobs : []);
        setIsLoading(false);
        setError("");
        return undefined;
      }
    }

    setIsLoading(true);
    setError("");

    let completedCount = 0;
    let dealsResult = [];
    let jobsResult = [];
    let dealsLoaded = false;
    let jobsLoaded = false;
    const errors = [];

    const finish = () => {
      completedCount += 1;
      if (completedCount < 2 || !isActive) return;
      setIsLoading(false);
      if (errors.length) {
        setError(errors[0]);
      } else {
        setError("");
      }
      if (dealsLoaded || jobsLoaded) {
        writeCachedRelatedRecords(cacheKey, {
          deals: dealsResult,
          jobs: jobsResult,
        });
      }
    };

    fetchLinkedDealsByAccount({
      plugin,
      accountType: normalizedAccountType,
      accountId: normalizedAccountId,
    })
      .then((deals) => {
        if (!isActive) return;
        dealsResult = Array.isArray(deals) ? deals : [];
        dealsLoaded = true;
        setRelatedDeals(dealsResult);
      })
      .catch((loadError) => {
        if (!isActive) return;
        console.error("[InquiryShared] Failed to fetch related inquiries", loadError);
        setRelatedDeals([]);
        errors.push(loadError?.message || "Unable to load related inquiries.");
      })
      .finally(finish);

    fetchLinkedJobsByAccount({
      plugin,
      accountType: normalizedAccountType,
      accountId: normalizedAccountId,
    })
      .then((jobs) => {
        if (!isActive) return;
        jobsResult = Array.isArray(jobs) ? jobs : [];
        jobsLoaded = true;
        setRelatedJobs(jobsResult);
      })
      .catch((loadError) => {
        if (!isActive) return;
        console.error("[InquiryShared] Failed to fetch related jobs", loadError);
        setRelatedJobs([]);
        errors.push(loadError?.message || "Unable to load related jobs.");
      })
      .finally(finish);

    return () => {
      isActive = false;
    };
  }, [plugin, accountId, accountType, refreshKey]);

  return {
    relatedDeals,
    relatedJobs,
    isLoading,
    error,
  };
}
