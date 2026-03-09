import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { useGoogleAddressLookup } from "../../../shared/hooks/useGoogleAddressLookup.js";
import { TasksModal } from "../../../modules/job-workspace/components/modals/TasksModal.jsx";
import { ContactDetailsModal } from "../../../modules/job-workspace/components/modals/ContactDetailsModal.jsx";
import { JobDirectStoreProvider } from "../../../modules/job-workspace/hooks/useJobDirectStore.jsx";
import {
  useServiceProviderLookup,
  useAdminProviderLookup,
} from "@modules/job-workspace/public/hooks.js";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { APP_USER } from "../../../config/userConfig.js";
import {
  ensureGooglePlacesLoaded,
  parseGoogleAddressComponents,
} from "../../../shared/lib/googlePlaces.js";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import { resolveStatusStyle } from "../../../shared/constants/statusStyles.js";
import {
  createLinkedJobForInquiry,
  createMemoCommentForDetails,
  createMemoPostForDetails,
  deleteMemoCommentForDetails,
  deleteMemoPostForDetails,
  fetchMemosForDetails,
  resolveJobDetailsContext,
  subscribeMemosForDetails,
  updateContactFieldsById,
  updateCompanyFieldsById,
  updateInquiryFieldsById,
} from "../../../modules/job-records/public/sdk.js";
import {
  createCompanyRecord,
  createContactRecord,
  createPropertyRecord,
  findContactByEmail,
  findPropertyByName,
  fetchLinkedDealsByAccount,
  fetchLinkedJobsByAccount,
  fetchPropertyRecordById,
  fetchPropertiesForSearch,
  fetchLinkedPropertiesByAccount,
  fetchServicesForActivities,
  searchContactsForLookup,
  searchCompaniesForLookup,
  searchPropertiesForLookup,
  uploadMaterialFile,
  updateContactRecord,
  updatePropertyRecord,
} from "../../../modules/job-workspace/sdk/core/runtime.js";
import {
  AccountDetailsSection,
  AddPropertyModal,
  AppointmentTabSection,
  ColorMappedSelectInput,
  TrashActionIcon as TrashIcon,
  normalizePropertyId,
  PropertyTabSection,
  RelatedRecordsSection,
  SearchDropdownInput,
  SelectInput,
  TitleBackIcon,
  UploadsSection,
} from "@modules/job-workspace/public/components.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
  fetchCompanyAccountRecordById,
  fetchContactAccountRecordById,
  normalizePropertyLookupRecord,
  getPropertyLookupKey,
  dedupePropertyLookupRecords,
  mergePropertyLookupRecords,
  getPropertyRecordSignature,
  arePropertyRecordCollectionsEqual,
  mergePropertyCollectionsIfChanged,
  resolvePropertyLookupLabel,
  buildComparablePropertyAddress,
  normalizeAddressText,
} from "@modules/job-workspace/public/sdk.js";
import {
  toText,
  fullName,
  toTelHref,
  formatDate,
  formatFileSize,
  formatRelativeTime,
  getAuthorName,
  getMemoFileMeta,
  mergeMemosPreservingComments,
  formatServiceProviderAllocationLabel,
  formatServiceProviderInputLabel,
  formatContactLookupLabel,
  joinAddress,
  compactStringFields,
  toMailHref,
  toGoogleMapsHref,
} from "@shared/utils/formatters.js";
import {
  isBodyCorpCompanyAccountType,
  isCompanyAccountType,
  isContactAccountType,
  isLikelyEmailValue,
  isLikelyPhoneValue,
} from "@shared/utils/accountTypeUtils.js";
import {
  ChevronDownIcon,
  CopyIcon,
} from "@shared/components/icons/index.jsx";
import { DetailsCard } from "@shared/components/ui/DetailsCard.jsx";
import { CardField } from "@shared/components/ui/CardField.jsx";
import { CardNote } from "@shared/components/ui/CardNote.jsx";
import { CardTagList } from "@shared/components/ui/CardTagList.jsx";
import { SectionLoadingState } from "@shared/components/ui/SectionLoadingState.jsx";
import {
  parseListSelectionValue,
  serializeListSelectionValue,
} from "../../inquiry/shared/inquiryInformationHelpers.js";
import {
  getInquiryFlowRule,
  shouldShowOtherSourceField,
} from "../../inquiry/shared/inquiryFlowRules.js";
import { useRelatedRecordsData } from "../../inquiry/shared/useRelatedRecordsData.js";
import { isPestServiceFlow } from "../../inquiry/shared/pestRules.js";
import {
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
} from "../../inquiry/shared/inquiryInformationConstants.js";

function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

async function resolveAddressFromGoogleLookup(addressText) {
  const query = toText(addressText);
  if (!query) return null;

  try {
    await ensureGooglePlacesLoaded();
    if (!window.google?.maps?.Geocoder) return null;

    const geocoder = new window.google.maps.Geocoder();
    const results = await new Promise((resolve, reject) => {
      geocoder.geocode(
        {
          address: query,
          componentRestrictions: { country: "AU" },
        },
        (response, status) => {
          if (
            status === "OK" &&
            Array.isArray(response) &&
            response.length
          ) {
            resolve(response);
            return;
          }
          reject(new Error(`Google geocode failed with status: ${status || "UNKNOWN"}`));
        }
      );
    });

    const firstResult = Array.isArray(results) ? results[0] : null;
    if (!firstResult) return null;
    return parseGoogleAddressComponents(firstResult);
  } catch (error) {
    console.warn("[InquiryDetails] Google address resolution failed", error);
    return null;
  }
}

function toDateInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (!Number.isFinite(num)) return "";
    const seconds = num > 4102444800 ? Math.floor(num / 1000) : num;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUnixSeconds(dateInput) {
  const value = toText(dateInput);
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function toNullableText(value) {
  const text = toText(value);
  return text || null;
}


function buildListSelectionTagItems(value, options = []) {
  const raw = toText(value);
  if (!raw) return [];
  const selectedCodes = parseListSelectionValue(raw, options);
  if (!selectedCodes.length) {
    return [
      {
        key: raw,
        code: "",
        label: raw,
      },
    ];
  }
  const optionLabelByCode = new Map(
    (Array.isArray(options) ? options : []).map((item) => [
      toText(item?.code || item?.value),
      toText(item?.label || item?.value || item?.code),
    ])
  );
  return selectedCodes
    .map((code) => {
      const normalizedCode = toText(code);
      if (!normalizedCode) return null;
      return {
        key: normalizedCode,
        code: normalizedCode,
        label: optionLabelByCode.get(normalizedCode) || normalizedCode,
      };
    })
    .filter(Boolean);
}

function normalizeRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

function normalizeServiceProviderContact(provider = {}) {
  const contactInfoRaw = provider?.Contact_Information || provider?.contact_information || {};
  const contactInfo = normalizeRelationRecord(contactInfoRaw);
  return {
    first_name: toText(
      provider?.first_name ||
        provider?.First_Name ||
        provider?.contact_information_first_name ||
        provider?.Contact_Information_First_Name ||
        contactInfo?.first_name ||
        contactInfo?.First_Name
    ),
    last_name: toText(
      provider?.last_name ||
        provider?.Last_Name ||
        provider?.contact_information_last_name ||
        provider?.Contact_Information_Last_Name ||
        contactInfo?.last_name ||
        contactInfo?.Last_Name
    ),
    email: toText(
      provider?.work_email ||
        provider?.Work_Email ||
        provider?.email ||
        provider?.Email
    ),
    sms_number: toText(
      provider?.mobile_number ||
        provider?.Mobile_Number ||
        provider?.sms_number ||
        provider?.SMS_Number
    ),
  };
}

function getInquiryPrimaryContact(inquiry = {}) {
  const nested = inquiry?.Primary_Contact || inquiry?.primary_contact || {};
  return {
    id: toText(
      nested?.id || nested?.ID || inquiry?.Primary_Contact_Contact_ID || inquiry?.Contact_Contact_ID
    ),
    first_name: toText(
      nested?.first_name ||
        nested?.First_Name ||
        inquiry?.Primary_Contact_First_Name ||
        inquiry?.Contact_First_Name
    ),
    last_name: toText(
      nested?.last_name ||
        nested?.Last_Name ||
        inquiry?.Primary_Contact_Last_Name ||
        inquiry?.Contact_Last_Name
    ),
    email: toText(
      nested?.email || nested?.Email || inquiry?.Primary_Contact_Email || inquiry?.ContactEmail
    ),
    sms_number: toText(
      nested?.sms_number || nested?.SMS_Number || inquiry?.Primary_Contact_SMS_Number
    ),
    address: toText(nested?.address || nested?.Address || inquiry?.Primary_Contact_Address),
    city: toText(nested?.city || nested?.City || inquiry?.Primary_Contact_City),
    state: toText(nested?.state || nested?.State || inquiry?.Primary_Contact_State),
    zip_code: toText(nested?.zip_code || nested?.Zip_Code || inquiry?.Primary_Contact_Zip_Code),
    popup_comment: toText(
      nested?.popup_comment ||
        nested?.Popup_Comment ||
        inquiry?.Primary_Contact_Popup_Comment
    ),
  };
}

function getInquiryCompany(inquiry = {}) {
  const nested = inquiry?.Company || inquiry?.company || {};
  const nestedPrimaryPerson = nested?.Primary_Person || nested?.primary_person || {};
  const companyScopedPrimaryContact = {
    id: toText(inquiry?.Contact_Contact_ID || inquiry?.ContactID || inquiry?.Contact_ID),
    first_name: toText(inquiry?.Contact_First_Name || inquiry?.ContactFirstName),
    last_name: toText(inquiry?.Contact_Last_Name || inquiry?.ContactLastName),
    email: toText(inquiry?.ContactEmail || inquiry?.Contact_Email),
    sms_number: toText(inquiry?.Contact_SMS_Number || inquiry?.ContactSMSNumber),
  };
  return {
    id: toText(nested?.id || nested?.ID || inquiry?.CompanyID),
    name: toText(nested?.name || nested?.Name || inquiry?.CompanyName),
    type: toText(nested?.type || nested?.Type || inquiry?.CompanyType),
    description: toText(nested?.description || nested?.Description || inquiry?.CompanyDescription),
    phone: toText(nested?.phone || nested?.Phone || inquiry?.CompanyPhone),
    address: toText(nested?.address || nested?.Address || inquiry?.CompanyAddress),
    city: toText(nested?.city || nested?.City || inquiry?.CompanyCity),
    state: toText(nested?.state || nested?.State || inquiry?.CompanyState),
    postal_code: toText(nested?.postal_code || nested?.Postal_Code || inquiry?.Company_Postal_Code),
    industry: toText(nested?.industry || nested?.Industry || inquiry?.CompanyIndustry),
    annual_revenue: toText(
      nested?.annual_revenue || nested?.Annual_Revenue || inquiry?.Company_Annual_Revenue
    ),
    number_of_employees: toText(
      nested?.number_of_employees ||
        nested?.Number_of_Employees ||
        inquiry?.Company_Number_Of_Employees
    ),
    account_type: toText(nested?.account_type || nested?.Account_Type || inquiry?.Company_Account_Type),
    popup_comment: toText(
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Company_Popup_Comment
    ),
    Primary_Person: {
      id: toText(
        nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || companyScopedPrimaryContact.id
      ),
      first_name: toText(
        nestedPrimaryPerson?.first_name ||
          nestedPrimaryPerson?.First_Name ||
          companyScopedPrimaryContact.first_name
      ),
      last_name: toText(
        nestedPrimaryPerson?.last_name ||
          nestedPrimaryPerson?.Last_Name ||
          companyScopedPrimaryContact.last_name
      ),
      email: toText(
        nestedPrimaryPerson?.email ||
          nestedPrimaryPerson?.Email ||
          companyScopedPrimaryContact.email
      ),
      sms_number: toText(
        nestedPrimaryPerson?.sms_number ||
          nestedPrimaryPerson?.SMS_Number ||
          companyScopedPrimaryContact.sms_number
      ),
    },
    Body_Corporate_Company: nested?.Body_Corporate_Company || nested?.body_corporate_company || {
      id: toText(inquiry?.CompanyID1),
      name: toText(inquiry?.CompanyName1),
      type: toText(inquiry?.CompanyType1),
      description: toText(inquiry?.CompanyDescription1),
      phone: toText(inquiry?.CompanyPhone1),
      address: toText(inquiry?.CompanyAddress1),
      city: toText(inquiry?.CompanyCity1),
      state: toText(inquiry?.CompanyState1),
      postal_code: toText(inquiry?.Company_Postal_Code1),
      industry: toText(inquiry?.CompanyIndustry1),
      annual_revenue: toText(inquiry?.Company_Annual_Revenue1),
      number_of_employees: toText(inquiry?.Company_Number_Of_Employees1),
    },
  };
}

const RECENT_ADMIN_ACTIVITY_STORAGE_KEY = "ptpm_admin_recent_activity_v1";
const MAX_RECENT_ADMIN_ACTIVITY_RECORDS = 20;
const RECENT_ACTIVITIES_UPDATED_EVENT = "ptpm-recent-activities-updated";
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

function readInquiryWorkspaceUiCache(inquiryUid = "") {
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

function writeInquiryWorkspaceUiCache(inquiryUid = "", value = {}) {
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

function readInquiryWorkspacePropertyCache({
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

function writeInquiryWorkspacePropertyCache({
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

function isMajorRecentActivityAction(action = "") {
  const normalized = toText(action).toLowerCase();
  return (
    normalized.includes("create") ||
    normalized.includes("update") ||
    normalized.includes("delete") ||
    normalized.includes("cancel") ||
    normalized.includes("new inquiry")
  );
}

function normalizeLegacyInquiryPageType(value = "") {
  const normalized = toText(value).toLowerCase();
  if (normalized === "inquiry-direct") return "inquiry-details";
  return normalized;
}

function resolveActivityPageType(pathname = "") {
  const normalizedPath = toText(pathname).toLowerCase();
  if (!normalizedPath) return "unknown";
  if (normalizedPath.startsWith("/inquiry-details")) return "inquiry-details";
  if (normalizedPath.startsWith("/inquiry-direct")) return "inquiry-details";
  if (normalizedPath.startsWith("/job-direct")) return "job-direct";
  if (normalizedPath.startsWith("/details")) return "job-details";
  if (normalizedPath.startsWith("/profile")) return "profile";
  if (normalizedPath.startsWith("/settings")) return "settings";
  if (normalizedPath.startsWith("/notifications")) return "notifications";
  if (normalizedPath === "/") return "dashboard";
  return "app";
}

function resolveActivityPageName(pageType = "") {
  const normalizedType = normalizeLegacyInquiryPageType(pageType);
  if (normalizedType === "inquiry-details") return "Inquiry Details";
  if (normalizedType === "job-direct") return "Job Direct";
  if (normalizedType === "job-details") return "Job Details";
  if (normalizedType === "profile") return "Profile";
  if (normalizedType === "settings") return "Settings";
  if (normalizedType === "notifications") return "Notifications";
  if (normalizedType === "dashboard") return "Dashboard";
  return "App";
}

function normalizeRecentActivityRecord(record = {}) {
  const timestamp = Number(record?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  const path = toText(record?.path);
  const pageType =
    normalizeLegacyInquiryPageType(record?.page_type) || resolveActivityPageType(path);
  const metadata =
    record?.metadata && typeof record.metadata === "object" ? { ...record.metadata } : {};
  const metadataInquiryId =
    toText(metadata?.inquiry_id) || toText(metadata?.inquiryId) || toText(metadata?.deal_id);
  const metadataInquiryUid =
    toText(metadata?.inquiry_uid) || toText(metadata?.inquiryUid) || toText(metadata?.deal_uid);
  return {
    id:
      toText(record?.id) ||
      `activity-${normalizedTimestamp}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp: normalizedTimestamp,
    action: toText(record?.action),
    page_type: pageType,
    page_name: toText(record?.page_name) || resolveActivityPageName(pageType),
    path,
    inquiry_id: toText(record?.inquiry_id || metadataInquiryId),
    inquiry_uid: toText(record?.inquiry_uid || metadataInquiryUid),
    metadata,
  };
}

function normalizeRecentActivityAction(value = "") {
  return toText(value).toLowerCase();
}

function finalizeRecentActivityList(records = []) {
  const normalized = (Array.isArray(records) ? records : [])
    .map((item) => normalizeRecentActivityRecord(item))
    .filter((item) => isMajorRecentActivityAction(item?.action))
    .sort((left, right) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0));

  const createdNewInquiryKeys = new Set(
    normalized
      .filter((item) => normalizeRecentActivityAction(item?.action) === "created new inquiry")
      .map((item) => toText(item?.inquiry_uid).toLowerCase() || toText(item?.path).toLowerCase())
      .filter(Boolean)
  );
  const seen = new Set();
  const deduped = [];
  for (const item of normalized) {
    const actionKey = normalizeRecentActivityAction(item?.action);
    const inquiryUidKey = toText(item?.inquiry_uid).toLowerCase();
    const inquiryIdKey = toText(item?.inquiry_id).toLowerCase();
    const pathKey = toText(item?.path);
    const inquiryKey = inquiryUidKey || inquiryIdKey || pathKey.toLowerCase();

    if (
      actionKey === "started new inquiry" &&
      inquiryKey &&
      createdNewInquiryKeys.has(inquiryKey)
    ) {
      continue;
    }

    const key = inquiryKey ? `${actionKey}|${inquiryKey}` : `${actionKey}|${pathKey.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }
  return deduped.slice(0, MAX_RECENT_ADMIN_ACTIVITY_RECORDS);
}

function buildRecentActivitySignature(records = []) {
  const toSignatureJson = (value) => {
    const seen = new WeakSet();
    try {
      return (
        JSON.stringify(value, (_key, current) => {
          if (typeof current === "bigint") return current.toString();
          if (
            typeof current === "function" ||
            typeof current === "symbol" ||
            typeof current === "undefined"
          ) {
            return undefined;
          }
          if (current && typeof current === "object") {
            if (seen.has(current)) return undefined;
            seen.add(current);
          }
          return current;
        }) || ""
      );
    } catch {
      return "";
    }
  };
  return JSON.stringify(
    finalizeRecentActivityList(records).map((item) => ({
      id: toText(item?.id),
      timestamp: Number(item?.timestamp || 0),
      action: toText(item?.action),
      page_type: toText(item?.page_type),
      page_name: toText(item?.page_name),
      path: toText(item?.path),
      inquiry_id: toText(item?.inquiry_id),
      inquiry_uid: toText(item?.inquiry_uid),
      metadata: toSignatureJson(item?.metadata && typeof item.metadata === "object" ? item.metadata : {}),
    }))
  );
}

function readRecentAdminActivitiesFromStorage() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(RECENT_ADMIN_ACTIVITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return finalizeRecentActivityList(parsed);
  } catch (storageError) {
    console.warn("[InquiryDetails] Failed reading recent admin activity from storage", storageError);
    return [];
  }
}

function writeRecentAdminActivitiesToStorage(records = []) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    const normalized = finalizeRecentActivityList(records);
    window.localStorage.setItem(RECENT_ADMIN_ACTIVITY_STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent(RECENT_ACTIVITIES_UPDATED_EVENT));
  } catch (storageError) {
    console.warn("[InquiryDetails] Failed writing recent admin activity to storage", storageError);
  }
}

function createRecentActivityJsonData(records = [], adminProviderId = "") {
  const normalizedRecords = finalizeRecentActivityList(records);
  const normalizedAdminProviderId = toText(adminProviderId);
  const payload = {
    service_provider_id: normalizedAdminProviderId || null,
    record_count: normalizedRecords.length,
    records: normalizedRecords.map((item) => ({
      id: toText(item?.id),
      timestamp: Number(item?.timestamp || 0),
      action: toText(item?.action),
      page_type: toText(item?.page_type),
      page_name: toText(item?.page_name),
      path: toText(item?.path),
      inquiry_id: toText(item?.inquiry_id),
      inquiry_uid: toText(item?.inquiry_uid),
      metadata: item?.metadata && typeof item.metadata === "object" ? item.metadata : {},
    })),
  };

  const seen = new WeakSet();
  try {
    return JSON.stringify(payload, (_key, value) => {
      if (typeof value === "bigint") return value.toString();
      if (
        typeof value === "function" ||
        typeof value === "symbol" ||
        typeof value === "undefined"
      ) {
        return undefined;
      }
      if (value && typeof value === "object") {
        if (seen.has(value)) return undefined;
        seen.add(value);
      }
      return value;
    });
  } catch {
    return JSON.stringify({
      service_provider_id: normalizedAdminProviderId || null,
      record_count: normalizedRecords.length,
      records: normalizedRecords.map((item) => ({
        id: toText(item?.id),
        timestamp: Number(item?.timestamp || 0),
        action: toText(item?.action),
        page_type: toText(item?.page_type),
        page_name: toText(item?.page_name),
        path: toText(item?.path),
        inquiry_id: toText(item?.inquiry_id),
        inquiry_uid: toText(item?.inquiry_uid),
      })),
    });
  }
}

async function updateServiceProviderRecentActivityJsonData({
  plugin,
  serviceProviderId,
  jsonPayload,
} = {}) {
  const normalizedProviderId = toText(serviceProviderId);
  if (!plugin?.switchTo || !normalizedProviderId) {
    throw new Error("Service provider context is not ready.");
  }
  const normalizedPayload = toText(jsonPayload);
  if (!normalizedPayload) {
    throw new Error("Recent activity JSON payload is missing.");
  }

  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.mutation) {
    throw new Error("Service provider model is unavailable.");
  }
  const normalizedProviderLookupId = /^\d+$/.test(normalizedProviderId)
    ? Number.parseInt(normalizedProviderId, 10)
    : normalizedProviderId;
  const whereCandidates = [
    ["id", normalizedProviderLookupId],
    ["id", normalizedProviderId],
    ["unique_id", normalizedProviderId],
    ["unique_id", normalizedProviderLookupId],
  ];
  const wherePairs = [];
  const seenWherePairs = new Set();
  for (const [whereField, whereValue] of whereCandidates) {
    const normalizedWhereValue = toText(whereValue);
    if (!normalizedWhereValue) continue;
    const key = `${whereField}:${normalizedWhereValue}`;
    if (seenWherePairs.has(key)) continue;
    seenWherePairs.add(key);
    wherePairs.push([whereField, whereValue]);
  }
  const payloadFields = [
    "recent_activity_json_data",
    "Recent_Activity_Json_Data",
    "recent_activity",
    "Recent_Activity",
  ];
  const normalizePayloadForCompare = (value) => {
    const text = toText(value);
    if (!text) return "";
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  };
  const expectedPayloadNormalized = normalizePayloadForCompare(normalizedPayload);
  const wasPayloadPersisted = async (whereField, whereValue, payloadField) => {
    if (!providerModel?.query) return false;
    try {
      const query = providerModel
        .query()
        .where(whereField, whereValue)
        .deSelectAll()
        .select(["id", "unique_id", payloadField])
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const result = await toPromiseLike(query.fetchDirect());
      const record = extractFirstRecord(result);
      if (!record) return false;
      const persistedPayload = normalizePayloadForCompare(
        record?.[payloadField] ?? record?._data?.[payloadField]
      );
      return persistedPayload === expectedPayloadNormalized;
    } catch {
      return false;
    }
  };

  const executeUpdate = async (whereField, whereValue, payloadField) => {
    const mutation = await providerModel.mutation();
    mutation.update((query) =>
      query.where(whereField, whereValue).set({
        [payloadField]: normalizedPayload,
      })
    );
    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error("Recent activity JSON update was cancelled.");
    }
    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        extractMutationErrorMessage(failure.statusMessage) ||
          "Unable to update service provider recent activity JSON data."
      );
    }
    return true;
  };
  let lastError = null;
  for (const [whereField, whereValue] of wherePairs) {
    for (const payloadField of payloadFields) {
      try {
        await executeUpdate(whereField, whereValue, payloadField);
        const didPersist = await wasPayloadPersisted(whereField, whereValue, payloadField);
        if (didPersist) {
          return true;
        }
        lastError = new Error(
          `Recent activity payload was not persisted for ${whereField} (${toText(whereValue)}) using ${payloadField}.`
        );
      } catch (updateError) {
        lastError = updateError;
      }
    }
  }
  if (lastError) throw lastError;
  return false;
}

const QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM = {
  email: "",
  first_name: "",
  last_name: "",
  sms_number: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "AU",
};

const QUICK_INQUIRY_EMPTY_COMPANY_FORM = {
  company_name: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_postal_code: "",
  company_account_type: "",
  primary_first_name: "",
  primary_last_name: "",
  primary_email: "",
  primary_sms_number: "",
};

const QUICK_INQUIRY_EMPTY_DETAILS_FORM = {
  inquiry_source: "",
  type: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  how_did_you_hear: "",
  other: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
  property_lot_number: "",
  property_unit_number: "",
  property_lookup: "",
  property_name: "",
  property_address_1: "",
  property_suburb_town: "",
  property_state: "",
  property_postal_code: "",
  property_country: "AU",
  admin_notes: "",
  client_notes: "",
};

function normalizeComparablePropertyName(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

function normalizeComparableText(value) {
  return toText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLookupRecordId(record = null, accountType = "Contact") {
  if (!record || typeof record !== "object") return "";
  const candidates =
    String(accountType || "").toLowerCase() === "company"
      ? [
          record?.id,
          record?.ID,
          record?.company_id,
          record?.Company_ID,
          record?.CompanyID,
        ]
      : [
          record?.id,
          record?.ID,
          record?.contact_id,
          record?.Contact_ID,
          record?.ContactID,
          record?.primary_contact_id,
          record?.Primary_Contact_ID,
        ];
  for (const candidate of candidates) {
    const normalized = toText(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function buildStandardPropertyName({
  lot_number = "",
  unit_number = "",
  address_1 = "",
  suburb_town = "",
  state = "",
  postal_code = "",
  country = "",
} = {}) {
  const lotUnit = [toText(lot_number), toText(unit_number)].filter(Boolean).join(" ");
  const suburbStatePostcode = [toText(suburb_town), toText(state), toText(postal_code)]
    .filter(Boolean)
    .join(" ");
  return [lotUnit, toText(address_1), suburbStatePostcode, toText(country)]
    .filter(Boolean)
    .join(", ");
}

function QuickInquiryBookingModal({
  open,
  onClose,
  plugin,
  inquiryId = "",
  prefillContext = null,
  configuredAdminProviderId = "",
  onSavingStart = null,
  onSaved = null,
  onError = null,
}) {
  const [step, setStep] = useState(1);
  const [accountMode, setAccountMode] = useState("individual");
  const [showIndividualOptional, setShowIndividualOptional] = useState(false);
  const [showCompanyOptional, setShowCompanyOptional] = useState(false);
  const [individualForm, setIndividualForm] = useState({ ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM });
  const [companyForm, setCompanyForm] = useState({ ...QUICK_INQUIRY_EMPTY_COMPANY_FORM });
  const [detailsForm, setDetailsForm] = useState({ ...QUICK_INQUIRY_EMPTY_DETAILS_FORM });
  const [contactMatchState, setContactMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [companyMatchState, setCompanyMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [propertyMatchState, setPropertyMatchState] = useState({
    status: "idle",
    message: "",
    record: null,
  });
  const [serviceOptions, setServiceOptions] = useState([]);
  const [isServiceOptionsLoading, setIsServiceOptionsLoading] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [relatedInquiries, setRelatedInquiries] = useState([]);
  const [relatedJobs, setRelatedJobs] = useState([]);
  const [isRelatedLoading, setIsRelatedLoading] = useState(false);
  const [relatedError, setRelatedError] = useState("");
  const [isQuickPropertySameAsContact, setIsQuickPropertySameAsContact] = useState(false);
  const [isApplyingQuickSameAsContactProperty, setIsApplyingQuickSameAsContactProperty] =
    useState(false);
  const contactLookupRequestRef = useRef(0);
  const companyLookupRequestRef = useRef(0);
  const propertyLookupRequestRef = useRef(0);
  const didHydrateOnOpenRef = useRef(false);

  useEffect(() => {
    if (!open) {
      didHydrateOnOpenRef.current = false;
      return;
    }
    if (didHydrateOnOpenRef.current) return;
    didHydrateOnOpenRef.current = true;

    const normalizedPrefill =
      prefillContext && typeof prefillContext === "object" ? prefillContext : null;
    if (!normalizedPrefill) {
      setStep(1);
      setAccountMode("individual");
      setShowIndividualOptional(false);
      setShowCompanyOptional(false);
      setIndividualForm({ ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM });
      setCompanyForm({ ...QUICK_INQUIRY_EMPTY_COMPANY_FORM });
      setDetailsForm({ ...QUICK_INQUIRY_EMPTY_DETAILS_FORM });
      setContactMatchState({ status: "idle", message: "", record: null });
      setCompanyMatchState({ status: "idle", message: "", record: null });
      setPropertyMatchState({ status: "idle", message: "", record: null });
      setIsQuickPropertySameAsContact(false);
      return;
    }

    const resolvedAccountType = toText(
      normalizedPrefill?.account_type || normalizedPrefill?.Account_Type
    ).toLowerCase();
    const nextAccountMode = resolvedAccountType === "company" ? "company" : "individual";
    const prefillContact =
      normalizedPrefill?.contact && typeof normalizedPrefill.contact === "object"
        ? normalizedPrefill.contact
        : {};
    const prefillCompany =
      normalizedPrefill?.company && typeof normalizedPrefill.company === "object"
        ? normalizedPrefill.company
        : {};
    const prefillDetails =
      normalizedPrefill?.details && typeof normalizedPrefill.details === "object"
        ? normalizedPrefill.details
        : {};
    const prefillPropertyRecord =
      prefillDetails?.property_record && typeof prefillDetails.property_record === "object"
        ? prefillDetails.property_record
        : {};
    const prefillPropertyId = normalizePropertyId(
      prefillDetails?.property_id ||
        prefillPropertyRecord?.id ||
        prefillPropertyRecord?.ID ||
        prefillPropertyRecord?.Property_ID
    );

    const nextIndividualForm = {
      ...QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM,
      email: toText(prefillContact?.email || prefillContact?.Email),
      first_name: toText(prefillContact?.first_name || prefillContact?.First_Name),
      last_name: toText(prefillContact?.last_name || prefillContact?.Last_Name),
      sms_number: toText(prefillContact?.sms_number || prefillContact?.SMS_Number),
      address: toText(prefillContact?.address || prefillContact?.Address),
      city: toText(prefillContact?.city || prefillContact?.City),
      state: toText(prefillContact?.state || prefillContact?.State),
      zip_code: toText(
        prefillContact?.zip_code ||
          prefillContact?.Zip_Code ||
          prefillContact?.postal_code ||
          prefillContact?.Postal_Code
      ),
      country: toText(prefillContact?.country || prefillContact?.Country || "AU") || "AU",
    };
    const nextCompanyForm = {
      ...QUICK_INQUIRY_EMPTY_COMPANY_FORM,
      company_name: toText(prefillCompany?.company_name || prefillCompany?.name || prefillCompany?.Name),
      company_phone: toText(prefillCompany?.company_phone || prefillCompany?.phone || prefillCompany?.Phone),
      company_address: toText(
        prefillCompany?.company_address || prefillCompany?.address || prefillCompany?.Address
      ),
      company_city: toText(prefillCompany?.company_city || prefillCompany?.city || prefillCompany?.City),
      company_state: toText(prefillCompany?.company_state || prefillCompany?.state || prefillCompany?.State),
      company_postal_code: toText(
        prefillCompany?.company_postal_code ||
          prefillCompany?.postal_code ||
          prefillCompany?.Postal_Code ||
          prefillCompany?.zip_code ||
          prefillCompany?.Zip_Code
      ),
      company_account_type: toText(
        prefillCompany?.company_account_type ||
          prefillCompany?.account_type ||
          prefillCompany?.Account_Type
      ),
      primary_first_name: toText(prefillCompany?.primary_first_name || prefillCompany?.Primary_First_Name),
      primary_last_name: toText(prefillCompany?.primary_last_name || prefillCompany?.Primary_Last_Name),
      primary_email: toText(prefillCompany?.primary_email || prefillCompany?.Primary_Email),
      primary_sms_number: toText(
        prefillCompany?.primary_sms_number || prefillCompany?.Primary_SMS_Number
      ),
    };
    const nextDetailsForm = {
      ...QUICK_INQUIRY_EMPTY_DETAILS_FORM,
      inquiry_source: toText(prefillDetails?.inquiry_source || prefillDetails?.Inquiry_Source),
      type: toText(prefillDetails?.type || prefillDetails?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        prefillDetails?.service_inquiry_id || prefillDetails?.Service_Inquiry_ID
      ),
      how_can_we_help: toText(prefillDetails?.how_can_we_help || prefillDetails?.How_can_we_help),
      how_did_you_hear: toText(prefillDetails?.how_did_you_hear || prefillDetails?.How_did_you_hear),
      other: toText(prefillDetails?.other || prefillDetails?.Other),
      noise_signs_options_as_text: toText(
        prefillDetails?.noise_signs_options_as_text || prefillDetails?.Noise_Signs_Options_As_Text
      ),
      pest_active_times_options_as_text: toText(
        prefillDetails?.pest_active_times_options_as_text ||
          prefillDetails?.Pest_Active_Times_Options_As_Text
      ),
      pest_location_options_as_text: toText(
        prefillDetails?.pest_location_options_as_text ||
          prefillDetails?.Pest_Location_Options_As_Text
      ),
      property_lot_number: toText(
        prefillDetails?.property_lot_number ||
          prefillPropertyRecord?.lot_number ||
          prefillPropertyRecord?.Lot_Number
      ),
      property_unit_number: toText(
        prefillDetails?.property_unit_number ||
          prefillPropertyRecord?.unit_number ||
          prefillPropertyRecord?.Unit_Number
      ),
      property_lookup: toText(
        prefillDetails?.property_lookup ||
          joinAddress([
            prefillPropertyRecord?.address_1 ||
              prefillPropertyRecord?.Address_1 ||
              prefillPropertyRecord?.address ||
              prefillPropertyRecord?.Address,
            prefillPropertyRecord?.suburb_town ||
              prefillPropertyRecord?.Suburb_Town ||
              prefillPropertyRecord?.city ||
              prefillPropertyRecord?.City,
            prefillPropertyRecord?.state || prefillPropertyRecord?.State,
            prefillPropertyRecord?.postal_code ||
              prefillPropertyRecord?.Postal_Code ||
              prefillPropertyRecord?.zip_code ||
              prefillPropertyRecord?.Zip_Code,
            prefillPropertyRecord?.country || prefillPropertyRecord?.Country,
          ])
      ),
      property_name: toText(
        prefillDetails?.property_name ||
          prefillPropertyRecord?.property_name ||
          prefillPropertyRecord?.Property_Name
      ),
      property_address_1: toText(
        prefillDetails?.property_address_1 ||
          prefillPropertyRecord?.address_1 ||
          prefillPropertyRecord?.Address_1 ||
          prefillPropertyRecord?.address ||
          prefillPropertyRecord?.Address
      ),
      property_suburb_town: toText(
        prefillDetails?.property_suburb_town ||
          prefillPropertyRecord?.suburb_town ||
          prefillPropertyRecord?.Suburb_Town ||
          prefillPropertyRecord?.city ||
          prefillPropertyRecord?.City
      ),
      property_state: toText(
        prefillDetails?.property_state ||
          prefillPropertyRecord?.state ||
          prefillPropertyRecord?.State
      ),
      property_postal_code: toText(
        prefillDetails?.property_postal_code ||
          prefillPropertyRecord?.postal_code ||
          prefillPropertyRecord?.Postal_Code ||
          prefillPropertyRecord?.zip_code ||
          prefillPropertyRecord?.Zip_Code
      ),
      property_country:
        toText(
          prefillDetails?.property_country ||
            prefillPropertyRecord?.country ||
            prefillPropertyRecord?.Country ||
            "AU"
        ) || "AU",
      admin_notes: toText(prefillDetails?.admin_notes || prefillDetails?.Admin_Notes),
      client_notes: toText(prefillDetails?.client_notes || prefillDetails?.Client_Notes),
    };

    const contactId = resolveLookupRecordId(prefillContact, "Contact");
    const companyId = resolveLookupRecordId(prefillCompany, "Company");
    const hasIndividualOptional = Boolean(
      nextIndividualForm.first_name ||
        nextIndividualForm.last_name ||
        nextIndividualForm.sms_number ||
        nextIndividualForm.address ||
        nextIndividualForm.city ||
        nextIndividualForm.state ||
        nextIndividualForm.zip_code
    );
    const hasCompanyOptional = Boolean(
      nextCompanyForm.company_phone ||
        nextCompanyForm.company_address ||
        nextCompanyForm.company_city ||
        nextCompanyForm.company_state ||
        nextCompanyForm.company_postal_code ||
        nextCompanyForm.company_account_type ||
        nextCompanyForm.primary_first_name ||
        nextCompanyForm.primary_last_name ||
        nextCompanyForm.primary_email ||
        nextCompanyForm.primary_sms_number
    );

    setStep(1);
    setAccountMode(nextAccountMode);
    setShowIndividualOptional(hasIndividualOptional);
    setShowCompanyOptional(hasCompanyOptional);
    setIndividualForm(nextIndividualForm);
    setCompanyForm(nextCompanyForm);
    setDetailsForm(nextDetailsForm);
    setContactMatchState(
      contactId || nextIndividualForm.email
        ? {
            status: "found",
            message: "This contact already exists. Proceed with this email.",
            record: {
              ...prefillContact,
              id: contactId || toText(prefillContact?.id || prefillContact?.ID),
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setCompanyMatchState(
      companyId || nextCompanyForm.company_name
        ? {
            status: "found",
            message: "This company already exists. Proceed with this company.",
            record: {
              ...prefillCompany,
              id: companyId || toText(prefillCompany?.id || prefillCompany?.ID),
              name: toText(prefillCompany?.company_name || prefillCompany?.name || prefillCompany?.Name),
              account_type: toText(
                prefillCompany?.company_account_type ||
                  prefillCompany?.account_type ||
                  prefillCompany?.Account_Type
              ),
              Primary_Person: {
                first_name: toText(
                  prefillCompany?.primary_first_name || prefillCompany?.Primary_First_Name
                ),
                last_name: toText(
                  prefillCompany?.primary_last_name || prefillCompany?.Primary_Last_Name
                ),
                email: toText(prefillCompany?.primary_email || prefillCompany?.Primary_Email),
                sms_number: toText(
                  prefillCompany?.primary_sms_number || prefillCompany?.Primary_SMS_Number
                ),
              },
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setPropertyMatchState(
      prefillPropertyId
        ? {
            status: "found",
            message: "Property already exists and will be linked.",
            record: {
              ...prefillPropertyRecord,
              id: prefillPropertyId,
              property_name: toText(
                nextDetailsForm.property_name || prefillPropertyRecord?.property_name
              ),
            },
          }
        : { status: "idle", message: "", record: null }
    );
    setIsQuickPropertySameAsContact(
      Boolean(
        normalizedPrefill?.isPropertySameAsContact || normalizedPrefill?.property_same_as_contact
      )
    );
  }, [open, prefillContext]);

  const individualAddressLookupRef = useGoogleAddressLookup({
    enabled: open && accountMode === "individual" && showIndividualOptional,
    country: "au",
    onAddressSelected: (parsed) => {
      setIndividualForm((previous) => ({
        ...previous,
        address: toText(parsed?.address || parsed?.formatted_address || previous.address),
        city: toText(parsed?.city || previous.city),
        state: toText(parsed?.state || previous.state),
        zip_code: toText(parsed?.zip_code || previous.zip_code),
        country: toText(parsed?.country || previous.country || "AU"),
      }));
    },
  });

  const companyAddressLookupRef = useGoogleAddressLookup({
    enabled: open && accountMode === "company" && showCompanyOptional,
    country: "au",
    onAddressSelected: (parsed) => {
      setCompanyForm((previous) => ({
        ...previous,
        company_address: toText(parsed?.address || parsed?.formatted_address || previous.company_address),
        company_city: toText(parsed?.city || previous.company_city),
        company_state: toText(parsed?.state || previous.company_state),
        company_postal_code: toText(parsed?.zip_code || previous.company_postal_code),
      }));
    },
  });

  const propertyLookupRef = useGoogleAddressLookup({
    enabled: open && step === 2 && getInquiryFlowRule(detailsForm.type).showPropertySearch,
    country: "au",
    onAddressSelected: (parsed) => {
      const lookupLabel = toText(parsed?.formatted_address || parsed?.address);
      const lotNumber = toText(parsed?.lot_number);
      const unitNumber = toText(parsed?.unit_number);
      const address1 = toText(parsed?.address || lookupLabel);
      const suburbTown = toText(parsed?.city);
      const state = toText(parsed?.state);
      const postalCode = toText(parsed?.zip_code);
      const country = toText(parsed?.country || "AU");
      const propertyName = buildStandardPropertyName({
        lot_number: lotNumber,
        unit_number: unitNumber,
        address_1: address1,
        suburb_town: suburbTown,
        state,
        postal_code: postalCode,
        country,
      });
      setDetailsForm((previous) => ({
        ...previous,
        property_lookup: lookupLabel || previous.property_lookup,
        property_lot_number: lotNumber || previous.property_lot_number,
        property_unit_number: unitNumber || previous.property_unit_number,
        property_name: propertyName || previous.property_name,
        property_address_1: address1 || previous.property_address_1,
        property_suburb_town: suburbTown || previous.property_suburb_town,
        property_state: state || previous.property_state,
        property_postal_code: postalCode || previous.property_postal_code,
        property_country: country || previous.property_country || "AU",
      }));
    },
  });

  const inquiryFlowRule = useMemo(() => getInquiryFlowRule(detailsForm.type), [detailsForm.type]);
  const standardizedPropertyName = useMemo(
    () =>
      buildStandardPropertyName({
        lot_number: detailsForm.property_lot_number,
        unit_number: detailsForm.property_unit_number,
        address_1: detailsForm.property_address_1 || detailsForm.property_lookup,
        suburb_town: detailsForm.property_suburb_town,
        state: detailsForm.property_state,
        postal_code: detailsForm.property_postal_code,
        country: detailsForm.property_country || "AU",
      }),
    [
      detailsForm.property_address_1,
      detailsForm.property_country,
      detailsForm.property_lookup,
      detailsForm.property_lot_number,
      detailsForm.property_postal_code,
      detailsForm.property_state,
      detailsForm.property_suburb_town,
      detailsForm.property_unit_number,
    ]
  );
  const shouldShowOtherSource = useMemo(
    () => shouldShowOtherSourceField(detailsForm.how_did_you_hear),
    [detailsForm.how_did_you_hear]
  );
  const currentAccountType = accountMode === "company" ? "Company" : "Contact";
  const currentMatchedAccountId = useMemo(
    () =>
      accountMode === "company"
        ? resolveLookupRecordId(companyMatchState.record, "Company")
        : resolveLookupRecordId(contactMatchState.record, "Contact"),
    [accountMode, companyMatchState.record, contactMatchState.record]
  );
  const serviceNameById = useMemo(
    () =>
      Object.fromEntries(
        (Array.isArray(serviceOptions) ? serviceOptions : []).map((option) => [
          toText(option?.value),
          toText(option?.label),
        ])
      ),
    [serviceOptions]
  );
  const selectedQuickServiceInquiryLabel = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(detailsForm.service_inquiry_id);
    if (!selectedServiceId) return "";
    return toText(
      serviceNameById[selectedServiceId] ||
        (Array.isArray(serviceOptions)
          ? serviceOptions.find((option) => toText(option?.value) === selectedServiceId)?.label
          : "")
    );
  }, [detailsForm.service_inquiry_id, serviceNameById, serviceOptions]);
  const isQuickPestServiceSelected = useMemo(
    () => isPestServiceFlow(selectedQuickServiceInquiryLabel),
    [selectedQuickServiceInquiryLabel]
  );
  const canProceedStepOne =
    accountMode === "company"
      ? Boolean(toText(companyForm.company_name))
      : Boolean(toText(individualForm.email));
  const isInquiryReady = Boolean(toText(inquiryId));
  const canCreateInquiry =
    isInquiryReady &&
    Boolean(toText(detailsForm.inquiry_source)) &&
    Boolean(toText(detailsForm.type)) &&
    !isApplyingQuickSameAsContactProperty &&
    !isCreatingInquiry;
  const quickSameAsContactPropertySource = useMemo(() => {
    if (accountMode === "company") {
      const matchedRecord = companyMatchState.record || {};
      const address1 = toText(
        companyForm.company_address || matchedRecord?.address || matchedRecord?.Address
      );
      const suburbTown = toText(
        companyForm.company_city || matchedRecord?.city || matchedRecord?.City
      );
      const state = toText(
        companyForm.company_state || matchedRecord?.state || matchedRecord?.State
      );
      const postalCode = toText(
        companyForm.company_postal_code ||
          matchedRecord?.postal_code ||
          matchedRecord?.Postal_Code ||
          matchedRecord?.zip_code ||
          matchedRecord?.Zip_Code
      );
      const country = toText(matchedRecord?.country || matchedRecord?.Country || "AU") || "AU";
      const searchText = joinAddress([address1, suburbTown, state, postalCode]);
      return {
        address1,
        suburbTown,
        state,
        postalCode,
        country,
        searchText,
      };
    }
    const matchedRecord = contactMatchState.record || {};
    const address1 = toText(individualForm.address || matchedRecord?.address || matchedRecord?.Address);
    const suburbTown = toText(individualForm.city || matchedRecord?.city || matchedRecord?.City);
    const state = toText(individualForm.state || matchedRecord?.state || matchedRecord?.State);
    const postalCode = toText(
      individualForm.zip_code ||
        matchedRecord?.zip_code ||
        matchedRecord?.Zip_Code ||
        matchedRecord?.postal_code ||
        matchedRecord?.Postal_Code
    );
    const country = toText(
      individualForm.country || matchedRecord?.country || matchedRecord?.Country || "AU"
    ) || "AU";
    const searchText = joinAddress([address1, suburbTown, state, postalCode]);
    return {
      address1,
      suburbTown,
      state,
      postalCode,
      country,
      searchText,
    };
  }, [
    accountMode,
    companyForm.company_address,
    companyForm.company_city,
    companyForm.company_postal_code,
    companyForm.company_state,
    companyMatchState.record,
    contactMatchState.record,
    individualForm.address,
    individualForm.city,
    individualForm.country,
    individualForm.state,
    individualForm.zip_code,
  ]);

  const handleQuickSameAsContactPropertyChange = useCallback(
    async (checked) => {
      setIsQuickPropertySameAsContact(Boolean(checked));
      if (!checked) return;

      const sourceAddress = toText(quickSameAsContactPropertySource?.address1);
      const sourceSuburb = toText(quickSameAsContactPropertySource?.suburbTown);
      const sourceState = toText(quickSameAsContactPropertySource?.state);
      const sourcePostal = toText(quickSameAsContactPropertySource?.postalCode);
      const sourceCountry = toText(quickSameAsContactPropertySource?.country || "AU") || "AU";
      const concatenatedSourceAddress = toText(
        quickSameAsContactPropertySource?.searchText ||
          joinAddress([sourceAddress, sourceSuburb, sourceState, sourcePostal])
      );

      if (!concatenatedSourceAddress) {
        setIsQuickPropertySameAsContact(false);
        onError?.(new Error("No address is available on the current account."));
        return;
      }

      setIsApplyingQuickSameAsContactProperty(true);
      try {
        const googleResolvedAddress = await resolveAddressFromGoogleLookup(concatenatedSourceAddress);
        const derivedAddress1 = toText(
          googleResolvedAddress?.address || sourceAddress || concatenatedSourceAddress
        );
        const derivedSuburb = toText(googleResolvedAddress?.city || sourceSuburb);
        const derivedState = toText(googleResolvedAddress?.state || sourceState);
        const derivedPostal = toText(googleResolvedAddress?.zip_code || sourcePostal);
        const derivedCountry = toText(googleResolvedAddress?.country || sourceCountry) || sourceCountry;
        const derivedLot = toText(googleResolvedAddress?.lot_number);
        const derivedUnit = toText(googleResolvedAddress?.unit_number);
        const searchText = toText(
          googleResolvedAddress?.formatted_address ||
            joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) ||
            concatenatedSourceAddress
        );

        if (!derivedAddress1 && !searchText) {
          throw new Error("No address is available on the current account.");
        }

        let matchedExistingProperty = null;
        if (plugin?.switchTo) {
          const searchedRecords = await searchPropertiesForLookup({
            plugin,
            query: searchText,
            limit: 25,
          });
          const normalizedSearchedRecords = dedupePropertyLookupRecords(searchedRecords || []);
          const targetComparableAddress = normalizeAddressText(
            joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) || searchText
          );
          matchedExistingProperty =
            normalizedSearchedRecords.find(
              (record) => buildComparablePropertyAddress(record) === targetComparableAddress
            ) ||
            normalizedSearchedRecords.find((record) => {
              const comparable = buildComparablePropertyAddress(record);
              return Boolean(
                comparable &&
                  targetComparableAddress &&
                  comparable.includes(targetComparableAddress)
              );
            }) ||
            null;
        }

        const normalizedMatchedProperty = normalizePropertyLookupRecord(matchedExistingProperty || {});
        const nextLot = toText(normalizedMatchedProperty?.lot_number || derivedLot);
        const nextUnit = toText(normalizedMatchedProperty?.unit_number || derivedUnit);
        const nextAddress1 = toText(
          normalizedMatchedProperty?.address_1 ||
            normalizedMatchedProperty?.address ||
            derivedAddress1
        );
        const nextSuburb = toText(
          normalizedMatchedProperty?.suburb_town ||
            normalizedMatchedProperty?.city ||
            derivedSuburb
        );
        const nextState = toText(normalizedMatchedProperty?.state || derivedState);
        const nextPostal = toText(
          normalizedMatchedProperty?.postal_code ||
            normalizedMatchedProperty?.zip_code ||
            derivedPostal
        );
        const nextCountry = toText(normalizedMatchedProperty?.country || derivedCountry || "AU") || "AU";
        const matchedPropertyName = toText(normalizedMatchedProperty?.property_name);
        const nextPropertyName =
          matchedPropertyName ||
          buildStandardPropertyName({
            lot_number: nextLot,
            unit_number: nextUnit,
            address_1: nextAddress1,
            suburb_town: nextSuburb,
            state: nextState,
            postal_code: nextPostal,
            country: nextCountry,
          }) ||
          searchText;
        const nextLookup = toText(googleResolvedAddress?.formatted_address || searchText || nextAddress1);

        setDetailsForm((previous) => ({
          ...previous,
          property_lookup: nextLookup,
          property_lot_number: nextLot,
          property_unit_number: nextUnit,
          property_name: nextPropertyName,
          property_address_1: nextAddress1,
          property_suburb_town: nextSuburb,
          property_state: nextState,
          property_postal_code: nextPostal,
          property_country: nextCountry,
        }));

        if (matchedExistingProperty) {
          setPropertyMatchState({
            status: "found",
            message: "Property already exists and will be linked.",
            record: normalizedMatchedProperty,
          });
        }
      } catch (applyError) {
        console.error("[QuickInquiry] Failed same-as-contact property flow", applyError);
        setIsQuickPropertySameAsContact(false);
        onError?.(new Error(applyError?.message || "Unable to apply contact address to property."));
      } finally {
        setIsApplyingQuickSameAsContactProperty(false);
      }
    },
    [onError, plugin, quickSameAsContactPropertySource]
  );

  useEffect(() => {
    if (!open || !plugin) return;

    let cancelled = false;
    setIsServiceOptionsLoading(true);
    fetchServicesForActivities({ plugin })
      .then((records) => {
        if (cancelled) return;
        const mapped = (Array.isArray(records) ? records : [])
          .map((record) => ({
            value: toText(record?.id || record?.ID),
            label: toText(record?.service_name || record?.Service_Name),
            type: toText(record?.service_type || record?.Service_Type),
          }))
          .filter((record) => record.value && record.label)
          .sort((left, right) => left.label.localeCompare(right.label));
        setServiceOptions(mapped);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[QuickInquiry] Failed loading service options", loadError);
        setServiceOptions([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsServiceOptionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, plugin]);

  useEffect(() => {
    if (!open || !plugin || accountMode !== "individual") {
      setContactMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const email = toText(individualForm.email);
    if (!email) {
      setContactMatchState({ status: "idle", message: "", record: null });
      return;
    }
    if (!isLikelyEmailValue(email)) {
      setContactMatchState({
        status: "invalid",
        message: "Enter a valid email format to run a duplicate check.",
        record: null,
      });
      return;
    }

    const requestId = ++contactLookupRequestRef.current;
    setContactMatchState({
      status: "checking",
      message: "Checking for existing contact...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      fetchContactByExactEmail({ plugin, email })
        .then((matchedRecord) => {
          if (requestId !== contactLookupRequestRef.current) return;
          if (!matchedRecord) {
            setContactMatchState({
              status: "not-found",
              message: "No contact found with this email. Proceed to create a new contact.",
              record: null,
            });
            return;
          }
          setContactMatchState({
            status: "found",
            message: "This contact already exists. Proceed with this email.",
            record: matchedRecord,
          });
          setIndividualForm((previous) => ({
            ...previous,
            first_name: toText(
              matchedRecord?.first_name || matchedRecord?.First_Name || previous.first_name
            ),
            last_name: toText(
              matchedRecord?.last_name || matchedRecord?.Last_Name || previous.last_name
            ),
            sms_number: toText(
              matchedRecord?.sms_number || matchedRecord?.SMS_Number || previous.sms_number
            ),
            address: toText(matchedRecord?.address || matchedRecord?.Address || previous.address),
            city: toText(matchedRecord?.city || matchedRecord?.City || previous.city),
            state: toText(matchedRecord?.state || matchedRecord?.State || previous.state),
            zip_code: toText(matchedRecord?.zip_code || matchedRecord?.Zip_Code || previous.zip_code),
            country: toText(matchedRecord?.country || matchedRecord?.Country || previous.country || "AU"),
          }));
        })
        .catch((lookupError) => {
          if (requestId !== contactLookupRequestRef.current) return;
          console.error("[QuickInquiry] Contact lookup failed", lookupError);
          setContactMatchState({
            status: "error",
            message: lookupError?.message || "Unable to verify contact email.",
            record: null,
          });
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [accountMode, individualForm.email, open, plugin]);

  useEffect(() => {
    if (!open || !plugin || accountMode !== "company") {
      setCompanyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const companyName = toText(companyForm.company_name);
    if (!companyName) {
      setCompanyMatchState({ status: "idle", message: "", record: null });
      return;
    }

    const requestId = ++companyLookupRequestRef.current;
    setCompanyMatchState({
      status: "checking",
      message: "Checking for existing company...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      fetchCompanyByExactName({ plugin, companyName })
        .then((matchedRecord) => {
          if (requestId !== companyLookupRequestRef.current) return;
          if (!matchedRecord) {
            setCompanyMatchState({
              status: "not-found",
              message: "No company found with this name. Proceed to create a new company.",
              record: null,
            });
            return;
          }
          setCompanyMatchState({
            status: "found",
            message: "This company already exists. Proceed with this company.",
            record: matchedRecord,
          });
          const primaryPerson = normalizeRelationRecord(
            matchedRecord?.Primary_Person || matchedRecord?.primary_person
          );
          setCompanyForm((previous) => ({
            ...previous,
            company_phone: toText(matchedRecord?.phone || matchedRecord?.Phone || previous.company_phone),
            company_address: toText(
              matchedRecord?.address || matchedRecord?.Address || previous.company_address
            ),
            company_city: toText(matchedRecord?.city || matchedRecord?.City || previous.company_city),
            company_state: toText(
              matchedRecord?.state || matchedRecord?.State || previous.company_state
            ),
            company_postal_code: toText(
              matchedRecord?.postal_code ||
                matchedRecord?.Postal_Code ||
                previous.company_postal_code
            ),
            company_account_type: toText(
              matchedRecord?.account_type ||
                matchedRecord?.Account_Type ||
                previous.company_account_type
            ),
            primary_first_name: toText(
              primaryPerson?.first_name || primaryPerson?.First_Name || previous.primary_first_name
            ),
            primary_last_name: toText(
              primaryPerson?.last_name || primaryPerson?.Last_Name || previous.primary_last_name
            ),
            primary_email: toText(
              primaryPerson?.email || primaryPerson?.Email || previous.primary_email
            ),
            primary_sms_number: toText(
              primaryPerson?.sms_number || primaryPerson?.SMS_Number || previous.primary_sms_number
            ),
          }));
        })
        .catch((lookupError) => {
          if (requestId !== companyLookupRequestRef.current) return;
          console.error("[QuickInquiry] Company lookup failed", lookupError);
          setCompanyMatchState({
            status: "error",
            message: lookupError?.message || "Unable to verify company name.",
            record: null,
          });
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [accountMode, companyForm.company_name, open, plugin]);

  useEffect(() => {
    if (!open || !plugin || !inquiryFlowRule.showPropertySearch) {
      setPropertyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const propertyNameToMatch = toText(
      standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
    );
    if (!propertyNameToMatch) {
      setPropertyMatchState({ status: "idle", message: "", record: null });
      return;
    }
    const comparableTarget = normalizeComparablePropertyName(propertyNameToMatch);

    const requestId = ++propertyLookupRequestRef.current;
    setPropertyMatchState({
      status: "checking",
      message: "Checking for existing property...",
      record: null,
    });
    const timeoutId = window.setTimeout(() => {
      findPropertyByName({ plugin, propertyName: propertyNameToMatch })
        .then((matchedRecord) => {
          if (requestId !== propertyLookupRequestRef.current) return;
          const comparableFound = normalizeComparablePropertyName(
            matchedRecord?.property_name || matchedRecord?.Property_Name
          );
          const hasExactMatch =
            Boolean(matchedRecord) &&
            Boolean(comparableTarget) &&
            comparableFound === comparableTarget;
          if (!hasExactMatch) {
            setPropertyMatchState({
              status: "not-found",
              message:
                "No exact property-name match found. A new property will be created on save.",
              record: null,
            });
            return;
          }
          setPropertyMatchState({
            status: "found",
            message: "Property already exists and will be linked.",
            record: matchedRecord,
          });
        })
        .catch((lookupError) => {
          if (requestId !== propertyLookupRequestRef.current) return;
          console.error("[QuickInquiry] Property lookup failed", lookupError);
          setPropertyMatchState({
            status: "error",
            message: lookupError?.message || "Unable to verify property name.",
            record: null,
          });
        });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    detailsForm.property_lookup,
    detailsForm.property_name,
    inquiryFlowRule.showPropertySearch,
    open,
    plugin,
    standardizedPropertyName,
  ]);

  useEffect(() => {
    if (!open || !plugin || !currentMatchedAccountId) {
      setRelatedInquiries([]);
      setRelatedJobs([]);
      setRelatedError("");
      setIsRelatedLoading(false);
      return;
    }
    let cancelled = false;
    setIsRelatedLoading(true);
    setRelatedError("");

    Promise.all([
      fetchQuickRelatedInquiriesByAccount({
        plugin,
        accountType: currentAccountType,
        accountId: currentMatchedAccountId,
      }),
      fetchQuickRelatedJobsByAccount({
        plugin,
        accountType: currentAccountType,
        accountId: currentMatchedAccountId,
      }),
    ])
      .then(([inquiries, jobs]) => {
        if (cancelled) return;
        setRelatedInquiries(Array.isArray(inquiries) ? inquiries : []);
        setRelatedJobs(Array.isArray(jobs) ? jobs : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[QuickInquiry] Failed loading related records", loadError);
        setRelatedInquiries([]);
        setRelatedJobs([]);
        setRelatedError(loadError?.message || "Unable to load related records.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsRelatedLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentAccountType, currentMatchedAccountId, open, plugin]);

  const handleCreateQuickInquiry = useCallback(async () => {
    if (!plugin) {
      onError?.(new Error("SDK is still initializing. Please wait."));
      return;
    }
    const normalizedInquiryId = toText(inquiryId);
    if (!normalizedInquiryId) {
      onError?.(new Error("Inquiry is still being prepared. Please wait a moment."));
      return;
    }
    if (isCreatingInquiry) return;
    const resolvedAccountMode = accountMode === "company" ? "Company" : "Contact";
    const currentFlowRule = getInquiryFlowRule(detailsForm.type);
    const sourceValue = toText(detailsForm.inquiry_source);
    const typeValue = toText(detailsForm.type);
    if (!sourceValue || !typeValue) {
      onError?.(new Error("Source and Type are required before creating inquiry."));
      return;
    }
    if (resolvedAccountMode === "Contact") {
      const email = toText(individualForm.email);
      if (!email || !isLikelyEmailValue(email)) {
        onError?.(new Error("A valid email is required for individual inquiry."));
        return;
      }
    } else if (!toText(companyForm.company_name)) {
      onError?.(new Error("Company name is required for company inquiry."));
      return;
    }

    const optimisticInquiryPatch = {
      inquiry_status: "New Inquiry",
      account_type: resolvedAccountMode,
      inquiry_source: toText(sourceValue),
      type: toText(typeValue),
      service_inquiry_id: currentFlowRule.showServiceInquiry
        ? normalizeServiceInquiryId(detailsForm.service_inquiry_id)
        : "",
      how_can_we_help: currentFlowRule.showHowCanWeHelp ? toText(detailsForm.how_can_we_help) : "",
      how_did_you_hear: currentFlowRule.showHowDidYouHear
        ? toText(detailsForm.how_did_you_hear)
        : "",
      other:
        currentFlowRule.showHowDidYouHear && shouldShowOtherSource ? toText(detailsForm.other) : "",
      noise_signs_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.noise_signs_options_as_text)
        : "",
      pest_active_times_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.pest_active_times_options_as_text)
        : "",
      pest_location_options_as_text: isQuickPestServiceSelected
        ? toText(detailsForm.pest_location_options_as_text)
        : "",
      admin_notes: toText(detailsForm.admin_notes),
      client_notes: toText(detailsForm.client_notes),
      Inquiry_Taken_By_id: configuredAdminProviderId
        ? normalizeMutationIdentifier(configuredAdminProviderId)
        : null,
    };
    if (currentFlowRule.showPropertySearch) {
      const optimisticPropertyName = toText(
        standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
      );
      const matchedPropertyId = normalizePropertyId(
        propertyMatchState.record?.id || propertyMatchState.record?.ID
      );
      optimisticInquiryPatch.property_id = matchedPropertyId || "";
      optimisticInquiryPatch.Property = {
        id: matchedPropertyId || "",
        property_name: optimisticPropertyName,
        address_1: toText(detailsForm.property_address_1 || detailsForm.property_lookup),
        suburb_town: toText(detailsForm.property_suburb_town),
        state: toText(detailsForm.property_state),
        postal_code: toText(detailsForm.property_postal_code),
        country: toText(detailsForm.property_country || "AU"),
      };
    }
    if (resolvedAccountMode === "Contact") {
      const matchedContactId = resolveLookupRecordId(contactMatchState.record, "Contact");
      optimisticInquiryPatch.primary_contact_id = matchedContactId || "";
      optimisticInquiryPatch.Primary_Contact = {
        id: matchedContactId || "",
        first_name: toText(individualForm.first_name),
        last_name: toText(individualForm.last_name),
        email: toText(individualForm.email),
        sms_number: toText(individualForm.sms_number),
        address: toText(individualForm.address),
        city: toText(individualForm.city),
        state: toText(individualForm.state),
        zip_code: toText(individualForm.zip_code),
        country: toText(individualForm.country || "AU"),
      };
    } else {
      const matchedCompanyId = resolveLookupRecordId(companyMatchState.record, "Company");
      optimisticInquiryPatch.company_id = matchedCompanyId || "";
      optimisticInquiryPatch.Company = {
        id: matchedCompanyId || "",
        name: toText(companyForm.company_name),
        phone: toText(companyForm.company_phone),
        address: toText(companyForm.company_address),
        city: toText(companyForm.company_city),
        state: toText(companyForm.company_state),
        postal_code: toText(companyForm.company_postal_code),
        account_type: toText(companyForm.company_account_type),
        Primary_Person: {
          first_name: toText(companyForm.primary_first_name),
          last_name: toText(companyForm.primary_last_name),
          email: toText(companyForm.primary_email),
          sms_number: toText(companyForm.primary_sms_number),
        },
      };
    }

    setIsCreatingInquiry(true);
    onSavingStart?.(optimisticInquiryPatch);
    try {
      let resolvedContactId = "";
      let resolvedCompanyId = "";

      if (resolvedAccountMode === "Contact") {
        const email = toText(individualForm.email);
        if (!email || !isLikelyEmailValue(email)) {
          throw new Error("A valid email is required for individual inquiry.");
        }

        const matchedRecord = contactMatchState.record;
        const matchedEmail = normalizeComparableText(
          matchedRecord?.email || matchedRecord?.Email
        );
        const shouldUseMatched =
          Boolean(matchedRecord) && matchedEmail === normalizeComparableText(email);
        if (shouldUseMatched) {
          resolvedContactId = resolveLookupRecordId(matchedRecord, "Contact");
        }
        if (!resolvedContactId) {
          const refreshedMatch = await fetchContactByExactEmail({ plugin, email });
          resolvedContactId = resolveLookupRecordId(refreshedMatch, "Contact");
        }
        if (!resolvedContactId) {
          const payload = compactStringFields({
            first_name: individualForm.first_name,
            last_name: individualForm.last_name,
            email,
            sms_number: individualForm.sms_number,
            address: individualForm.address,
            city: individualForm.city,
            state: individualForm.state,
            zip_code: individualForm.zip_code,
            country: individualForm.country || "AU",
          });
          try {
            const createdContact = await createContactRecord({ plugin, payload });
            resolvedContactId = resolveLookupRecordId(createdContact, "Contact");
          } catch (createError) {
            const fallbackMatch = await fetchContactByExactEmail({ plugin, email });
            resolvedContactId = resolveLookupRecordId(fallbackMatch, "Contact");
            if (!resolvedContactId) {
              throw createError;
            }
          }
          if (!resolvedContactId) {
            const postCreateMatch = await fetchContactByExactEmail({ plugin, email });
            resolvedContactId = resolveLookupRecordId(postCreateMatch, "Contact");
          }
        }

        if (!resolvedContactId) {
          throw new Error("Unable to resolve contact for this inquiry.");
        }
      } else {
        const companyName = toText(companyForm.company_name);
        if (!companyName) {
          throw new Error("Company name is required for company inquiry.");
        }
        const matchedRecord = companyMatchState.record;
        const matchedName = normalizeComparableText(matchedRecord?.name || matchedRecord?.Name);
        const shouldUseMatched =
          Boolean(matchedRecord) && matchedName === normalizeComparableText(companyName);
        if (shouldUseMatched) {
          resolvedCompanyId = resolveLookupRecordId(matchedRecord, "Company");
        }
        if (!resolvedCompanyId) {
          const refreshedMatch = await fetchCompanyByExactName({ plugin, companyName });
          resolvedCompanyId = resolveLookupRecordId(refreshedMatch, "Company");
        }
        if (!resolvedCompanyId) {
          const primaryPersonPayload = compactStringFields({
            first_name: companyForm.primary_first_name,
            last_name: companyForm.primary_last_name,
            email: companyForm.primary_email,
            sms_number: companyForm.primary_sms_number,
          });
          const companyPayload = compactStringFields({
            name: companyName,
            phone: companyForm.company_phone,
            address: companyForm.company_address,
            city: companyForm.company_city,
            state: companyForm.company_state,
            postal_code: companyForm.company_postal_code,
            account_type: companyForm.company_account_type,
          });
          if (Object.keys(primaryPersonPayload).length) {
            companyPayload.Primary_Person = primaryPersonPayload;
          }
          try {
            const createdCompany = await createCompanyRecord({
              plugin,
              payload: companyPayload,
            });
            resolvedCompanyId = resolveLookupRecordId(createdCompany, "Company");
          } catch (createError) {
            const fallbackMatch = await fetchCompanyByExactName({ plugin, companyName });
            resolvedCompanyId = resolveLookupRecordId(fallbackMatch, "Company");
            if (!resolvedCompanyId) {
              throw createError;
            }
          }
          if (!resolvedCompanyId) {
            const postCreateMatch = await fetchCompanyByExactName({ plugin, companyName });
            resolvedCompanyId = resolveLookupRecordId(postCreateMatch, "Company");
          }
        }

        if (!resolvedCompanyId) {
          throw new Error("Unable to resolve company for this inquiry.");
        }
      }

      let resolvedPropertyId = "";
      let resolvedPropertyRecord = null;
      if (currentFlowRule.showPropertySearch) {
        const propertyName = toText(
          standardizedPropertyName || detailsForm.property_name || detailsForm.property_lookup
        );
        const propertyDraft = {
          property_name: propertyName,
          lot_number: toText(detailsForm.property_lot_number),
          unit_number: toText(detailsForm.property_unit_number),
          address_1: toText(detailsForm.property_address_1 || detailsForm.property_lookup),
          suburb_town: toText(detailsForm.property_suburb_town),
          state: toText(detailsForm.property_state),
          postal_code: toText(detailsForm.property_postal_code),
          country: toText(detailsForm.property_country || "AU"),
        };
        const matchedProperty = propertyMatchState.record;
        const comparableTargetPropertyName = normalizeComparablePropertyName(propertyName);
        const comparableMatchedPropertyName = normalizeComparablePropertyName(
          matchedProperty?.property_name || matchedProperty?.Property_Name
        );
        if (
          matchedProperty &&
          comparableTargetPropertyName &&
          comparableMatchedPropertyName === comparableTargetPropertyName
        ) {
          resolvedPropertyId = normalizePropertyId(matchedProperty?.id || matchedProperty?.ID);
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            ...(matchedProperty || {}),
            id: resolvedPropertyId || matchedProperty?.id || matchedProperty?.ID || "",
          });
        } else if (propertyName) {
          const createdProperty = await createPropertyRecord({
            plugin,
            payload: compactStringFields(propertyDraft),
          });
          resolvedPropertyId = normalizePropertyId(createdProperty?.id || createdProperty?.ID);
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            ...(createdProperty || {}),
            id: resolvedPropertyId || createdProperty?.id || createdProperty?.ID || "",
          });
        }
        if (resolvedPropertyId && !resolvedPropertyRecord) {
          resolvedPropertyRecord = normalizePropertyLookupRecord({
            ...propertyDraft,
            id: resolvedPropertyId,
          });
        }
      }

      const payload = {
        inquiry_status: "New Inquiry",
        account_type: resolvedAccountMode,
        primary_contact_id:
          resolvedAccountMode === "Contact"
            ? normalizeMutationIdentifier(resolvedContactId)
            : null,
        company_id:
          resolvedAccountMode === "Company"
            ? normalizeMutationIdentifier(resolvedCompanyId)
            : null,
        inquiry_source: toNullableText(sourceValue),
        type: toNullableText(typeValue),
        service_inquiry_id: currentFlowRule.showServiceInquiry
          ? normalizeMutationIdentifier(normalizeServiceInquiryId(detailsForm.service_inquiry_id))
          : null,
        how_can_we_help: currentFlowRule.showHowCanWeHelp
          ? toNullableText(detailsForm.how_can_we_help)
          : null,
        how_did_you_hear: currentFlowRule.showHowDidYouHear
          ? toNullableText(detailsForm.how_did_you_hear)
          : null,
        other:
          currentFlowRule.showHowDidYouHear && shouldShowOtherSource
            ? toNullableText(detailsForm.other)
            : null,
        noise_signs_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.noise_signs_options_as_text)
          : null,
        pest_active_times_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.pest_active_times_options_as_text)
          : null,
        pest_location_options_as_text: isQuickPestServiceSelected
          ? toNullableText(detailsForm.pest_location_options_as_text)
          : null,
        admin_notes: toNullableText(detailsForm.admin_notes),
        client_notes: toNullableText(detailsForm.client_notes),
        property_id:
          currentFlowRule.showPropertySearch && resolvedPropertyId
            ? normalizeMutationIdentifier(resolvedPropertyId)
            : null,
        Inquiry_Taken_By_id: configuredAdminProviderId
          ? normalizeMutationIdentifier(configuredAdminProviderId)
          : null,
      };

      await updateInquiryFieldsById({
        plugin,
        inquiryId: normalizedInquiryId,
        payload,
      });
      onSaved?.({
        id: normalizedInquiryId,
        propertyId: resolvedPropertyId,
        propertyRecord: resolvedPropertyRecord,
        isPropertySameAsContact: Boolean(
          currentFlowRule.showPropertySearch && isQuickPropertySameAsContact
        ),
      });
    } catch (saveError) {
      onError?.(saveError);
    } finally {
      setIsCreatingInquiry(false);
    }
  }, [
    accountMode,
    companyForm.company_account_type,
    companyForm.company_address,
    companyForm.company_city,
    companyForm.company_name,
    companyForm.company_phone,
    companyForm.company_postal_code,
    companyForm.company_state,
    companyForm.primary_email,
    companyForm.primary_first_name,
    companyForm.primary_last_name,
    companyForm.primary_sms_number,
    companyMatchState.record,
    configuredAdminProviderId,
    contactMatchState.record,
    detailsForm.admin_notes,
    detailsForm.client_notes,
    detailsForm.how_can_we_help,
    detailsForm.how_did_you_hear,
    detailsForm.inquiry_source,
    detailsForm.noise_signs_options_as_text,
    detailsForm.other,
    detailsForm.pest_active_times_options_as_text,
    detailsForm.pest_location_options_as_text,
    detailsForm.property_address_1,
    detailsForm.property_country,
    detailsForm.property_lot_number,
    detailsForm.property_lookup,
    detailsForm.property_name,
    detailsForm.property_postal_code,
    detailsForm.property_state,
    detailsForm.property_suburb_town,
    detailsForm.property_unit_number,
    detailsForm.service_inquiry_id,
    detailsForm.type,
    inquiryId,
    individualForm.address,
    individualForm.city,
    individualForm.country,
    individualForm.email,
    individualForm.first_name,
    individualForm.last_name,
    individualForm.sms_number,
    individualForm.state,
    individualForm.zip_code,
    isCreatingInquiry,
    onError,
    onSavingStart,
    onSaved,
    plugin,
    propertyMatchState.record,
    isQuickPropertySameAsContact,
    isQuickPestServiceSelected,
    standardizedPropertyName,
    shouldShowOtherSource,
  ]);

  const matchMessageClassByStatus = {
    found: "text-emerald-700",
    checking: "text-slate-500",
    error: "text-red-600",
    invalid: "text-amber-700",
    "not-found": "text-slate-500",
  };

  return (
    <Modal
      open={open}
      onClose={isCreatingInquiry ? () => {} : onClose}
      title="Quick Inquiry Booking"
      widthClass="max-w-[min(98vw,1220px)]"
      closeOnBackdrop={false}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="text-xs text-slate-500">Step {step} of 2</div>
          <div className="flex items-center gap-2">
            {step === 2 ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep(1)}
                disabled={isCreatingInquiry}
              >
                Back
              </Button>
            ) : null}
            {step === 1 ? (
              <Button
                variant="primary"
                size="sm"
                onClick={() => setStep(2)}
                disabled={!canProceedStepOne}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={handleCreateQuickInquiry}
                disabled={!canCreateInquiry}
              >
                {isCreatingInquiry ? "Saving..." : "Save Inquiry"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="max-h-[76vh] overflow-y-auto pr-1">
        <div className="mb-3 flex items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              step === 1 ? "bg-[#003882] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            1. Account
          </span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
              step === 2 ? "bg-[#003882] text-white" : "bg-slate-100 text-slate-600"
            }`}
          >
            2. Inquiry Details
          </span>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            {step === 1 ? (
              <div className="rounded border border-slate-200 bg-white p-3">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  Are you an individual or company?
                </div>
                <div className="mb-3 inline-flex rounded border border-slate-300 p-0.5">
                  <button
                    type="button"
                    className={`rounded px-3 py-1 text-xs font-semibold ${
                      accountMode === "individual"
                        ? "bg-[#003882] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setAccountMode("individual")}
                  >
                    Individual
                  </button>
                  <button
                    type="button"
                    className={`rounded px-3 py-1 text-xs font-semibold ${
                      accountMode === "company"
                        ? "bg-[#003882] text-white"
                        : "text-slate-600 hover:bg-slate-100"
                    }`}
                    onClick={() => setAccountMode("company")}
                  >
                    Company
                  </button>
                </div>

                {accountMode === "individual" ? (
                  <div className="space-y-2">
                    <InputField
                      label="Email"
                      field="quick_individual_email"
                      value={individualForm.email}
                      onChange={(event) =>
                        setIndividualForm((previous) => ({
                          ...previous,
                          email: event.target.value,
                        }))
                      }
                      placeholder="Enter email"
                    />
                    {contactMatchState.message ? (
                      <div
                        className={`text-xs ${
                          matchMessageClassByStatus[contactMatchState.status] || "text-slate-500"
                        }`}
                      >
                        {contactMatchState.message}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-700 underline underline-offset-2"
                      onClick={() => setShowIndividualOptional((previous) => !previous)}
                    >
                      {showIndividualOptional ? "Hide optional details" : "Add optional details"}
                    </button>

                    {showIndividualOptional ? (
                      <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                        <InputField
                          label="First Name"
                          field="quick_individual_first_name"
                          value={individualForm.first_name}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              first_name: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Last Name"
                          field="quick_individual_last_name"
                          value={individualForm.last_name}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              last_name: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Phone"
                          field="quick_individual_phone"
                          value={individualForm.sms_number}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              sms_number: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Address (Google Lookup)"
                          field="quick_individual_address"
                          inputRef={individualAddressLookupRef}
                          value={individualForm.address}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              address: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="City"
                          field="quick_individual_city"
                          value={individualForm.city}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              city: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="State"
                          field="quick_individual_state"
                          value={individualForm.state}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              state: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Postal Code"
                          field="quick_individual_zip_code"
                          value={individualForm.zip_code}
                          onChange={(event) =>
                            setIndividualForm((previous) => ({
                              ...previous,
                              zip_code: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <InputField
                      label="Company Name"
                      field="quick_company_name"
                      value={companyForm.company_name}
                      onChange={(event) =>
                        setCompanyForm((previous) => ({
                          ...previous,
                          company_name: event.target.value,
                        }))
                      }
                      placeholder="Enter company name"
                    />
                    {companyMatchState.message ? (
                      <div
                        className={`text-xs ${
                          matchMessageClassByStatus[companyMatchState.status] || "text-slate-500"
                        }`}
                      >
                        {companyMatchState.message}
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-medium text-sky-700 underline underline-offset-2"
                      onClick={() => setShowCompanyOptional((previous) => !previous)}
                    >
                      {showCompanyOptional ? "Hide optional details" : "Add optional details"}
                    </button>
                    {showCompanyOptional ? (
                      <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
                        <InputField
                          label="Phone"
                          field="quick_company_phone"
                          value={companyForm.company_phone}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_phone: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Address (Google Lookup)"
                          field="quick_company_address"
                          inputRef={companyAddressLookupRef}
                          value={companyForm.company_address}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_address: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="City"
                          field="quick_company_city"
                          value={companyForm.company_city}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_city: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="State"
                          field="quick_company_state"
                          value={companyForm.company_state}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_state: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Postal Code"
                          field="quick_company_postal_code"
                          value={companyForm.company_postal_code}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_postal_code: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Account Type"
                          field="quick_company_account_type"
                          value={companyForm.company_account_type}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              company_account_type: event.target.value,
                            }))
                          }
                          placeholder="Business / Body Corp / Other"
                        />
                        <InputField
                          label="Primary First Name"
                          field="quick_company_primary_first_name"
                          value={companyForm.primary_first_name}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              primary_first_name: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Primary Last Name"
                          field="quick_company_primary_last_name"
                          value={companyForm.primary_last_name}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              primary_last_name: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Primary Email"
                          field="quick_company_primary_email"
                          value={companyForm.primary_email}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              primary_email: event.target.value,
                            }))
                          }
                        />
                        <InputField
                          label="Primary Phone"
                          field="quick_company_primary_phone"
                          value={companyForm.primary_sms_number}
                          onChange={(event) =>
                            setCompanyForm((previous) => ({
                              ...previous,
                              primary_sms_number: event.target.value,
                            }))
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3 rounded border border-slate-200 bg-white p-3">
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <SelectInput
                    label="Source"
                    field="quick_inquiry_source"
                    options={INQUIRY_SOURCE_OPTIONS}
                    value={detailsForm.inquiry_source}
                    onChange={(nextValue) =>
                      setDetailsForm((previous) => ({ ...previous, inquiry_source: nextValue }))
                    }
                  />
                  <SelectInput
                    label="Type"
                    field="quick_inquiry_type"
                    options={INQUIRY_TYPE_OPTIONS}
                    value={detailsForm.type}
                    onChange={(nextValue) =>
                      setDetailsForm((previous) => ({ ...previous, type: nextValue }))
                    }
                  />
                  {inquiryFlowRule.showServiceInquiry ? (
                    <SelectInput
                      label={
                        isServiceOptionsLoading
                          ? "Service (Loading...)"
                          : "Service"
                      }
                      field="quick_inquiry_service"
                      options={serviceOptions}
                      value={detailsForm.service_inquiry_id}
                      onChange={(nextValue) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          service_inquiry_id: normalizeServiceInquiryId(nextValue),
                        }))
                      }
                    />
                  ) : null}
                  {inquiryFlowRule.showHowDidYouHear ? (
                    <SelectInput
                      label="How Did You Hear"
                      field="quick_how_did_you_hear"
                      options={HOW_DID_YOU_HEAR_OPTIONS}
                      value={detailsForm.how_did_you_hear}
                      onChange={(nextValue) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          how_did_you_hear: nextValue,
                        }))
                      }
                    />
                  ) : null}
                  {inquiryFlowRule.showHowDidYouHear && shouldShowOtherSource ? (
                    <InputField
                      label="Other"
                      field="quick_how_did_you_hear_other"
                      value={detailsForm.other}
                      onChange={(event) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          other: event.target.value,
                        }))
                      }
                    />
                  ) : null}
                </div>

                {inquiryFlowRule.showServiceInquiry && isQuickPestServiceSelected ? (
                  <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                    <InquiryEditListSelectionField
                      label="Pest Noise Signs"
                      field="quick_noise_signs_options_as_text"
                      value={detailsForm.noise_signs_options_as_text}
                      options={NOISE_SIGN_OPTIONS}
                      onChange={(nextValue) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          noise_signs_options_as_text: nextValue,
                        }))
                      }
                    />
                    <InquiryEditListSelectionField
                      label="Pest Active Times"
                      field="quick_pest_active_times_options_as_text"
                      value={detailsForm.pest_active_times_options_as_text}
                      options={PEST_ACTIVE_TIME_OPTIONS}
                      onChange={(nextValue) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          pest_active_times_options_as_text: nextValue,
                        }))
                      }
                    />
                    <InquiryEditListSelectionField
                      label="Pest Locations"
                      field="quick_pest_location_options_as_text"
                      value={detailsForm.pest_location_options_as_text}
                      options={PEST_LOCATION_OPTIONS}
                      onChange={(nextValue) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          pest_location_options_as_text: nextValue,
                        }))
                      }
                    />
                  </div>
                ) : null}

                {inquiryFlowRule.showHowCanWeHelp ? (
                  <label className="block">
                    <span className="type-label text-slate-600">How Can We Help</span>
                    <textarea
                      className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                      rows={4}
                      value={detailsForm.how_can_we_help}
                      onChange={(event) =>
                        setDetailsForm((previous) => ({
                          ...previous,
                          how_can_we_help: event.target.value,
                        }))
                      }
                    />
                  </label>
                ) : null}

                {inquiryFlowRule.showPropertySearch ? (
                  <>
                    <div className="mb-1 flex items-center justify-end">
                      <label className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-600">
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 accent-[#003882]"
                          checked={Boolean(isQuickPropertySameAsContact)}
                          disabled={
                            isApplyingQuickSameAsContactProperty ||
                            !toText(quickSameAsContactPropertySource?.searchText)
                          }
                          onChange={(event) => {
                            void handleQuickSameAsContactPropertyChange(
                              Boolean(event.target.checked)
                            );
                          }}
                        />
                        <span>
                          {isApplyingQuickSameAsContactProperty
                            ? "Applying..."
                            : "Same as contact's address"}
                        </span>
                      </label>
                    </div>
                    <InputField
                      label="Which address is this inquiry about?"
                      field="quick_property_lookup"
                      inputRef={propertyLookupRef}
                      value={detailsForm.property_lookup}
                      onChange={(event) => {
                        const nextLookup = toText(event.target.value);
                        setDetailsForm((previous) => {
                          const nextAddress1 = nextLookup || previous.property_address_1;
                          return {
                            ...previous,
                            property_lookup: event.target.value,
                            property_address_1: nextAddress1,
                            property_name: buildStandardPropertyName({
                              lot_number: previous.property_lot_number,
                              unit_number: previous.property_unit_number,
                              address_1: nextAddress1,
                              suburb_town: previous.property_suburb_town,
                              state: previous.property_state,
                              postal_code: previous.property_postal_code,
                              country: previous.property_country || "AU",
                            }),
                          };
                        });
                      }}
                      placeholder="Search address"
                    />
                    {propertyMatchState.message ? (
                      <div
                        className={`text-xs ${
                          matchMessageClassByStatus[propertyMatchState.status] || "text-slate-500"
                        }`}
                      >
                        {propertyMatchState.message}
                      </div>
                    ) : null}
                  </>
                ) : null}
              </div>
            )}

            <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-white p-3 md:grid-cols-2">
              <label className="block">
                <span className="type-label text-slate-600">Admin Notes</span>
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                  rows={3}
                  value={detailsForm.admin_notes}
                  onChange={(event) =>
                    setDetailsForm((previous) => ({
                      ...previous,
                      admin_notes: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="block">
                <span className="type-label text-slate-600">Client Notes</span>
                <textarea
                  className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
                  rows={3}
                  value={detailsForm.client_notes}
                  onChange={(event) =>
                    setDetailsForm((previous) => ({
                      ...previous,
                      client_notes: event.target.value,
                    }))
                  }
                />
              </label>
            </div>
          </div>

          <aside className="space-y-2 rounded border border-slate-200 bg-slate-50 p-3">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">
              Related Data
            </div>
            <div className="text-xs text-slate-600">
              {currentMatchedAccountId
                ? `${currentAccountType} #${currentMatchedAccountId}`
                : "Related data appears after matching an existing contact/company."}
            </div>
            {isRelatedLoading ? (
              <div className="text-xs text-slate-500">Loading related records...</div>
            ) : null}
            {relatedError ? (
              <div className="rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">
                {relatedError}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Past Inquiry As {currentAccountType}
              </div>
              {relatedInquiries.length ? (
                <div className="max-h-44 space-y-1.5 overflow-auto">
                  {relatedInquiries.slice(0, 20).map((item) => {
                    const uid = toText(item?.unique_id);
                    const id = toText(item?.id);
                    const linkUid = uid || id;
                    if (!linkUid) return null;
                    const serviceId = normalizeServiceInquiryId(item?.service_inquiry_id);
                    const serviceName = toText(item?.service_name) || toText(serviceNameById[serviceId]);
                    const dealName = toText(item?.deal_name);
                    return (
                      <div
                        key={`quick-related-inquiry-${uid || id}`}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <a
                          href={`/inquiry-details/${encodeURIComponent(linkUid)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-700 underline underline-offset-2"
                        >
                          {linkUid}
                        </a>
                        {dealName ? (
                          <div className="text-[11px] text-slate-600">{dealName}</div>
                        ) : null}
                        <div className="text-[11px] text-slate-600">
                          {formatDate(item?.created_at) || "-"}
                        </div>
                        <div className="text-[11px] text-slate-600">{toText(item?.type) || "-"}</div>
                        <div className="text-[11px] text-slate-600">
                          {serviceName || (serviceId ? `Service #${serviceId}` : "-")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No past inquiries.</div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                Past Jobs
              </div>
              {relatedJobs.length ? (
                <div className="max-h-44 space-y-1.5 overflow-auto">
                  {relatedJobs.slice(0, 20).map((item) => {
                    const uid = toText(item?.unique_id);
                    const id = toText(item?.id);
                    const linkUid = uid || id;
                    if (!linkUid) return null;
                    return (
                      <div
                        key={`quick-related-job-${uid || id}`}
                        className="rounded border border-slate-200 bg-white px-2 py-1.5"
                      >
                        <a
                          href={`/details/${encodeURIComponent(linkUid)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-sky-700 underline underline-offset-2"
                        >
                          {linkUid}
                        </a>
                        <div className="text-[11px] text-slate-600">
                          {toText(item?.property_name) || "-"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-xs text-slate-500">No past jobs.</div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </Modal>
  );
}

const INQUIRY_DETAILS_EDIT_EMPTY_FORM = {
  inquiry_status: "New Inquiry",
  inquiry_source: "",
  type: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  how_did_you_hear: "",
  other: "",
  admin_notes: "",
  client_notes: "",
  date_job_required_by: "",
  renovations: "",
  resident_availability: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
};

const INQUIRY_WORKSPACE_TABS = [
  { id: "related-records", label: "Related Records" },
  { id: "properties", label: "Properties" },
  { id: "uploads", label: "Uploads" },
  { id: "appointments", label: "Appointments" },
];

function WorkspaceTabPanel({ isMounted = false, isActive = false, children }) {
  if (!isMounted) return null;
  return (
    <div className={isActive ? "block" : "hidden"} aria-hidden={!isActive}>
      {children}
    </div>
  );
}

function InquiryEditTextArea({
  label,
  field,
  value,
  onChange,
  placeholder = "",
  rows = 4,
}) {
  return (
    <label className="block">
      <span className="type-label text-slate-600">{label}</span>
      <textarea
        data-field={field}
        value={value}
        onChange={onChange}
        rows={rows}
        placeholder={placeholder}
        className="mt-2 w-full rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
    </label>
  );
}

function InquiryEditListSelectionField({
  label,
  field,
  value,
  options = [],
  onChange,
}) {
  const selectedValues = useMemo(
    () => parseListSelectionValue(value, options),
    [value, options]
  );
  const selectedSet = useMemo(() => new Set(selectedValues), [selectedValues]);
  const optionLabelByKey = useMemo(() => {
    const map = new Map();
    options.forEach((option) => {
      const key = toText(option?.code || option?.value);
      if (!key) return;
      map.set(key, option?.label || option?.value || option?.code);
    });
    return map;
  }, [options]);

  const toggleOption = (optionKey) => {
    const key = toText(optionKey);
    if (!key) return;
    const nextValues = selectedSet.has(key)
      ? selectedValues.filter((item) => item !== key)
      : [...selectedValues, key];
    onChange?.(serializeListSelectionValue(nextValues));
  };

  return (
    <div className="w-full">
      <span className="type-label text-slate-600">{label}</span>
      <input type="hidden" data-field={field} value={toText(value)} readOnly />
      <div className="mt-2 rounded border border-slate-300 bg-white p-2">
        <div className="mb-2 flex min-h-7 flex-wrap gap-1">
          {selectedValues.map((key) => (
            <span
              key={`${field}-selected-${key}`}
              className="inline-flex items-center rounded bg-sky-50 px-2 py-0.5 text-[11px] text-sky-800"
            >
              {optionLabelByKey.get(key) || key}
            </span>
          ))}
        </div>
        <div className="max-h-32 overflow-y-auto pr-1">
          <div className="flex flex-wrap gap-1.5">
            {options.map((option) => {
              const optionKey = toText(option?.code || option?.value);
              const isSelected = selectedSet.has(optionKey);
              return (
                <button
                  key={`${field}-option-${optionKey}`}
                  type="button"
                  onClick={() => toggleOption(optionKey)}
                  className={`rounded border px-2 py-1 text-xs transition ${
                    isSelected
                      ? "border-sky-700 bg-sky-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {option?.label || option?.value || option?.code}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    return new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
  }
  return Promise.resolve(result);
}

function extractFirstRecord(payload) {
  const rows =
    payload?.resp ||
    payload?.data ||
    payload?.payload?.data?.PeterpmDeal ||
    payload?.payload?.data?.peterpmdeal ||
    [];
  if (Array.isArray(rows) && rows.length) return rows[0] || null;
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value) && value.length) return value[0] || null;
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value) && value.length) return value[0] || null;
    }
  }
  return null;
}

function extractRecordsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value)) return value;
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function toSortableTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(toText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeQuickDealRowsFromCalc(records = []) {
  const rows = [];
  const sourceRows = Array.isArray(records) ? records : [];
  sourceRows.forEach((record) => {
    const idValues = record?.DealsID;
    const uidValues = record?.Deals_Unique_ID;
    const nameValues = record?.Deals_Deal_Name;
    const typeValues = record?.DealsType;
    const createdValues = record?.Deals_Created_At;
    const serviceIdValues = record?.Service_Inquiry_ID;
    const serviceNameValues = record?.Service_Service_Name;

    const maxLength = Math.max(
      Array.isArray(idValues) ? idValues.length : 0,
      Array.isArray(uidValues) ? uidValues.length : 0,
      Array.isArray(nameValues) ? nameValues.length : 0,
      Array.isArray(typeValues) ? typeValues.length : 0,
      Array.isArray(createdValues) ? createdValues.length : 0,
      Array.isArray(serviceIdValues) ? serviceIdValues.length : 0,
      Array.isArray(serviceNameValues) ? serviceNameValues.length : 0,
      1
    );

    for (let index = 0; index < maxLength; index += 1) {
      const pick = (value) => (Array.isArray(value) ? value[index] : value);
      rows.push({
        id: toText(pick(idValues)),
        unique_id: toText(pick(uidValues)),
        deal_name: toText(pick(nameValues)),
        type: toText(pick(typeValues)),
        created_at: pick(createdValues) ?? null,
        service_inquiry_id: normalizeServiceInquiryId(pick(serviceIdValues)),
        service_name: toText(pick(serviceNameValues)),
      });
    }
  });

  const dedupedByKey = new Map();
  rows.forEach((row) => {
    const key = toText(row?.id || row?.unique_id || row?.deal_name);
    if (!key) return;
    if (!dedupedByKey.has(key)) {
      dedupedByKey.set(key, row);
      return;
    }
    const existing = dedupedByKey.get(key) || {};
    dedupedByKey.set(key, {
      ...existing,
      ...row,
      id: toText(existing?.id || row?.id),
      unique_id: toText(existing?.unique_id || row?.unique_id),
      deal_name: toText(existing?.deal_name || row?.deal_name),
      type: toText(existing?.type || row?.type),
      created_at: existing?.created_at || row?.created_at || null,
      service_inquiry_id: toText(existing?.service_inquiry_id || row?.service_inquiry_id),
      service_name: toText(existing?.service_name || row?.service_name),
    });
  });

  return Array.from(dedupedByKey.values()).sort(
    (left, right) => toSortableTimestamp(right?.created_at) - toSortableTimestamp(left?.created_at)
  );
}

function normalizeMutationIdentifier(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function extractCreatedDealId(result) {
  const managed = result?.mutations?.PeterpmDeal?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }
  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  return "";
}

async function createInquiryRecordFromPayload({ plugin, payload = null } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.mutation) {
    throw new Error("Deal model is unavailable.");
  }

  const mutation = await dealModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Inquiry create was cancelled.");
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create inquiry."
    );
  }

  const createdId = extractCreatedDealId(result);
  if (!isPersistedId(createdId)) {
    throw new Error("Inquiry create did not return an ID.");
  }

  const query = buildInquiryLiteBaseQuery(plugin)
    .where("id", normalizeMutationIdentifier(createdId))
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const detailResult = await toPromiseLike(query.fetchDirect());
  const createdRecord = extractFirstRecord(detailResult);
  const createdUid = toText(createdRecord?.unique_id || createdRecord?.Unique_ID);
  if (!createdUid) {
    throw new Error("Inquiry was created but unique ID was not returned.");
  }

  return {
    id: toText(createdRecord?.id || createdRecord?.ID || createdId),
    unique_id: createdUid,
    raw: createdRecord || null,
  };
}

async function fetchCompanyByExactName({ plugin, companyName } = {}) {
  const normalizedName = normalizeComparableText(companyName);
  if (!plugin?.switchTo || !normalizedName) return null;

  const runDetailQuery = async (whereField, whereValue) => {
    const query = plugin
      .switchTo("PeterpmCompany")
      .query()
      .where(whereField, whereValue)
      .deSelectAll()
      .select([
        "id",
        "name",
        "phone",
        "address",
        "city",
        "state",
        "postal_code",
        "account_type",
      ])
      .include("Primary_Person", (personQuery) =>
        personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
      )
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  try {
    const direct = await runDetailQuery("name", companyName);
    if (normalizeComparableText(direct?.name || direct?.Name) === normalizedName) {
      return direct;
    }
  } catch (_) {
    // Continue to fallback search.
  }

  const fallbackMatches = await searchCompaniesForLookup({
    plugin,
    query: normalizedName,
    limit: 40,
  }).catch(() => []);
  const fallbackRecord = (Array.isArray(fallbackMatches) ? fallbackMatches : []).find(
    (record) => normalizeComparableText(record?.name || record?.Name) === normalizedName
  );
  const fallbackId = resolveLookupRecordId(fallbackRecord, "Company");
  if (!fallbackId) return null;

  try {
    return await runDetailQuery("id", normalizeMutationIdentifier(fallbackId));
  } catch (_) {
    return fallbackRecord || null;
  }
}

async function fetchContactByExactEmail({ plugin, email } = {}) {
  const normalizedEmail = toText(email).trim().toLowerCase();
  if (!plugin?.switchTo || !normalizedEmail) return null;

  try {
    const direct = await findContactByEmail({ plugin, email: normalizedEmail });
    if (normalizeComparableText(direct?.email || direct?.Email) === normalizedEmail) {
      return direct;
    }
  } catch (_) {
    // Continue to fallback search.
  }

  const fallbackMatches = await searchContactsForLookup({
    plugin,
    query: normalizedEmail,
    limit: 40,
  }).catch(() => []);
  const fallbackRecord = (Array.isArray(fallbackMatches) ? fallbackMatches : []).find(
    (record) => normalizeComparableText(record?.email || record?.Email) === normalizedEmail
  );
  const fallbackId = resolveLookupRecordId(fallbackRecord, "Contact");
  if (!fallbackId) return fallbackRecord || null;

  try {
    const detailQuery = plugin
      .switchTo("PeterpmContact")
      .query()
      .where("id", normalizeMutationIdentifier(fallbackId))
      .deSelectAll()
      .select([
        "id",
        "first_name",
        "last_name",
        "email",
        "sms_number",
        "address",
        "city",
        "state",
        "zip_code",
        "country",
      ])
      .limit(1)
      .noDestroy();
    detailQuery.getOrInitQueryCalc?.();
    const detailResult = await toPromiseLike(detailQuery.fetchDirect());
    return extractFirstRecord(detailResult) || fallbackRecord || null;
  } catch (_) {
    return fallbackRecord || null;
  }
}

async function fetchQuickRelatedInquiriesByAccount({
  plugin,
  accountType = "Contact",
  accountId = "",
} = {}) {
  const normalizedAccountId = toText(accountId);
  if (!plugin?.switchTo || !normalizedAccountId) return [];
  const normalizedType = String(accountType || "").trim().toLowerCase();
  const isCompanyAccount = normalizedType === "company" || normalizedType === "entity";
  const modelName = isCompanyAccount ? "PeterpmCompany" : "PeterpmContact";
  const operationName = isCompanyAccount ? "calcCompanies" : "calcContacts";
  const variableType = isCompanyAccount ? "PeterpmCompanyID!" : "PeterpmContactID!";
  const richQuery = `
    query ${operationName}($id: ${variableType}) {
      ${operationName}(query: [{ where: { id: $id } }]) {
        DealsID: field(arg: ["Deals", "id"])
        Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
        Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
        DealsType: field(arg: ["Deals", "type"])
        Deals_Created_At: field(arg: ["Deals", "created_at"])
        Service_Inquiry_ID: field(arg: ["Deals", "service_inquiry_id"])
        Service_Service_Name: field(arg: ["Deals", "Service_Inquiry", "service_name"])
      }
    }
  `;

  try {
    const query = plugin.switchTo(modelName).query().fromGraphql(richQuery);
    const response = await toPromiseLike(
      query.fetchDirect({
        variables: { id: normalizeMutationIdentifier(normalizedAccountId) },
      })
    );
    const normalizedRows = normalizeQuickDealRowsFromCalc(extractRecordsFromPayload(response));
    if (normalizedRows.length) {
      return normalizedRows;
    }
  } catch (queryError) {
    console.warn("[QuickInquiry] Rich related inquiry query failed. Falling back.", queryError);
  }

  const fallbackRows = await fetchLinkedDealsByAccount({
    plugin,
    accountType,
    accountId: normalizedAccountId,
  }).catch(() => []);
  return (Array.isArray(fallbackRows) ? fallbackRows : [])
    .map((row) => ({
      id: toText(row?.id || row?.ID),
      unique_id: toText(row?.unique_id || row?.Unique_ID),
      deal_name: toText(row?.deal_name || row?.Deal_Name),
      created_at: row?.created_at || row?.Created_At || row?.Date_Added || null,
      type: toText(row?.type || row?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        row?.service_inquiry_id || row?.Service_Inquiry_ID
      ),
      service_name: toText(row?.service_name || row?.Service_Service_Name),
    }))
    .sort(
      (left, right) => toSortableTimestamp(right?.created_at) - toSortableTimestamp(left?.created_at)
    );
}

async function fetchQuickRelatedJobsByAccount({
  plugin,
  accountType = "Contact",
  accountId = "",
} = {}) {
  const normalizedAccountId = toText(accountId);
  if (!plugin?.switchTo || !normalizedAccountId) return [];
  const rows = await fetchLinkedJobsByAccount({
    plugin,
    accountType,
    accountId: normalizedAccountId,
  }).catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: toText(row?.id || row?.ID),
      unique_id: toText(row?.unique_id || row?.Unique_ID),
      property_name: toText(
        row?.property_name || row?.Property_Name || row?.property || row?.Property
      ),
      created_at: row?.created_at || row?.Created_At || null,
    }))
    .sort((left, right) => Number(right?.created_at || 0) - Number(left?.created_at || 0));
}

function buildInquiryLiteBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmDeal")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "account_type",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "how_can_we_help",
      "other",
      "admin_notes",
      "client_notes",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "service_inquiry_id",
      "service_provider_id",
      "Inquiry_Taken_By_id",
      "company_id",
      "primary_contact_id",
      "property_id",
      "quote_record_id",
      "Quote_Record_ID",
      "Quote_record_ID",
      "inquiry_for_job_id",
      "Inquiry_For_Job_ID",
      "Inquiry_for_Job_ID",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "renovations",
      "resident_availability",
      "date_job_required_by",
      "CompanyID",
      "CompanyName",
      "CompanyType",
      "CompanyPhone",
      "CompanyAddress",
      "CompanyCity",
      "CompanyState",
      "Company_Postal_Code",
      "Contact_Contact_ID",
      "Contact_First_Name",
      "Contact_Last_Name",
      "ContactEmail",
      "Contact_SMS_Number",
      "Company_Account_Type",
      "CompanyID1",
      "CompanyName1",
      "CompanyType1",
      "CompanyPhone1",
      "CompanyAddress1",
      "CompanyCity1",
      "CompanyState1",
      "Company_Postal_Code1",
    ])
    .include("Primary_Contact", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "address",
          "city",
          "state",
          "zip_code",
        ])
    )
    .include("Company", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "name",
          "type",
          "description",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
          "industry",
          "annual_revenue",
          "number_of_employees",
          "account_type",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
            .deSelectAll()
            .select([
              "id",
              "name",
              "type",
              "description",
              "phone",
              "address",
              "city",
              "state",
              "postal_code",
              "industry",
              "annual_revenue",
              "number_of_employees",
            ])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "address_1",
          "address_2",
          "suburb_town",
          "city",
          "state",
          "postal_code",
          "country",
        ])
    )
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "work_email", "mobile_number"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    );
}

async function fetchInquiryLiteByUid({ plugin, uid }) {
  const uniqueId = toText(uid);
  if (!plugin?.switchTo || !uniqueId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("unique_id", uniqueId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchInquiryLiteById({ plugin, id }) {
  const inquiryId = toText(id);
  if (!plugin?.switchTo || !inquiryId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("id", inquiryId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchServiceNameById({ plugin, serviceId }) {
  const normalizedId = normalizeServiceInquiryId(serviceId);
  if (!plugin?.switchTo || !normalizedId) return "";
  const query = plugin
    .switchTo("PeterpmService")
    .query()
    .where("id", /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId)
    .deSelectAll()
    .select(["id", "service_name"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.service_name || record?.Service_Name);
}

async function fetchServiceProviderById({ plugin, providerId }) {
  const normalizedId = toText(providerId);
  if (!plugin?.switchTo || !normalizedId) return null;
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  const runQuery = async ({ field, value }) => {
    const query = providerModel
      .query()
      .where(field, value)
      .deSelectAll()
      .select(["id", "unique_id", "type", "status", "work_email", "mobile_number"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  const byId = await runQuery({
    field: "id",
    value: /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId,
  });
  if (byId) return byId;

  const byUniqueId = await runQuery({ field: "unique_id", value: normalizedId });
  if (byUniqueId) return byUniqueId;

  return null;
}

async function fetchServiceProviderByContactId({ plugin, contactId }) {
  const normalizedContactId = normalizeMutationIdentifier(contactId);
  if (!plugin?.switchTo || normalizedContactId == null) return null;
  const providerModel = plugin.switchTo("PeterpmServiceProvider");

  const runQuery = async (restrictToAdminType = false) => {
    let query = providerModel
      .query()
      .where("contact_information_id", normalizedContactId)
      .deSelectAll()
      .select([
        "id",
        "unique_id",
        "type",
        "status",
        "work_email",
        "mobile_number",
        "contact_information_id",
      ])
      .include("Contact_Information", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name"])
      )
      .limit(1)
      .noDestroy();

    if (restrictToAdminType) {
      query = query.andWhere("type", "Admin");
    }
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    return extractFirstRecord(result);
  };

  const adminRecord = await runQuery(true);
  if (adminRecord) return adminRecord;

  const anyRecord = await runQuery(false);
  if (anyRecord) return anyRecord;
  return null;
}

async function resolveRecentActivityAdminProviderId({
  plugin,
  configuredProviderId = "",
  currentUserContactId = "",
} = {}) {
  const configuredId = toText(configuredProviderId);
  if (configuredId) {
    return configuredId;
  }

  const byContactRecord = await fetchServiceProviderByContactId({
    plugin,
    contactId: currentUserContactId,
  });
  const byContactRecordId = toText(byContactRecord?.id || byContactRecord?.ID);
  if (byContactRecordId) return byContactRecordId;

  return "";
}

async function fetchJobIdByUniqueId({ plugin, uniqueId }) {
  const normalizedUniqueId = toText(uniqueId);
  if (!plugin?.switchTo || !normalizedUniqueId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("unique_id", normalizedUniqueId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.id || record?.ID);
}

async function fetchJobUniqueIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.unique_id || record?.Unique_ID);
}

async function fetchJobInquiryRecordIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "inquiry_record_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.inquiry_record_id || record?.Inquiry_Record_ID);
}

export function InquiryDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast, success, error, dismiss } = useToast();
  const { plugin, isReady: isSdkReady } = useVitalStatsPlugin();
  const { uid = "" } = useParams();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
    onModeChange: null,
    allowModeSwitch: false,
    titleVerb: "Add",
    initialValues: null,
  });
  const [resolvedInquiry, setResolvedInquiry] = useState(null);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [serviceInquiryName, setServiceInquiryName] = useState("");
  const [serviceProviderFallback, setServiceProviderFallback] = useState(null);
  const { records: serviceProviderLookup, isLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookup({ plugin, isSdkReady });
  const { records: inquiryTakenByLookup, isLoading: isInquiryTakenByLookupLoading } =
    useAdminProviderLookup({ plugin, isSdkReady });
  const [serviceProviderSearch, setServiceProviderSearch] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [isSavingLinkedJob, setIsSavingLinkedJob] = useState(false);
  const [linkedJobSelectionOverride, setLinkedJobSelectionOverride] = useState(undefined);
  const [relatedJobIdByUid, setRelatedJobIdByUid] = useState({});
  const [relatedRecordsRefreshKey, setRelatedRecordsRefreshKey] = useState(0);
  const [inquiryTakenByFallback, setInquiryTakenByFallback] = useState(null);
  const [inquiryTakenBySearch, setInquiryTakenBySearch] = useState("");
  const [selectedInquiryTakenById, setSelectedInquiryTakenById] = useState("");
  const [isSavingInquiryTakenBy, setIsSavingInquiryTakenBy] = useState(false);
  const [isCreatingCallback, setIsCreatingCallback] = useState(false);
  const [isCreateQuoteModalOpen, setIsCreateQuoteModalOpen] = useState(false);
  const [isCreatingQuote, setIsCreatingQuote] = useState(false);
  const [isOpeningQuoteJob, setIsOpeningQuoteJob] = useState(false);
  const [isQuoteJobDirectlyLinked, setIsQuoteJobDirectlyLinked] = useState(false);
  const [quoteCreateDraft, setQuoteCreateDraft] = useState({
    quote_date: "",
  });
  const [isDeleteRecordModalOpen, setIsDeleteRecordModalOpen] = useState(false);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);
  const [isQuickInquiryBookingModalOpen, setIsQuickInquiryBookingModalOpen] = useState(false);
  const [isQuickInquiryProvisioning, setIsQuickInquiryProvisioning] = useState(false);
  const [isInquiryDetailsModalOpen, setIsInquiryDetailsModalOpen] = useState(false);
  const [isSavingInquiryDetails, setIsSavingInquiryDetails] = useState(false);
  const [isInquiryEditPestAccordionOpen, setIsInquiryEditPestAccordionOpen] = useState(false);
  const [removingListTagKeys, setRemovingListTagKeys] = useState({});
  const [optimisticListSelectionByField, setOptimisticListSelectionByField] = useState({});
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("related-records");
  const [mountedWorkspaceTabs, setMountedWorkspaceTabs] = useState({});
  const [propertyLookupRecords, setPropertyLookupRecords] = useState([]);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [isLinkedPropertiesLoading, setIsLinkedPropertiesLoading] = useState(false);
  const [linkedPropertiesError, setLinkedPropertiesError] = useState("");
  const [propertySearchQuery, setPropertySearchQuery] = useState("");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [isPropertySameAsContact, setIsPropertySameAsContact] = useState(false);
  const [isApplyingSameAsContactProperty, setIsApplyingSameAsContactProperty] = useState(false);
  const [propertyModalState, setPropertyModalState] = useState({
    open: false,
    initialData: null,
  });
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState("create");
  const [appointmentModalEditingId, setAppointmentModalEditingId] = useState("");
  const [appointmentModalDraft, setAppointmentModalDraft] = useState(null);
  const [isUploadsModalOpen, setIsUploadsModalOpen] = useState(false);
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [areFloatingWidgetsVisible, setAreFloatingWidgetsVisible] = useState(false);
  const [isRecentActivityPanelOpen, setIsRecentActivityPanelOpen] = useState(false);
  const [recentAdminActivities, setRecentAdminActivities] = useState(() =>
    readRecentAdminActivitiesFromStorage()
  );
  const recentAdminActivitiesRef = useRef(readRecentAdminActivitiesFromStorage());
  const [isRecentActivitySyncing, setIsRecentActivitySyncing] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const [inquiryDetailsForm, setInquiryDetailsForm] = useState({
    ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
  });
  const [inquiryServiceOptions, setInquiryServiceOptions] = useState([]);
  const [serviceInquiryLabelById, setServiceInquiryLabelById] = useState({});
  const [isInquiryServiceLookupLoading, setIsInquiryServiceLookupLoading] = useState(false);
  const moreMenuRef = useRef(null);
  const inquiryTakenByAutofillRef = useRef(new Set());
  const listSelectionDesiredRef = useRef({});
  const listSelectionSyncingRef = useRef({});
  const propertySearchManualEditRef = useRef(false);
  const previousSelectedPropertyIdRef = useRef("");
  const previousVisibleWorkspaceTabsKeyRef = useRef("");
  const previousAccountBindingKeyRef = useRef("");
  const memoFileInputRef = useRef(null);
  const popupCommentAutoShownRef = useRef({});
  const quickInquiryProvisioningRequestedRef = useRef(false);
  const quickInquirySavingToastIdRef = useRef("");
  const lastRecentActivityViewKeyRef = useRef("");
  const recentActivityProviderIdRef = useRef("");
  const recentActivitySyncTimeoutRef = useRef(null);
  const lastSyncedRecentActivityHashRef = useRef("");
  const syncRecentActivityFileRef = useRef(null);
  const safeUid = useMemo(() => String(uid || "").trim(), [uid]);
  const isQuickInquiryBookingMode = useMemo(
    () =>
      toText(safeUid).toLowerCase() === "new" ||
      toText(location?.pathname).toLowerCase().replace(/\/+$/, "") === "/inquiry-details/new",
    [location?.pathname, safeUid]
  );
  const hasUid = Boolean(safeUid) && !isQuickInquiryBookingMode;
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const currentAdminContactId = toText(APP_USER?.id);
  const inquiryStatus = useMemo(
    () =>
      String(
        resolvedInquiry?.inquiry_status ||
          resolvedInquiry?.Inquiry_Status ||
          (isQuickInquiryBookingMode ? "New Inquiry" : "")
      ).trim(),
    [isQuickInquiryBookingMode, resolvedInquiry]
  );
  const inquiryNumericId = useMemo(
    () => String(resolvedInquiry?.id || resolvedInquiry?.ID || "").trim(),
    [resolvedInquiry]
  );
  const inquiryStatusStyle = useMemo(() => {
    if (!inquiryStatus) {
      return { color: "#64748b", backgroundColor: "#f1f5f9" };
    }
    return resolveStatusStyle(inquiryStatus);
  }, [inquiryStatus]);
  const headerInquiryStatusLabel = isQuickInquiryBookingMode
    ? "New Inquiry"
    : inquiryStatus || (isContextLoading ? "Loading..." : "Unknown");
  const headerInquiryStatusStyle = isQuickInquiryBookingMode
    ? resolveStatusStyle("New Inquiry")
    : inquiryStatusStyle;
  const externalInquiryUrl = useMemo(() => {
    if (!inquiryNumericId) return "";
    return `https://app.ontraport.com/#!/deal/edit&id=${encodeURIComponent(inquiryNumericId)}`;
  }, [inquiryNumericId]);
  const inquiry = resolvedInquiry || {};
  const currentActivityPath = useMemo(
    () => `${toText(location?.pathname) || "/"}${toText(location?.search)}`,
    [location?.pathname, location?.search]
  );
  const trackRecentActivity = useCallback(
    ({
      action = "",
      pageType = "",
      pageName = "",
      path = "",
      metadata = null,
    } = {}) => {
      const normalizedAction = toText(action);
      if (!isMajorRecentActivityAction(normalizedAction)) return;
      const resolvedPath = toText(path || currentActivityPath);
      const resolvedPageType =
        normalizeLegacyInquiryPageType(pageType) || resolveActivityPageType(resolvedPath);
      const resolvedPageName = toText(pageName) || resolveActivityPageName(resolvedPageType);
      const normalizedMetadata =
        metadata && typeof metadata === "object" ? { ...metadata } : {};
      const metadataInquiryId =
        toText(normalizedMetadata?.inquiry_id) ||
        toText(normalizedMetadata?.inquiryId) ||
        toText(normalizedMetadata?.deal_id);
      const metadataInquiryUid =
        toText(normalizedMetadata?.inquiry_uid) ||
        toText(normalizedMetadata?.inquiryUid) ||
        toText(normalizedMetadata?.deal_uid);
      const isNewInquiryPath = toText(resolvedPath).toLowerCase().startsWith("/inquiry-details/new");
      const timestamp = Date.now();
      const nextRecord = normalizeRecentActivityRecord({
        id: `activity-${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
        timestamp,
        action: normalizedAction,
        page_type: resolvedPageType,
        page_name: resolvedPageName,
        path: resolvedPath,
        inquiry_id: metadataInquiryId || (isNewInquiryPath ? "" : toText(inquiryNumericId)),
        inquiry_uid: metadataInquiryUid || (isNewInquiryPath ? "" : toText(safeUid)),
        metadata: normalizedMetadata,
      });
      const currentList = finalizeRecentActivityList(
        recentAdminActivitiesRef.current?.length
          ? recentAdminActivitiesRef.current
          : readRecentAdminActivitiesFromStorage()
      );
      const normalizedActionKey = normalizeRecentActivityAction(nextRecord?.action);
      let merged = [nextRecord, ...currentList];

      if (normalizedActionKey === "created new inquiry") {
        const nextInquiryUid = toText(nextRecord?.inquiry_uid).toLowerCase();
        const startedIndex = currentList.findIndex((item) => {
          if (normalizeRecentActivityAction(item?.action) !== "started new inquiry") {
            return false;
          }
          const startedUid = toText(item?.inquiry_uid).toLowerCase();
          if (nextInquiryUid && startedUid && startedUid === nextInquiryUid) {
            return true;
          }
          return toText(item?.path).toLowerCase().startsWith("/inquiry-details/new");
        });
        if (startedIndex >= 0) {
          const startedRecord = currentList[startedIndex];
          const remaining = currentList.filter((_, index) => index !== startedIndex);
          const upgradedRecord = normalizeRecentActivityRecord({
            ...startedRecord,
            ...nextRecord,
            id: toText(startedRecord?.id) || toText(nextRecord?.id),
          });
          merged = [upgradedRecord, ...remaining];
        }
      }

      const nextRecords = finalizeRecentActivityList(merged);
      recentAdminActivitiesRef.current = nextRecords;
      writeRecentAdminActivitiesToStorage(nextRecords);
      setRecentAdminActivities(nextRecords);
    },
    [currentActivityPath, inquiryNumericId, safeUid]
  );
  const syncRecentActivityFile = useCallback(
    async (records = []) => {
      const configuredId = toText(configuredAdminProviderId);
      if (!plugin) {
        throw new Error("SDK plugin is not ready for recent activity sync.");
      }
      const normalizedRecords = (Array.isArray(records) ? records : [])
        .map((item) => normalizeRecentActivityRecord(item))
        .filter((item) => isMajorRecentActivityAction(item?.action))
        .sort((left, right) => Number(right?.timestamp || 0) - Number(left?.timestamp || 0))
        .slice(0, MAX_RECENT_ADMIN_ACTIVITY_RECORDS);
      if (!normalizedRecords.length) return false;

      let resolvedProviderId = toText(recentActivityProviderIdRef.current);
      if (!recentActivityProviderIdRef.current) {
        try {
          resolvedProviderId = await resolveRecentActivityAdminProviderId({
            plugin,
            configuredProviderId: configuredId,
            currentUserContactId: currentAdminContactId,
          });
          recentActivityProviderIdRef.current = resolvedProviderId;
        } catch (providerError) {
          console.warn("[InquiryDetails] Failed resolving provider for recent activity sync", providerError);
        }
      }
      if (!resolvedProviderId) {
        throw new Error("Admin service provider ID could not be resolved for recent activity sync.");
      }

      const jsonPayload = createRecentActivityJsonData(normalizedRecords, resolvedProviderId);
      const didUpdate = await updateServiceProviderRecentActivityJsonData({
        plugin,
        serviceProviderId: resolvedProviderId,
        jsonPayload,
      });
      if (!didUpdate) {
        throw new Error("Recent activity JSON update was not acknowledged.");
      }
      return true;
    },
    [configuredAdminProviderId, currentAdminContactId, plugin]
  );

  useEffect(() => {
    recentAdminActivitiesRef.current = finalizeRecentActivityList(recentAdminActivities);
  }, [recentAdminActivities]);

  useEffect(() => {
    syncRecentActivityFileRef.current = syncRecentActivityFile;
  }, [syncRecentActivityFile]);

  useEffect(() => {
    if (!plugin || !recentAdminActivities.length) return;
    const signature = buildRecentActivitySignature(recentAdminActivities);
    if (!signature || signature === lastSyncedRecentActivityHashRef.current) return;
    if (recentActivitySyncTimeoutRef.current) {
      window.clearTimeout(recentActivitySyncTimeoutRef.current);
    }
    recentActivitySyncTimeoutRef.current = window.setTimeout(async () => {
      setIsRecentActivitySyncing(true);
      try {
        const didSync = await syncRecentActivityFile(recentAdminActivities);
        if (didSync) {
          lastSyncedRecentActivityHashRef.current = signature;
        }
      } catch (syncError) {
        console.error("[InquiryDetails] Failed syncing recent activity file", syncError);
        recentActivityProviderIdRef.current = "";
      } finally {
        setIsRecentActivitySyncing(false);
      }
    }, 250);

    return () => {
      if (recentActivitySyncTimeoutRef.current) {
        window.clearTimeout(recentActivitySyncTimeoutRef.current);
      }
    };
  }, [plugin, recentAdminActivities, syncRecentActivityFile]);

  useEffect(
    () => () => {
      if (recentActivitySyncTimeoutRef.current) {
        window.clearTimeout(recentActivitySyncTimeoutRef.current);
      }
    },
    []
  );

  const inquiryPrimaryContact = getInquiryPrimaryContact(inquiry);
  const inquiryCompany = getInquiryCompany(inquiry);
  const inquiryCompanyPrimaryPerson =
    inquiryCompany?.Primary_Person || inquiryCompany?.primary_person || {};
  const inquiryBodyCorpCompanyRaw =
    inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company || null;
  const inquiryBodyCorpCompany = Array.isArray(inquiryBodyCorpCompanyRaw)
    ? inquiryBodyCorpCompanyRaw[0] || {}
    : inquiryBodyCorpCompanyRaw || {};
  const serviceProvider = normalizeRelationRecord(
    inquiry?.Service_Provider || inquiry?.service_provider
  );
  const serviceProviderContact = normalizeServiceProviderContact(serviceProvider);
  const serviceProviderFallbackRecord = normalizeRelationRecord(serviceProviderFallback);
  const serviceProviderFallbackContact = normalizeServiceProviderContact(serviceProviderFallbackRecord);

  const inquiryAccountType = toText(inquiry?.account_type || inquiry?.Account_Type);
  const normalizedAccountType = inquiryAccountType.toLowerCase();
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const hasInquiryContactDetails = Boolean(
    fullName(inquiryPrimaryContact?.first_name, inquiryPrimaryContact?.last_name) ||
      toText(inquiryPrimaryContact?.email) ||
      toText(inquiryPrimaryContact?.sms_number) ||
      toText(inquiryPrimaryContact?.address)
  );
  const hasInquiryCompanyDetails = Boolean(
    toText(inquiryCompany?.name) || toText(inquiryCompany?.phone) || toText(inquiryCompany?.address)
  );
  const companyAccountType = toText(
    inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasInquiryContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasInquiryCompanyDetails);

  const accountType = inquiryAccountType;
  const inquiryCompanyId = toText(
    inquiry?.company_id || inquiry?.Company_ID || inquiryCompany?.id || inquiryCompany?.ID
  );
  const inquiryContactId = toText(
    inquiry?.primary_contact_id ||
      inquiry?.Primary_Contact_ID ||
      inquiryPrimaryContact?.id ||
      inquiryPrimaryContact?.ID
  );
  const contactPopupComment = toText(
    inquiryPrimaryContact?.popup_comment || inquiryPrimaryContact?.Popup_Comment
  );
  const companyPopupComment = toText(inquiryCompany?.popup_comment || inquiryCompany?.Popup_Comment);
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasAnyPopupComment = Boolean(contactPopupComment || companyPopupComment);
  const hasMemoContext = Boolean(inquiryNumericId);
  const currentUserId = toText(APP_USER?.id);
  const relatedRecordsAccountType = useMemo(() => {
    if (isCompanyAccount) return "Company";
    if (isContactAccount) return "Contact";
    return inquiryCompanyId ? "Company" : "Contact";
  }, [inquiryCompanyId, isCompanyAccount, isContactAccount]);
  const relatedRecordsAccountId = useMemo(() => {
    if (relatedRecordsAccountType === "Company") {
      return inquiryCompanyId || inquiryContactId;
    }
    return inquiryContactId || inquiryCompanyId;
  }, [inquiryCompanyId, inquiryContactId, relatedRecordsAccountType]);
  const {
    relatedDeals,
    relatedJobs,
    isLoading: isRelatedRecordsLoading,
    error: relatedRecordsError,
  } = useRelatedRecordsData({
    plugin,
    accountType: relatedRecordsAccountType,
    accountId: relatedRecordsAccountId,
    refreshKey: relatedRecordsRefreshKey,
  });
  const filteredRelatedDeals = useMemo(() => {
    const currentInquiryId = toText(inquiryNumericId);
    const currentInquiryUid = toText(safeUid);
    return (Array.isArray(relatedDeals) ? relatedDeals : []).filter((deal) => {
      const dealId = toText(deal?.id || deal?.ID);
      const dealUid = toText(deal?.unique_id || deal?.Unique_ID);
      if (currentInquiryId && dealId && dealId === currentInquiryId) return false;
      if (currentInquiryUid && dealUid && dealUid === currentInquiryUid) return false;
      return true;
    });
  }, [inquiryNumericId, relatedDeals, safeUid]);
  const isInquiryRequestExpanded = true;
  const quoteJobIdFromRecord = toText(
    inquiry?.quote_record_id || inquiry?.Quote_Record_ID || inquiry?.Quote_record_ID
  );
  const linkedInquiryJobIdFromRecord = toText(
    inquiry?.inquiry_for_job_id || inquiry?.Inquiry_For_Job_ID || inquiry?.Inquiry_for_Job_ID
  );
  const selectedRelatedJobId =
    linkedJobSelectionOverride !== undefined
      ? toText(linkedJobSelectionOverride)
      : linkedInquiryJobIdFromRecord || quoteJobIdFromRecord;
  const inquiryPropertyRelationRecord = useMemo(
    () => normalizeRelationRecord(inquiry?.Property || inquiry?.property),
    [inquiry?.Property, inquiry?.property]
  );
  const inquiryPropertyId = normalizePropertyId(
    inquiry?.property_id ||
      inquiry?.Property_ID ||
      inquiryPropertyRelationRecord?.id ||
      inquiryPropertyRelationRecord?.ID
  );
  const inquiryPropertyRecord = useMemo(
    () =>
      normalizePropertyLookupRecord({
        ...inquiryPropertyRelationRecord,
        id:
          inquiryPropertyId ||
          inquiryPropertyRelationRecord?.id ||
          inquiryPropertyRelationRecord?.ID,
      }),
    [inquiryPropertyId, inquiryPropertyRelationRecord]
  );
  const normalizedSelectedPropertyId = normalizePropertyId(selectedPropertyId);
  const linkedPropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(linkedProperties).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [linkedProperties]
  );
  const propertySearchItems = useMemo(
    () =>
      dedupePropertyLookupRecords(propertyLookupRecords)
        .map((item) => ({
          id: normalizePropertyId(item?.id),
          label: resolvePropertyLookupLabel(item) || "Property",
          meta: [
            toText(item?.unique_id || item?.Unique_ID),
            toText(item?.address_1 || item?.Address_1 || item?.address || item?.Address),
            toText(item?.suburb_town || item?.Suburb_Town || item?.city || item?.City),
            toText(item?.state || item?.State),
            toText(item?.postal_code || item?.Postal_Code || item?.zip_code || item?.Zip_Code),
          ]
            .filter(Boolean)
            .join(" | "),
        }))
        .filter((item) => item.id || item.label),
    [propertyLookupRecords]
  );
  const activeRelatedProperty = useMemo(() => {
    if (normalizedSelectedPropertyId) {
      const fromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      const fromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === normalizedSelectedPropertyId
      );
      if (fromLookup && fromLinked) return { ...fromLinked, ...fromLookup };
      if (fromLookup) return fromLookup;
      if (fromLinked) return fromLinked;
    }
    if (linkedPropertiesSorted.length) return linkedPropertiesSorted[0];
    return null;
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);
  const uploadsPropertyId = normalizePropertyId(
    activeRelatedProperty?.id || normalizedSelectedPropertyId || inquiryPropertyId
  );
  const workspacePropertiesSorted = useMemo(
    () =>
      dedupePropertyLookupRecords(propertyLookupRecords).sort((left, right) =>
        resolvePropertyLookupLabel(left).localeCompare(resolvePropertyLookupLabel(right))
      ),
    [propertyLookupRecords]
  );
  const workspaceLookupData = useMemo(() => {
    const providers = [
      ...(Array.isArray(serviceProviderLookup) ? serviceProviderLookup : []),
      ...(Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []),
    ];
    const dedupedProviderMap = new Map();
    providers.forEach((provider) => {
      const key = toText(provider?.id || provider?.ID);
      if (!key || dedupedProviderMap.has(key)) return;
      dedupedProviderMap.set(key, provider);
    });
    const contacts = [];
    if (inquiryContactId || inquiryPrimaryContact?.email || inquiryPrimaryContact?.sms_number) {
      contacts.push({
        id: inquiryContactId || inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID || "",
        first_name: inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name || "",
        last_name: inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name || "",
        email: inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email || "",
        sms_number: inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number || "",
      });
    }
    const companies = [];
    if (inquiryCompanyId || inquiryCompany?.name || inquiryCompany?.Name) {
      companies.push({
        id: inquiryCompanyId || inquiryCompany?.id || inquiryCompany?.ID || "",
        name: inquiryCompany?.name || inquiryCompany?.Name || "",
        account_type:
          inquiryCompany?.account_type ||
          inquiryCompany?.Account_Type ||
          inquiry?.Company_Account_Type ||
          "",
        Primary_Person: {
          id: inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID || "",
          first_name:
            inquiryCompanyPrimaryPerson?.first_name ||
            inquiryCompanyPrimaryPerson?.First_Name ||
            "",
          last_name:
            inquiryCompanyPrimaryPerson?.last_name ||
            inquiryCompanyPrimaryPerson?.Last_Name ||
            "",
          email: inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email || "",
          sms_number:
            inquiryCompanyPrimaryPerson?.sms_number ||
            inquiryCompanyPrimaryPerson?.SMS_Number ||
            "",
        },
      });
    }
    return {
      contacts,
      companies,
      properties: workspacePropertiesSorted,
      serviceProviders: Array.from(dedupedProviderMap.values()),
    };
  }, [
    inquiry,
    inquiryCompany,
    inquiryCompanyId,
    inquiryCompanyPrimaryPerson,
    inquiryContactId,
    inquiryPrimaryContact,
    inquiryTakenByLookup,
    serviceProviderLookup,
    workspacePropertiesSorted,
  ]);
  const accountContactName = fullName(
    inquiryPrimaryContact?.first_name,
    inquiryPrimaryContact?.last_name
  );
  const accountContactEmail = toText(inquiryPrimaryContact?.email);
  const accountContactPhone = toText(inquiryPrimaryContact?.sms_number);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail)
    ? toMailHref(accountContactEmail)
    : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone)
    ? toTelHref(accountContactPhone)
    : "";
  const accountContactAddress = joinAddress([
    inquiryPrimaryContact?.address,
    inquiryPrimaryContact?.city,
    inquiryPrimaryContact?.state,
    inquiryPrimaryContact?.zip_code,
  ]);
  const accountContactAddressHref = toGoogleMapsHref(accountContactAddress);
  const accountCompanyName = toText(inquiryCompany?.name || inquiryCompany?.Name);
  const accountCompanyPhone = toText(inquiryCompany?.phone || inquiryCompany?.Phone);
  const accountCompanyPhoneHref = isLikelyPhoneValue(accountCompanyPhone)
    ? toTelHref(accountCompanyPhone)
    : "";
  const accountCompanyAddress = joinAddress([
    inquiryCompany?.address || inquiryCompany?.Address,
    inquiryCompany?.city || inquiryCompany?.City,
    inquiryCompany?.state || inquiryCompany?.State,
    inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code || inquiryCompany?.Zip_Code,
  ]);
  const accountCompanyAddressHref = toGoogleMapsHref(accountCompanyAddress);
  const accountCompanyPrimaryName = fullName(
    inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name,
    inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
  );
  const accountCompanyPrimaryEmail = toText(
    inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email
  );
  const accountCompanyPrimaryEmailHref = isLikelyEmailValue(accountCompanyPrimaryEmail)
    ? toMailHref(accountCompanyPrimaryEmail)
    : "";
  const accountCompanyPrimaryPhone = toText(
    inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
  );
  const accountCompanyPrimaryPhoneHref = isLikelyPhoneValue(accountCompanyPrimaryPhone)
    ? toTelHref(accountCompanyPrimaryPhone)
    : "";
  const accountBodyCorpName = toText(inquiryBodyCorpCompany?.name || inquiryBodyCorpCompany?.Name);
  const accountBodyCorpType = toText(inquiryBodyCorpCompany?.type || inquiryBodyCorpCompany?.Type);
  const accountBodyCorpPhone = toText(inquiryBodyCorpCompany?.phone || inquiryBodyCorpCompany?.Phone);
  const accountBodyCorpPhoneHref = isLikelyPhoneValue(accountBodyCorpPhone)
    ? toTelHref(accountBodyCorpPhone)
    : "";
  const accountBodyCorpAddress = joinAddress([
    inquiryBodyCorpCompany?.address || inquiryBodyCorpCompany?.Address,
    inquiryBodyCorpCompany?.city || inquiryBodyCorpCompany?.City,
    inquiryBodyCorpCompany?.state || inquiryBodyCorpCompany?.State,
    inquiryBodyCorpCompany?.postal_code || inquiryBodyCorpCompany?.Postal_Code,
  ]);
  const accountBodyCorpAddressHref = toGoogleMapsHref(accountBodyCorpAddress);
  const hasBodyCorpDetails = Boolean(
    accountBodyCorpName || accountBodyCorpType || accountBodyCorpPhone || accountBodyCorpAddress
  );
  const hasAccountContactFields = Boolean(
    accountContactName || accountContactEmail || accountContactPhone || accountContactAddress
  );
  const hasAccountCompanyFields = Boolean(
    accountCompanyName ||
      accountCompanyPhone ||
      accountCompanyPrimaryName ||
      accountCompanyPrimaryEmail ||
      accountCompanyPrimaryPhone ||
      accountCompanyAddress
  );

  useEffect(() => {
    setPopupCommentDrafts({
      contact: contactPopupComment,
      company: companyPopupComment,
    });
  }, [companyPopupComment, contactPopupComment, inquiryCompanyId, inquiryContactId]);

  useEffect(() => {
    const currentUid = toText(safeUid);
    if (!currentUid || isContextLoading) return;
    if (!hasAnyPopupComment) return;
    if (popupCommentAutoShownRef.current?.[currentUid]) return;
    popupCommentAutoShownRef.current[currentUid] = true;
    setIsPopupCommentModalOpen(true);
  }, [hasAnyPopupComment, isContextLoading, safeUid]);

  const sameAsContactPropertySource = useMemo(() => {
    const contactStreet = toText(inquiryPrimaryContact?.address);
    const contactCity = toText(inquiryPrimaryContact?.city);
    const contactState = toText(inquiryPrimaryContact?.state);
    const contactPostalCode = toText(inquiryPrimaryContact?.zip_code);
    const companyStreet = toText(inquiryCompany?.address || inquiryCompany?.Address);
    const companyCity = toText(inquiryCompany?.city || inquiryCompany?.City);
    const companyState = toText(inquiryCompany?.state || inquiryCompany?.State);
    const companyPostalCode = toText(
      inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
    );

    const preferCompanyAddress = isCompanyAccount;
    const primaryStreet = preferCompanyAddress ? companyStreet : contactStreet;
    const primaryCity = preferCompanyAddress ? companyCity : contactCity;
    const primaryState = preferCompanyAddress ? companyState : contactState;
    const primaryPostalCode = preferCompanyAddress ? companyPostalCode : contactPostalCode;
    const secondaryStreet = preferCompanyAddress ? contactStreet : companyStreet;
    const secondaryCity = preferCompanyAddress ? contactCity : companyCity;
    const secondaryState = preferCompanyAddress ? contactState : companyState;
    const secondaryPostalCode = preferCompanyAddress ? contactPostalCode : companyPostalCode;

    const fallbackStreet = primaryStreet || secondaryStreet;
    const fallbackCity = primaryCity || secondaryCity;
    const fallbackState = primaryState || secondaryState;
    const fallbackPostalCode = primaryPostalCode || secondaryPostalCode;
    const hasPrimaryAddress = Boolean(primaryStreet || primaryCity || primaryPostalCode);
    const formatted = joinAddress([fallbackStreet, fallbackCity, fallbackState, fallbackPostalCode]);
    return {
      sourceType: hasPrimaryAddress
        ? preferCompanyAddress
          ? "company"
          : "contact"
        : preferCompanyAddress
          ? "contact"
          : "company",
      address1: fallbackStreet || formatted,
      suburbTown: fallbackCity,
      state: fallbackState,
      postalCode: fallbackPostalCode,
      propertyName:
        fallbackStreet ||
        formatted ||
        accountContactName ||
        accountCompanyName ||
        `Property ${safeUid || ""}`.trim(),
      searchText: formatted || fallbackStreet,
    };
  }, [
    accountCompanyName,
    accountContactName,
    isCompanyAccount,
    inquiryCompany,
    inquiryPrimaryContact,
    safeUid,
  ]);
  const accountBindingKey = useMemo(
    () =>
      [
        toText(inquiryAccountType),
        toText(inquiryContactId),
        toText(inquiryCompanyId),
      ].join("|"),
    [inquiryAccountType, inquiryCompanyId, inquiryContactId]
  );

  const accountEditorContactInitialValues = useMemo(
    () => ({
      id: toText(inquiryPrimaryContact?.id),
      first_name: toText(inquiryPrimaryContact?.first_name),
      last_name: toText(inquiryPrimaryContact?.last_name),
      email: toText(inquiryPrimaryContact?.email),
      sms_number: toText(inquiryPrimaryContact?.sms_number),
      address: toText(inquiryPrimaryContact?.address),
      city: toText(inquiryPrimaryContact?.city),
      state: toText(inquiryPrimaryContact?.state),
      zip_code: toText(inquiryPrimaryContact?.zip_code),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiryPrimaryContact]
  );
  const accountEditorCompanyInitialValues = useMemo(
    () => ({
      id: toText(inquiryCompany?.id),
      company_name: toText(inquiryCompany?.name || inquiryCompany?.Name),
      company_type: toText(inquiryCompany?.type || inquiryCompany?.Type),
      company_description: toText(inquiryCompany?.description || inquiryCompany?.Description),
      company_phone: toText(inquiryCompany?.phone || inquiryCompany?.Phone),
      company_address: toText(inquiryCompany?.address || inquiryCompany?.Address),
      company_city: toText(inquiryCompany?.city || inquiryCompany?.City),
      company_state: toText(inquiryCompany?.state || inquiryCompany?.State),
      company_postal_code: toText(
        inquiryCompany?.postal_code || inquiryCompany?.Postal_Code || inquiryCompany?.zip_code
      ),
      company_industry: toText(inquiryCompany?.industry || inquiryCompany?.Industry),
      company_annual_revenue: toText(
        inquiryCompany?.annual_revenue || inquiryCompany?.Annual_Revenue
      ),
      company_number_of_employees: toText(
        inquiryCompany?.number_of_employees || inquiryCompany?.Number_of_Employees
      ),
      company_account_type: toText(
        inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
      ),
      primary_person_contact_id: toText(
        inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID
      ),
      first_name: toText(
        inquiryCompanyPrimaryPerson?.first_name ||
          inquiryCompanyPrimaryPerson?.First_Name
      ),
      last_name: toText(
        inquiryCompanyPrimaryPerson?.last_name ||
          inquiryCompanyPrimaryPerson?.Last_Name
      ),
      email: toText(
        inquiryCompanyPrimaryPerson?.email ||
          inquiryCompanyPrimaryPerson?.Email
      ),
      sms_number: toText(
        inquiryCompanyPrimaryPerson?.sms_number ||
          inquiryCompanyPrimaryPerson?.SMS_Number
      ),
      country: "AU",
      postal_country: "AU",
    }),
    [inquiry?.Company_Account_Type, inquiryCompany, inquiryCompanyPrimaryPerson]
  );

  const statusSource = toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source);
  const statusType = toText(inquiry?.type || inquiry?.Type);
  const statusServiceInquiryId = normalizeServiceInquiryId(
    inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
  );
  const statusServiceName =
    serviceInquiryName || (statusServiceInquiryId ? `Service #${statusServiceInquiryId}` : "");
  const statusServiceNameHref = statusServiceInquiryId
    ? `https://app.ontraport.com/#!/o_services10003/edit&id=${encodeURIComponent(
        statusServiceInquiryId
      )}`
    : "";
  const statusHowCanHelp = toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help);
  const statusHowHeard = toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear);
  const statusOther = toText(inquiry?.other || inquiry?.Other);
  const inquiryDisplayFlowRule = useMemo(() => {
    const resolvedType = toText(inquiry?.type || inquiry?.Type);
    return getInquiryFlowRule(resolvedType);
  }, [inquiry]);
  const shouldShowStatusOther = useMemo(
    () => shouldShowOtherSourceField(toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear)),
    [inquiry]
  );
  const statusHowHeardDisplay =
    shouldShowStatusOther && statusOther ? statusOther : statusHowHeard;

  const requestDateRequired = formatDate(inquiry?.date_job_required_by || inquiry?.Date_Job_Required_By);
  const requestRenovations = toText(inquiry?.renovations || inquiry?.Renovations);
  const requestResidentAvailability = toText(
    inquiry?.resident_availability || inquiry?.Resident_Availability
  );
  const requestPestNoiseRawValue =
    inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text;
  const requestPestActiveTimesRawValue =
    inquiry?.pest_active_times_options_as_text || inquiry?.Pest_Active_Times_Options_As_Text;
  const requestPestLocationsRawValue =
    inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text;
  const requestPestNoiseDisplayValue = Array.isArray(
    optimisticListSelectionByField.noise_signs_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.noise_signs_options_as_text)
    : requestPestNoiseRawValue;
  const requestPestActiveTimesDisplayValue = Array.isArray(
    optimisticListSelectionByField.pest_active_times_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.pest_active_times_options_as_text)
    : requestPestActiveTimesRawValue;
  const requestPestLocationsDisplayValue = Array.isArray(
    optimisticListSelectionByField.pest_location_options_as_text
  )
    ? serializeListSelectionValue(optimisticListSelectionByField.pest_location_options_as_text)
    : requestPestLocationsRawValue;
  const requestPestNoiseTags = buildListSelectionTagItems(
    requestPestNoiseDisplayValue,
    NOISE_SIGN_OPTIONS
  );
  const requestPestActiveTimesTags = buildListSelectionTagItems(
    requestPestActiveTimesDisplayValue,
    PEST_ACTIVE_TIME_OPTIONS
  );
  const requestPestLocationsTags = buildListSelectionTagItems(
    requestPestLocationsDisplayValue,
    PEST_LOCATION_OPTIONS
  );
  const hasRelatedRecordsData =
    filteredRelatedDeals.length > 0 || (Array.isArray(relatedJobs) && relatedJobs.length > 0);
  const shouldShowRelationshipTabsByFlow = Boolean(inquiryDisplayFlowRule.showPropertySearch);
  const shouldShowRelatedRecordsTab =
    Boolean(relatedRecordsAccountId) &&
    shouldShowRelationshipTabsByFlow &&
    hasRelatedRecordsData;
  const shouldShowPropertiesTab = shouldShowRelationshipTabsByFlow;
  const visibleWorkspaceTabs = useMemo(
    () =>
      INQUIRY_WORKSPACE_TABS.filter((tab) => {
        if (tab.id === "related-records") return shouldShowRelatedRecordsTab;
        if (tab.id === "properties") return shouldShowPropertiesTab;
        return true;
      }),
    [shouldShowPropertiesTab, shouldShowRelatedRecordsTab]
  );
  const visibleWorkspaceTabsKey = useMemo(
    () => visibleWorkspaceTabs.map((tab) => tab.id).join("|"),
    [visibleWorkspaceTabs]
  );

  useEffect(() => {
    if (!visibleWorkspaceTabs.length) return;
    const firstVisibleTabId = visibleWorkspaceTabs[0].id;
    const hasVisibleTabSetChanged =
      previousVisibleWorkspaceTabsKeyRef.current !== visibleWorkspaceTabsKey;
    if (hasVisibleTabSetChanged) {
      previousVisibleWorkspaceTabsKeyRef.current = visibleWorkspaceTabsKey;
      setActiveWorkspaceTab(firstVisibleTabId);
      return;
    }
    const isActiveVisible = visibleWorkspaceTabs.some((tab) => tab.id === activeWorkspaceTab);
    if (isActiveVisible) return;
    setActiveWorkspaceTab(firstVisibleTabId);
  }, [activeWorkspaceTab, visibleWorkspaceTabs, visibleWorkspaceTabsKey]);

  useEffect(() => {
    const normalizedActiveTab = toText(activeWorkspaceTab);
    if (!normalizedActiveTab) return;
    setMountedWorkspaceTabs((previous) => {
      if (previous[normalizedActiveTab]) return previous;
      return {
        ...previous,
        [normalizedActiveTab]: true,
      };
    });
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (!visibleWorkspaceTabs.length) return;
    const visibleIds = visibleWorkspaceTabs.map((tab) => tab.id);
    const firstVisibleTabId = visibleIds[0];
    setMountedWorkspaceTabs((previous) => {
      const next = {};
      visibleIds.forEach((tabId) => {
        if (previous[tabId] || tabId === activeWorkspaceTab || tabId === firstVisibleTabId) {
          next[tabId] = true;
        }
      });
      const previousKeys = Object.keys(previous).filter((key) => previous[key]);
      const nextKeys = Object.keys(next).filter((key) => next[key]);
      if (
        previousKeys.length === nextKeys.length &&
        previousKeys.every((key) => next[key])
      ) {
        return previous;
      }
      return next;
    });
  }, [activeWorkspaceTab, visibleWorkspaceTabs]);

  const notesAdmin = toText(inquiry?.admin_notes || inquiry?.Admin_Notes);
  const notesClient = toText(inquiry?.client_notes || inquiry?.Client_Notes);
  const isInquiryInitialLoadInProgress =
    hasUid && !resolvedInquiry && (!isSdkReady || isContextLoading);
  const inquiryDetailsInitialForm = useMemo(
    () => ({
      inquiry_status: toText(inquiry?.inquiry_status || inquiry?.Inquiry_Status) || "New Inquiry",
      inquiry_source: toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source),
      type: toText(inquiry?.type || inquiry?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
      ),
      how_can_we_help: toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help),
      how_did_you_hear: toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear),
      other: toText(inquiry?.other || inquiry?.Other),
      admin_notes: toText(inquiry?.admin_notes || inquiry?.Admin_Notes),
      client_notes: toText(inquiry?.client_notes || inquiry?.Client_Notes),
      date_job_required_by: toDateInput(
        inquiry?.date_job_required_by || inquiry?.Date_Job_Required_By
      ),
      renovations: toText(inquiry?.renovations || inquiry?.Renovations),
      resident_availability: toText(
        inquiry?.resident_availability || inquiry?.Resident_Availability
      ),
      noise_signs_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text,
          NOISE_SIGN_OPTIONS
        )
      ),
      pest_active_times_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.pest_active_times_options_as_text || inquiry?.Pest_Active_Times_Options_As_Text,
          PEST_ACTIVE_TIME_OPTIONS
        )
      ),
      pest_location_options_as_text: serializeListSelectionValue(
        parseListSelectionValue(
          inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text,
          PEST_LOCATION_OPTIONS
        )
      ),
    }),
    [inquiry]
  );
  const quickInquiryPrefillContext = useMemo(() => {
    const hasExistingInquiryContext =
      Boolean(toText(inquiryNumericId)) &&
      toText(safeUid).toLowerCase() !== "new";
    if (!hasExistingInquiryContext) return null;

    const resolvedPropertyRecord = normalizePropertyLookupRecord(
      activeRelatedProperty || inquiryPropertyRecord || {}
    );
    const resolvedPropertyId = normalizePropertyId(
      resolvedPropertyRecord?.id ||
        inquiry?.property_id ||
        inquiry?.Property_ID ||
        inquiryPropertyId
    );

    return {
      account_type: inquiryAccountType || "Contact",
      contact: {
        id:
          inquiryContactId ||
          toText(inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID),
        first_name: toText(inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name),
        last_name: toText(inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name),
        email: toText(inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email),
        sms_number: toText(inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number),
        address: toText(inquiryPrimaryContact?.address || inquiryPrimaryContact?.Address),
        city: toText(inquiryPrimaryContact?.city || inquiryPrimaryContact?.City),
        state: toText(inquiryPrimaryContact?.state || inquiryPrimaryContact?.State),
        zip_code: toText(
          inquiryPrimaryContact?.zip_code ||
            inquiryPrimaryContact?.Zip_Code ||
            inquiryPrimaryContact?.postal_code ||
            inquiryPrimaryContact?.Postal_Code
        ),
        country: toText(inquiryPrimaryContact?.country || inquiryPrimaryContact?.Country || "AU"),
      },
      company: {
        id: inquiryCompanyId || toText(inquiryCompany?.id || inquiryCompany?.ID),
        company_name: toText(inquiryCompany?.name || inquiryCompany?.Name),
        company_phone: toText(inquiryCompany?.phone || inquiryCompany?.Phone),
        company_address: toText(inquiryCompany?.address || inquiryCompany?.Address),
        company_city: toText(inquiryCompany?.city || inquiryCompany?.City),
        company_state: toText(inquiryCompany?.state || inquiryCompany?.State),
        company_postal_code: toText(
          inquiryCompany?.postal_code ||
            inquiryCompany?.Postal_Code ||
            inquiryCompany?.zip_code ||
            inquiryCompany?.Zip_Code
        ),
        company_account_type: toText(
          inquiryCompany?.account_type || inquiryCompany?.Account_Type || inquiry?.Company_Account_Type
        ),
        primary_first_name: toText(
          inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name
        ),
        primary_last_name: toText(
          inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name
        ),
        primary_email: toText(
          inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email
        ),
        primary_sms_number: toText(
          inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
        ),
      },
      details: {
        inquiry_source: toText(inquiry?.inquiry_source || inquiry?.Inquiry_Source),
        type: toText(inquiry?.type || inquiry?.Type),
        service_inquiry_id: normalizeServiceInquiryId(
          inquiry?.service_inquiry_id || inquiry?.Service_Inquiry_ID
        ),
        how_can_we_help: toText(inquiry?.how_can_we_help || inquiry?.How_can_we_help),
        how_did_you_hear: toText(inquiry?.how_did_you_hear || inquiry?.How_did_you_hear),
        other: toText(inquiry?.other || inquiry?.Other),
        noise_signs_options_as_text: toText(
          inquiry?.noise_signs_options_as_text || inquiry?.Noise_Signs_Options_As_Text
        ),
        pest_active_times_options_as_text: toText(
          inquiry?.pest_active_times_options_as_text || inquiry?.Pest_Active_Times_Options_As_Text
        ),
        pest_location_options_as_text: toText(
          inquiry?.pest_location_options_as_text || inquiry?.Pest_Location_Options_As_Text
        ),
        property_id: resolvedPropertyId,
        property_name: toText(
          resolvedPropertyRecord?.property_name || resolvedPropertyRecord?.Property_Name
        ),
        property_lookup: joinAddress([
          resolvedPropertyRecord?.address_1 ||
            resolvedPropertyRecord?.Address_1 ||
            resolvedPropertyRecord?.address ||
            resolvedPropertyRecord?.Address,
          resolvedPropertyRecord?.suburb_town ||
            resolvedPropertyRecord?.Suburb_Town ||
            resolvedPropertyRecord?.city ||
            resolvedPropertyRecord?.City,
          resolvedPropertyRecord?.state || resolvedPropertyRecord?.State,
          resolvedPropertyRecord?.postal_code ||
            resolvedPropertyRecord?.Postal_Code ||
            resolvedPropertyRecord?.zip_code ||
            resolvedPropertyRecord?.Zip_Code,
          resolvedPropertyRecord?.country || resolvedPropertyRecord?.Country,
        ]),
        property_lot_number: toText(
          resolvedPropertyRecord?.lot_number || resolvedPropertyRecord?.Lot_Number
        ),
        property_unit_number: toText(
          resolvedPropertyRecord?.unit_number || resolvedPropertyRecord?.Unit_Number
        ),
        property_address_1: toText(
          resolvedPropertyRecord?.address_1 ||
            resolvedPropertyRecord?.Address_1 ||
            resolvedPropertyRecord?.address ||
            resolvedPropertyRecord?.Address
        ),
        property_suburb_town: toText(
          resolvedPropertyRecord?.suburb_town ||
            resolvedPropertyRecord?.Suburb_Town ||
            resolvedPropertyRecord?.city ||
            resolvedPropertyRecord?.City
        ),
        property_state: toText(resolvedPropertyRecord?.state || resolvedPropertyRecord?.State),
        property_postal_code: toText(
          resolvedPropertyRecord?.postal_code ||
            resolvedPropertyRecord?.Postal_Code ||
            resolvedPropertyRecord?.zip_code ||
            resolvedPropertyRecord?.Zip_Code
        ),
        property_country: toText(resolvedPropertyRecord?.country || resolvedPropertyRecord?.Country || "AU"),
        property_record: resolvedPropertyRecord,
        admin_notes: notesAdmin,
        client_notes: notesClient,
      },
      property_same_as_contact: Boolean(isPropertySameAsContact),
    };
  }, [
    activeRelatedProperty,
    inquiry,
    inquiryAccountType,
    inquiryCompany,
    inquiryCompanyId,
    inquiryCompanyPrimaryPerson,
    inquiryContactId,
    inquiryNumericId,
    inquiryPrimaryContact,
    inquiryPropertyId,
    inquiryPropertyRecord,
    isPropertySameAsContact,
    notesAdmin,
    notesClient,
    safeUid,
  ]);
  const inquiryEditFlowRule = useMemo(
    () => getInquiryFlowRule(inquiryDetailsForm.type),
    [inquiryDetailsForm.type]
  );
  const shouldShowInquiryEditOther = useMemo(
    () => shouldShowOtherSourceField(inquiryDetailsForm.how_did_you_hear),
    [inquiryDetailsForm.how_did_you_hear]
  );
  const selectedInquiryEditServiceLabel = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    if (!selectedServiceId) return "";
    const fromOptions = (Array.isArray(inquiryServiceOptions) ? inquiryServiceOptions : []).find(
      (option) => toText(option?.value) === selectedServiceId
    );
    return toText(fromOptions?.label || serviceInquiryLabelById?.[selectedServiceId]);
  }, [inquiryDetailsForm.service_inquiry_id, inquiryServiceOptions, serviceInquiryLabelById]);
  const isInquiryEditPestService = useMemo(
    () => isPestServiceFlow(selectedInquiryEditServiceLabel),
    [selectedInquiryEditServiceLabel]
  );
  const resolvedInquiryServiceOptions = useMemo(() => {
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    const options = Array.isArray(inquiryServiceOptions) ? [...inquiryServiceOptions] : [];
    if (selectedServiceId && !options.some((option) => toText(option?.value) === selectedServiceId)) {
      options.unshift({
        value: selectedServiceId,
        label: toText(serviceInquiryLabelById?.[selectedServiceId]) || `Service #${selectedServiceId}`,
      });
    }
    return options;
  }, [inquiryDetailsForm.service_inquiry_id, inquiryServiceOptions, serviceInquiryLabelById]);

  const serviceProviderIdResolved = toText(
    inquiry?.service_provider_id ||
      inquiry?.Service_Provider_ID ||
      serviceProvider?.id ||
      serviceProvider?.ID ||
      serviceProviderFallbackRecord?.id ||
      serviceProviderFallbackRecord?.ID
  );
  const hasServiceProviderRelationDetails = Boolean(
    fullName(serviceProviderContact?.first_name, serviceProviderContact?.last_name) ||
      toText(serviceProviderContact?.email) ||
      toText(serviceProviderContact?.sms_number)
  );
  const serviceProviderEmail =
    toText(serviceProviderContact?.email) ||
    toText(serviceProviderFallbackContact?.email);
  const serviceProviderPhone =
    toText(serviceProviderContact?.sms_number) ||
    toText(serviceProviderFallbackContact?.sms_number);
  const inquiryTakenByStoredId = toText(
    inquiry?.Inquiry_Taken_By_id || inquiry?.Inquiry_Taken_By_ID || inquiry?.inquiry_taken_by_id
  );
  const inquiryTakenByIdResolved = inquiryTakenByStoredId || configuredAdminProviderId;
  const inquiryTakenByFallbackRecord = normalizeRelationRecord(inquiryTakenByFallback);
  const inquiryTakenByFallbackContact = normalizeServiceProviderContact(inquiryTakenByFallbackRecord);
  const inquiryTakenBySelectedLookupRecord = useMemo(
    () =>
      (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []).find(
        (provider) => toText(provider?.id || provider?.ID) === inquiryTakenByIdResolved
      ) || null,
    [inquiryTakenByIdResolved, inquiryTakenByLookup]
  );
  const serviceProviderPrefillLabel = useMemo(
    () =>
      serviceProviderIdResolved
        ? formatServiceProviderInputLabel({
            id: serviceProviderIdResolved,
            first_name:
              serviceProviderContact?.first_name || serviceProviderFallbackContact?.first_name,
            last_name:
              serviceProviderContact?.last_name || serviceProviderFallbackContact?.last_name,
            email: serviceProviderEmail,
            sms_number: serviceProviderPhone,
          })
        : "",
    [
      serviceProviderContact?.first_name,
      serviceProviderContact?.last_name,
      serviceProviderEmail,
      serviceProviderFallbackContact?.first_name,
      serviceProviderFallbackContact?.last_name,
      serviceProviderIdResolved,
      serviceProviderPhone,
    ]
  );
  const inquiryTakenByPrefillLabel = useMemo(() => {
    if (!inquiryTakenByIdResolved) return "";
    if (inquiryTakenBySelectedLookupRecord) {
      return formatServiceProviderInputLabel(inquiryTakenBySelectedLookupRecord);
    }
    if (inquiryTakenByFallbackRecord && toText(inquiryTakenByFallbackRecord?.id)) {
      return formatServiceProviderInputLabel({
        id: inquiryTakenByIdResolved,
        first_name: inquiryTakenByFallbackContact?.first_name,
        last_name: inquiryTakenByFallbackContact?.last_name,
        email: inquiryTakenByFallbackContact?.email,
        sms_number: inquiryTakenByFallbackContact?.sms_number,
      });
    }
    return "";
  }, [
    inquiryTakenByFallbackContact?.email,
    inquiryTakenByFallbackContact?.first_name,
    inquiryTakenByFallbackContact?.last_name,
    inquiryTakenByFallbackContact?.sms_number,
    inquiryTakenByFallbackRecord,
    inquiryTakenByIdResolved,
    inquiryTakenBySelectedLookupRecord,
  ]);
  const serviceProviderSearchItems = useMemo(
    () =>
      (Array.isArray(serviceProviderLookup) ? serviceProviderLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email),
            sms_number: toText(provider?.sms_number),
          };
        })
        .filter(Boolean),
    [serviceProviderLookup]
  );
  const inquiryTakenBySearchItems = useMemo(
    () =>
      (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : [])
        .map((provider) => {
          const id = toText(provider?.id || provider?.ID);
          if (!id) return null;
          const label = formatServiceProviderAllocationLabel(provider);
          const valueLabel = formatServiceProviderInputLabel(provider);
          return {
            id,
            label,
            valueLabel,
            meta: toText(provider?.unique_id || provider?.Unique_ID),
            first_name: toText(provider?.first_name),
            last_name: toText(provider?.last_name),
            email: toText(provider?.email || provider?.work_email || provider?.Work_Email),
            sms_number: toText(
              provider?.sms_number || provider?.mobile_number || provider?.Mobile_Number
            ),
          };
        })
        .filter(Boolean),
    [inquiryTakenByLookup]
  );
  const inquiryAppointmentPrefillContext = useMemo(() => {
    const locationId = normalizePropertyId(activeRelatedProperty?.id);
    const locationLabel = resolvePropertyLookupLabel(activeRelatedProperty || {});
    const guestId = inquiryContactId || toText(inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID);
    const guestLabel = formatContactLookupLabel({
      id: guestId,
      first_name: inquiryPrimaryContact?.first_name,
      last_name: inquiryPrimaryContact?.last_name,
      email: inquiryPrimaryContact?.email,
      sms_number: inquiryPrimaryContact?.sms_number,
    });
    const serviceLabel = toText(serviceInquiryName);
    const title = [safeUid, serviceLabel].filter(Boolean).join(" | ");
    const details = [
      serviceLabel ? `Service:\n${serviceLabel}` : "",
      locationLabel ? `Property:\n${locationLabel}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    return {
      locationId,
      locationLabel,
      hostId: serviceProviderIdResolved,
      hostLabel: serviceProviderPrefillLabel,
      guestId,
      guestLabel,
      title,
      description: details,
    };
  }, [
    activeRelatedProperty,
    inquiryContactId,
    inquiryPrimaryContact,
    safeUid,
    serviceInquiryName,
    serviceProviderIdResolved,
    serviceProviderPrefillLabel,
  ]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const onDocumentClick = (event) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocumentClick);
    return () => document.removeEventListener("mousedown", onDocumentClick);
  }, [isMoreOpen]);

  useEffect(() => {
    if (isQuickInquiryBookingMode) {
      setIsQuickInquiryBookingModalOpen(true);
    }
  }, [isQuickInquiryBookingMode]);

  useEffect(() => {
    if (!isQuickInquiryBookingMode) {
      quickInquiryProvisioningRequestedRef.current = false;
      setIsQuickInquiryProvisioning(false);
      return;
    }
    if (!isSdkReady || !plugin?.switchTo) return;
    if (inquiryNumericId || isQuickInquiryProvisioning) return;
    if (quickInquiryProvisioningRequestedRef.current) return;
    quickInquiryProvisioningRequestedRef.current = true;
    setIsQuickInquiryProvisioning(true);

    createInquiryRecordFromPayload({
      plugin,
      payload: {
        inquiry_status: "New Inquiry",
        account_type: "Contact",
        Inquiry_Taken_By_id: configuredAdminProviderId
          ? normalizeMutationIdentifier(configuredAdminProviderId)
          : null,
      },
    })
      .then((createdInquiry) => {
        const createdId = toText(createdInquiry?.id || createdInquiry?.ID);
        const nextUid = toText(createdInquiry?.unique_id);
        if (!nextUid) {
          throw new Error("Inquiry was created but unique ID was not returned.");
        }
        trackRecentActivity({
          action: "Created new inquiry",
          path: `/inquiry-details/${encodeURIComponent(nextUid)}`,
          pageType: "inquiry-details",
          pageName: "Inquiry Details",
          metadata: {
            inquiry_id: createdId,
            inquiry_uid: nextUid,
          },
        });
        navigate(`/inquiry-details/${encodeURIComponent(nextUid)}`, { replace: true });
      })
      .catch((provisionError) => {
        quickInquiryProvisioningRequestedRef.current = false;
        console.error("[InquiryDetails] Failed background quick inquiry creation", provisionError);
        error("Create failed", provisionError?.message || "Unable to create inquiry.");
      })
      .finally(() => {
        setIsQuickInquiryProvisioning(false);
      });
  }, [
    configuredAdminProviderId,
    error,
    inquiryNumericId,
    isQuickInquiryBookingMode,
    isQuickInquiryProvisioning,
    isSdkReady,
    navigate,
    plugin,
    trackRecentActivity,
  ]);

  useEffect(() => {
    if (!accountBindingKey) return;
    if (!previousAccountBindingKeyRef.current) {
      previousAccountBindingKeyRef.current = accountBindingKey;
      return;
    }
    if (previousAccountBindingKeyRef.current === accountBindingKey) return;
    previousAccountBindingKeyRef.current = accountBindingKey;
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
  }, [accountBindingKey]);

  useEffect(() => {
    previousVisibleWorkspaceTabsKeyRef.current = "";
    previousAccountBindingKeyRef.current = "";
    setMountedWorkspaceTabs({});
    setActiveWorkspaceTab("");
  }, [safeUid]);

  useEffect(() => {
    setSelectedPropertyId("");
    setPropertySearchQuery("");
    propertySearchManualEditRef.current = false;
    previousSelectedPropertyIdRef.current = "";
    setIsPropertySameAsContact(false);
    setIsApplyingSameAsContactProperty(false);
    setLinkedProperties([]);
    setLinkedPropertiesError("");
    setPropertyModalState({ open: false, initialData: null });
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsUploadsModalOpen(false);
  }, [safeUid]);

  useEffect(() => {
    if (!hasUid) return;
    const cachedUi = readInquiryWorkspaceUiCache(safeUid);
    if (!cachedUi || typeof cachedUi !== "object") return;
    const cachedPropertyId = normalizePropertyId(cachedUi?.selectedPropertyId || "");
    if (cachedPropertyId) {
      setSelectedPropertyId(cachedPropertyId);
    }
    if (typeof cachedUi?.isPropertySameAsContact === "boolean") {
      setIsPropertySameAsContact(cachedUi.isPropertySameAsContact);
    }
  }, [hasUid, safeUid]);

  useEffect(() => {
    if (!hasUid) return;
    writeInquiryWorkspaceUiCache(safeUid, {
      selectedPropertyId: normalizedSelectedPropertyId || selectedPropertyId,
      isPropertySameAsContact,
    });
  }, [
    hasUid,
    isPropertySameAsContact,
    normalizedSelectedPropertyId,
    safeUid,
    selectedPropertyId,
  ]);

  useEffect(() => {
    if (!plugin || !relatedRecordsAccountId || !inquiryDisplayFlowRule.showPropertySearch) {
      setLinkedProperties([]);
      setLinkedPropertiesError("");
      setIsLinkedPropertiesLoading(false);
      return;
    }

    let isMounted = true;
    setLinkedPropertiesError("");
    const cachedPropertyData = readInquiryWorkspacePropertyCache({
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    });
    if (cachedPropertyData) {
      const cachedLinked = dedupePropertyLookupRecords(cachedPropertyData.linkedProperties || []);
      const cachedLookup = dedupePropertyLookupRecords(
        cachedPropertyData.propertyLookupRecords || []
      );
      setLinkedProperties((previous) =>
        arePropertyRecordCollectionsEqual(previous, cachedLinked) ? previous : cachedLinked
      );
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, cachedLookup)
      );
      setIsLinkedPropertiesLoading(false);
      return () => {
        isMounted = false;
      };
    }

    setIsLinkedPropertiesLoading(true);
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        setLinkedProperties((previous) =>
          arePropertyRecordCollectionsEqual(previous, normalizedRecords)
            ? previous
            : normalizedRecords
        );
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
        writeInquiryWorkspacePropertyCache({
          accountType: relatedRecordsAccountType,
          accountId: relatedRecordsAccountId,
          linkedProperties: normalizedRecords,
          propertyLookupRecords: normalizedRecords,
        });
      })
      .catch((loadError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading linked properties", loadError);
        setLinkedProperties([]);
        setLinkedPropertiesError(loadError?.message || "Unable to load linked properties.");
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLinkedPropertiesLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [inquiryDisplayFlowRule.showPropertySearch, plugin, relatedRecordsAccountId, relatedRecordsAccountType]);

  useEffect(() => {
    if (!relatedRecordsAccountId || !inquiryDisplayFlowRule.showPropertySearch) return;
    if (!linkedProperties.length && !propertyLookupRecords.length) return;
    writeInquiryWorkspacePropertyCache({
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
      linkedProperties,
      propertyLookupRecords,
    });
  }, [
    inquiryDisplayFlowRule.showPropertySearch,
    linkedProperties,
    propertyLookupRecords,
    relatedRecordsAccountId,
    relatedRecordsAccountType,
  ]);

  useEffect(() => {
    if (!inquiryPropertyId && !resolvePropertyLookupLabel(inquiryPropertyRecord)) return;
    setPropertyLookupRecords((previous) =>
      mergePropertyCollectionsIfChanged(previous, [inquiryPropertyRecord])
    );
  }, [inquiryPropertyId, inquiryPropertyRecord]);

  useEffect(() => {
    const shouldPreloadAllProperties = toText(import.meta.env.VITE_PRELOAD_ALL_PROPERTIES).toLowerCase() === "true";
    if (!shouldPreloadAllProperties) return;
    if (!plugin || !shouldShowPropertiesTab) return;

    let isMounted = true;
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (!isMounted) return;
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (!normalizedRecords.length) return;
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, normalizedRecords)
        );
      })
      .catch((loadError) => {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading property lookup", loadError);
      });

    return () => {
      isMounted = false;
    };
  }, [plugin, shouldShowPropertiesTab]);

  useEffect(() => {
    const normalizedInquiryPropertyId = normalizePropertyId(inquiryPropertyId);
    if (!normalizedInquiryPropertyId) return;
    setSelectedPropertyId((previous) => {
      const normalizedPreviousId = normalizePropertyId(previous);
      if (normalizedPreviousId === normalizedInquiryPropertyId) return previous;
      return normalizedInquiryPropertyId;
    });
  }, [inquiryPropertyId]);

  useEffect(() => {
    if (normalizedSelectedPropertyId) {
      const isStillAvailableInLinked = linkedPropertiesSorted.some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      const isStillAvailableInLookup = dedupePropertyLookupRecords(propertyLookupRecords).some(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
      if (isStillAvailableInLinked || isStillAvailableInLookup) return;
    }
    const fallbackId = inquiryPropertyId || normalizePropertyId(linkedPropertiesSorted[0]?.id);
    setSelectedPropertyId((previous) => {
      const prevId = normalizePropertyId(previous);
      if (prevId === fallbackId) return previous;
      return fallbackId;
    });
  }, [inquiryPropertyId, linkedPropertiesSorted, normalizedSelectedPropertyId, propertyLookupRecords]);

  useEffect(() => {
    if (!normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = "";
      return;
    }
    const selectedRecord =
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      );
    if (!selectedRecord) return;
    const nextLabel = resolvePropertyLookupLabel(selectedRecord);
    if (!nextLabel) return;
    if (previousSelectedPropertyIdRef.current !== normalizedSelectedPropertyId) {
      previousSelectedPropertyIdRef.current = normalizedSelectedPropertyId;
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(nextLabel);
      return;
    }
    if (propertySearchManualEditRef.current) return;
    if (toText(propertySearchQuery) === toText(nextLabel)) return;
    setPropertySearchQuery(nextLabel);
  }, [
    linkedPropertiesSorted,
    normalizedSelectedPropertyId,
    propertyLookupRecords,
    propertySearchQuery,
  ]);

  useEffect(() => {
    if (!plugin || !normalizedSelectedPropertyId) return;
    const selectedRecord =
      dedupePropertyLookupRecords(propertyLookupRecords).find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) ||
      linkedPropertiesSorted.find(
        (record) => normalizePropertyId(record?.id) === normalizedSelectedPropertyId
      ) || null;

    const hasAddressDetails = Boolean(
      toText(
        selectedRecord?.address_1 ||
          selectedRecord?.Address_1 ||
          selectedRecord?.address ||
          selectedRecord?.Address
      ) ||
        toText(
          selectedRecord?.suburb_town ||
            selectedRecord?.Suburb_Town ||
            selectedRecord?.city ||
            selectedRecord?.City
        )
    );
    if (selectedRecord && hasAddressDetails) return;

    let isMounted = true;
    fetchPropertyRecordById({ plugin, propertyId: normalizedSelectedPropertyId })
      .then((record) => {
        if (!isMounted || !record) return;
        const normalizedRecord = normalizePropertyLookupRecord(record);
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedRecord])
        );
        setLinkedProperties((previous) =>
          mergePropertyCollectionsIfChanged(previous || [], [normalizedRecord])
        );
      })
      .catch((fetchError) => {
        if (!isMounted) return;
        if (!/timed out/i.test(String(fetchError?.message || ""))) {
          console.error("[InquiryDetails] Failed hydrating selected property details", fetchError);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [linkedPropertiesSorted, normalizedSelectedPropertyId, plugin, propertyLookupRecords]);

  useEffect(() => {
    const sourceComparableAddress = normalizeAddressText(
      joinAddress([
        sameAsContactPropertySource?.address1,
        sameAsContactPropertySource?.suburbTown,
        sameAsContactPropertySource?.state,
        sameAsContactPropertySource?.postalCode,
      ]) || sameAsContactPropertySource?.searchText
    );
    const selectedComparableAddress = buildComparablePropertyAddress(activeRelatedProperty || {});
    const isAddressMatched =
      Boolean(sourceComparableAddress && selectedComparableAddress) &&
      (sourceComparableAddress === selectedComparableAddress ||
        selectedComparableAddress.includes(sourceComparableAddress) ||
        sourceComparableAddress.includes(selectedComparableAddress));
    setIsPropertySameAsContact((previous) =>
      previous === isAddressMatched ? previous : isAddressMatched
    );
  }, [activeRelatedProperty, sameAsContactPropertySource]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    if (!shouldShowInquiryEditOther && toText(inquiryDetailsForm.other)) {
      setInquiryDetailsForm((previous) => ({ ...previous, other: "" }));
    }
  }, [isInquiryDetailsModalOpen, inquiryDetailsForm.other, shouldShowInquiryEditOther]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen) return;
    setIsInquiryEditPestAccordionOpen(isInquiryEditPestService);
  }, [isInquiryDetailsModalOpen, isInquiryEditPestService]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !isSdkReady || !plugin) return;

    let isMounted = true;
    setIsInquiryServiceLookupLoading(true);
    const loadServices = async () => {
      try {
        let records = await fetchServicesForActivities({ plugin });
        records = Array.isArray(records) ? records : [];
        if (!records.length) {
          const allServicesQuery = plugin
            .switchTo("PeterpmService")
            .query()
            .deSelectAll()
            .select(["id", "service_name", "service_type"])
            .noDestroy();
          allServicesQuery.getOrInitQueryCalc?.();
          const response = await toPromiseLike(allServicesQuery.fetchDirect());
          const rows = response?.resp || response?.data || [];
          records = Array.isArray(rows) ? rows : [];
        }
        if (!isMounted) return;
        const mapped = records
          .map((record) => ({
            id: toText(record?.id || record?.ID),
            name: toText(record?.service_name || record?.Service_Name),
            type: toText(record?.service_type || record?.Service_Type),
          }))
          .filter((record) => record.id && record.name)
          .filter((record) => !record.type || record.type.toLowerCase() === "primary")
          .sort((a, b) => a.name.localeCompare(b.name));
        setInquiryServiceOptions(mapped.map((record) => ({ value: record.id, label: record.name })));
        setServiceInquiryLabelById(Object.fromEntries(mapped.map((record) => [record.id, record.name])));
      } catch (serviceError) {
        if (!isMounted) return;
        console.error("[InquiryDetails] Failed loading service options", serviceError);
        setInquiryServiceOptions([]);
        setServiceInquiryLabelById({});
      } finally {
        if (!isMounted) return;
        setIsInquiryServiceLookupLoading(false);
      }
    };
    loadServices();

    return () => {
      isMounted = false;
    };
  }, [isInquiryDetailsModalOpen, isSdkReady, plugin]);

  useEffect(() => {
    if (!isInquiryDetailsModalOpen || !plugin?.switchTo) return;
    const selectedServiceId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    if (!selectedServiceId) return;
    if (serviceInquiryLabelById[selectedServiceId]) return;

    let isActive = true;
    const loadServiceLabel = async () => {
      try {
        const resolvedLabel = await fetchServiceNameById({ plugin, serviceId: selectedServiceId });
        if (!isActive || !resolvedLabel) return;
        setServiceInquiryLabelById((previous) => ({
          ...previous,
          [selectedServiceId]: resolvedLabel,
        }));
      } catch (_) {
        if (!isActive) return;
      }
    };
    loadServiceLabel();

    return () => {
      isActive = false;
    };
  }, [inquiryDetailsForm.service_inquiry_id, isInquiryDetailsModalOpen, plugin, serviceInquiryLabelById]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !hasUid) {
      setResolvedInquiry(null);
      return;
    }

    let cancelled = false;
    setIsContextLoading(true);
    resolveJobDetailsContext({ plugin, uid: safeUid, sourceTab: "inquiry" })
      .then(async (context) => {
        if (cancelled) return;
        const fromContext =
          context?.inquiry ||
          context?.job?.Inquiry_Record ||
          context?.job?.inquiry_record ||
          null;
        if (fromContext) {
          const contextInquiryId = toText(fromContext?.id || fromContext?.ID);
          const enrichedFromContextId = contextInquiryId
            ? await fetchInquiryLiteById({ plugin, id: contextInquiryId })
            : null;
          if (cancelled) return;
          if (enrichedFromContextId) {
            setResolvedInquiry(enrichedFromContextId);
            return;
          }

          const contextInquiryUid = toText(fromContext?.unique_id || fromContext?.Unique_ID || safeUid);
          const enrichedFromContextUid = contextInquiryUid
            ? await fetchInquiryLiteByUid({ plugin, uid: contextInquiryUid })
            : null;
          if (cancelled) return;
          if (enrichedFromContextUid) {
            setResolvedInquiry(enrichedFromContextUid);
            return;
          }

          setResolvedInquiry(fromContext);
          return;
        }

        const liteByUid = await fetchInquiryLiteByUid({ plugin, uid: safeUid });
        if (cancelled) return;
        if (liteByUid) {
          setResolvedInquiry(liteByUid);
          return;
        }

        if (/^\d+$/.test(safeUid)) {
          const liteById = await fetchInquiryLiteById({ plugin, id: safeUid });
          if (cancelled) return;
          if (liteById) {
            setResolvedInquiry(liteById);
            return;
          }
        }

        setResolvedInquiry(null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed loading inquiry context", loadError);
        setResolvedInquiry(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsContextLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [hasUid, isSdkReady, plugin, safeUid]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceInquiryName("");
      return;
    }
    if (!statusServiceInquiryId) {
      setServiceInquiryName("");
      return;
    }

    let cancelled = false;
    fetchServiceNameById({ plugin, serviceId: statusServiceInquiryId })
      .then((name) => {
        if (cancelled) return;
        setServiceInquiryName(toText(name));
      })
      .catch(() => {
        if (cancelled) return;
        setServiceInquiryName("");
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, statusServiceInquiryId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setServiceProviderFallback(null);
      return;
    }
    if (!serviceProviderIdResolved) {
      setServiceProviderFallback(null);
      return;
    }
    if (hasServiceProviderRelationDetails) {
      setServiceProviderFallback(null);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: serviceProviderIdResolved })
      .then((providerRecord) => {
        if (cancelled) return;
        setServiceProviderFallback(providerRecord || null);
      })
      .catch(() => {
        if (cancelled) return;
        setServiceProviderFallback(null);
      });

    return () => {
      cancelled = true;
    };
  }, [hasServiceProviderRelationDetails, isSdkReady, plugin, serviceProviderIdResolved]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setInquiryTakenByFallback(null);
      return;
    }
    if (!inquiryTakenByIdResolved) {
      setInquiryTakenByFallback(null);
      return;
    }
    const fromLookup = (Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []).find(
      (provider) => toText(provider?.id || provider?.ID) === inquiryTakenByIdResolved
    );
    if (fromLookup) {
      setInquiryTakenByFallback(fromLookup);
      return;
    }

    let cancelled = false;
    fetchServiceProviderById({ plugin, providerId: inquiryTakenByIdResolved })
      .then((providerRecord) => {
        if (cancelled) return;
        setInquiryTakenByFallback(providerRecord || null);
      })
      .catch(() => {
        if (cancelled) return;
        setInquiryTakenByFallback(null);
      });

    return () => {
      cancelled = true;
    };
  }, [inquiryTakenByIdResolved, inquiryTakenByLookup, isSdkReady, plugin]);

  useEffect(() => {
    const currentId = toText(serviceProviderIdResolved);
    setSelectedServiceProviderId(currentId);
    setServiceProviderSearch(currentId ? serviceProviderPrefillLabel : "");
  }, [serviceProviderIdResolved, serviceProviderPrefillLabel]);

  useEffect(() => {
    const quoteJobId = toText(quoteJobIdFromRecord);
    const inquiryId = toText(inquiryNumericId);
    if (!plugin?.switchTo || !/^\d+$/.test(quoteJobId) || !inquiryId) {
      setIsQuoteJobDirectlyLinked(false);
      return;
    }

    let cancelled = false;
    fetchJobInquiryRecordIdById({ plugin, jobId: quoteJobId })
      .then((jobInquiryId) => {
        if (cancelled) return;
        setIsQuoteJobDirectlyLinked(toText(jobInquiryId) === inquiryId);
      })
      .catch((linkError) => {
        if (cancelled) return;
        console.warn("[InquiryDetails] Failed verifying quote/job association", linkError);
        setIsQuoteJobDirectlyLinked(false);
      });

    return () => {
      cancelled = true;
    };
  }, [inquiryNumericId, plugin, quoteJobIdFromRecord]);

  useEffect(() => {
    setLinkedJobSelectionOverride(undefined);
  }, [linkedInquiryJobIdFromRecord, safeUid]);

  useEffect(() => {
    setRelatedJobIdByUid({});
  }, [safeUid]);

  useEffect(() => {
    if (!plugin || !Array.isArray(relatedJobs) || !relatedJobs.length) return;
    const unresolvedUids = relatedJobs
      .map((job) => ({
        id: toText(job?.id || job?.ID),
        uid: toText(job?.unique_id || job?.Unique_ID),
      }))
      .filter((row) => !row.id && row.uid && !toText(relatedJobIdByUid[row.uid]));
    if (!unresolvedUids.length) return;

    let cancelled = false;
    Promise.all(
      unresolvedUids.map(async (row) => ({
        uid: row.uid,
        id: await fetchJobIdByUniqueId({ plugin, uniqueId: row.uid }),
      }))
    )
      .then((resolvedRows) => {
        if (cancelled) return;
        setRelatedJobIdByUid((previous) => {
          const next = { ...previous };
          let changed = false;
          resolvedRows.forEach(({ uid, id }) => {
            const normalizedUid = toText(uid);
            const normalizedId = toText(id);
            if (!normalizedUid || !normalizedId || toText(next[normalizedUid]) === normalizedId) return;
            next[normalizedUid] = normalizedId;
            changed = true;
          });
          return changed ? next : previous;
        });
      })
      .catch((resolveError) => {
        if (cancelled) return;
        console.warn("[InquiryDetails] Failed resolving related job ids", resolveError);
      });

    return () => {
      cancelled = true;
    };
  }, [plugin, relatedJobIdByUid, relatedJobs]);

  useEffect(() => {
    const currentId = toText(
      inquiryTakenBySelectedLookupRecord?.id ||
        inquiryTakenByFallbackRecord?.id ||
        inquiryTakenByIdResolved
    );
    setSelectedInquiryTakenById(currentId);
    setInquiryTakenBySearch(currentId ? inquiryTakenByPrefillLabel : "");
  }, [
    inquiryTakenByFallbackRecord?.id,
    inquiryTakenByIdResolved,
    inquiryTakenByPrefillLabel,
    inquiryTakenBySelectedLookupRecord?.id,
  ]);

  const refreshResolvedInquiry = useCallback(async () => {
    if (!plugin || !inquiryNumericId) return null;
    const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
    if (refreshed) {
      setResolvedInquiry(refreshed);
    }
    return refreshed || null;
  }, [inquiryNumericId, plugin]);

  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [hasMemoContext, inquiryNumericId, isSdkReady, plugin]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      setIsMemosLoading(false);
      setMemosError("");
      return undefined;
    }

    setIsMemosLoading(true);
    setMemosError("");

    fetchMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
    })
      .then((rows) => {
        if (cancelled) return;
        setMemos(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to load memos", loadError);
        setMemos([]);
        setMemosError(loadError?.message || "Unable to load memos.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsMemosLoading(false);
      });

    const unsubscribeMemos = subscribeMemosForDetails({
      plugin,
      inquiryId: inquiryNumericId,
      limit: 120,
      onChange: (rows) => {
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
        setIsMemosLoading(false);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Memo subscription failed", streamError);
        setMemosError((previous) => previous || "Live memo updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeMemos?.();
    };
  }, [hasMemoContext, inquiryNumericId, isSdkReady, plugin]);

  useEffect(() => {
    setOptimisticListSelectionByField({});
    setRemovingListTagKeys({});
    listSelectionDesiredRef.current = {};
    listSelectionSyncingRef.current = {};
  }, [inquiryNumericId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    if (!inquiryNumericId) return;
    if (!configuredAdminProviderId) return;
    if (inquiryTakenByStoredId) return;

    const marker = `${inquiryNumericId}:${configuredAdminProviderId}`;
    if (inquiryTakenByAutofillRef.current.has(marker)) return;
    inquiryTakenByAutofillRef.current.add(marker);

    let cancelled = false;
    updateInquiryFieldsById({
      plugin,
      inquiryId: inquiryNumericId,
      payload: {
        Inquiry_Taken_By_id: configuredAdminProviderId,
      },
    })
      .then(async () => {
        if (cancelled) return;
        const refreshed = await fetchInquiryLiteById({ plugin, id: inquiryNumericId });
        if (cancelled || !refreshed) return;
        setResolvedInquiry(refreshed);
      })
      .catch((autoAssignError) => {
        if (cancelled) return;
        console.error("[InquiryDetails] Failed to auto-set inquiry taken by", autoAssignError);
      });

    return () => {
      cancelled = true;
    };
  }, [
    configuredAdminProviderId,
    inquiryNumericId,
    inquiryTakenByStoredId,
    isSdkReady,
    plugin,
  ]);

  const openContactDetailsModal = useCallback(
    ({
      mode = "individual",
      onSave = null,
      onModeChange = null,
      allowModeSwitch = false,
      titleVerb = "Add",
      initialValues = null,
    } = {}) => {
      setContactModalState({
        open: true,
        mode,
        onSave: typeof onSave === "function" ? onSave : null,
        onModeChange: typeof onModeChange === "function" ? onModeChange : null,
        allowModeSwitch: Boolean(allowModeSwitch),
        titleVerb: toText(titleVerb) || "Add",
        initialValues:
          initialValues && typeof initialValues === "object" ? { ...initialValues } : null,
      });
    },
    []
  );

  const closeContactDetailsModal = useCallback(() => {
    setContactModalState((previous) => ({
      ...previous,
      open: false,
    }));
  }, []);

  const handlePropertySearchQueryChange = useCallback(
    async (query) => {
      const normalizedQuery = toText(query);
      if (!plugin || normalizedQuery.length < 2) return [];
      try {
        const records = await searchPropertiesForLookup({
          plugin,
          query: normalizedQuery,
          limit: 50,
        });
        const normalizedRecords = dedupePropertyLookupRecords(records || []);
        if (normalizedRecords.length) {
          setPropertyLookupRecords((previous) =>
            mergePropertyCollectionsIfChanged(previous, normalizedRecords)
          );
        }
        return normalizedRecords;
      } catch (lookupError) {
        console.error("[InquiryDetails] Property lookup search failed", lookupError);
        return [];
      }
    },
    [plugin]
  );

  const handlePropertySearchValueChange = useCallback((value) => {
    propertySearchManualEditRef.current = true;
    setPropertySearchQuery(value);
  }, []);

  const handleSelectPropertyFromSearch = useCallback((item = {}) => {
    const nextId = normalizePropertyId(item?.id);
    if (!nextId) return;
    propertySearchManualEditRef.current = false;
    setSelectedPropertyId(nextId);
    setPropertySearchQuery(toText(item?.label));
  }, []);

  const closePropertyModal = useCallback(() => {
    setPropertyModalState({ open: false, initialData: null });
  }, []);

  const savePropertyRecord = useCallback(
    async ({ draftProperty, initialPropertyId = "" } = {}) => {
      if (!plugin) {
        throw new Error("SDK is still initializing. Please try again.");
      }
      const resolvedId = normalizePropertyId(draftProperty?.id || initialPropertyId);
      const isPersisted = /^\d+$/.test(String(resolvedId || "").trim());
      if (isPersisted) {
        return updatePropertyRecord({
          plugin,
          id: resolvedId,
          payload: draftProperty,
        });
      }
      return createPropertyRecord({
        plugin,
        payload: draftProperty,
      });
    },
    [plugin]
  );

  const handleSaveProperty = useCallback(
    async (draftProperty) => {
      const initialPropertyId = normalizePropertyId(propertyModalState?.initialData?.id);
      const savedProperty = await savePropertyRecord({ draftProperty, initialPropertyId });
      const resolvedSavedId = normalizePropertyId(
        savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          ""
      );
      const hydratedSavedProperty = resolvedSavedId
        ? await fetchPropertyRecordById({ plugin, propertyId: resolvedSavedId }).catch(() => null)
        : null;
      const normalizedSavedProperty = normalizePropertyLookupRecord({
        ...(propertyModalState?.initialData || {}),
        ...(draftProperty || {}),
        ...(savedProperty || {}),
        ...(hydratedSavedProperty || {}),
        id:
          resolvedSavedId ||
          savedProperty?.id ||
          savedProperty?.ID ||
          draftProperty?.id ||
          propertyModalState?.initialData?.id ||
          "",
      });
      const nextId = normalizePropertyId(normalizedSavedProperty?.id);
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, [normalizedSavedProperty])
      );
      setLinkedProperties((previous) => {
        const existing = Array.isArray(previous) ? previous : [];
        return mergePropertyCollectionsIfChanged(existing, [normalizedSavedProperty]);
      });
      if (nextId) setSelectedPropertyId(nextId);
      propertySearchManualEditRef.current = false;
      setPropertySearchQuery(resolvePropertyLookupLabel(normalizedSavedProperty));
      success(
        initialPropertyId ? "Property updated" : "Property saved",
        initialPropertyId
          ? "Property details were updated."
          : "Property was saved successfully."
      );
    },
    [plugin, propertyModalState?.initialData, savePropertyRecord, success]
  );

  const handleOpenAddPropertyModal = useCallback(() => {
    setPropertyModalState({
      open: true,
      initialData: null,
    });
  }, []);

  const handleOpenEditPropertyModal = useCallback(
    (propertyRecord = null) => {
      const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
      const selectedFromLookup = dedupePropertyLookupRecords(propertyLookupRecords).find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const selectedFromLinked = linkedPropertiesSorted.find(
        (item) => normalizePropertyId(item?.id) === editableId
      );
      const editableProperty = normalizePropertyLookupRecord({
        ...(activeRelatedProperty || {}),
        ...(selectedFromLinked || {}),
        ...(selectedFromLookup || {}),
        ...(propertyRecord || {}),
      });
      setPropertyModalState({
        open: true,
        initialData: editableProperty,
      });
    },
    [activeRelatedProperty, linkedPropertiesSorted, propertyLookupRecords]
  );

  const handleSameAsContactPropertyChange = useCallback(
    async (checked) => {
      if (!checked) return;
      setIsPropertySameAsContact(true);

      if (!plugin || !inquiryNumericId) {
        setIsPropertySameAsContact(false);
        error("Property link failed", "Inquiry context is not ready.");
        return;
      }

      const sourceAddress = toText(sameAsContactPropertySource?.address1);
      const sourceSuburb = toText(sameAsContactPropertySource?.suburbTown);
      const sourceState = toText(sameAsContactPropertySource?.state);
      const sourcePostal = toText(sameAsContactPropertySource?.postalCode);
      const concatenatedSourceAddress = toText(
        sameAsContactPropertySource?.searchText ||
          joinAddress([sourceAddress, sourceSuburb, sourceState, sourcePostal])
      );
      const googleResolvedAddress = await resolveAddressFromGoogleLookup(concatenatedSourceAddress);
      const derivedPropertyName = toText(
        googleResolvedAddress?.formatted_address ||
          sameAsContactPropertySource?.propertyName ||
          concatenatedSourceAddress
      );
      const derivedAddress1 = toText(
        googleResolvedAddress?.address || sourceAddress || concatenatedSourceAddress
      );
      const derivedSuburb = toText(googleResolvedAddress?.city || sourceSuburb);
      const derivedState = toText(googleResolvedAddress?.state || sourceState);
      const derivedPostal = toText(googleResolvedAddress?.zip_code || sourcePostal);
      const derivedCountry = toText(googleResolvedAddress?.country || "AU") || "AU";
      const derivedLot = toText(googleResolvedAddress?.lot_number);
      const derivedUnit = toText(googleResolvedAddress?.unit_number);
      const searchText = toText(
        googleResolvedAddress?.formatted_address ||
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) ||
          concatenatedSourceAddress
      );

      if (!derivedAddress1 && !searchText) {
        setIsPropertySameAsContact(false);
        error(
          "Property link failed",
          "No address is available on the current account to create a property."
        );
        return;
      }

      setIsApplyingSameAsContactProperty(true);
      try {
        const searchedRecords = await searchPropertiesForLookup({
          plugin,
          query: searchText,
          limit: 25,
        });
        const normalizedSearchedRecords = dedupePropertyLookupRecords(searchedRecords || []);
        const targetComparableAddress = normalizeAddressText(
          joinAddress([derivedAddress1, derivedSuburb, derivedState, derivedPostal]) || searchText
        );
        const matchedExistingProperty =
          normalizedSearchedRecords.find(
            (record) => buildComparablePropertyAddress(record) === targetComparableAddress
          ) ||
          normalizedSearchedRecords.find((record) => {
            const comparable = buildComparablePropertyAddress(record);
            return Boolean(comparable && targetComparableAddress && comparable.includes(targetComparableAddress));
          }) ||
          null;

        let resolvedProperty = matchedExistingProperty;
        if (!resolvedProperty) {
          const createdProperty = await createPropertyRecord({
            plugin,
            payload: {
              property_name: derivedPropertyName || searchText,
              lot_number: derivedLot,
              unit_number: derivedUnit,
              address_1: derivedAddress1 || searchText,
              suburb_town: derivedSuburb,
              state: derivedState,
              postal_code: derivedPostal,
              country: derivedCountry,
            },
          });
          resolvedProperty = normalizePropertyLookupRecord(createdProperty || {});
        }

        const resolvedPropertyId = normalizePropertyId(
          resolvedProperty?.id || resolvedProperty?.ID || resolvedProperty?.Property_ID
        );
        if (!resolvedPropertyId) {
          throw new Error("Unable to resolve a property ID.");
        }

        const hydratedProperty = await fetchPropertyRecordById({
          plugin,
          propertyId: resolvedPropertyId,
        }).catch(() => null);

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            property_id: resolvedPropertyId,
            Property_ID: resolvedPropertyId,
          },
        });

        const normalizedResolvedProperty = normalizePropertyLookupRecord({
          ...(hydratedProperty || {}),
          ...resolvedProperty,
          id: resolvedPropertyId,
          address_1:
            toText(hydratedProperty?.address_1 || hydratedProperty?.address) ||
            toText(resolvedProperty?.address_1 || resolvedProperty?.address) ||
            derivedAddress1,
          suburb_town:
            toText(hydratedProperty?.suburb_town || hydratedProperty?.city) ||
            toText(resolvedProperty?.suburb_town || resolvedProperty?.city) ||
            derivedSuburb,
          state:
            toText(hydratedProperty?.state) ||
            toText(resolvedProperty?.state) ||
            derivedState,
          postal_code:
            toText(hydratedProperty?.postal_code || hydratedProperty?.zip_code) ||
            toText(resolvedProperty?.postal_code || resolvedProperty?.zip_code) ||
            derivedPostal,
          property_name:
            toText(hydratedProperty?.property_name) ||
            toText(resolvedProperty?.property_name) ||
            derivedPropertyName,
        });
        setPropertyLookupRecords((previous) =>
          mergePropertyCollectionsIfChanged(previous, [normalizedResolvedProperty])
        );
        setLinkedProperties((previous) => {
          const existing = Array.isArray(previous) ? previous : [];
          return mergePropertyCollectionsIfChanged(existing, [normalizedResolvedProperty]);
        });
        setSelectedPropertyId(resolvedPropertyId);
        propertySearchManualEditRef.current = false;
        setPropertySearchQuery(
          toText(normalizedResolvedProperty?.property_name) ||
            resolvePropertyLookupLabel(normalizedResolvedProperty)
        );

        await refreshResolvedInquiry();
        success(
          "Property linked",
          matchedExistingProperty
            ? "Matched existing property by address and linked it to inquiry."
            : "Created property from account address and linked it to inquiry."
        );
      } catch (saveError) {
        console.error("[InquiryDetails] Failed same-as-contact property flow", saveError);
        setIsPropertySameAsContact(false);
        error("Property link failed", saveError?.message || "Unable to link property.");
      } finally {
        setIsApplyingSameAsContactProperty(false);
      }
    },
    [
      error,
      inquiryNumericId,
      plugin,
      refreshResolvedInquiry,
      sameAsContactPropertySource,
      success,
    ]
  );

  const handleOpenCreateAppointmentModal = useCallback(() => {
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
    setIsAppointmentModalOpen(true);
    trackRecentActivity({
      action: "Opened create appointment",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, trackRecentActivity]);

  const handleOpenEditAppointmentModal = useCallback((record = {}, draftState = null) => {
    const appointmentId = toText(record?.id || record?.ID);
    if (!appointmentId) return;
    setAppointmentModalMode("update");
    setAppointmentModalEditingId(appointmentId);
    setAppointmentModalDraft(draftState && typeof draftState === "object" ? draftState : null);
    setIsAppointmentModalOpen(true);
    trackRecentActivity({
      action: "Opened edit appointment",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        appointment_id: appointmentId,
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, trackRecentActivity]);

  const closeAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setAppointmentModalEditingId("");
    setAppointmentModalDraft(null);
  }, []);

  const handleOpenUploadModal = useCallback(() => {
    setIsUploadsModalOpen(true);
    trackRecentActivity({
      action: "Opened uploads modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, trackRecentActivity]);

  const closeUploadsModal = useCallback(() => {
    setIsUploadsModalOpen(false);
  }, []);

  const handleCloseQuickInquiryBookingModal = useCallback(() => {
    setIsQuickInquiryBookingModalOpen(false);
  }, []);

  const dismissQuickInquirySavingToast = useCallback(() => {
    const toastId = toText(quickInquirySavingToastIdRef.current);
    if (!toastId) return;
    dismiss(toastId);
    quickInquirySavingToastIdRef.current = "";
  }, [dismiss]);

  const handleQuickInquiryBookingSavingStart = useCallback(
    (optimisticPatch = {}) => {
      setIsQuickInquiryBookingModalOpen(false);
      setResolvedInquiry((previous) => {
        const base = previous && typeof previous === "object" ? previous : {};
        const next = {
          ...base,
          ...(optimisticPatch && typeof optimisticPatch === "object" ? optimisticPatch : {}),
        };
        if (!toText(next?.id) && inquiryNumericId) {
          next.id = inquiryNumericId;
        }
        const currentSafeUid = toText(safeUid);
        if (
          !toText(next?.unique_id) &&
          currentSafeUid &&
          currentSafeUid.toLowerCase() !== "new"
        ) {
          next.unique_id = currentSafeUid;
        }
        if (!toText(next?.inquiry_status)) {
          next.inquiry_status = "New Inquiry";
        }
        return next;
      });
      dismissQuickInquirySavingToast();
      quickInquirySavingToastIdRef.current = toast({
        type: "info",
        title: "Saving inquiry...",
        description: "Please wait while details are being saved.",
        duration: 0,
      });
    },
    [dismissQuickInquirySavingToast, inquiryNumericId, safeUid, toast]
  );

  const handleQuickInquiryBookingSaved = useCallback(async (savedContext = {}) => {
    const savedPropertyId = normalizePropertyId(
      savedContext?.propertyId || savedContext?.property_id
    );
    const savedPropertyRecordValue =
      savedContext?.propertyRecord && typeof savedContext.propertyRecord === "object"
        ? savedContext.propertyRecord
        : savedContext?.property_record &&
            typeof savedContext.property_record === "object"
          ? savedContext.property_record
          : null;
    const savedPropertyRecord = savedPropertyRecordValue
      ? normalizePropertyLookupRecord({
          ...savedPropertyRecordValue,
          id:
            savedPropertyId ||
            savedPropertyRecordValue?.id ||
            savedPropertyRecordValue?.ID ||
            "",
        })
      : null;

    if (savedPropertyId) {
      setSelectedPropertyId(savedPropertyId);
    }
    if (savedPropertyRecord) {
      setPropertyLookupRecords((previous) =>
        mergePropertyCollectionsIfChanged(previous, [savedPropertyRecord])
      );
      setLinkedProperties((previous) =>
        mergePropertyCollectionsIfChanged(Array.isArray(previous) ? previous : [], [
          savedPropertyRecord,
        ])
      );
      const nextPropertyLabel = resolvePropertyLookupLabel(savedPropertyRecord);
      if (nextPropertyLabel) {
        propertySearchManualEditRef.current = false;
        setPropertySearchQuery(nextPropertyLabel);
      }
    }
    if (savedContext?.isPropertySameAsContact || savedContext?.property_same_as_contact) {
      setIsPropertySameAsContact(true);
    }

    try {
      await refreshResolvedInquiry();
      dismissQuickInquirySavingToast();
      success("Inquiry saved", "Quick inquiry details were saved.");
    } catch (refreshError) {
      dismissQuickInquirySavingToast();
      error("Refresh failed", refreshError?.message || "Inquiry saved but refresh failed.");
    }
  }, [
    dismissQuickInquirySavingToast,
    error,
    refreshResolvedInquiry,
    success,
  ]);

  const handleQuickInquiryBookingError = useCallback(
    (saveError) => {
      dismissQuickInquirySavingToast();
      setIsQuickInquiryBookingModalOpen(true);
      error("Create failed", saveError?.message || "Unable to create inquiry.");
    },
    [dismissQuickInquirySavingToast, error]
  );

  const handleQuickView = useCallback(() => {
    trackRecentActivity({
      action: "Opened quick view",
      path: currentActivityPath,
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
    setIsQuickInquiryBookingModalOpen(true);
  }, [currentActivityPath, inquiryNumericId, safeUid, trackRecentActivity]);

  const handleCreateCallback = useCallback(async () => {
    if (isCreatingCallback) return;
    if (!plugin || !inquiryNumericId) {
      error("Create callback failed", "Inquiry context is not ready.");
      return;
    }
    setIsCreatingCallback(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          call_back: true,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Created call back",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
        },
      });
      success("Callback created", "Callback request was marked on this inquiry.");
    } catch (saveError) {
      console.error("[InquiryDetails] Failed creating callback", saveError);
      error("Create callback failed", saveError?.message || "Unable to create callback.");
    } finally {
      setIsCreatingCallback(false);
    }
  }, [
    error,
    inquiryNumericId,
    isCreatingCallback,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    success,
    trackRecentActivity,
  ]);

  const handleOpenCreateQuoteModal = useCallback(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    setQuoteCreateDraft({
      quote_date: `${year}-${month}-${day}`,
      follow_up_date: "",
    });
    setIsCreateQuoteModalOpen(true);
    trackRecentActivity({
      action: "Opened create quote/job modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, trackRecentActivity]);

  const hasLinkedQuoteJob = Boolean(quoteJobIdFromRecord);

  const handleQuoteJobAction = useCallback(async () => {
    if (isCreatingQuote || isOpeningQuoteJob) return;
    if (!hasLinkedQuoteJob) {
      handleOpenCreateQuoteModal();
      return;
    }
    const linkedJobValue = toText(quoteJobIdFromRecord);
    if (!linkedJobValue) {
      handleOpenCreateQuoteModal();
      return;
    }

    setIsOpeningQuoteJob(true);
    try {
      let targetUid = "";
      if (plugin?.switchTo) {
        targetUid = await fetchJobUniqueIdById({ plugin, jobId: linkedJobValue });
      }
      const resolvedUid = toText(targetUid || linkedJobValue);
      if (!resolvedUid) {
        error("Open failed", "Unable to resolve quote/job record.");
        return;
      }
      trackRecentActivity({
        action: "Opened quote/job",
        path: `/job-details/${encodeURIComponent(resolvedUid)}`,
        pageType: "job-details",
        pageName: "Job Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          job_uid: resolvedUid,
          job_id: linkedJobValue,
        },
      });
      navigate(`/job-details/${encodeURIComponent(resolvedUid)}`);
    } catch (openError) {
      console.error("[InquiryDetails] Failed opening quote/job details", openError);
      error("Open failed", openError?.message || "Unable to open quote/job.");
    } finally {
      setIsOpeningQuoteJob(false);
    }
  }, [
    error,
    handleOpenCreateQuoteModal,
    hasLinkedQuoteJob,
    isCreatingQuote,
    isOpeningQuoteJob,
    quoteJobIdFromRecord,
    navigate,
    plugin,
    inquiryNumericId,
    safeUid,
    trackRecentActivity,
  ]);

  const handleCloseCreateQuoteModal = useCallback(() => {
    if (isCreatingQuote) return;
    setIsCreateQuoteModalOpen(false);
  }, [isCreatingQuote]);

  const handleConfirmCreateQuote = useCallback(async () => {
    if (isCreatingQuote) return;
    if (!plugin || !inquiryNumericId) {
      error("Create failed", "Inquiry context is not ready.");
      return;
    }

    const providerId = toText(serviceProviderIdResolved || selectedServiceProviderId);
    const inquiryTakenById = toText(
      selectedInquiryTakenById || inquiryTakenByStoredId || inquiryTakenByIdResolved
    );

    const propertyId = normalizePropertyId(activeRelatedProperty?.id || inquiryPropertyId);

    setIsCreatingQuote(true);
    setIsCreateQuoteModalOpen(false);
    try {
      const inquiryPayload = {
        ...(inquiry || {}),
        id: inquiryNumericId,
        ID: inquiryNumericId,
        property_id: propertyId || null,
        Property_ID: propertyId || null,
      };
      if (providerId) {
        inquiryPayload.service_provider_id = providerId;
        inquiryPayload.Service_Provider_ID = providerId;
      }
      const createdJob = await createLinkedJobForInquiry({
        plugin,
        inquiry: inquiryPayload,
        serviceProviderId: providerId || null,
        inquiryTakenById: inquiryTakenById || null,
        quoteDate: quoteCreateDraft.quote_date,
      });
      const createdJobId = toText(createdJob?.id || createdJob?.ID);
      if (createdJobId) {
        setLinkedJobSelectionOverride(createdJobId);
      }
      await refreshResolvedInquiry();
      setRelatedRecordsRefreshKey((previous) => previous + 1);
      trackRecentActivity({
        action: "Created quote/job",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          job_id: toText(createdJob?.id || createdJob?.ID),
          job_uid: toText(createdJob?.unique_id || createdJob?.Unique_ID),
        },
      });
      success(
        "Quote created",
        `Quote ${toText(createdJob?.unique_id || createdJob?.Unique_ID) || ""} created.`
      );
    } catch (createError) {
      console.error("[InquiryDetails] Create quote failed", createError);
      error("Create failed", createError?.message || "Unable to create quote.");
    } finally {
      setIsCreatingQuote(false);
    }
  }, [
    activeRelatedProperty?.id,
    error,
    inquiry,
    inquiryNumericId,
    inquiryPropertyId,
    isCreatingQuote,
    plugin,
    quoteCreateDraft.quote_date,
    refreshResolvedInquiry,
    selectedInquiryTakenById,
    selectedServiceProviderId,
    serviceProviderIdResolved,
    inquiryTakenByStoredId,
    inquiryTakenByIdResolved,
    safeUid,
    success,
    trackRecentActivity,
  ]);

  const handleMemoFileChange = useCallback((event) => {
    const nextFile = Array.from(event?.target?.files || [])[0] || null;
    setMemoFile(nextFile);
    if (event?.target) event.target.value = "";
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      error("Post failed", "No linked inquiry found for memos.");
      return;
    }
    if (!text && !memoFile) {
      error("Post failed", "Enter a message or attach a file.");
      return;
    }
    if (isPostingMemo) return;

    setIsPostingMemo(true);
    try {
      let memoFilePayload = "";
      if (memoFile) {
        const uploaded = await uploadMaterialFile({
          file: memoFile,
          uploadPath: `forum-memos/${inquiryNumericId || safeUid || "inquiry-details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      await createMemoPostForDetails({
        plugin,
        payload: {
          post_copy: text,
          post_status: "Published",
          related_inquiry_id: inquiryNumericId || null,
          related_job_id: linkedInquiryJobIdFromRecord || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      success("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[InquiryDetails] Failed posting memo", postError);
      error("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    error,
    hasMemoContext,
    inquiryNumericId,
    isPostingMemo,
    memoFile,
    memoText,
    plugin,
    refreshMemos,
    safeUid,
    linkedInquiryJobIdFromRecord,
    success,
  ]);

  const handleSendMemoReply = useCallback(
    async (postId) => {
      const normalizedPostId = toText(postId);
      const text = toText(memoReplyDrafts?.[normalizedPostId]);
      if (!normalizedPostId || !text) return;
      if (sendingReplyPostId) return;

      setSendingReplyPostId(normalizedPostId);
      try {
        await createMemoCommentForDetails({
          plugin,
          payload: {
            forum_post_id: normalizedPostId,
            comment: text,
            comment_status: "Published",
            created_at: Math.floor(Date.now() / 1000),
          },
        });
        setMemoReplyDrafts((previous) => ({
          ...(previous || {}),
          [normalizedPostId]: "",
        }));
        await refreshMemos();
        success("Reply posted", "Your reply was added.");
      } catch (replyError) {
        console.error("[InquiryDetails] Failed posting memo reply", replyError);
        error("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [error, memoReplyDrafts, plugin, refreshMemos, sendingReplyPostId, success]
  );

  const confirmDeleteMemoItem = useCallback(async () => {
    if (!memoDeleteTarget || isDeletingMemoItem) return;
    const deleteType = toText(memoDeleteTarget?.type);
    const targetId = toText(memoDeleteTarget?.id);
    if (!deleteType || !targetId) return;

    setIsDeletingMemoItem(true);
    try {
      if (deleteType === "post") {
        await deleteMemoPostForDetails({ plugin, postId: targetId });
      } else {
        await deleteMemoCommentForDetails({ plugin, commentId: targetId });
      }
      setMemoDeleteTarget(null);
      await refreshMemos();
      success("Deleted", deleteType === "post" ? "Memo deleted." : "Reply deleted.");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed deleting memo item", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [error, isDeletingMemoItem, memoDeleteTarget, plugin, refreshMemos, success]);

  const handleSavePopupComments = useCallback(async () => {
    if (isSavingPopupComment) return;

    const nextContactComment = toText(popupCommentDrafts?.contact);
    const nextCompanyComment = toText(popupCommentDrafts?.company);
    const contactChanged = nextContactComment !== contactPopupComment;
    const companyChanged = nextCompanyComment !== companyPopupComment;

    if (!contactChanged && !companyChanged) {
      setIsPopupCommentModalOpen(false);
      return;
    }

    try {
      setIsSavingPopupComment(true);

      if (contactChanged) {
        if (!inquiryContactId) {
          throw new Error("Primary contact is missing.");
        }
        await updateContactFieldsById({
          plugin,
          contactId: inquiryContactId,
          payload: {
            popup_comment: nextContactComment || null,
          },
        });
      }

      if (companyChanged) {
        if (!inquiryCompanyId) {
          throw new Error("Company is missing.");
        }
        await updateCompanyFieldsById({
          plugin,
          companyId: inquiryCompanyId,
          payload: {
            popup_comment: nextCompanyComment || null,
          },
        });
      }

      success("Saved", "Popup comment updated.");
      setIsPopupCommentModalOpen(false);
      await refreshResolvedInquiry();
    } catch (saveError) {
      console.error("[InquiryDetails] Popup comment save failed", saveError);
      error("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally {
      setIsSavingPopupComment(false);
    }
  }, [
    companyPopupComment,
    contactPopupComment,
    error,
    inquiryCompanyId,
    inquiryContactId,
    isSavingPopupComment,
    plugin,
    popupCommentDrafts,
    refreshResolvedInquiry,
    success,
  ]);

  const handleDeleteRecord = useCallback(() => {
    setIsMoreOpen(false);
    setIsDeleteRecordModalOpen(true);
    trackRecentActivity({
      action: "Opened cancel inquiry modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, trackRecentActivity]);

  const handleCloseDeleteRecordModal = useCallback(() => {
    if (isDeletingRecord) return;
    setIsDeleteRecordModalOpen(false);
  }, [isDeletingRecord]);

  const handleConfirmDeleteRecord = useCallback(async () => {
    if (isDeletingRecord) return;
    if (!plugin || !inquiryNumericId) {
      error("Delete failed", "Inquiry context is not ready.");
      return;
    }

    setIsDeletingRecord(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          inquiry_status: "Cancelled",
        },
      });
      trackRecentActivity({
        action: "Cancelled inquiry",
        path: "/",
        pageType: "dashboard",
        pageName: "Dashboard",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
        },
      });
      success("Record cancelled", "Inquiry status was updated to Cancelled.");
      setIsDeleteRecordModalOpen(false);
      navigate("/");
    } catch (deleteError) {
      console.error("[InquiryDetails] Failed cancelling inquiry", deleteError);
      error("Delete failed", deleteError?.message || "Unable to cancel inquiry.");
    } finally {
      setIsDeletingRecord(false);
    }
  }, [
    error,
    inquiryNumericId,
    isDeletingRecord,
    navigate,
    plugin,
    safeUid,
    success,
    trackRecentActivity,
  ]);

  const handleConfirmServiceProviderAllocation = useCallback(async () => {
    if (isAllocatingServiceProvider) return;
    if (!plugin || !inquiryNumericId) {
      error("Allocation failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = toText(selectedServiceProviderId);
    if (!providerId) {
      error("Allocation failed", "Select a service provider first.");
      return;
    }

    setIsAllocatingServiceProvider(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          service_provider_id: providerId,
          Service_Provider_ID: providerId,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Allocated service provider",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          service_provider_id: providerId,
        },
      });
      success("Service provider allocated", "Deal was updated with selected service provider.");
    } catch (allocationError) {
      console.error("[InquiryDetails] Service provider allocation failed", allocationError);
      error("Allocation failed", allocationError?.message || "Unable to allocate service provider.");
    } finally {
      setIsAllocatingServiceProvider(false);
    }
  }, [
    error,
    inquiryNumericId,
    isAllocatingServiceProvider,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    selectedServiceProviderId,
    success,
    trackRecentActivity,
  ]);

  const handleConfirmInquiryTakenBy = useCallback(async () => {
    if (isSavingInquiryTakenBy) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }
    const providerId = toText(selectedInquiryTakenById);
    if (!providerId) {
      error("Save failed", "Select admin first.");
      return;
    }

    setIsSavingInquiryTakenBy(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          Inquiry_Taken_By_id: providerId,
        },
      });
      await refreshResolvedInquiry();
      trackRecentActivity({
        action: "Updated inquiry taken by",
        pageType: "inquiry-details",
        pageName: "Inquiry Details",
        metadata: {
          inquiry_id: toText(inquiryNumericId),
          inquiry_uid: toText(safeUid),
          inquiry_taken_by_id: providerId,
        },
      });
      success("Inquiry taken by updated", "Inquiry was updated with selected admin.");
    } catch (saveError) {
      console.error("[InquiryDetails] Inquiry taken by update failed", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry taken by.");
    } finally {
      setIsSavingInquiryTakenBy(false);
    }
  }, [
    error,
    inquiryNumericId,
    isSavingInquiryTakenBy,
    plugin,
    refreshResolvedInquiry,
    safeUid,
    selectedInquiryTakenById,
    success,
    trackRecentActivity,
  ]);

  const handleOpenInquiryDetailsEditor = useCallback(() => {
    setInquiryDetailsForm({
      ...INQUIRY_DETAILS_EDIT_EMPTY_FORM,
      ...(inquiryDetailsInitialForm || {}),
    });
    setIsInquiryDetailsModalOpen(true);
    trackRecentActivity({
      action: "Opened inquiry edit modal",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryDetailsInitialForm, inquiryNumericId, safeUid, trackRecentActivity]);

  const handleCloseInquiryDetailsEditor = useCallback(() => {
    if (isSavingInquiryDetails) return;
    setIsInquiryDetailsModalOpen(false);
  }, [isSavingInquiryDetails]);

  const handleSaveInquiryDetails = useCallback(async () => {
    if (isSavingInquiryDetails) return;
    if (!plugin || !inquiryNumericId) {
      error("Save failed", "Inquiry context is not ready.");
      return;
    }

    const normalizedServiceInquiryId = normalizeServiceInquiryId(inquiryDetailsForm.service_inquiry_id);
    const payload = {
      inquiry_status: toNullableText(inquiryDetailsForm.inquiry_status),
      inquiry_source: toNullableText(inquiryDetailsForm.inquiry_source),
      type: toNullableText(inquiryDetailsForm.type),
      service_inquiry_id: normalizedServiceInquiryId
        ? /^\d+$/.test(normalizedServiceInquiryId)
          ? Number.parseInt(normalizedServiceInquiryId, 10)
          : normalizedServiceInquiryId
        : null,
      how_can_we_help: toNullableText(inquiryDetailsForm.how_can_we_help),
      how_did_you_hear: toNullableText(inquiryDetailsForm.how_did_you_hear),
      other: toNullableText(inquiryDetailsForm.other),
      admin_notes: toNullableText(inquiryDetailsForm.admin_notes),
      client_notes: toNullableText(inquiryDetailsForm.client_notes),
      date_job_required_by: toUnixSeconds(inquiryDetailsForm.date_job_required_by),
      renovations: toNullableText(inquiryDetailsForm.renovations),
      resident_availability: toNullableText(inquiryDetailsForm.resident_availability),
      noise_signs_options_as_text: toNullableText(inquiryDetailsForm.noise_signs_options_as_text),
      pest_active_times_options_as_text: toNullableText(
        inquiryDetailsForm.pest_active_times_options_as_text
      ),
      pest_location_options_as_text: toNullableText(inquiryDetailsForm.pest_location_options_as_text),
    };

    setIsSavingInquiryDetails(true);
    try {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload,
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Inquiry details were updated.");
      setIsInquiryDetailsModalOpen(false);
    } catch (saveError) {
      console.error("[InquiryDetails] Failed to update inquiry details", saveError);
      error("Save failed", saveError?.message || "Unable to update inquiry details.");
    } finally {
      setIsSavingInquiryDetails(false);
    }
  }, [
    error,
    inquiryDetailsForm.admin_notes,
    inquiryDetailsForm.client_notes,
    inquiryDetailsForm.date_job_required_by,
    inquiryDetailsForm.how_can_we_help,
    inquiryDetailsForm.how_did_you_hear,
    inquiryDetailsForm.inquiry_source,
    inquiryDetailsForm.inquiry_status,
    inquiryDetailsForm.noise_signs_options_as_text,
    inquiryDetailsForm.other,
    inquiryDetailsForm.pest_active_times_options_as_text,
    inquiryDetailsForm.pest_location_options_as_text,
    inquiryDetailsForm.renovations,
    inquiryDetailsForm.resident_availability,
    inquiryDetailsForm.service_inquiry_id,
    inquiryDetailsForm.type,
    inquiryNumericId,
    isSavingInquiryDetails,
    plugin,
    refreshResolvedInquiry,
    success,
  ]);

  const flushQuickListSelectionField = useCallback(
    async (field) => {
      const normalizedField = toText(field);
      if (!normalizedField || !plugin || !inquiryNumericId) return;
      if (listSelectionSyncingRef.current[normalizedField]) return;

      listSelectionSyncingRef.current[normalizedField] = true;
      let lastSyncedSignature = "";
      let didFail = false;
      try {
        while (true) {
          const desiredCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? [...listSelectionDesiredRef.current[normalizedField]]
            : [];
          const desiredSignature = desiredCodes.join("|");
          lastSyncedSignature = desiredSignature;
          await updateInquiryFieldsById({
            plugin,
            inquiryId: inquiryNumericId,
            payload: {
              [normalizedField]: serializeListSelectionValue(desiredCodes),
            },
          });
          const latestCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? listSelectionDesiredRef.current[normalizedField]
            : [];
          if (latestCodes.join("|") === desiredSignature) break;
        }

        await refreshResolvedInquiry();
      } catch (removeError) {
        didFail = true;
        console.error("[InquiryDetails] Failed to remove list selection tag", removeError);
        error("Update failed", removeError?.message || "Unable to remove selection.");
        try {
          await refreshResolvedInquiry();
        } catch (refreshError) {
          console.error("[InquiryDetails] Failed refreshing inquiry after list tag failure", refreshError);
        }
      } finally {
        listSelectionSyncingRef.current[normalizedField] = false;

        const desiredNow = Array.isArray(listSelectionDesiredRef.current[normalizedField])
          ? listSelectionDesiredRef.current[normalizedField].join("|")
          : "";
        const shouldClearFieldState = didFail || desiredNow === lastSyncedSignature;

        if (shouldClearFieldState) {
          delete listSelectionDesiredRef.current[normalizedField];
          setOptimisticListSelectionByField((previous) => {
            if (!(normalizedField in previous)) return previous;
            const next = { ...previous };
            delete next[normalizedField];
            return next;
          });
          setRemovingListTagKeys((previous) => {
            const nextEntries = Object.entries(previous).filter(
              ([key]) => !key.startsWith(`${normalizedField}:`)
            );
            if (nextEntries.length === Object.keys(previous).length) return previous;
            return Object.fromEntries(nextEntries);
          });
        } else {
          void flushQuickListSelectionField(normalizedField);
        }
      }
    },
    [error, inquiryNumericId, plugin, refreshResolvedInquiry]
  );

  const handleQuickRemoveListSelectionTag = useCallback(
    ({ field, rawValue, options, tag }) => {
      if (!plugin || !inquiryNumericId) {
        error("Update failed", "Inquiry context is not ready.");
        return;
      }
      const normalizedField = toText(field);
      if (!normalizedField) return;

      const tagCode = toText(tag?.code || tag?.key);
      const tagLabel = toText(tag?.label || tagCode) || "value";
      const optimisticCodes = optimisticListSelectionByField[normalizedField];
      const currentCodes = Array.isArray(optimisticCodes)
        ? optimisticCodes
        : parseListSelectionValue(rawValue, options);
      const nextCodes = tagCode
        ? currentCodes.filter((code) => toText(code) !== tagCode)
        : [];
      if (tagCode && nextCodes.length === currentCodes.length) return;

      listSelectionDesiredRef.current[normalizedField] = nextCodes;
      setOptimisticListSelectionByField((previous) => ({
        ...previous,
        [normalizedField]: nextCodes,
      }));
      setRemovingListTagKeys((previous) => ({
        ...previous,
        [`${normalizedField}:${tagCode || tagLabel}`]: true,
      }));

      void flushQuickListSelectionField(normalizedField);
    },
    [
      error,
      flushQuickListSelectionField,
      inquiryNumericId,
      optimisticListSelectionByField,
      plugin,
    ]
  );

  const isListSelectionTagRemoving = useCallback(
    (field, tag) =>
      Boolean(
        removingListTagKeys[`${toText(field)}:${toText(tag?.code || tag?.key || tag?.label)}`]
      ),
    [removingListTagKeys]
  );

  const handleOpenAccountEditor = useCallback(() => {
    if (!plugin || !inquiryNumericId) return;
    const currentMode = isCompanyAccount ? "entity" : "individual";

    const handleSaveAccount = async (draftRecord, context = {}) => {
      const mode = toText(context?.mode || currentMode).toLowerCase() === "entity"
        ? "entity"
        : "individual";

      if (mode === "entity") {
        const companyName = toText(draftRecord?.name);
        if (!companyName) {
          throw new Error("Company name is required.");
        }
        const companyPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          name: companyName,
        };
        delete companyPayload.primary_contact_id;
        delete companyPayload.Primary_Contact_ID;
        if (companyPayload?.Primary_Person && typeof companyPayload.Primary_Person === "object") {
          const compactPrimaryPerson = compactStringFields(companyPayload.Primary_Person);
          if (Object.keys(compactPrimaryPerson).length) {
            companyPayload.Primary_Person = compactPrimaryPerson;
          } else {
            delete companyPayload.Primary_Person;
          }
        }
        const existingCompanyId = toText(
          companyPayload?.id || companyPayload?.ID || companyPayload?.Company_ID
        );

        let companyId = existingCompanyId;
        if (existingCompanyId) {
          await updateCompanyFieldsById({
            plugin,
            companyId: existingCompanyId,
            payload: companyPayload,
          });
        } else {
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          companyId = toText(createdCompany?.id || createdCompany?.ID);
        }
        if (!companyId) {
          throw new Error("Unable to resolve company ID.");
        }
        const preservedPrimaryContactId = toText(
          inquiryPrimaryContact?.id ||
            inquiry?.primary_contact_id ||
            inquiry?.Primary_Contact_ID
        );

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            account_type: "Company",
            Account_Type: "Company",
            company_id: companyId,
            Company_ID: companyId,
            primary_contact_id: preservedPrimaryContactId || null,
            Primary_Contact_ID: preservedPrimaryContactId || null,
          },
        });
        await refreshResolvedInquiry();
        success("Inquiry updated", "Company account was linked and inquiry contact was preserved.");
        return;
      }

      const existingContactId = toText(
        draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
      );
      const savedContact = existingContactId
        ? await updateContactRecord({
            plugin,
            id: existingContactId,
            payload: draftRecord || {},
          })
        : await createContactRecord({
            plugin,
            payload: draftRecord || {},
          });
      const contactId = toText(savedContact?.id || savedContact?.ID || existingContactId);
      if (!contactId) {
        throw new Error("Unable to resolve contact ID.");
      }

      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          account_type: "Contact",
          Account_Type: "Contact",
          primary_contact_id: contactId,
          Primary_Contact_ID: contactId,
          company_id: toText(inquiryCompany?.id) || null,
          Company_ID: toText(inquiryCompany?.id) || null,
        },
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Contact account was linked and company was preserved.");
    };

    openContactDetailsModal({
      mode: currentMode,
      onSave: handleSaveAccount,
      allowModeSwitch: true,
      titleVerb: "Update",
      initialValues:
        currentMode === "entity"
          ? accountEditorCompanyInitialValues
          : accountEditorContactInitialValues,
      onModeChange: (nextMode) => {
        const normalizedMode = toText(nextMode).toLowerCase() === "entity" ? "entity" : "individual";
        setContactModalState((previous) => ({
          ...previous,
          mode: normalizedMode,
          initialValues:
            normalizedMode === "entity"
              ? accountEditorCompanyInitialValues
              : accountEditorContactInitialValues,
        }));
      },
    });
  }, [
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    inquiryNumericId,
    inquiryCompany,
    inquiryPrimaryContact,
    isCompanyAccount,
    openContactDetailsModal,
    plugin,
    refreshResolvedInquiry,
    success,
  ]);

  const handleOpenTasksModal = () => {
    if (!inquiryNumericId) return;
    setIsTasksModalOpen(true);
    trackRecentActivity({
      action: "Opened manage tasks",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  };
  const handleCloseTasksModal = () => {
    setIsTasksModalOpen(false);
  };

  const handleCopyUid = useCallback(async () => {
    if (!safeUid) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeUid);
      } else {
        throw new Error("Clipboard API is unavailable.");
      }
      success("UID copied", safeUid);
    } catch (copyError) {
      error("Copy failed", copyError?.message || "Unable to copy UID.");
    }
  }, [error, safeUid, success]);
  const handleCopyFieldValue = useCallback(
    async ({ label, value }) => {
      const text = toText(value);
      if (!text) return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error("Clipboard API is unavailable.");
        }
        success(`${label} copied`, text);
      } catch (copyError) {
        error("Copy failed", copyError?.message || "Unable to copy value.");
      }
    },
    [error, success]
  );
  const openRelatedRecord = useCallback(
    (uniqueId) => {
      const nextUid = toText(uniqueId);
      if (!nextUid) return;
      navigate(`/job-details/${encodeURIComponent(nextUid)}`);
    },
    [navigate]
  );
  const handleOpenRecentActivityItem = useCallback(
    (activity = {}) => {
      const targetPath = toText(activity?.path);
      if (!targetPath) return;
      const targetPageType =
        normalizeLegacyInquiryPageType(activity?.page_type) ||
        resolveActivityPageType(targetPath);
      trackRecentActivity({
        action: "Opened recent activity",
        path: targetPath,
        pageType: targetPageType,
        pageName: toText(activity?.page_name) || resolveActivityPageName(targetPageType),
      });
      navigate(targetPath);
    },
    [navigate, trackRecentActivity]
  );
  const handleToggleRelatedJobLink = useCallback(
    async (jobRecord = {}) => {
      if (isSavingLinkedJob) return;
      if (!plugin || !inquiryNumericId) {
        error("Save failed", "Inquiry context is not ready.");
        return;
      }
      const jobUniqueId = toText(jobRecord?.unique_id || jobRecord?.Unique_ID);
      let resolvedJobId = toText(
        jobRecord?.id || jobRecord?.ID || (jobUniqueId ? relatedJobIdByUid[jobUniqueId] : "")
      );
      if (!resolvedJobId && jobUniqueId) {
        resolvedJobId = toText(await fetchJobIdByUniqueId({ plugin, uniqueId: jobUniqueId }));
        if (resolvedJobId) {
          setRelatedJobIdByUid((previous) =>
            toText(previous[jobUniqueId]) === resolvedJobId
              ? previous
              : { ...previous, [jobUniqueId]: resolvedJobId }
          );
        }
      }
      if (!resolvedJobId) {
        error("Save failed", "Selected job is missing a record ID.");
        return;
      }

      const currentlySelected = toText(selectedRelatedJobId);
      const shouldUnselect =
        Boolean(currentlySelected) &&
        (currentlySelected === resolvedJobId || (jobUniqueId && currentlySelected === jobUniqueId));
      const nextLinkedJobId = shouldUnselect ? "" : resolvedJobId;

      setLinkedJobSelectionOverride(nextLinkedJobId);
      setIsSavingLinkedJob(true);
      try {
        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            inquiry_for_job_id: nextLinkedJobId,
          },
        });
        await refreshResolvedInquiry();
        if (shouldUnselect) {
          success("Job unlinked", "Inquiry job link was removed.");
        } else {
          success(
            "Job linked",
            `Inquiry linked to ${jobUniqueId || resolvedJobId || "selected job"}.`
          );
        }
      } catch (saveError) {
        console.error("[InquiryDetails] Failed to update inquiry linked job", saveError);
        setLinkedJobSelectionOverride(undefined);
        error("Save failed", saveError?.message || "Unable to update linked job.");
      } finally {
        setIsSavingLinkedJob(false);
      }
    },
    [
      error,
      inquiryNumericId,
      isSavingLinkedJob,
      plugin,
      refreshResolvedInquiry,
      relatedJobIdByUid,
      selectedRelatedJobId,
      success,
    ]
  );
  const handleInquiryDetailsTextFieldChange = useCallback(
    (field) => (event) => {
      const nextValue = String(event?.target?.value ?? "");
      setInquiryDetailsForm((previous) =>
        previous[field] === nextValue ? previous : { ...previous, [field]: nextValue }
      );
    },
    []
  );

  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']" data-page="inquiry-details">
      <GlobalTopHeader />

      <section className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="w-full px-2">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
            <div className="min-w-0 flex items-center gap-3">
              <Link
                to="/"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
                aria-label="Back to dashboard"
              >
                <TitleBackIcon className="h-4 w-4" />
              </Link>
              <div className="min-w-0 flex items-center gap-2">
                <div className="truncate text-sm font-semibold text-slate-900">
                  Inquiry Details
                </div>
                {hasUid ? (
                  <>
                    {externalInquiryUrl ? (
                      <a
                        href={externalInquiryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="uid-link hover:text-blue-800"
                        title={`Open inquiry ${inquiryNumericId} in Ontraport`}
                      >
                        {safeUid}
                      </a>
                    ) : (
                      <span className="uid-text">{safeUid}</span>
                    )}
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                      onClick={handleCopyUid}
                      title="Copy UID"
                      aria-label="Copy UID"
                    >
                      <CopyIcon />
                    </button>
                  </>
                ) : null}
              </div>
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={headerInquiryStatusStyle}
              >
                {headerInquiryStatusLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
                    <span className="service-provider-allocation-legend">Service Provider</span>
                    <SearchDropdownInput
                      label=""
                      field="service_provider_allocation"
                      value={serviceProviderSearch}
                      placeholder="Allocate service provider"
                      items={serviceProviderSearchItems}
                      onValueChange={(value) => {
                        setServiceProviderSearch(value);
                        setSelectedServiceProviderId("");
                      }}
                      onSelect={(item) => {
                        const providerId = toText(item?.id);
                        setSelectedServiceProviderId(providerId);
                        setServiceProviderSearch(toText(item?.valueLabel || item?.label));
                      }}
                      onAdd={handleConfirmServiceProviderAllocation}
                      addButtonLabel={
                        isAllocatingServiceProvider ? "Allocating..." : "Confirm Allocation"
                      }
                      closeOnSelect={false}
                      autoConfirmOnClose
                      emptyText={
                        isServiceProviderLookupLoading
                          ? "Loading service providers..."
                          : "No service providers found."
                      }
                      rootData={{
                        className: "service-provider-allocation-root w-full",
                        "data-search-root": "service-provider-allocation",
                      }}
                    />
                  </div>
                  <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
                    <span className="service-provider-allocation-legend">Inquiry Taken By</span>
                    <SearchDropdownInput
                      label=""
                      field="inquiry_taken_by_allocation"
                      value={inquiryTakenBySearch}
                      placeholder="Set inquiry taken by"
                      items={inquiryTakenBySearchItems}
                      onValueChange={(value) => {
                        setInquiryTakenBySearch(value);
                        setSelectedInquiryTakenById("");
                      }}
                      onSelect={(item) => {
                        const providerId = toText(item?.id);
                        setSelectedInquiryTakenById(providerId);
                        setInquiryTakenBySearch(toText(item?.valueLabel || item?.label));
                      }}
                      onAdd={handleConfirmInquiryTakenBy}
                      addButtonLabel={isSavingInquiryTakenBy ? "Saving..." : "Confirm Selection"}
                      closeOnSelect={false}
                      autoConfirmOnClose
                      emptyText={
                        isInquiryTakenByLookupLoading
                          ? "Loading admins..."
                          : "No admin records found."
                      }
                      rootData={{
                        className: "service-provider-allocation-root w-full",
                        "data-search-root": "inquiry-taken-by-allocation",
                      }}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 whitespace-nowrap px-3 !text-xs"
                    onClick={handleCreateCallback}
                    disabled={!inquiryNumericId || isCreatingCallback}
                  >
                    {isCreatingCallback ? "Creating..." : "Create Call Back"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 whitespace-nowrap px-3 !text-xs"
                    onClick={handleOpenTasksModal}
                    disabled={!inquiryNumericId}
                  >
                    Manage Tasks
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 whitespace-nowrap px-3 !text-xs"
                    onClick={() => {
                      if (!isQuickInquiryBookingMode) {
                        handleQuickView();
                        return;
                      }
                      setIsQuickInquiryBookingModalOpen(true);
                    }}
                  >
                    Quick View
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 whitespace-nowrap px-3 !text-xs"
                    onClick={handleQuoteJobAction}
                    disabled={!inquiryNumericId || isCreatingQuote || isOpeningQuoteJob}
                  >
                    {isCreatingQuote
                      ? "Creating Quote/Job..."
                      : isOpeningQuoteJob
                        ? "Opening Quote/Job..."
                        : hasLinkedQuoteJob
                        ? "View Quote/Job"
                        : "Create Quote/Job"}
                  </Button>
                  <div className="relative" ref={moreMenuRef}>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 whitespace-nowrap px-3 !text-xs"
                      onClick={() => setIsMoreOpen((previous) => !previous)}
                      aria-haspopup="menu"
                      aria-expanded={isMoreOpen}
                    >
                      More
                      <ChevronDownIcon />
                    </Button>
                    {isMoreOpen ? (
                      <div className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                        <button
                          type="button"
                          className={`block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 ${
                            isDeletingRecord ? "pointer-events-none opacity-50" : ""
                          }`}
                          onClick={handleDeleteRecord}
                        >
                          Delete Record
                        </button>
                      </div>
                    ) : null}
                  </div>
            </div>
          </div>
        </div>
      </section>
      <JobDirectStoreProvider
        jobUid={hasUid ? safeUid : null}
        jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
        lookupData={workspaceLookupData}
      >
      <TasksModal
        open={isTasksModalOpen}
        onClose={handleCloseTasksModal}
        plugin={plugin}
        contextType="deal"
        contextId={inquiryNumericId}
        jobData={{
          ...(resolvedInquiry || {}),
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
          inquiry_record_id: inquiryNumericId,
          Inquiry_Record_ID: inquiryNumericId,
        }}
        additionalCreatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
        additionalUpdatePayload={{
          deal_id: inquiryNumericId,
          Deal_id: inquiryNumericId,
        }}
      />
      <ContactDetailsModal
        open={contactModalState.open}
        onClose={closeContactDetailsModal}
        mode={contactModalState.mode}
        plugin={plugin}
        onSave={contactModalState.onSave}
        onModeChange={contactModalState.onModeChange}
        allowModeSwitch={contactModalState.allowModeSwitch}
        titleVerb={contactModalState.titleVerb}
        initialValues={contactModalState.initialValues}
        useTopLookupSearch
        enableInlineDuplicateLookup
      />
      <QuickInquiryBookingModal
        open={isQuickInquiryBookingModalOpen}
        onClose={handleCloseQuickInquiryBookingModal}
        plugin={plugin}
        inquiryId={inquiryNumericId}
        prefillContext={quickInquiryPrefillContext}
        configuredAdminProviderId={configuredAdminProviderId}
        onSavingStart={handleQuickInquiryBookingSavingStart}
        onSaved={handleQuickInquiryBookingSaved}
        onError={handleQuickInquiryBookingError}
      />
      <AddPropertyModal
        open={propertyModalState.open}
        onClose={closePropertyModal}
        onSave={handleSaveProperty}
        initialData={propertyModalState.initialData}
        plugin={plugin}
      />
      <Modal
        open={isInquiryDetailsModalOpen}
        onClose={handleCloseInquiryDetailsEditor}
        title="Edit Inquiry & Request Details"
        widthClass="max-w-5xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseInquiryDetailsEditor}
              disabled={isSavingInquiryDetails}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSaveInquiryDetails}
              disabled={isSavingInquiryDetails}
            >
              {isSavingInquiryDetails ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="max-h-[72vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <ColorMappedSelectInput
              label="Inquiry Status"
              field="inquiry_status"
              options={INQUIRY_STATUS_OPTIONS}
              value={inquiryDetailsForm.inquiry_status}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, inquiry_status: nextValue }))
              }
            />
            <SelectInput
              label="Inquiry Source"
              field="inquiry_source"
              options={INQUIRY_SOURCE_OPTIONS}
              value={inquiryDetailsForm.inquiry_source}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, inquiry_source: nextValue }))
              }
            />
            <SelectInput
              label="Type"
              field="type"
              options={INQUIRY_TYPE_OPTIONS}
              value={inquiryDetailsForm.type}
              onChange={(nextValue) =>
                setInquiryDetailsForm((previous) => ({ ...previous, type: nextValue }))
              }
            />
            {inquiryEditFlowRule.showServiceInquiry ? (
              <SelectInput
                label={isInquiryServiceLookupLoading ? "Select Service (Loading...)" : "Select Service"}
                field="service_inquiry_id"
                options={resolvedInquiryServiceOptions}
                value={inquiryDetailsForm.service_inquiry_id}
                onChange={(nextValue) =>
                  setInquiryDetailsForm((previous) => ({
                    ...previous,
                    service_inquiry_id: normalizeServiceInquiryId(nextValue),
                  }))
                }
              />
            ) : null}
            {inquiryEditFlowRule.showHowDidYouHear ? (
              <SelectInput
                label="How Did You Hear About Us"
                field="how_did_you_hear"
                options={HOW_DID_YOU_HEAR_OPTIONS}
                value={inquiryDetailsForm.how_did_you_hear}
                onChange={(nextValue) =>
                  setInquiryDetailsForm((previous) => ({ ...previous, how_did_you_hear: nextValue }))
                }
              />
            ) : null}
            {inquiryEditFlowRule.showHowDidYouHear && shouldShowInquiryEditOther ? (
              <InputField
                label="Other"
                field="other"
                value={inquiryDetailsForm.other}
                onChange={handleInquiryDetailsTextFieldChange("other")}
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField
              label="Date Job Required By"
              type="date"
              field="date_job_required_by"
              value={inquiryDetailsForm.date_job_required_by}
              onChange={handleInquiryDetailsTextFieldChange("date_job_required_by")}
            />
            <InputField
              label="Renovations"
              field="renovations"
              value={inquiryDetailsForm.renovations}
              onChange={handleInquiryDetailsTextFieldChange("renovations")}
            />
            <InputField
              label="Resident Availability"
              field="resident_availability"
              value={inquiryDetailsForm.resident_availability}
              onChange={handleInquiryDetailsTextFieldChange("resident_availability")}
            />
          </div>

          <div className="rounded border border-slate-200 bg-slate-50">
            <button
              type="button"
              className="flex w-full items-center justify-between px-3 py-2 text-left"
              onClick={() => setIsInquiryEditPestAccordionOpen((previous) => !previous)}
              aria-expanded={isInquiryEditPestAccordionOpen}
            >
              <span className="type-label text-slate-700">Pest Details</span>
              <span className="text-xs font-semibold text-slate-600">
                {isInquiryEditPestAccordionOpen ? "⌃" : "⌄"}
              </span>
            </button>
            {isInquiryEditPestAccordionOpen ? (
              <div className="space-y-3 border-t border-slate-200 bg-white px-3 py-3">
                <InquiryEditListSelectionField
                  label="Noise Signs"
                  field="noise_signs_options_as_text"
                  value={inquiryDetailsForm.noise_signs_options_as_text}
                  options={NOISE_SIGN_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      noise_signs_options_as_text: nextValue,
                    }))
                  }
                />
                <InquiryEditListSelectionField
                  label="Pest Active Times"
                  field="pest_active_times_options_as_text"
                  value={inquiryDetailsForm.pest_active_times_options_as_text}
                  options={PEST_ACTIVE_TIME_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      pest_active_times_options_as_text: nextValue,
                    }))
                  }
                />
                <InquiryEditListSelectionField
                  label="Pest Location"
                  field="pest_location_options_as_text"
                  value={inquiryDetailsForm.pest_location_options_as_text}
                  options={PEST_LOCATION_OPTIONS}
                  onChange={(nextValue) =>
                    setInquiryDetailsForm((previous) => ({
                      ...previous,
                      pest_location_options_as_text: nextValue,
                    }))
                  }
                />
              </div>
            ) : null}
          </div>

          {inquiryEditFlowRule.showHowCanWeHelp ? (
            <div className="md:col-span-2">
              <InquiryEditTextArea
                label="How Can We Help"
                field="how_can_we_help"
                value={inquiryDetailsForm.how_can_we_help}
                onChange={handleInquiryDetailsTextFieldChange("how_can_we_help")}
                placeholder="Describe the inquiry details..."
                rows={5}
              />
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InquiryEditTextArea
              label="Admin Notes"
              field="admin_notes"
              value={inquiryDetailsForm.admin_notes}
              onChange={handleInquiryDetailsTextFieldChange("admin_notes")}
              rows={6}
            />
            <InquiryEditTextArea
              label="Client Notes"
              field="client_notes"
              value={inquiryDetailsForm.client_notes}
              onChange={handleInquiryDetailsTextFieldChange("client_notes")}
              rows={6}
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={isAppointmentModalOpen}
        onClose={closeAppointmentModal}
        title={appointmentModalMode === "update" ? "Edit Appointment" : "Add Appointment"}
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          <AppointmentTabSection
            plugin={plugin}
            jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
            preloadedLookupData={workspaceLookupData}
            inquiryRecordId={inquiryNumericId}
            inquiryUid={safeUid}
            mode={appointmentModalMode}
            editingAppointmentId={appointmentModalEditingId}
            draft={appointmentModalDraft}
            prefillContext={inquiryAppointmentPrefillContext}
            layoutMode="form"
            hideStatusFieldInForm
          />
        </div>
      </Modal>
      <Modal
        open={isUploadsModalOpen}
        onClose={closeUploadsModal}
        title="Add Uploads"
        widthClass="max-w-[min(96vw,1280px)]"
      >
        <div className="max-h-[78vh] overflow-y-auto pr-1">
          {inquiryNumericId ? (
            <UploadsSection
              plugin={plugin}
              jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
              uploadsMode="inquiry"
              inquiryId={inquiryNumericId}
              inquiryUid={safeUid}
              linkedJobId={linkedInquiryJobIdFromRecord}
              additionalCreatePayload={{
                inquiry_id: inquiryNumericId,
                Inquiry_ID: inquiryNumericId,
                inquiry_record_id: inquiryNumericId,
                Inquiry_Record_ID: inquiryNumericId,
                job_id: linkedInquiryJobIdFromRecord || null,
                Job_ID: linkedInquiryJobIdFromRecord || null,
                ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
              }}
              layoutMode="form"
              enableFormUploads
            />
          ) : (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Inquiry record ID is required to add uploads.
            </div>
          )}
        </div>
      </Modal>
      <Modal
        open={isCreateQuoteModalOpen}
        onClose={handleCloseCreateQuoteModal}
        title="Create Quote/Job"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseCreateQuoteModal}
              disabled={isCreatingQuote}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmCreateQuote}
              disabled={isCreatingQuote}
            >
              {isCreatingQuote ? "Creating..." : "Create Quote/Job"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <InputField
            label="Quote Date"
            type="date"
            field="quote_date"
            value={quoteCreateDraft.quote_date}
            onChange={(event) =>
              setQuoteCreateDraft((previous) => ({
                ...previous,
                quote_date: String(event?.target?.value || ""),
              }))
            }
          />
        </div>
      </Modal>
      <Modal
        open={isDeleteRecordModalOpen}
        onClose={handleCloseDeleteRecordModal}
        title="Delete Record"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseDeleteRecordModal}
              disabled={isDeletingRecord}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteRecord}
              disabled={isDeletingRecord}
            >
              {isDeletingRecord ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          This will mark the inquiry status as <strong>Cancelled</strong> and return you to the
          dashboard.
        </p>
      </Modal>
      <Modal
        open={isPopupCommentModalOpen}
        onClose={() => {
          if (isSavingPopupComment) return;
          setPopupCommentDrafts({
            contact: contactPopupComment,
            company: companyPopupComment,
          });
          setIsPopupCommentModalOpen(false);
        }}
        title="Popup Comments"
        widthClass="max-w-2xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setPopupCommentDrafts({
                  contact: contactPopupComment,
                  company: companyPopupComment,
                });
                setIsPopupCommentModalOpen(false);
              }}
              disabled={isSavingPopupComment}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSavePopupComments}
              disabled={isSavingPopupComment}
            >
              {isSavingPopupComment ? "Saving..." : "Save"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {showContactDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Primary Contact Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.contact}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    contact: event.target.value,
                  }))
                }
                placeholder="Add popup comment for primary contact"
              />
            </div>
          ) : null}

          {showCompanyDetails ? (
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Company Comment
              </label>
              <textarea
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-[#003882] focus:outline-none focus:ring-2 focus:ring-[#003882]/20"
                rows={5}
                value={popupCommentDrafts.company}
                onChange={(event) =>
                  setPopupCommentDrafts((previous) => ({
                    ...(previous || {}),
                    company: event.target.value,
                  }))
                }
                placeholder="Add popup comment for company"
              />
            </div>
          ) : null}
        </div>
      </Modal>
      <Modal
        open={Boolean(memoDeleteTarget)}
        onClose={() => {
          if (isDeletingMemoItem) return;
          setMemoDeleteTarget(null);
        }}
        title={toText(memoDeleteTarget?.type) === "post" ? "Delete Memo" : "Delete Reply"}
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMemoDeleteTarget(null)}
              disabled={isDeletingMemoItem}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteMemoItem}
              disabled={isDeletingMemoItem}
            >
              {isDeletingMemoItem ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          {toText(memoDeleteTarget?.type) === "post"
            ? "Are you sure you want to delete this memo?"
            : "Are you sure you want to delete this reply?"}
        </p>
      </Modal>

      <section
        className="w-full px-2 py-2"
        data-page="inquiry-details"
        data-inquiry-uid={safeUid}
      >
        {!hasUid && !isQuickInquiryBookingMode ? (
          <div className="mb-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
            Open this page with a valid inquiry UID to load inquiry details.
          </div>
        ) : null}

        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AccountDetailsSection
            isLoading={isInquiryInitialLoadInProgress}
            editDisabled={!inquiryNumericId}
            onEdit={handleOpenAccountEditor}
            onCopy={handleCopyFieldValue}
            safeUid={safeUid}
            accountType={accountType}
            showContactDetails={showContactDetails}
            hasAccountContactFields={hasAccountContactFields}
            accountContactName={accountContactName}
            accountContactEmail={accountContactEmail}
            accountContactEmailHref={accountContactEmailHref}
            accountContactPhone={accountContactPhone}
            accountContactPhoneHref={accountContactPhoneHref}
            accountContactAddress={accountContactAddress}
            accountContactAddressHref={accountContactAddressHref}
            showCompanyDetails={showCompanyDetails}
            hasAccountCompanyFields={hasAccountCompanyFields}
            accountCompanyName={accountCompanyName}
            accountCompanyPhone={accountCompanyPhone}
            accountCompanyPhoneHref={accountCompanyPhoneHref}
            accountCompanyPrimaryName={accountCompanyPrimaryName}
            accountCompanyPrimaryEmail={accountCompanyPrimaryEmail}
            accountCompanyPrimaryEmailHref={accountCompanyPrimaryEmailHref}
            accountCompanyPrimaryPhone={accountCompanyPrimaryPhone}
            accountCompanyPrimaryPhoneHref={accountCompanyPrimaryPhoneHref}
            accountCompanyAddress={accountCompanyAddress}
            accountCompanyAddressHref={accountCompanyAddressHref}
            isBodyCorpAccount={isBodyCorpAccount}
            hasBodyCorpDetails={hasBodyCorpDetails}
            accountBodyCorpName={accountBodyCorpName}
            accountBodyCorpType={accountBodyCorpType}
            accountBodyCorpPhone={accountBodyCorpPhone}
            accountBodyCorpPhoneHref={accountBodyCorpPhoneHref}
            accountBodyCorpAddress={accountBodyCorpAddress}
            accountBodyCorpAddressHref={accountBodyCorpAddressHref}
          />

          <DetailsCard
            title="Inquiry & Request Details"
            onEdit={handleOpenInquiryDetailsEditor}
            editDisabled={!inquiryNumericId}
            className={isInquiryRequestExpanded ? "xl:col-span-2" : ""}
          >
            {isInquiryInitialLoadInProgress ? (
              <SectionLoadingState
                label="Loading inquiry details"
                blocks={8}
                columnsClass="sm:grid-cols-2 xl:grid-cols-4"
              />
            ) : isInquiryRequestExpanded ? (
              <div className="space-y-1.5">
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-5">
                  <CardField label="Inquiry Status" value={inquiryStatus} />
                  <CardField label="Source" value={statusSource} />
                  <CardField label="Type" value={statusType} />
                  {inquiryDisplayFlowRule.showServiceInquiry ? (
                    <CardField
                      label="Service Name"
                      value={statusServiceName}
                      href={statusServiceNameHref}
                      openInNewTab
                    />
                  ) : null}
                  {inquiryDisplayFlowRule.showHowDidYouHear ? (
                    <CardField label="How Did You Hear" value={statusHowHeardDisplay} />
                  ) : null}
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-5">
                  <CardField label="Date Job Required By" value={requestDateRequired} />
                  <CardField label="Renovations" value={requestRenovations} />
                  <CardField label="Resident Availability" value={requestResidentAvailability} />
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-[14px] sm:grid-cols-2 xl:grid-cols-3">
                  <CardTagList
                    label="Pest Noise Signs"
                    tags={requestPestNoiseTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "noise_signs_options_as_text",
                        rawValue: requestPestNoiseRawValue,
                        options: NOISE_SIGN_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("noise_signs_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Active Times"
                    tags={requestPestActiveTimesTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_active_times_options_as_text",
                        rawValue: requestPestActiveTimesRawValue,
                        options: PEST_ACTIVE_TIME_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_active_times_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Locations"
                    tags={requestPestLocationsTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_location_options_as_text",
                        rawValue: requestPestLocationsRawValue,
                        options: PEST_LOCATION_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_location_options_as_text", tag)
                    }
                  />
                </div>
                <div
                  className={`grid grid-cols-1 gap-1.5 ${
                    inquiryDisplayFlowRule.showHowCanWeHelp ? "md:grid-cols-3" : "md:grid-cols-2"
                  }`}
                >
                  {inquiryDisplayFlowRule.showHowCanWeHelp ? (
                    <CardNote label="How Can We Help" value={statusHowCanHelp} />
                  ) : null}
                  <CardNote label="Admin Notes" value={notesAdmin} />
                  <CardNote label="Client Notes" value={notesClient} />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <CardField label="Inquiry Status" value={inquiryStatus} />
                  <CardField label="Source" value={statusSource} />
                  <CardField label="Type" value={statusType} />
                  {inquiryDisplayFlowRule.showServiceInquiry ? (
                    <CardField
                      label="Service Name"
                      value={statusServiceName}
                      href={statusServiceNameHref}
                      openInNewTab
                    />
                  ) : null}
                  {inquiryDisplayFlowRule.showHowDidYouHear ? (
                    <CardField label="How Did You Hear" value={statusHowHeardDisplay} />
                  ) : null}
                  <CardTagList
                    label="Pest Noise Signs"
                    tags={requestPestNoiseTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "noise_signs_options_as_text",
                        rawValue: requestPestNoiseRawValue,
                        options: NOISE_SIGN_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("noise_signs_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Active Times"
                    tags={requestPestActiveTimesTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_active_times_options_as_text",
                        rawValue: requestPestActiveTimesRawValue,
                        options: PEST_ACTIVE_TIME_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_active_times_options_as_text", tag)
                    }
                  />
                  <CardTagList
                    label="Pest Locations"
                    tags={requestPestLocationsTags}
                    onRemoveTag={(tag) =>
                      handleQuickRemoveListSelectionTag({
                        field: "pest_location_options_as_text",
                        rawValue: requestPestLocationsRawValue,
                        options: PEST_LOCATION_OPTIONS,
                        tag,
                      })
                    }
                    isTagRemoving={(tag) =>
                      isListSelectionTagRemoving("pest_location_options_as_text", tag)
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
                  <CardField label="Date Job Required By" value={requestDateRequired} />
                  <CardField label="Renovations" value={requestRenovations} />
                  <CardField label="Resident Availability" value={requestResidentAvailability} />
                </div>
                {inquiryDisplayFlowRule.showHowCanWeHelp ? (
                  <CardNote label="How Can We Help" value={statusHowCanHelp} />
                ) : null}
                <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                  <CardNote label="Admin Notes" value={notesAdmin} />
                  <CardNote label="Client Notes" value={notesClient} />
                </div>
              </div>
            )}
          </DetailsCard>

        </div>

          <section className="inquiry-details-workspace mt-1.5 overflow-hidden rounded-md border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-1.5 py-1">
              {visibleWorkspaceTabs.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded-md border px-2 py-[3px] text-[11px] font-semibold leading-4 transition ${
                      isActive
                        ? "border-[#003882] bg-[#003882] text-white shadow-sm"
                        : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="p-1.5">
              {isInquiryInitialLoadInProgress ? (
                <SectionLoadingState
                  label="Loading workspace"
                  blocks={6}
                  columnsClass="md:grid-cols-2"
                />
              ) : (
                <>
                  <WorkspaceTabPanel
                    isMounted={
                      shouldShowRelatedRecordsTab &&
                      Boolean(mountedWorkspaceTabs["related-records"])
                    }
                    isActive={activeWorkspaceTab === "related-records"}
                  >
                    <RelatedRecordsSection
                      deals={filteredRelatedDeals}
                      jobs={relatedJobs}
                      isLoading={isRelatedRecordsLoading}
                      error={relatedRecordsError}
                      hasAccount={Boolean(relatedRecordsAccountId)}
                      noAccountMessage="Link a contact/company on this inquiry to load related records."
                      linkedJobId={selectedRelatedJobId}
                      jobIdByUid={relatedJobIdByUid}
                      onToggleJobLink={handleToggleRelatedJobLink}
                      isLinkingJob={isSavingLinkedJob}
                      onNavigateToDeal={(uid) => openRelatedRecord(uid)}
                      onNavigateToJob={(uid) => openRelatedRecord(uid)}
                    />
                  </WorkspaceTabPanel>

                  <WorkspaceTabPanel
                    isMounted={shouldShowPropertiesTab && Boolean(mountedWorkspaceTabs.properties)}
                    isActive={activeWorkspaceTab === "properties"}
                  >
                    <PropertyTabSection
                      plugin={plugin}
                      preloadedLookupData={workspaceLookupData}
                      quoteJobId={linkedInquiryJobIdFromRecord}
                      inquiryId={inquiryNumericId}
                      currentPropertyId={normalizePropertyId(
                        activeRelatedProperty?.id || selectedPropertyId
                      )}
                      onOpenContactDetailsModal={openContactDetailsModal}
                      accountType={relatedRecordsAccountType}
                      selectedAccountId={relatedRecordsAccountId}
                      propertySearchValue={propertySearchQuery}
                      propertySearchItems={propertySearchItems}
                      onPropertySearchValueChange={handlePropertySearchValueChange}
                      onPropertySearchQueryChange={handlePropertySearchQueryChange}
                      onSelectPropertyFromSearch={handleSelectPropertyFromSearch}
                      onAddProperty={handleOpenAddPropertyModal}
                      activeRelatedProperty={activeRelatedProperty}
                      linkedProperties={linkedPropertiesSorted}
                      isLoading={isLinkedPropertiesLoading}
                      loadError={linkedPropertiesError}
                      selectedPropertyId={normalizePropertyId(
                        activeRelatedProperty?.id || selectedPropertyId
                      )}
                      onSelectProperty={setSelectedPropertyId}
                      onEditRelatedProperty={handleOpenEditPropertyModal}
                      sameAsContactLabel={
                        isApplyingSameAsContactProperty ? "Applying..." : "Same as contact"
                      }
                      isSameAsContactChecked={isPropertySameAsContact}
                      isSameAsContactDisabled={
                        isApplyingSameAsContactProperty || !inquiryNumericId || !plugin
                      }
                      onSameAsContactChange={handleSameAsContactPropertyChange}
                      showPropertyUploadsSection={false}
                      propertyDetailsVariant="cards"
                    />
                  </WorkspaceTabPanel>

                  <WorkspaceTabPanel
                    isMounted={Boolean(mountedWorkspaceTabs.uploads)}
                    isActive={activeWorkspaceTab === "uploads"}
                  >
                    {inquiryNumericId ? (
                      <UploadsSection
                        plugin={plugin}
                        jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
                        uploadsMode="inquiry"
                        inquiryId={inquiryNumericId}
                        inquiryUid={safeUid}
                        linkedJobId={linkedInquiryJobIdFromRecord}
                        additionalCreatePayload={{
                          inquiry_id: inquiryNumericId,
                          Inquiry_ID: inquiryNumericId,
                          inquiry_record_id: inquiryNumericId,
                          Inquiry_Record_ID: inquiryNumericId,
                          job_id: linkedInquiryJobIdFromRecord || null,
                          Job_ID: linkedInquiryJobIdFromRecord || null,
                          ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
                        }}
                        layoutMode="table"
                        existingUploadsView="tiles"
                        onRequestAddUpload={handleOpenUploadModal}
                        enableFormUploads
                      />
                    ) : (
                      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        Inquiry record ID is required to load uploads.
                      </div>
                    )}
                  </WorkspaceTabPanel>

                  <WorkspaceTabPanel
                    isMounted={Boolean(mountedWorkspaceTabs.appointments)}
                    isActive={activeWorkspaceTab === "appointments"}
                  >
                    <AppointmentTabSection
                      plugin={plugin}
                      jobData={{ id: linkedInquiryJobIdFromRecord, ID: linkedInquiryJobIdFromRecord }}
                      preloadedLookupData={workspaceLookupData}
                      inquiryRecordId={inquiryNumericId}
                      inquiryUid={safeUid}
                      prefillContext={inquiryAppointmentPrefillContext}
                      layoutMode="table"
                      eventRowTintOpacity={0.4}
                      onRequestCreate={handleOpenCreateAppointmentModal}
                      onRequestEdit={handleOpenEditAppointmentModal}
                    />
                  </WorkspaceTabPanel>
                </>
              )}
            </div>
          </section>
      </section>
      <button
        type="button"
        className="pointer-events-auto fixed bottom-[144px] right-[-2px] z-[61] inline-flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-slate-300/90 bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition hover:bg-slate-50"
        onClick={() => setAreFloatingWidgetsVisible((previous) => !previous)}
        aria-label={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
        title={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
      >
        {(hasPopupCommentsSection || memos.length) ? (
          <span className="absolute -top-1 right-[20px] inline-flex h-2 w-2 rounded-full bg-red-500" />
        ) : null}
        <svg
          viewBox="0 0 24 24"
          width="14"
          height="14"
          fill="none"
          aria-hidden="true"
          className="-translate-x-[8px]"
        >
          {areFloatingWidgetsVisible ? (
            <path
              d="M9 6l6 6-6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : (
            <path
              d="M15 6l-6 6 6 6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
        </svg>
      </button>
      <div
        className={`fixed bottom-5 right-6 z-[60] flex flex-col items-end gap-3 transition-all duration-200 ${
          areFloatingWidgetsVisible
            ? "pointer-events-auto translate-x-0 opacity-100"
            : "pointer-events-none translate-x-4 opacity-0"
        }`}
      >
        <button
          type="button"
          className={`pointer-events-auto relative inline-flex h-12 w-12 items-center justify-center rounded-full border border-red-700 bg-red-600 text-white shadow-[0_10px_24px_rgba(220,38,38,0.35)] transition ${
            hasPopupCommentsSection
              ? "hover:bg-red-700"
              : "cursor-not-allowed opacity-45"
          }`}
          onClick={() => {
            if (!hasPopupCommentsSection) return;
            setIsPopupCommentModalOpen(true);
          }}
          disabled={!hasPopupCommentsSection}
          aria-label="Open popup comments"
          title={hasPopupCommentsSection ? "Popup comments" : "Popup comments unavailable"}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
            <path
              d="M12 7.25V13.25"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            <circle cx="12" cy="17.1" r="1.25" fill="currentColor" />
          </svg>
        </button>

        {isMemoChatOpen ? (
          <section className="pointer-events-auto flex w-[370px] max-w-[92vw] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.22)]">
            <header className="flex items-center justify-between bg-[#003882] px-3 py-2.5 text-white">
              <div className="text-sm font-semibold">Memos</div>
              <button
                type="button"
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-white/30 text-white hover:bg-white/10"
                onClick={() => setIsMemoChatOpen(false)}
                aria-label="Close memos chat"
                title="Close"
              >
                ✕
              </button>
            </header>

            <div className="max-h-[420px] min-h-[340px] space-y-2 overflow-y-auto bg-slate-50 p-2.5">
              {!hasMemoContext ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  Memos are available when inquiry is linked.
                </div>
              ) : isMemosLoading ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  Loading memos...
                </div>
              ) : memosError ? (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {memosError}
                </div>
              ) : !memos.length ? (
                <div className="rounded border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
                  No memos yet.
                </div>
              ) : (
                memos.map((memo, memoIndex) => {
                  const memoId = toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`;
                  const memoAuthor = memo?.Author || {};
                  const memoIsMine =
                    Boolean(currentUserId) && toText(memo?.author_id || memoAuthor?.id) === currentUserId;
                  const memoAuthorName = getAuthorName(memoAuthor);
                  const memoFileMeta = getMemoFileMeta(memo?.file || memo?.File);
                  const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
                  const isReplySending = sendingReplyPostId === memoId;
                  return (
                    <div
                      key={memoId}
                      className={`rounded-lg border px-2.5 py-2 ${
                        memoIsMine
                          ? "border-blue-200 bg-blue-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <div className="truncate text-[11px] font-semibold text-slate-700">
                          {memoIsMine ? "You" : memoAuthorName}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">
                            {formatRelativeTime(memo?.created_at || memo?.Date_Added)}
                          </span>
                          <button
                            type="button"
                            className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                            onClick={() => setMemoDeleteTarget({ type: "post", id: memoId })}
                            title="Delete memo"
                            aria-label="Delete memo"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </div>
                      <p className="whitespace-pre-wrap text-xs text-slate-700">
                        {toText(
                          memo?.post_copy ||
                            memo?.Post_Copy ||
                            memo?.comment ||
                            memo?.Comment ||
                            memo?.text ||
                            memo?.Text ||
                            memo?.content ||
                            memo?.Content
                        ) || "-"}
                      </p>
                      {memoFileMeta?.link ? (
                        <a
                          href={memoFileMeta.link}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 inline-flex max-w-full rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-[#003882] underline underline-offset-2"
                        >
                          <span className="max-w-[240px] truncate">
                            {memoFileMeta.name || "View attachment"}
                            {memoFileMeta.size ? ` (${formatFileSize(memoFileMeta.size)})` : ""}
                          </span>
                        </a>
                      ) : null}

                      {replies.length ? (
                        <div className="mt-2 space-y-1.5 border-t border-slate-200 pt-2">
                          {replies.map((reply, replyIndex) => {
                            const replyId = toText(reply?.id || reply?.ID) || `${memoId}-reply-${replyIndex}`;
                            const replyAuthor = reply?.Author || {};
                            const replyIsMine =
                              Boolean(currentUserId) &&
                              toText(reply?.author_id || replyAuthor?.id) === currentUserId;
                            return (
                              <div
                                key={replyId}
                                className="rounded border border-slate-200 bg-slate-50 px-2 py-1.5"
                              >
                                <div className="mb-0.5 flex items-center justify-between gap-2">
                                  <span className="truncate text-[10px] font-semibold text-slate-700">
                                    {replyIsMine ? "You" : getAuthorName(replyAuthor)}
                                  </span>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-slate-500">
                                      {formatRelativeTime(reply?.created_at)}
                                    </span>
                                    <button
                                      type="button"
                                      className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-200 bg-white text-red-600 hover:bg-red-50"
                                      onClick={() =>
                                        setMemoDeleteTarget({ type: "comment", id: replyId })
                                      }
                                      title="Delete reply"
                                      aria-label="Delete reply"
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </div>
                                <p className="whitespace-pre-wrap text-xs text-slate-700">
                                  {toText(
                                    reply?.comment ||
                                      reply?.Comment ||
                                      reply?.post_copy ||
                                      reply?.Post_Copy ||
                                      reply?.text ||
                                      reply?.Text ||
                                      reply?.content ||
                                      reply?.Content
                                  ) || "-"}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : null}

                      <div className="mt-2 flex items-end gap-1.5">
                        <textarea
                          className="min-h-[34px] flex-1 rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 outline-none focus:border-slate-400"
                          placeholder="Reply..."
                          value={toText(memoReplyDrafts?.[memoId])}
                          onChange={(event) =>
                            setMemoReplyDrafts((previous) => ({
                              ...(previous || {}),
                              [memoId]: event.target.value,
                            }))
                          }
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="!px-2 !py-1 !text-xs"
                          disabled={Boolean(sendingReplyPostId)}
                          onClick={() => handleSendMemoReply(memoId)}
                        >
                          {isReplySending ? "..." : "Send"}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <footer className="space-y-2 border-t border-slate-200 bg-white p-2.5">
              <textarea
                className="min-h-[52px] w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-slate-400"
                placeholder="Write a memo..."
                value={memoText}
                onChange={(event) => setMemoText(event.target.value)}
                disabled={!hasMemoContext || isPostingMemo}
              />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="!px-2 !py-1 !text-xs"
                    onClick={() => memoFileInputRef.current?.click()}
                    disabled={!hasMemoContext || isPostingMemo}
                  >
                    Attach
                  </Button>
                  <input
                    ref={memoFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={handleMemoFileChange}
                  />
                  {memoFile ? (
                    <span className="max-w-[150px] truncate text-[11px] text-slate-500">
                      {memoFile.name}
                    </span>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="!bg-[#003882] !px-2 !py-1 !text-xs !text-white hover:!bg-[#0A4A9E]"
                  onClick={handleSendMemo}
                  disabled={!hasMemoContext || isPostingMemo}
                >
                  {isPostingMemo ? "Posting..." : "Send"}
                </Button>
              </div>
            </footer>
          </section>
        ) : null}

        <button
          type="button"
          className="pointer-events-auto relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#003882] text-white shadow-[0_10px_24px_rgba(0,56,130,0.35)] transition hover:bg-[#0A4A9E]"
          onClick={() => setIsMemoChatOpen((previous) => !previous)}
          aria-label={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
          title={isMemoChatOpen ? "Close memos chat" : "Open memos chat"}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" aria-hidden="true">
            <path
              d="M20 6.5v7A3.5 3.5 0 0 1 16.5 17H9l-4 3v-3A3.5 3.5 0 0 1 1.5 13.5v-7A3.5 3.5 0 0 1 5 3h11.5A3.5 3.5 0 0 1 20 6.5Z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M6.5 8.5h8M6.5 11.5h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {memos.length ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {memos.length > 99 ? "99+" : memos.length}
            </span>
          ) : null}
        </button>
      </div>
      </JobDirectStoreProvider>
    </main>
  );
}
