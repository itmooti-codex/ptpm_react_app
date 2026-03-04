import { useEffect, useState } from "react";
import {
  fetchLinkedDealsByAccount,
  fetchLinkedJobsByAccount,
} from "@modules/job-workspace/sdk/core/runtime.js";

const RELATED_RECORDS_CACHE_TTL_MS = 2 * 60 * 1000;
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

function readCachedRelatedRecords(cacheKey = "") {
  if (!cacheKey) return null;
  const cached = relatedRecordsCache.get(cacheKey);
  if (!cached || typeof cached !== "object") return null;
  const createdAt = Number(cached.createdAt || 0);
  if (!Number.isFinite(createdAt) || Date.now() - createdAt > RELATED_RECORDS_CACHE_TTL_MS) {
    relatedRecordsCache.delete(cacheKey);
    return null;
  }
  return cached;
}

function writeCachedRelatedRecords(cacheKey = "", value = {}) {
  if (!cacheKey) return;
  relatedRecordsCache.set(cacheKey, {
    createdAt: Date.now(),
    deals: Array.isArray(value.deals) ? value.deals : [],
    jobs: Array.isArray(value.jobs) ? value.jobs : [],
  });
}

export function useRelatedRecordsData({ plugin, accountType = "", accountId = "" } = {}) {
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
    const cached = readCachedRelatedRecords(cacheKey);
    if (cached) {
      setRelatedDeals(Array.isArray(cached.deals) ? cached.deals : []);
      setRelatedJobs(Array.isArray(cached.jobs) ? cached.jobs : []);
      setIsLoading(false);
      setError("");
      return undefined;
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
        console.error("[InquiryDirect] Failed to fetch related inquiries", loadError);
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
        console.error("[InquiryDirect] Failed to fetch related jobs", loadError);
        setRelatedJobs([]);
        errors.push(loadError?.message || "Unable to load related jobs.");
      })
      .finally(finish);

    return () => {
      isActive = false;
    };
  }, [plugin, accountId, accountType]);

  return {
    relatedDeals,
    relatedJobs,
    isLoading,
    error,
  };
}
