import {
  dedupePropertyLookupRecords,
} from "@modules/details-workspace/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { toText } from "@shared/utils/formatters.js";

const INQUIRY_WORKSPACE_UI_CACHE_KEY_PREFIX = "ptpm:inquiry-details:workspace-ui:v1:";
const INQUIRY_WORKSPACE_PROPERTY_CACHE_KEY_PREFIX =
  "ptpm:inquiry-details:workspace-property-cache:v1:";
const INQUIRY_WORKSPACE_UI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const INQUIRY_WORKSPACE_PROPERTY_CACHE_TTL_MS = 5 * 60 * 1000;

function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readJsonStorageItem(storageKey = "") {
  if (!canUseLocalStorage()) return null;
  const key = toText(storageKey);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeJsonStorageItem(storageKey = "", value = null) {
  if (!canUseLocalStorage()) return false;
  const key = toText(storageKey);
  if (!key) return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function buildInquiryWorkspaceUiCacheKey(inquiryUid = "") {
  const normalizedUid = toText(inquiryUid);
  if (!normalizedUid) return "";
  return `${INQUIRY_WORKSPACE_UI_CACHE_KEY_PREFIX}${normalizedUid.toLowerCase()}`;
}

export function readInquiryWorkspaceUiCache(inquiryUid = "") {
  const storageKey = buildInquiryWorkspaceUiCacheKey(inquiryUid);
  if (!storageKey) return null;
  const parsed = readJsonStorageItem(storageKey);
  if (!parsed || typeof parsed !== "object") return null;
  const cachedAt = Number(parsed?.cachedAt || 0);
  if (!cachedAt || Date.now() - cachedAt > INQUIRY_WORKSPACE_UI_CACHE_TTL_MS) {
    return null;
  }
  return parsed;
}

export function writeInquiryWorkspaceUiCache(inquiryUid = "", value = {}) {
  const storageKey = buildInquiryWorkspaceUiCacheKey(inquiryUid);
  if (!storageKey) return false;
  return writeJsonStorageItem(storageKey, {
    cachedAt: Date.now(),
    selectedPropertyId: normalizePropertyId(value?.selectedPropertyId || ""),
    isPropertySameAsContact: Boolean(value?.isPropertySameAsContact),
  });
}

function buildInquiryWorkspacePropertyCacheKey(accountType = "", accountId = "") {
  const normalizedId = toText(accountId);
  if (!normalizedId) return "";
  const normalizedType = toText(accountType).toLowerCase() === "company" ? "company" : "contact";
  return `${INQUIRY_WORKSPACE_PROPERTY_CACHE_KEY_PREFIX}${normalizedType}:${normalizedId}`;
}

export function readInquiryWorkspacePropertyCache({
  accountType = "",
  accountId = "",
} = {}) {
  const storageKey = buildInquiryWorkspacePropertyCacheKey(accountType, accountId);
  if (!storageKey) return null;
  const parsed = readJsonStorageItem(storageKey);
  if (!parsed || typeof parsed !== "object") return null;
  const cachedAt = Number(parsed?.cachedAt || 0);
  if (!cachedAt || Date.now() - cachedAt > INQUIRY_WORKSPACE_PROPERTY_CACHE_TTL_MS) {
    return null;
  }
  return {
    linkedProperties: dedupePropertyLookupRecords(parsed?.linkedProperties || []),
    propertyLookupRecords: dedupePropertyLookupRecords(parsed?.propertyLookupRecords || []),
  };
}

export function writeInquiryWorkspacePropertyCache({
  accountType = "",
  accountId = "",
  linkedProperties = [],
  propertyLookupRecords = [],
} = {}) {
  const storageKey = buildInquiryWorkspacePropertyCacheKey(accountType, accountId);
  if (!storageKey) return false;
  return writeJsonStorageItem(storageKey, {
    cachedAt: Date.now(),
    linkedProperties: dedupePropertyLookupRecords(linkedProperties || []),
    propertyLookupRecords: dedupePropertyLookupRecords(propertyLookupRecords || []),
  });
}
