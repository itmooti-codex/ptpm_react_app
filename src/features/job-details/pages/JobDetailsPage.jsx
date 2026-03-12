import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import logoUrl from "../../../assets/logo.webp";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import {
  resolveStatusStyle,
  resolveJobStatusStyle,
  resolveQuoteStatusStyle,
  resolvePaymentStatusStyle,
  resolvePriorityStyle,
} from "../../../shared/constants/statusStyles.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { useVitalStatsPlugin } from "@platform/vitalstats/useVitalStatsPlugin.js";
import {
  AddActivitiesSection,
  AddPropertyModal,
  AddMaterialsSection,
  AccountDetailsSection,
  AppointmentTabSection,
  ContactDetailsModal,
  InvoiceSection,
  PropertyAffiliationModal,
  PropertyTabSection,
  RelatedRecordsSection,
  SearchDropdownInput,
  TasksModal,
  TitleBackIcon,
  TrashActionIcon as TrashIcon,
  UploadsSection,
} from "@modules/job-workspace/public/components.js";
import {
  JobDirectStoreProvider,
  useServiceProviderLookup,
  useAdminProviderLookup,
  useSearchCallback,
} from "@modules/job-workspace/public/hooks.js";
import {
  extractFirstRecord,
  fetchLinkedPropertiesByAccount,
  fetchActivitiesByJobId,
  fetchMaterialsByJobId,
  fetchPropertiesForSearch,
  searchPropertiesForLookup,
  subscribeActivitiesByJobId,
  subscribeMaterialsByJobId,
} from "@modules/job-workspace/public/sdk.js";
import {
  createMemoCommentForDetails,
  createMemoPostForDetails,
  deleteMemoCommentForDetails,
  deleteMemoPostForDetails,
  fetchContactLogsForDetails,
  fetchMemosForDetails,
  fetchPropertyAffiliationsForDetails,
  fetchTasksForDetails,
  savePropertyForDetails,
  subscribeMemosForDetails,
  updateCompanyFieldsById,
  updateContactFieldsById,
  updateInquiryFieldsById,
  updateJobFieldsById,
} from "@modules/job-records/public/sdk.js";
import { APP_USER } from "../../../config/userConfig.js";
import {
  createAffiliationRecord,
  createCompanyRecord,
  createContactRecord,
  searchCompaniesForLookup,
  searchContactsForLookup,
  updateAffiliationRecord,
  fetchCompanyAccountRecordById,
  fetchContactAccountRecordById,
  normalizePropertyLookupRecord,
  mergePropertyLookupRecords,
  uploadMaterialFile,
} from "@modules/job-workspace/sdk/core/runtime.js";
import { useRelatedRecordsData } from "../../inquiry/shared/useRelatedRecordsData.js";
import {
  toText,
  toBoolean,
  fullName,
  joinAddress,
  compactStringFields,
  toMailHref,
  toTelHref,
  toGoogleMapsHref,
  formatActivityServiceLabel,
  formatServiceProviderAllocationLabel,
  formatServiceProviderInputLabel,
  formatContactLookupLabel,
  formatCompanyLookupLabel,
  mergeMemosPreservingComments,
} from "@shared/utils/formatters.js";
import {
  isContactAccountType,
  isCompanyAccountType,
  isBodyCorpCompanyAccountType,
  isLikelyEmailValue,
  isLikelyPhoneValue,
} from "@shared/utils/accountTypeUtils.js";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
} from "@shared/components/icons/index.jsx";
import { DetailsCard } from "@shared/components/ui/DetailsCard.jsx";
import { CardField } from "@shared/components/ui/CardField.jsx";
import { MemoChatPanel } from "@shared/components/ui/MemoChatPanel.jsx";
import { SectionLoadingState } from "@shared/components/ui/SectionLoadingState.jsx";
import { useCurrentUserProfile } from "@shared/hooks/useCurrentUserProfile.js";
import { ContactLogsPanel } from "../components/ContactLogsPanel.jsx";
import { JobMemosPreviewPanel } from "../components/JobMemosPreviewPanel.jsx";
import { JobNotesPanel } from "../components/JobNotesPanel.jsx";

function parseDateLikeValue(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^-?\d+(\.\d+)?$/.test(text.replace(/,/g, ""))) {
    const numeric = Number(text.replace(/,/g, ""));
    if (!Number.isFinite(numeric)) return null;
    const asMs = String(Math.abs(Math.trunc(numeric))).length <= 10 ? numeric * 1000 : numeric;
    const parsed = new Date(asMs);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateDisplay(value) {
  const parsed = parseDateLikeValue(value);
  if (!parsed) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function pickBooleanValue(record = {}, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    return toBoolean(record?.[key]);
  }
  return false;
}

function getRelatedDealRecordKey(record = {}, index = 0) {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  if (uid) return `uid:${uid}`;
  const id = toText(record?.id || record?.ID);
  if (id) return `id:${id}`;
  return `deal:${index}`;
}

function getRelatedJobRecordKey(record = {}, index = 0) {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  if (uid) return `uid:${uid}`;
  const id = toText(record?.id || record?.ID);
  if (id) return `id:${id}`;
  return `job:${index}`;
}

function getRelatedRecordIdentity(record = {}, index = 0, fallbackPrefix = "record") {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  const id = toText(record?.id || record?.ID);
  return {
    uid,
    id,
    fallbackKey: `${fallbackPrefix}:${index}`,
  };
}

function mergeRelatedRecordCollections(baseRecords = [], contextualRecords = [], getKey) {
  const list = Array.isArray(baseRecords) ? baseRecords : [];
  const contextual = Array.isArray(contextualRecords) ? contextualRecords : [];
  const merged = [];
  const indexByKey = new Map();

  [...list, ...contextual].forEach((record, index) => {
    if (!record || typeof record !== "object") return;
    const { uid, id, fallbackKey } = getRelatedRecordIdentity(
      record,
      index,
      typeof getKey === "function" ? getKey(record, index).split(":")[0] : "record"
    );
    const candidateKeys = [uid ? `uid:${uid}` : "", id ? `id:${id}` : ""].filter(Boolean);
    const existingIndex = candidateKeys.reduce((foundIndex, key) => {
      if (foundIndex != null) return foundIndex;
      return indexByKey.has(key) ? indexByKey.get(key) : null;
    }, null);

    if (existingIndex == null && !candidateKeys.length) {
      merged.push(record);
      return;
    }

    if (existingIndex == null) {
      candidateKeys.forEach((key) => {
        indexByKey.set(key, merged.length);
      });
      if (!candidateKeys.length) {
        indexByKey.set(fallbackKey, merged.length);
      }
      merged.push(record);
      return;
    }
    merged[existingIndex] = {
      ...merged[existingIndex],
      ...record,
    };

    const mergedRecord = merged[existingIndex];
    const mergedUid = toText(mergedRecord?.unique_id || mergedRecord?.Unique_ID);
    const mergedId = toText(mergedRecord?.id || mergedRecord?.ID);
    if (mergedUid) indexByKey.set(`uid:${mergedUid}`, existingIndex);
    if (mergedId) indexByKey.set(`id:${mergedId}`, existingIndex);
  });

  return merged;
}

function toPromiseLike(result) {
  if (result && typeof result.then === "function") return result;
  if (result && typeof result.toPromise === "function") return result.toPromise();
  return Promise.resolve(result);
}

function toAffiliationOption(affiliation = {}) {
  const contactName = fullName(
    affiliation?.contact_first_name,
    affiliation?.contact_last_name
  );
  const companyName = toText(
    affiliation?.company_as_accounts_contact_name || affiliation?.company_name
  );
  const email = toText(
    affiliation?.contact_email || affiliation?.company_as_accounts_contact_email
  );
  const mobile = toText(
    affiliation?.contact_sms_number ||
      affiliation?.company_as_accounts_contact_sms_number ||
      affiliation?.contact_phone
  );
  const role = toText(affiliation?.role) || `Affiliation #${toText(affiliation?.id)}`;
  const labelParts = [role, contactName || companyName].filter(Boolean);
  return {
    id: toText(affiliation?.id),
    label: labelParts.join(" - ") || role,
    meta: [companyName, email, mobile].filter(Boolean).join(" | "),
    legacyIds: [
      toText(affiliation?.contact_id),
      toText(affiliation?.company_as_accounts_contact_id),
      toText(affiliation?.company_id),
    ].filter(Boolean),
  };
}

const DEFAULT_STATUS_STYLE = { color: "#475569", backgroundColor: "#f1f5f9" };

function isDefaultStatusStyle(style) {
  return (
    String(style?.color || "") === DEFAULT_STATUS_STYLE.color &&
    String(style?.backgroundColor || "") === DEFAULT_STATUS_STYLE.backgroundColor
  );
}

function resolveStatusStyleNormalized(value) {
  const text = toText(value);
  if (!text) return DEFAULT_STATUS_STYLE;

  const direct = resolveStatusStyle(text);
  if (!isDefaultStatusStyle(direct)) return direct;

  const lowered = text.toLowerCase();
  const titleCased = text
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : ""))
    .join(" ");

  const candidates = [
    titleCased,
    lowered,
    lowered === "in progress" ? "In Progress" : "",
    lowered === "waiting for payment" ? "Waiting For Payment" : "",
    lowered === "invoice required" ? "Invoice Required" : "",
    lowered === "invoice sent" ? "Invoice Sent" : "",
    lowered === "written off" ? "Written Off" : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const style = resolveStatusStyle(candidate);
    if (!isDefaultStatusStyle(style)) return style;
  }

  return direct;
}

function pickJobStatusFromState(state = {}) {
  const candidates = [
    state?.job_Status,
    state?.job_status,
    state?.Job_Status,
    state?.status,
    state?.job?.job_Status,
    state?.job?.job_status,
    state?.job?.Job_Status,
    state?.job?.status,
    state?.record?.job_Status,
    state?.record?.job_status,
    state?.record?.Job_Status,
    state?.record?.status,
    state?.row?.job_Status,
    state?.row?.job_status,
    state?.row?.Job_Status,
    state?.row?.status,
  ];
  return candidates.map((value) => toText(value)).find(Boolean) || "";
}

const LAST_ACTION_STATUSES = Object.freeze({
  QUEUED: "queued",
  SUCCEEDED: "succeeded",
});

const LAST_ACTION_SOURCE = "app";
const LAST_ACTION_RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function createLastActionRequestId() {
  const timestamp = Date.now().toString(36);
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const suffix = Array.from(
      bytes,
      (value) => LAST_ACTION_RANDOM_ALPHABET[value % LAST_ACTION_RANDOM_ALPHABET.length]
    ).join("");
    return `act_${timestamp}_${suffix}`;
  }

  return `act_${timestamp}_${Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6)}`;
}

function toActionToken(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function buildJobLastActionPayload({
  type = "",
  message = "",
  status = LAST_ACTION_STATUSES.QUEUED,
} = {}) {
  const normalizedType = toText(type);
  if (!normalizedType) return {};
  return {
    PTPM_Last_Action_Status: status,
    PTPM_Last_Action_Message: toText(message),
    PTPM_Last_Action_Type: normalizedType,
    PTPM_Last_Action_Request_ID: createLastActionRequestId(),
    PTPM_Last_Action_At: Math.trunc(Date.now() / 1000),
    PTPM_Last_Action_Source: LAST_ACTION_SOURCE,
  };
}

function buildEmailMenuLastAction({ groupKey = "", option = null, target = "button" } = {}) {
  if (target === "job") {
    return {
      type: "job.email.job-update",
      message: "Job update email requested.",
    };
  }

  const buttonName = toText(option?.button_name);
  const templateName = toText(option?.template_link_button);
  if (!buttonName) {
    return { type: "", message: "" };
  }

  if (target === "template") {
    return {
      type: [
        "job",
        "email",
        toActionToken(groupKey),
        toActionToken(buttonName),
        toActionToken(templateName),
      ]
        .filter(Boolean)
        .join("."),
      message: `${templateName || "Email template"} selected for ${buttonName}.`,
    };
  }

  return {
    type: ["job", "email", toActionToken(groupKey), toActionToken(buttonName)]
      .filter(Boolean)
      .join("."),
    message: `${buttonName} requested.`,
  };
}


const EMAIL_OPTIONS_DATA = {
  general: {
    label: "General Emails",
    buttons: [
      { button_name: "Email Customer", template_link_button: "Job Email" },
      { button_name: "Email Tenant", template_link_button: "Job Email" },
      { button_name: "Request Review", template_link_button: "Job Email" },
    ],
  },
  quote: {
    label: "Quote Emails",
    buttons: [
      { button_name: "Email Manual Quote", template_link_button: "Job Email" },
      { button_name: "Email Electronic Quote", template_link_button: "Job Email" },
      { button_name: "Email RE Quote FU", template_link_button: "Job Email" },
      { button_name: "Email BC Quote FU", template_link_button: "Job Email" },
      { button_name: "Email O Quote FU", template_link_button: "Job Email" },
      { button_name: "Email 2nd Quote FU", template_link_button: "Job Email" },
    ],
  },
  invoice: {
    label: "Invoice Emails",
    buttons: [
      { button_name: "Email Invoice", template_link_button: "Account Email" },
      { button_name: "Email Invoice FU", template_link_button: "Account Email" },
      { button_name: "Email RE INV FU", template_link_button: "Account Email" },
    ],
  },
};

const JOB_TAKEN_BY_FIELD_ALIASES = ["Job_Taken_By_id", "job_taken_by_id", "Job_Taken_By_ID"];
const JOB_WORKSPACE_TABS = [
  { id: "related-data", label: "Related Data" },
  { id: "properties", label: "Properties" },
  { id: "uploads", label: "Uploads" },
  { id: "appointments", label: "Appointments" },
  { id: "activities", label: "Activities" },
  { id: "materials", label: "Materials" },
  { id: "invoice-payment", label: "Quote and Payment" },
];

const JOB_INITIAL_SELECT_FIELDS = [
  "id",
  "unique_id",
  "job_status",
  "job_Status",
  "Job_Status",
  "primary_service_provider_id",
  "Primary_Service_Provider_ID",
  "inquiry_record_id",
  "Inquiry_Record_ID",
  "pca_done",
  "PCA_Done",
  "prestart_done",
  "Prestart_Done",
  "mark_complete",
  "Mark_Complete",
  "client_entity_id",
  "Client_Entity_ID",
  "client_individual_id",
  "Client_Individual_ID",
  "property_id",
  "Property_ID",
  "account_type",
  "Account_Type",
  "accounts_contact_id",
  "Accounts_Contact_ID",
  "quote_status",
  "Quote_Status",
  "payment_status",
  "Payment_Status",
  "quote_date",
  "Quote_Date",
  "follow_up_date",
  "Follow_Up_Date",
  "quote_valid_until",
  "Quote_Valid_Until",
  "date_quote_requested",
  "Date_Quote_Requested",
  "date_quote_sent",
  "Date_Quote_Sent",
  "date_quoted_accepted",
  "Date_Quoted_Accepted",
  "priority",
  "Priority",
  "admin_recommendation",
  "Admin_Recommendation",
];

const EMPTY_QUOTE_PAYMENT_DETAILS = {
  quote_status: "",
  payment_status: "",
  quote_date: null,
  follow_up_date: null,
  quote_valid_until: null,
  date_quote_requested: null,
  date_quote_sent: null,
  date_quoted_accepted: null,
  priority: "",
  admin_recommendation: "",
};

function buildQuotePaymentDetailsFromJob(job = {}) {
  return {
    quote_status: toText(job?.quote_status || job?.Quote_Status),
    payment_status: toText(job?.payment_status || job?.Payment_Status),
    quote_date: job?.quote_date ?? job?.Quote_Date ?? null,
    follow_up_date: job?.follow_up_date ?? job?.Follow_Up_Date ?? null,
    quote_valid_until: job?.quote_valid_until ?? job?.Quote_Valid_Until ?? null,
    date_quote_requested: job?.date_quote_requested ?? job?.Date_Quote_Requested ?? null,
    date_quote_sent: job?.date_quote_sent ?? job?.Date_Quote_Sent ?? null,
    date_quoted_accepted: job?.date_quoted_accepted ?? job?.Date_Quoted_Accepted ?? null,
    priority: toText(job?.priority || job?.Priority),
    admin_recommendation: toText(job?.admin_recommendation || job?.Admin_Recommendation),
  };
}

function WorkspaceTabPanel({ isMounted = false, isActive = false, children }) {
  if (!isMounted) return null;
  return (
    <div className={isActive ? "block" : "hidden"} aria-hidden={!isActive}>
      {children}
    </div>
  );
}

function escapeHtml(value) {
  const text = toText(value);
  if (!text) return "";
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatCurrencyDisplay(value) {
  const text = toText(value);
  if (!text) return "$0.00";
  const numeric = Number(String(text).replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "$0.00";
  return numeric.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeJobWhereValue(field, value) {
  const normalizedValue = toText(value);
  if (!normalizedValue) return "";
  if (field === "id" && /^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }
  return normalizedValue;
}

async function fetchSingleJobRecord({ jobModel, field, value, selectFields = [] } = {}) {
  const whereValue = normalizeJobWhereValue(field, value);
  if (!jobModel?.query || whereValue === "" || whereValue == null) return null;
  const uniqueSelectFields = Array.from(
    new Set(
      ["id", ...(Array.isArray(selectFields) ? selectFields : [])]
        .map((item) => toText(item))
        .filter(Boolean)
    )
  );
  const query = jobModel
    .query()
    .where(field, whereValue)
    .deSelectAll()
    .select(uniqueSelectFields)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchDetailedJobRecord({ plugin, field = "id", value } = {}) {
  const normalizedValue = normalizeJobWhereValue(field, value);
  if (!plugin?.switchTo || normalizedValue === "" || normalizedValue == null) return null;
  const jobModel = plugin.switchTo("PeterpmJob");
  if (!jobModel?.query) return null;

  const query = jobModel
    .query()
    .where(field, normalizedValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "account_type",
      "client_entity_id",
      "client_individual_id",
      "property_id",
      "inquiry_record_id",
    ])
    .include("Inquiry_Record", (inquiryQuery) =>
      inquiryQuery
        .deSelectAll()
        .select(["id", "unique_id", "deal_name"])
    )
    .include("Client_Individual", (contactQuery) =>
      contactQuery
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
          "xero_contact_id",
        ])
    )
    .include("Client_Entity", (companyQuery) =>
      companyQuery
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
          "popup_comment",
          "xero_contact_id",
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
    .include("Property", (propertyQuery) =>
      propertyQuery
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "address",
          "city",
          "suburb_town",
          "state",
          "postal_code",
          "zip_code",
          "country",
          "property_type",
          "building_type",
          "building_type_other",
          "foundation_type",
          "bedrooms",
          "manhole",
          "stories",
          "building_age",
          "building_features",
          "building_features_options_as_text",
        ])
    )
    .limit(1)
    .noDestroy();

  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}


async function fetchPropertyRecordById({ plugin, propertyId } = {}) {
  const normalizedPropertyId = toText(propertyId);
  if (!plugin?.switchTo || !normalizedPropertyId) return null;
  const whereValue = /^\d+$/.test(normalizedPropertyId)
    ? Number.parseInt(normalizedPropertyId, 10)
    : normalizedPropertyId;
  const query = plugin
    .switchTo("PeterpmProperty")
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "property_name",
      "lot_number",
      "unit_number",
      "address_1",
      "address_2",
      "address",
      "city",
      "suburb_town",
      "state",
      "postal_code",
      "zip_code",
      "country",
      "property_type",
      "building_type",
      "building_type_other",
      "foundation_type",
      "bedrooms",
      "manhole",
      "stories",
      "building_age",
      "building_features",
      "building_features_options_as_text",
    ])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return normalizePropertyLookupRecord(extractFirstRecord(result) || {});
}

async function fetchJobTakenByValue({ jobModel, jobId } = {}) {
  const normalizedJobId = toText(jobId);
  if (!jobModel?.query || !normalizedJobId) {
    return { value: "", field: "", resolved: false };
  }

  for (const fieldName of JOB_TAKEN_BY_FIELD_ALIASES) {
    try {
      const record = await fetchSingleJobRecord({
        jobModel,
        field: "id",
        value: normalizedJobId,
        selectFields: [fieldName],
      });
      if (!record || typeof record !== "object") continue;
      const value = toText(record?.[fieldName]);
      if (value) return { value, field: fieldName, resolved: true };
      if (Object.prototype.hasOwnProperty.call(record, fieldName)) {
        return { value: "", field: fieldName, resolved: true };
      }
    } catch (_) {
      // ignore unsupported alias and continue with fallback aliases
    }
  }

  return { value: "", field: "", resolved: false };
}

async function fetchInquiryUidById({ plugin, inquiryId } = {}) {
  const normalizedInquiryId = toText(inquiryId);
  if (!plugin?.switchTo || !normalizedInquiryId) return "";
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) return "";

  const whereValue = /^\d+$/.test(normalizedInquiryId)
    ? Number.parseInt(normalizedInquiryId, 10)
    : normalizedInquiryId;

  const query = dealModel
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.unique_id || record?.Unique_ID);
}

function normalizeInquiryCompanyRecord(inquiry = {}) {
  const nested = inquiry?.Company || inquiry?.company || {};
  const nestedPrimaryPerson = nested?.Primary_Person || nested?.primary_person || {};
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
    account_type: toText(
      nested?.account_type || nested?.Account_Type || inquiry?.Company_Account_Type
    ),
    popup_comment: toText(
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Company_Popup_Comment
    ),
    Primary_Person: {
      id: toText(nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || inquiry?.Contact_Contact_ID),
      first_name: toText(
        nestedPrimaryPerson?.first_name ||
          nestedPrimaryPerson?.First_Name ||
          inquiry?.Contact_First_Name
      ),
      last_name: toText(
        nestedPrimaryPerson?.last_name ||
          nestedPrimaryPerson?.Last_Name ||
          inquiry?.Contact_Last_Name
      ),
      email: toText(
        nestedPrimaryPerson?.email || nestedPrimaryPerson?.Email || inquiry?.ContactEmail
      ),
      sms_number: toText(
        nestedPrimaryPerson?.sms_number ||
          nestedPrimaryPerson?.SMS_Number ||
          inquiry?.Contact_SMS_Number
      ),
    },
    Body_Corporate_Company: nested?.Body_Corporate_Company || nested?.body_corporate_company || {
      id: toText(inquiry?.CompanyID1 || inquiry?.Company_ID1),
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

async function fetchInquiryAccountContextById({ plugin, inquiryId } = {}) {
  const normalizedInquiryId = toText(inquiryId);
  if (!plugin?.switchTo || !normalizedInquiryId) return null;
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) return null;

  const whereValue = /^\d+$/.test(normalizedInquiryId)
    ? Number.parseInt(normalizedInquiryId, 10)
    : normalizedInquiryId;

  const query = dealModel
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "deal_name",
      "how_can_we_help",
      "renovations",
      "resident_availability",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "recommendations",
      "account_type",
      "Account_Type",
      "CompanyID",
      "CompanyName",
      "CompanyType",
      "CompanyDescription",
      "CompanyPhone",
      "CompanyAddress",
      "CompanyCity",
      "CompanyState",
      "Company_Postal_Code",
      "CompanyIndustry",
      "Company_Annual_Revenue",
      "Company_Number_Of_Employees",
      "Company_Account_Type",
      "Company_Popup_Comment",
      "Contact_Contact_ID",
      "Contact_First_Name",
      "Contact_Last_Name",
      "ContactEmail",
      "Contact_SMS_Number",
      "CompanyID1",
      "Company_ID1",
      "CompanyName1",
      "CompanyType1",
      "CompanyDescription1",
      "CompanyPhone1",
      "CompanyAddress1",
      "CompanyCity1",
      "CompanyState1",
      "Company_Postal_Code1",
      "CompanyIndustry1",
      "Company_Annual_Revenue1",
      "Company_Number_Of_Employees1",
    ])
    .include("Company", (companyQuery) =>
      companyQuery
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
          "popup_comment",
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
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export function JobDetailsPage() {
  const { success, error } = useToast();
  const { plugin, isReady: isSdkReady } = useVitalStatsPlugin();
  const { uid = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const safeUid = toText(uid);
  const isNewJob = !safeUid || safeUid.toLowerCase() === "new";
  const configuredAdminProviderId = useMemo(
    () => toText(import.meta.env.VITE_APP_USER_ADMIN_ID),
    []
  );
  const routeJobStatus = useMemo(() => {
    const stateStatus = pickJobStatusFromState(location?.state || {});
    if (stateStatus) return stateStatus;
    const queryParams = new URLSearchParams(toText(location?.search));
    return toText(
      queryParams.get("job_Status") ||
        queryParams.get("job_status") ||
        queryParams.get("Job_Status") ||
        queryParams.get("status")
    );
  }, [location?.search, location?.state]);
  const jobNumericId = useMemo(() => {
    const state = location?.state || {};
    const stateJobId = [
      state?.jobId,
      state?.sourceId,
      state?.id,
      state?.job_id,
      state?.job?.id,
      state?.job?.ID,
      state?.record?.id,
      state?.record?.ID,
      state?.row?.id,
      state?.row?.ID,
    ]
      .map((value) => toText(value))
      .find(Boolean);
    if (stateJobId) return stateJobId;

    const queryParams = new URLSearchParams(toText(location?.search));
    return toText(queryParams.get("id") || queryParams.get("jobId") || queryParams.get("job_id"));
  }, [location?.search, location?.state]);
  const [resolvedJobId, setResolvedJobId] = useState("");
  const effectiveJobId = useMemo(
    () => toText(resolvedJobId || jobNumericId),
    [jobNumericId, resolvedJobId]
  );
  const externalJobUrl = useMemo(() => {
    if (!effectiveJobId) return "";
    return `https://app.ontraport.com/#!/o_jobs10000/edit&id=${encodeURIComponent(effectiveJobId)}`;
  }, [effectiveJobId]);
  const [serviceProviderSearch, setServiceProviderSearch] = useState("");
  const [jobTakenBySearch, setJobTakenBySearch] = useState("");
  const { records: serviceProviderLookup, isLoading: isServiceProviderLookupLoading } =
    useServiceProviderLookup({ plugin, isSdkReady });
  const { records: jobTakenByLookup, isLoading: isJobTakenByLookupLoading } =
    useAdminProviderLookup({ plugin, isSdkReady });
  const [allocatedServiceProviderId, setAllocatedServiceProviderId] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [companyLookupRecords, setCompanyLookupRecords] = useState([]);
  const [contactLookupRecords, setContactLookupRecords] = useState([]);
  const [isCompanyLookupLoading, setIsCompanyLookupLoading] = useState(false);
  const [isContactLookupLoading, setIsContactLookupLoading] = useState(false);
  const [jobEmailContactSearchValue, setJobEmailContactSearchValue] = useState("");
  const [accountsContactSearchValue, setAccountsContactSearchValue] = useState("");
  const [selectedJobEmailContactId, setSelectedJobEmailContactId] = useState("");
  const [selectedAccountsContactId, setSelectedAccountsContactId] = useState("");
  const [isSavingQuoteContacts, setIsSavingQuoteContacts] = useState(false);
  const [allocatedJobTakenById, setAllocatedJobTakenById] = useState("");
  const [selectedJobTakenById, setSelectedJobTakenById] = useState("");
  const [isSavingJobTakenBy, setIsSavingJobTakenBy] = useState(false);
  const [isJobAllocationPrefillResolved, setIsJobAllocationPrefillResolved] = useState(false);
  const [isLoadedJobTakenByMissing, setIsLoadedJobTakenByMissing] = useState(false);
  const [relatedInquiryId, setRelatedInquiryId] = useState("");
  const [relatedInquiryUid, setRelatedInquiryUid] = useState("");
  const [isSavingLinkedInquiry, setIsSavingLinkedInquiry] = useState(false);
  const [loadedJobStatus, setLoadedJobStatus] = useState("");
  const [openMenu, setOpenMenu] = useState("");
  const [activeEmailGroup, setActiveEmailGroup] = useState("general");
  const [isPcaDone, setIsPcaDone] = useState(false);
  const [isPrestartDone, setIsPrestartDone] = useState(false);
  const [isMarkComplete, setIsMarkComplete] = useState(false);
  const [isSavingPcaDone, setIsSavingPcaDone] = useState(false);
  const [isSavingPrestartDone, setIsSavingPrestartDone] = useState(false);
  const [isSavingMarkComplete, setIsSavingMarkComplete] = useState(false);
  const [isMarkCompleteConfirmOpen, setIsMarkCompleteConfirmOpen] = useState(false);
  const [pendingMarkCompleteValue, setPendingMarkCompleteValue] = useState(false);
  const [loadedAccountType, setLoadedAccountType] = useState("");
  const [loadedClientEntityId, setLoadedClientEntityId] = useState("");
  const [loadedClientIndividualId, setLoadedClientIndividualId] = useState("");
  const [loadedPropertyId, setLoadedPropertyId] = useState("");
  const [loadedAccountsContactId, setLoadedAccountsContactId] = useState("");
  const [accountContactRecord, setAccountContactRecord] = useState(null);
  const [accountCompanyRecord, setAccountCompanyRecord] = useState(null);
  const [relatedInquiryRecord, setRelatedInquiryRecord] = useState(null);
  const [linkedProperties, setLinkedProperties] = useState([]);
  const [isLinkedPropertiesLoading, setIsLinkedPropertiesLoading] = useState(false);
  const [linkedPropertiesError, setLinkedPropertiesError] = useState("");
  const [affiliations, setAffiliations] = useState([]);
  const [isAffiliationsLoading, setIsAffiliationsLoading] = useState(false);
  const [affiliationsError, setAffiliationsError] = useState("");
  const [workspacePropertyLookupRecords, setWorkspacePropertyLookupRecords] = useState([]);
  const [isWorkspacePropertyLookupLoading, setIsWorkspacePropertyLookupLoading] = useState(false);
  const [workspacePropertyLookupError, setWorkspacePropertyLookupError] = useState("");
  const [workspacePropertySearchValue, setWorkspacePropertySearchValue] = useState("");
  const [selectedWorkspacePropertyId, setSelectedWorkspacePropertyId] = useState("");
  const [jobActivities, setJobActivities] = useState([]);
  const [jobMaterials, setJobMaterials] = useState([]);
  const [isWorkspaceSectionsLoading, setIsWorkspaceSectionsLoading] = useState(false);
  const [workspaceSectionsError, setWorkspaceSectionsError] = useState("");
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState("related-data");
  const [mountedWorkspaceTabs, setMountedWorkspaceTabs] = useState(() => ({
    "related-data": true,
  }));
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [invoiceActiveTab, setInvoiceActiveTab] = useState("");
  const [invoiceActiveTabVersion, setInvoiceActiveTabVersion] = useState(0);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [appointmentModalMode, setAppointmentModalMode] = useState("create");
  const [editingAppointmentId, setEditingAppointmentId] = useState("");
  const [isUploadsModalOpen, setIsUploadsModalOpen] = useState(false);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [propertyModalMode, setPropertyModalMode] = useState("create");
  const [affiliationModalState, setAffiliationModalState] = useState({
    open: false,
    initialData: null,
  });
  const [shouldAutoSelectNewAffiliation, setShouldAutoSelectNewAffiliation] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [activityModalMode, setActivityModalMode] = useState("create");
  const [editingActivityId, setEditingActivityId] = useState("");
  const [isMaterialModalOpen, setIsMaterialModalOpen] = useState(false);
  const [materialModalMode, setMaterialModalMode] = useState("create");
  const [editingMaterialId, setEditingMaterialId] = useState("");
  const [quotePaymentDetails, setQuotePaymentDetails] = useState(EMPTY_QUOTE_PAYMENT_DETAILS);
  const [isQuoteWorkflowUpdating, setIsQuoteWorkflowUpdating] = useState(false);
  const [isDuplicatingJob, setIsDuplicatingJob] = useState(false);
  const [isCreatingCallback, setIsCreatingCallback] = useState(false);
  const [isAccountDetailsLoading, setIsAccountDetailsLoading] = useState(false);
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
    onModeChange: null,
    allowModeSwitch: false,
    titleVerb: "Update",
    initialValues: null,
  });
  const [contactLogs, setContactLogs] = useState([]);
  const [isContactLogsLoading, setIsContactLogsLoading] = useState(false);
  const [contactLogsError, setContactLogsError] = useState("");
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [areFloatingWidgetsVisible, setAreFloatingWidgetsVisible] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [memoFocusRequest, setMemoFocusRequest] = useState({ memoId: "", key: 0 });
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const memoFileInputRef = useRef(null);
  const menuRootRef = useRef(null);
  const serviceProviderPrefilledRef = useRef(false);
  const jobTakenByAutofillRef = useRef(new Set());
  const normalizedQuoteAccountType = toText(loadedAccountType).toLowerCase();
  const isQuoteCompanyAccount = isCompanyAccountType(normalizedQuoteAccountType);
  const relatedRecordsAccountType =
    isQuoteCompanyAccount || (toText(loadedClientEntityId) && !toText(loadedClientIndividualId))
      ? "Company"
      : "Contact";
  const relatedRecordsAccountId =
    relatedRecordsAccountType === "Company"
      ? toText(loadedClientEntityId || loadedClientIndividualId)
      : toText(loadedClientIndividualId || loadedClientEntityId);
  const isRelatedDataTabMounted = Boolean(mountedWorkspaceTabs["related-data"]);

  useEffect(() => {
    if (!openMenu) return undefined;
    const handleOutsideClick = (event) => {
      if (!menuRootRef.current || menuRootRef.current.contains(event.target)) return;
      setOpenMenu("");
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [openMenu]);

  useEffect(() => {
    serviceProviderPrefilledRef.current = false;
    setAllocatedServiceProviderId("");
    setAllocatedJobTakenById("");
    setResolvedJobId("");
    setIsJobAllocationPrefillResolved(false);
    setIsLoadedJobTakenByMissing(false);
    setRelatedInquiryId("");
    setRelatedInquiryUid("");
    setLoadedJobStatus("");
    setIsPcaDone(false);
    setIsPrestartDone(false);
    setIsMarkComplete(false);
    setIsMarkCompleteConfirmOpen(false);
    setPendingMarkCompleteValue(false);
    setLoadedAccountType("");
    setLoadedClientEntityId("");
    setLoadedClientIndividualId("");
    setLoadedPropertyId("");
    setLoadedAccountsContactId("");
    setAccountContactRecord(null);
    setAccountCompanyRecord(null);
    setRelatedInquiryRecord(null);
    setLinkedProperties([]);
    setIsLinkedPropertiesLoading(false);
    setLinkedPropertiesError("");
    setAffiliations([]);
    setIsAffiliationsLoading(false);
    setAffiliationsError("");
    setWorkspacePropertyLookupRecords([]);
    setIsWorkspacePropertyLookupLoading(false);
    setWorkspacePropertyLookupError("");
    setWorkspacePropertySearchValue("");
    setSelectedWorkspacePropertyId("");
    setJobActivities([]);
    setJobMaterials([]);
    setIsWorkspaceSectionsLoading(false);
    setWorkspaceSectionsError("");
    setActiveWorkspaceTab("related-data");
    setMountedWorkspaceTabs({ "related-data": true });
    setIsTasksModalOpen(false);
    setInvoiceActiveTab("");
    setInvoiceActiveTabVersion(0);
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setEditingAppointmentId("");
    setIsUploadsModalOpen(false);
    setIsAddPropertyOpen(false);
    setPropertyModalMode("create");
    setAffiliationModalState({ open: false, initialData: null });
    setShouldAutoSelectNewAffiliation(false);
    setIsActivityModalOpen(false);
    setActivityModalMode("create");
    setEditingActivityId("");
    setIsMaterialModalOpen(false);
    setMaterialModalMode("create");
    setEditingMaterialId("");
    setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
    setIsQuoteWorkflowUpdating(false);
    setContactLogs([]);
    setIsContactLogsLoading(false);
    setContactLogsError("");
    setJobEmailContactSearchValue("");
    setAccountsContactSearchValue("");
    setSelectedJobEmailContactId("");
    setSelectedAccountsContactId("");
    setIsSavingQuoteContacts(false);
    setCompanyLookupRecords([]);
    setContactLookupRecords([]);
    setIsCompanyLookupLoading(false);
    setIsContactLookupLoading(false);
    setContactModalState({
      open: false,
      mode: "individual",
      onSave: null,
      onModeChange: null,
      allowModeSwitch: false,
      titleVerb: "Update",
      initialValues: null,
    });
    setIsAccountDetailsLoading(false);
  }, [jobNumericId, safeUid]);

  useEffect(() => {
    if (!isSdkReady || !plugin || isNewJob) {
      setAllocatedServiceProviderId("");
      setAllocatedJobTakenById("");
      setResolvedJobId("");
      setIsJobAllocationPrefillResolved(false);
      setIsLoadedJobTakenByMissing(false);
      setRelatedInquiryId("");
      setRelatedInquiryUid("");
      setLoadedJobStatus("");
      setIsPcaDone(false);
      setIsPrestartDone(false);
      setIsMarkComplete(false);
      setLoadedAccountType("");
      setLoadedClientEntityId("");
      setLoadedClientIndividualId("");
      setLoadedPropertyId("");
      setLoadedAccountsContactId("");
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setRelatedInquiryRecord(null);
      setLinkedProperties([]);
      setIsLinkedPropertiesLoading(false);
      setLinkedPropertiesError("");
      setAffiliations([]);
      setIsAffiliationsLoading(false);
      setAffiliationsError("");
      setWorkspacePropertyLookupRecords([]);
      setIsWorkspacePropertyLookupLoading(false);
      setWorkspacePropertyLookupError("");
      setWorkspacePropertySearchValue("");
      setSelectedWorkspacePropertyId("");
      setJobActivities([]);
      setJobMaterials([]);
      setIsWorkspaceSectionsLoading(false);
      setWorkspaceSectionsError("");
      setActiveWorkspaceTab("related-data");
      setMountedWorkspaceTabs({ "related-data": true });
      setIsTasksModalOpen(false);
      setInvoiceActiveTab("");
    setInvoiceActiveTabVersion(0);
      setIsAppointmentModalOpen(false);
      setAppointmentModalMode("create");
      setEditingAppointmentId("");
      setIsUploadsModalOpen(false);
      setIsAddPropertyOpen(false);
      setPropertyModalMode("create");
      setAffiliationModalState({ open: false, initialData: null });
      setShouldAutoSelectNewAffiliation(false);
      setIsActivityModalOpen(false);
      setActivityModalMode("create");
      setEditingActivityId("");
      setIsMaterialModalOpen(false);
      setMaterialModalMode("create");
      setEditingMaterialId("");
      setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
      setJobEmailContactSearchValue("");
      setAccountsContactSearchValue("");
      setSelectedJobEmailContactId("");
      setSelectedAccountsContactId("");
      setIsSavingQuoteContacts(false);
      setIsAccountDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setIsJobAllocationPrefillResolved(false);
    const jobModel = plugin.switchTo?.("PeterpmJob");
    if (!jobModel?.query) {
      setAllocatedServiceProviderId("");
      setAllocatedJobTakenById("");
      setResolvedJobId("");
      setLoadedJobStatus("");
      setIsJobAllocationPrefillResolved(true);
      setIsLoadedJobTakenByMissing(false);
      setRelatedInquiryId("");
      setRelatedInquiryUid("");
      setIsPcaDone(false);
      setIsPrestartDone(false);
      setIsMarkComplete(false);
      setLoadedAccountType("");
      setLoadedClientEntityId("");
      setLoadedClientIndividualId("");
      setLoadedPropertyId("");
      setLoadedAccountsContactId("");
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setRelatedInquiryRecord(null);
      setLinkedProperties([]);
      setIsLinkedPropertiesLoading(false);
      setLinkedPropertiesError("");
      setAffiliations([]);
      setIsAffiliationsLoading(false);
      setAffiliationsError("");
      setWorkspacePropertyLookupRecords([]);
      setIsWorkspacePropertyLookupLoading(false);
      setWorkspacePropertyLookupError("");
      setWorkspacePropertySearchValue("");
      setSelectedWorkspacePropertyId("");
      setJobActivities([]);
      setJobMaterials([]);
      setIsWorkspaceSectionsLoading(false);
      setWorkspaceSectionsError("");
      setActiveWorkspaceTab("related-data");
      setMountedWorkspaceTabs({ "related-data": true });
      setIsTasksModalOpen(false);
      setInvoiceActiveTab("");
    setInvoiceActiveTabVersion(0);
      setIsAppointmentModalOpen(false);
      setAppointmentModalMode("create");
      setEditingAppointmentId("");
      setIsUploadsModalOpen(false);
      setIsAddPropertyOpen(false);
      setPropertyModalMode("create");
      setAffiliationModalState({ open: false, initialData: null });
      setShouldAutoSelectNewAffiliation(false);
      setIsActivityModalOpen(false);
      setActivityModalMode("create");
      setEditingActivityId("");
      setIsMaterialModalOpen(false);
      setMaterialModalMode("create");
      setEditingMaterialId("");
      setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
      setJobEmailContactSearchValue("");
      setAccountsContactSearchValue("");
      setSelectedJobEmailContactId("");
      setSelectedAccountsContactId("");
      setIsSavingQuoteContacts(false);
      setIsAccountDetailsLoading(false);
      return () => {
        cancelled = true;
      };
    }

    const loadInitialJobData = async () => {
      try {
        let job = null;
        if (jobNumericId) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "id",
            value: jobNumericId,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (!job && safeUid && !isNewJob) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "unique_id",
            value: safeUid,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (!job && safeUid && /^\d+$/.test(safeUid)) {
          job = await fetchSingleJobRecord({
            jobModel,
            field: "id",
            value: safeUid,
            selectFields: JOB_INITIAL_SELECT_FIELDS,
          });
        }
        if (cancelled) return;
        const resolvedId = toText(job?.id || job?.ID);
        const resolvedTakenBy = resolvedId
          ? await fetchJobTakenByValue({ jobModel, jobId: resolvedId })
          : { value: "" };
        if (cancelled) return;
        const resolvedTakenById = toText(resolvedTakenBy?.value);
        setResolvedJobId(resolvedId);
        setAllocatedServiceProviderId(
          toText(job?.primary_service_provider_id || job?.Primary_Service_Provider_ID)
        );
        setAllocatedJobTakenById(resolvedTakenById);
        const resolvedInquiryId = toText(job?.inquiry_record_id || job?.Inquiry_Record_ID);
        setRelatedInquiryId(resolvedInquiryId);
        const resolvedInquiryUid = resolvedInquiryId
          ? await fetchInquiryUidById({ plugin, inquiryId: resolvedInquiryId })
          : "";
        if (cancelled) return;
        setRelatedInquiryUid(resolvedInquiryUid);
        setIsPcaDone(pickBooleanValue(job, ["pca_done", "PCA_Done"]));
        setIsPrestartDone(pickBooleanValue(job, ["prestart_done", "Prestart_Done"]));
        setIsMarkComplete(pickBooleanValue(job, ["mark_complete", "Mark_Complete"]));
        setLoadedAccountType(toText(job?.account_type || job?.Account_Type));
        setLoadedClientEntityId(toText(job?.client_entity_id || job?.Client_Entity_ID));
        setLoadedClientIndividualId(
          toText(job?.client_individual_id || job?.Client_Individual_ID)
        );
        const resolvedPropertyId = toText(job?.property_id || job?.Property_ID);
        setLoadedPropertyId(resolvedPropertyId);
        setSelectedWorkspacePropertyId(resolvedPropertyId);
        const resolvedAccountsContactId = toText(
          job?.accounts_contact_id || job?.Accounts_Contact_ID
        );
        setLoadedAccountsContactId(resolvedAccountsContactId);
        setSelectedAccountsContactId(resolvedAccountsContactId);
        setQuotePaymentDetails(buildQuotePaymentDetailsFromJob(job));
        setAccountContactRecord(null);
        setAccountCompanyRecord(null);
        setLoadedJobStatus(toText(job?.job_status || job?.job_Status || job?.Job_Status));
        setIsLoadedJobTakenByMissing(Boolean(resolvedId && !resolvedTakenById));
        setIsJobAllocationPrefillResolved(true);
      } catch (lookupError) {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to load job data on page load", lookupError);
        setAllocatedServiceProviderId("");
        setAllocatedJobTakenById("");
        setResolvedJobId("");
        setLoadedJobStatus("");
        setIsJobAllocationPrefillResolved(true);
        setIsLoadedJobTakenByMissing(false);
        setRelatedInquiryId("");
        setRelatedInquiryUid("");
        setIsPcaDone(false);
        setIsPrestartDone(false);
        setIsMarkComplete(false);
        setLoadedAccountType("");
        setLoadedClientEntityId("");
        setLoadedClientIndividualId("");
        setLoadedPropertyId("");
        setLoadedAccountsContactId("");
        setAccountContactRecord(null);
        setAccountCompanyRecord(null);
        setRelatedInquiryRecord(null);
        setLinkedProperties([]);
        setIsLinkedPropertiesLoading(false);
        setLinkedPropertiesError("");
        setAffiliations([]);
        setIsAffiliationsLoading(false);
        setAffiliationsError("");
        setWorkspacePropertyLookupRecords([]);
        setIsWorkspacePropertyLookupLoading(false);
        setWorkspacePropertyLookupError("");
        setWorkspacePropertySearchValue("");
        setSelectedWorkspacePropertyId("");
        setJobActivities([]);
        setJobMaterials([]);
        setIsWorkspaceSectionsLoading(false);
        setWorkspaceSectionsError("");
        setActiveWorkspaceTab("related-data");
        setMountedWorkspaceTabs({ "related-data": true });
        setIsTasksModalOpen(false);
        setInvoiceActiveTab("");
    setInvoiceActiveTabVersion(0);
        setIsAppointmentModalOpen(false);
        setAppointmentModalMode("create");
        setEditingAppointmentId("");
        setIsUploadsModalOpen(false);
        setIsAddPropertyOpen(false);
        setPropertyModalMode("create");
        setAffiliationModalState({ open: false, initialData: null });
        setShouldAutoSelectNewAffiliation(false);
        setIsActivityModalOpen(false);
        setActivityModalMode("create");
        setEditingActivityId("");
        setIsMaterialModalOpen(false);
        setMaterialModalMode("create");
        setEditingMaterialId("");
        setQuotePaymentDetails(EMPTY_QUOTE_PAYMENT_DETAILS);
        setJobEmailContactSearchValue("");
        setAccountsContactSearchValue("");
        setSelectedJobEmailContactId("");
        setSelectedAccountsContactId("");
        setIsSavingQuoteContacts(false);
        setIsAccountDetailsLoading(false);
      }
    };

    loadInitialJobData();

    return () => {
      cancelled = true;
    };
  }, [isNewJob, isSdkReady, jobNumericId, plugin, safeUid]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setIsAccountDetailsLoading(false);
      return;
    }
    const jobId = toText(effectiveJobId);
    if (!jobId) {
      setAccountContactRecord(null);
      setAccountCompanyRecord(null);
      setIsAccountDetailsLoading(false);
      return;
    }

    let cancelled = false;
    setIsAccountDetailsLoading(true);
    const loadAccountDetails = async () => {
      try {
        const detailedJob = await fetchDetailedJobRecord({
          plugin,
          field: "id",
          value: jobId,
        });
        if (cancelled) return;

        const jobContactRaw =
          detailedJob?.Client_Individual || detailedJob?.client_individual || null;
        const jobCompanyRaw =
          detailedJob?.Client_Entity || detailedJob?.client_entity || null;
        const jobPropertyRaw = detailedJob?.Property || detailedJob?.property || null;
        const jobContact = Array.isArray(jobContactRaw) ? jobContactRaw[0] || null : jobContactRaw;
        let jobCompany = Array.isArray(jobCompanyRaw) ? jobCompanyRaw[0] || null : jobCompanyRaw;
        let resolvedJobContact = jobContact || null;
        let resolvedJobProperty = Array.isArray(jobPropertyRaw)
          ? jobPropertyRaw[0] || null
          : jobPropertyRaw || null;
        const resolvedCompanyId = toText(
          detailedJob?.client_entity_id ||
            detailedJob?.Client_Entity_ID ||
            jobCompany?.id ||
            jobCompany?.ID ||
            loadedClientEntityId
        );
        const resolvedContactId = toText(
          detailedJob?.client_individual_id ||
            detailedJob?.Client_Individual_ID ||
            resolvedJobContact?.id ||
            resolvedJobContact?.ID ||
            loadedClientIndividualId
        );
        const resolvedPropertyId = toText(
          detailedJob?.property_id ||
            detailedJob?.Property_ID ||
            resolvedJobProperty?.id ||
            resolvedJobProperty?.ID ||
            resolvedJobProperty?.Property_ID ||
            loadedPropertyId
        );

        const companyAccountType = toText(
          jobCompany?.account_type || jobCompany?.Account_Type || loadedAccountType
        );
        const hasNestedPrimaryPerson = Boolean(
          toText(jobCompany?.Primary_Person?.id) ||
            toText(jobCompany?.Primary_Person?.email) ||
            toText(jobCompany?.primary_person?.id) ||
            toText(jobCompany?.primary_person?.email)
        );
        const needsCompanyRefresh = Boolean(
          resolvedCompanyId &&
            (!jobCompany ||
              !toText(jobCompany?.id || jobCompany?.ID) ||
              !hasNestedPrimaryPerson ||
              !toText(jobCompany?.account_type || jobCompany?.Account_Type) ||
              (isBodyCorpCompanyAccountType(companyAccountType) &&
                !toText(jobCompany?.Body_Corporate_Company?.name) &&
                !toText(jobCompany?.body_corporate_company?.name) &&
                !toText(jobCompany?.Body_Corporate_Company?.id) &&
                !toText(jobCompany?.body_corporate_company?.id)))
        );
        if (needsCompanyRefresh) {
          try {
            const fetchedCompany = await fetchCompanyAccountRecordById({
              plugin,
              companyId: resolvedCompanyId,
            });
            if (cancelled) return;
            if (fetchedCompany) {
              jobCompany = {
                ...(jobCompany && typeof jobCompany === "object" ? jobCompany : {}),
                ...fetchedCompany,
                Primary_Person:
                  fetchedCompany?.Primary_Person ||
                  jobCompany?.Primary_Person ||
                  jobCompany?.primary_person,
                Body_Corporate_Company:
                  fetchedCompany?.Body_Corporate_Company ||
                  jobCompany?.Body_Corporate_Company ||
                  jobCompany?.body_corporate_company,
              };
            }
          } catch (companyLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading company account details", companyLoadError);
          }
        }

        // Re-read account type from the (potentially refreshed) company record
        const resolvedCompanyAccountType = toText(
          jobCompany?.account_type || jobCompany?.Account_Type || loadedAccountType
        );

        const needsContactRefresh = Boolean(
          resolvedContactId &&
            (!resolvedJobContact ||
              !toText(resolvedJobContact?.id || resolvedJobContact?.ID) ||
              (!toText(resolvedJobContact?.first_name) &&
                !toText(resolvedJobContact?.last_name) &&
                !toText(resolvedJobContact?.email)))
        );
        if (needsContactRefresh) {
          try {
            const fetchedContact = await fetchContactAccountRecordById({
              plugin,
              contactId: resolvedContactId,
            });
            if (cancelled) return;
            if (fetchedContact) {
              resolvedJobContact = {
                ...(resolvedJobContact && typeof resolvedJobContact === "object"
                  ? resolvedJobContact
                  : {}),
                ...fetchedContact,
              };
            }
          } catch (contactLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading contact account details", contactLoadError);
          }
        }

        const needsBodyCorpFallback =
          isBodyCorpCompanyAccountType(resolvedCompanyAccountType) &&
          !toText(jobCompany?.Body_Corporate_Company?.name) &&
          !toText(jobCompany?.body_corporate_company?.name) &&
          !toText(jobCompany?.Body_Corporate_Company?.id) &&
          !toText(jobCompany?.body_corporate_company?.id) &&
          toText(relatedInquiryId);

        if (needsBodyCorpFallback) {
          try {
            const inquiryRecord = await fetchInquiryAccountContextById({
              plugin,
              inquiryId: relatedInquiryId,
            });
            if (cancelled) return;
            const inquiryCompany = normalizeInquiryCompanyRecord(inquiryRecord || {});
            const inquiryBodyCorp =
              inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company;
            if (jobCompany && inquiryBodyCorp) {
              jobCompany = {
                ...jobCompany,
                Body_Corporate_Company: inquiryBodyCorp,
              };
            }
          } catch (inquiryLoadError) {
            if (cancelled) return;
            console.warn(
              "[JobDetailsBlank] Failed loading inquiry body corp context for account details",
              inquiryLoadError
            );
          }
        }

        if ((!resolvedJobProperty || !toText(resolvedJobProperty?.id || resolvedJobProperty?.ID)) && resolvedPropertyId) {
          try {
            resolvedJobProperty = await fetchPropertyRecordById({
              plugin,
              propertyId: resolvedPropertyId,
            });
          } catch (propertyLoadError) {
            if (cancelled) return;
            console.warn("[JobDetailsBlank] Failed loading property details", propertyLoadError);
          }
        }

        if (resolvedPropertyId) {
          const normalizedProperty = normalizePropertyLookupRecord(
            resolvedJobProperty || { id: resolvedPropertyId }
          );
          setLoadedPropertyId((previous) => toText(previous || normalizedProperty.id));
          setSelectedWorkspacePropertyId((previous) => toText(previous || normalizedProperty.id));
          setWorkspacePropertyLookupRecords((previous) =>
            mergePropertyLookupRecords(previous, [normalizedProperty])
          );
          setLinkedProperties((previous) =>
            mergePropertyLookupRecords(previous, [normalizedProperty])
          );
        }

        setAccountContactRecord(resolvedJobContact || null);
        setAccountCompanyRecord(jobCompany || null);
      } catch (loadError) {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading account details", loadError);
        setAccountContactRecord(null);
        setAccountCompanyRecord(null);
      } finally {
        if (cancelled) return;
        setIsAccountDetailsLoading(false);
      }
    };

    loadAccountDetails();

    return () => {
      cancelled = true;
    };
  }, [
    effectiveJobId,
    isSdkReady,
    loadedAccountType,
    loadedClientEntityId,
    loadedClientIndividualId,
    loadedPropertyId,
    plugin,
    relatedInquiryId,
  ]);

  const searchCompaniesInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setCompanyLookupRecords([]);
        setIsCompanyLookupLoading(false);
        return [];
      }
      setIsCompanyLookupLoading(true);
      try {
        const records = await searchCompaniesForLookup({
          plugin,
          query: toText(query),
          limit: 25,
        });
        const normalized = Array.isArray(records) ? records : [];
        setCompanyLookupRecords(normalized);
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Company lookup search failed", lookupError);
        setCompanyLookupRecords([]);
        return [];
      } finally {
        setIsCompanyLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  const searchContactsInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setContactLookupRecords([]);
        setIsContactLookupLoading(false);
        return [];
      }
      setIsContactLookupLoading(true);
      try {
        const records = await searchContactsForLookup({
          plugin,
          query: toText(query),
          limit: 50,
        });
        const normalized = Array.isArray(records) ? records : [];
        setContactLookupRecords(normalized);
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Contact lookup search failed", lookupError);
        setContactLookupRecords([]);
        return [];
      } finally {
        setIsContactLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  const searchWorkspacePropertiesInDatabase = useCallback(
    async (query = "") => {
      if (!isSdkReady || !plugin) {
        setWorkspacePropertyLookupRecords([]);
        setIsWorkspacePropertyLookupLoading(false);
        setWorkspacePropertyLookupError("");
        return [];
      }
      setIsWorkspacePropertyLookupLoading(true);
      setWorkspacePropertyLookupError("");
      try {
        const records = await searchPropertiesForLookup({
          plugin,
          query: toText(query),
          limit: 50,
        });
        const normalized = mergePropertyLookupRecords(Array.isArray(records) ? records : []);
        setWorkspacePropertyLookupRecords((previous) =>
          mergePropertyLookupRecords(previous, normalized)
        );
        return normalized;
      } catch (lookupError) {
        console.error("[JobDetailsBlank] Property lookup search failed", lookupError);
        setWorkspacePropertyLookupRecords([]);
        setWorkspacePropertyLookupError(lookupError?.message || "Unable to search properties.");
        return [];
      } finally {
        setIsWorkspacePropertyLookupLoading(false);
      }
    },
    [isSdkReady, plugin]
  );

  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    void searchCompaniesInDatabase("");
    void searchContactsInDatabase("");
  }, [isSdkReady, plugin, searchCompaniesInDatabase, searchContactsInDatabase]);

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setWorkspacePropertyLookupRecords([]);
      setIsWorkspacePropertyLookupLoading(false);
      setWorkspacePropertyLookupError("");
      return;
    }
    let cancelled = false;
    setIsWorkspacePropertyLookupLoading(true);
    setWorkspacePropertyLookupError("");
    fetchPropertiesForSearch({ plugin })
      .then((records) => {
        if (cancelled) return;
        setWorkspacePropertyLookupRecords(
          mergePropertyLookupRecords(Array.isArray(records) ? records : [])
        );
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to fetch properties for lookup", lookupError);
        setWorkspacePropertyLookupRecords([]);
        setWorkspacePropertyLookupError(lookupError?.message || "Unable to load properties.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsWorkspacePropertyLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !relatedRecordsAccountId) {
      setLinkedProperties([]);
      setIsLinkedPropertiesLoading(false);
      setLinkedPropertiesError("");
      return;
    }

    let cancelled = false;
    setIsLinkedPropertiesLoading(true);
    setLinkedPropertiesError("");
    fetchLinkedPropertiesByAccount({
      plugin,
      accountType: relatedRecordsAccountType,
      accountId: relatedRecordsAccountId,
    })
      .then((records) => {
        if (cancelled) return;
        const normalized = mergePropertyLookupRecords(Array.isArray(records) ? records : []);
        setLinkedProperties(normalized);
        setWorkspacePropertyLookupRecords((previous) =>
          mergePropertyLookupRecords(previous, normalized)
        );
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading linked properties", loadError);
        setLinkedProperties([]);
        setLinkedPropertiesError(loadError?.message || "Unable to load linked properties.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsLinkedPropertiesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, relatedRecordsAccountId, relatedRecordsAccountType]);

  const serviceProviderItems = useMemo(
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
            email: toText(provider?.email || provider?.work_email || provider?.Work_Email),
            sms_number: toText(
              provider?.sms_number || provider?.mobile_number || provider?.Mobile_Number
            ),
          };
        })
        .filter(Boolean),
    [serviceProviderLookup]
  );

  const jobTakenByItems = useMemo(
    () =>
      (Array.isArray(jobTakenByLookup) ? jobTakenByLookup : [])
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
    [jobTakenByLookup]
  );

  const companyItems = useMemo(
    () =>
      (Array.isArray(companyLookupRecords) ? companyLookupRecords : [])
        .map((company) => {
          const id = toText(company?.id || company?.ID || company?.Company_ID);
          if (!id) return null;
          return {
            id,
            label: formatCompanyLookupLabel(company),
          };
        })
        .filter(Boolean),
    [companyLookupRecords]
  );

  const contactItems = useMemo(
    () =>
      (Array.isArray(contactLookupRecords) ? contactLookupRecords : [])
        .map((contact) => {
          const id = toText(contact?.id || contact?.ID || contact?.Contact_ID);
          if (!id) return null;
          return {
            id,
            label: formatContactLookupLabel(contact),
          };
        })
        .filter(Boolean),
    [contactLookupRecords]
  );
  const workspacePropertySearchItems = useMemo(
    () =>
      (Array.isArray(workspacePropertyLookupRecords) ? workspacePropertyLookupRecords : [])
        .map((property) => {
          const id = toText(property?.id || property?.ID || property?.Property_ID);
          if (!id) return null;
          const uniqueId = toText(property?.unique_id || property?.Unique_ID);
          const propertyName = toText(
            property?.property_name ||
              property?.Property_Name ||
              property?.address_1 ||
              property?.Address_1 ||
              property?.address ||
              property?.Address
          );
          const label = propertyName || uniqueId || `Property #${id}`;
          const meta = [
            uniqueId,
            toText(property?.address_1 || property?.Address_1 || property?.address || property?.Address),
            toText(property?.suburb_town || property?.Suburb_Town || property?.city || property?.City),
            toText(property?.state || property?.State),
            toText(property?.postal_code || property?.Postal_Code),
          ]
            .filter(Boolean)
            .join(" | ");
          return {
            id,
            label,
            meta,
          };
        })
        .filter(Boolean),
    [workspacePropertyLookupRecords]
  );
  const linkedWorkspaceProperties = useMemo(
    () => (Array.isArray(linkedProperties) ? linkedProperties : []),
    [linkedProperties]
  );
  const activeWorkspaceProperty = useMemo(
    () => {
      const selectedId = toText(selectedWorkspacePropertyId || loadedPropertyId);
      if (selectedId) {
        const fromLookup = (Array.isArray(workspacePropertyLookupRecords)
          ? workspacePropertyLookupRecords
          : []
        ).find(
          (property) =>
            toText(property?.id || property?.ID || property?.Property_ID) === selectedId
        );
        const fromLinked = linkedWorkspaceProperties.find(
          (property) =>
            toText(property?.id || property?.ID || property?.Property_ID) === selectedId
        );
        if (fromLookup && fromLinked) return { ...fromLinked, ...fromLookup };
        if (fromLookup) return fromLookup;
        if (fromLinked) return fromLinked;
      }
      return linkedWorkspaceProperties[0] || null;
    },
    [linkedWorkspaceProperties, loadedPropertyId, selectedWorkspacePropertyId, workspacePropertyLookupRecords]
  );
  const relatedRecords = useRelatedRecordsData({
    plugin,
    accountType: relatedRecordsAccountType,
    accountId: relatedRecordsAccountId,
  });
  const contextualRelatedDeal = useMemo(() => {
    const resolvedId = toText(relatedInquiryRecord?.id || relatedInquiryRecord?.ID || relatedInquiryId);
    const resolvedUid = toText(
      relatedInquiryRecord?.unique_id || relatedInquiryRecord?.Unique_ID || relatedInquiryUid
    );
    const resolvedDealName = toText(
      relatedInquiryRecord?.deal_name || relatedInquiryRecord?.Deal_Name
    );
    if (!resolvedId && !resolvedUid) return null;
    return {
      ...(relatedInquiryRecord && typeof relatedInquiryRecord === "object" ? relatedInquiryRecord : {}),
      id: resolvedId,
      unique_id: resolvedUid,
      deal_name: resolvedDealName,
    };
  }, [relatedInquiryId, relatedInquiryRecord, relatedInquiryUid]);
  const contextualCurrentJob = useMemo(() => {
    const resolvedJobId = toText(effectiveJobId);
    const resolvedJobUid = toText(safeUid);
    const propertyName = toText(
      activeWorkspaceProperty?.property_name ||
        activeWorkspaceProperty?.Property_Name ||
        activeWorkspaceProperty?.address_1 ||
        activeWorkspaceProperty?.Address_1 ||
        activeWorkspaceProperty?.address ||
        activeWorkspaceProperty?.Address
    );
    if (!resolvedJobId && !resolvedJobUid) return null;
    return {
      id: resolvedJobId,
      unique_id: resolvedJobUid,
      job_status: toText(loadedJobStatus),
      quote_status: toText(quotePaymentDetails?.quote_status),
      property_name: propertyName,
    };
  }, [activeWorkspaceProperty, effectiveJobId, loadedJobStatus, quotePaymentDetails?.quote_status, safeUid]);
  const relatedDealsForDisplay = useMemo(
    () =>
      mergeRelatedRecordCollections(
        relatedRecords?.relatedDeals,
        contextualRelatedDeal ? [contextualRelatedDeal] : [],
        getRelatedDealRecordKey
      ),
    [contextualRelatedDeal, relatedRecords?.relatedDeals]
  );
  const relatedJobsForDisplay = useMemo(
    () =>
      mergeRelatedRecordCollections(
        relatedRecords?.relatedJobs,
        contextualCurrentJob ? [contextualCurrentJob] : [],
        getRelatedJobRecordKey
      ),
    [contextualCurrentJob, relatedRecords?.relatedJobs]
  );
  const workspaceLookupData = useMemo(
    () => ({
      contacts: Array.isArray(contactLookupRecords) ? contactLookupRecords : [],
      companies: Array.isArray(companyLookupRecords) ? companyLookupRecords : [],
      properties: Array.isArray(workspacePropertyLookupRecords) ? workspacePropertyLookupRecords : [],
      serviceProviders: Array.isArray(serviceProviderLookup) ? serviceProviderLookup : [],
    }),
    [companyLookupRecords, contactLookupRecords, serviceProviderLookup, workspacePropertyLookupRecords]
  );
  const jobDirectBootstrapJobData = useMemo(() => {
    const selectedAccountsContactIdText = toText(selectedAccountsContactId);
    const selectedAffiliation = selectedAccountsContactIdText
      ? (Array.isArray(affiliations) ? affiliations : []).find(
          (a) => toText(a?.id) === selectedAccountsContactIdText
        )
      : null;
    const clientContactFirstName = toText(
      accountContactRecord?.first_name || accountContactRecord?.First_Name
    );
    const clientContactLastName = toText(
      accountContactRecord?.last_name || accountContactRecord?.Last_Name
    );
    const clientContactEmail = toText(
      accountContactRecord?.email || accountContactRecord?.Email
    );
    const clientCompanyName = toText(
      accountCompanyRecord?.name || accountCompanyRecord?.Name
    );
    const clientCompanyEmail = toText(
      accountCompanyRecord?.Primary_Person?.email ||
        accountCompanyRecord?.Primary_Person?.Email ||
        accountCompanyRecord?.primary_person?.email ||
        accountCompanyRecord?.primary_person?.Email
    );
    const acFirstName =
      toText(selectedAffiliation?.contact_first_name) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase()) ? clientCompanyName : clientContactFirstName);
    const acLastName =
      toText(selectedAffiliation?.contact_last_name) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase()) ? "" : clientContactLastName);
    const acEmail =
      toText(
        selectedAffiliation?.contact_email ||
          selectedAffiliation?.company_as_accounts_contact_email
      ) ||
      (isCompanyAccountType(toText(loadedAccountType).toLowerCase())
        ? clientCompanyEmail
        : clientContactEmail);
    const contactXeroId = toText(
      accountContactRecord?.xero_contact_id || accountContactRecord?.Xero_Contact_ID
    );
    const companyXeroId = toText(
      accountCompanyRecord?.xero_contact_id || accountCompanyRecord?.Xero_Contact_ID
    );
    return {
      id: toText(effectiveJobId),
      ID: toText(effectiveJobId),
      unique_id: safeUid,
      Unique_ID: safeUid,
      inquiry_record_id: toText(relatedInquiryId),
      Inquiry_Record_ID: toText(relatedInquiryId),
      account_type: toText(loadedAccountType),
      Account_Type: toText(loadedAccountType),
      client_entity_id: toText(loadedClientEntityId),
      Client_Entity_ID: toText(loadedClientEntityId),
      client_individual_id: toText(loadedClientIndividualId),
      Client_Individual_ID: toText(loadedClientIndividualId),
      property_id: toText(selectedWorkspacePropertyId || loadedPropertyId),
      Property_ID: toText(selectedWorkspacePropertyId || loadedPropertyId),
      activities: Array.isArray(jobActivities) ? jobActivities : [],
      materials: Array.isArray(jobMaterials) ? jobMaterials : [],
      // Accounts contact name/email for invoice section
      accounts_contact_contact_first_name: acFirstName,
      Accounts_Contact_Contact_First_Name: acFirstName,
      accounts_contact_contact_last_name: acLastName,
      Accounts_Contact_Contact_Last_Name: acLastName,
      accounts_contact_contact_email: acEmail,
      Accounts_Contact_Contact_Email: acEmail,
      // Xero contact IDs for invoice section
      Client_Individual_Xero_Contact_ID: contactXeroId,
      client_individual_xero_contact_id: contactXeroId,
      Client_Entity_Xero_Contact_ID: companyXeroId,
      client_entity_xero_contact_id: companyXeroId,
    };
  }, [
    accountCompanyRecord,
    accountContactRecord,
    affiliations,
    effectiveJobId,
    jobActivities,
    jobMaterials,
    loadedAccountType,
    loadedClientEntityId,
    loadedClientIndividualId,
    loadedPropertyId,
    relatedInquiryId,
    safeUid,
    selectedAccountsContactId,
    selectedWorkspacePropertyId,
  ]);

  const jobEmailFallbackLabel = useMemo(() => {
    const selectedId = toText(selectedJobEmailContactId);
    if (!selectedId) return "";
    if (isQuoteCompanyAccount) {
      return formatCompanyLookupLabel({
        id: selectedId,
        name: toText(accountCompanyRecord?.name || accountCompanyRecord?.Name),
        phone: toText(accountCompanyRecord?.phone || accountCompanyRecord?.Phone),
        account_type: toText(
          accountCompanyRecord?.account_type ||
            accountCompanyRecord?.Account_Type ||
            loadedAccountType
        ),
      });
    }
    return formatContactLookupLabel({
      id: selectedId,
      first_name: toText(accountContactRecord?.first_name || accountContactRecord?.First_Name),
      last_name: toText(accountContactRecord?.last_name || accountContactRecord?.Last_Name),
      email: toText(accountContactRecord?.email || accountContactRecord?.Email),
      sms_number: toText(accountContactRecord?.sms_number || accountContactRecord?.SMS_Number),
    });
  }, [
    accountCompanyRecord,
    accountContactRecord,
    isQuoteCompanyAccount,
    loadedAccountType,
    selectedJobEmailContactId,
  ]);

  const jobEmailItems = useMemo(() => {
    const baseItems = isQuoteCompanyAccount ? companyItems : contactItems;
    const selectedId = toText(selectedJobEmailContactId);
    if (!selectedId) return baseItems;
    if (baseItems.some((item) => toText(item?.id) === selectedId)) return baseItems;
    return [
      {
        id: selectedId,
        label: jobEmailFallbackLabel || selectedId,
      },
      ...baseItems,
    ];
  }, [
    companyItems,
    contactItems,
    isQuoteCompanyAccount,
    jobEmailFallbackLabel,
    selectedJobEmailContactId,
  ]);

  const affiliationItems = useMemo(
    () =>
      (Array.isArray(affiliations) ? affiliations : [])
        .map((affiliation) => toAffiliationOption(affiliation))
        .filter((item) => Boolean(toText(item?.id))),
    [affiliations]
  );
  const accountsContactItems = useMemo(() => {
    const selectedId = toText(selectedAccountsContactId);
    if (!selectedId) return affiliationItems;
    if (affiliationItems.some((item) => toText(item?.id) === selectedId)) return affiliationItems;
    return [
      {
        id: selectedId,
        label: selectedId,
      },
      ...affiliationItems,
    ];
  }, [affiliationItems, selectedAccountsContactId]);

  const resolvedJobEmailSelectionLabel = useMemo(() => {
    const selected = jobEmailItems.find(
      (item) => toText(item?.id) === toText(selectedJobEmailContactId)
    );
    if (selected?.label) return toText(selected.label);
    if (jobEmailContactSearchValue) return toText(jobEmailContactSearchValue);
    return jobEmailFallbackLabel || toText(selectedJobEmailContactId);
  }, [
    jobEmailContactSearchValue,
    jobEmailFallbackLabel,
    jobEmailItems,
    selectedJobEmailContactId,
  ]);

  const resolvedAccountsContactSelectionLabel = useMemo(() => {
    const selectedId = toText(selectedAccountsContactId);
    if (!selectedId) return "";
    const selected = accountsContactItems.find((item) => toText(item?.id) === selectedId);
    if (selected?.label) return toText(selected.label);
    const legacyMatch = accountsContactItems.find((item) =>
      Array.isArray(item?.legacyIds) ? item.legacyIds.includes(selectedId) : false
    );
    return toText(legacyMatch?.label || selectedId);
  }, [accountsContactItems, selectedAccountsContactId]);

  const jobTakenByStoredId = toText(allocatedJobTakenById);
  const jobTakenByIdResolved = jobTakenByStoredId || configuredAdminProviderId;
  const jobTakenBySelectedLookupRecord = useMemo(
    () =>
      (Array.isArray(jobTakenByLookup) ? jobTakenByLookup : []).find(
        (provider) => toText(provider?.id || provider?.ID) === jobTakenByIdResolved
      ) || null,
    [jobTakenByIdResolved, jobTakenByLookup]
  );
  const jobTakenByPrefillLabel = useMemo(() => {
    if (!jobTakenByIdResolved) return "";
    if (jobTakenBySelectedLookupRecord) {
      return formatServiceProviderInputLabel(jobTakenBySelectedLookupRecord);
    }
    return `Provider #${jobTakenByIdResolved}`;
  }, [jobTakenByIdResolved, jobTakenBySelectedLookupRecord]);

  const updateJobTakenByWithFallback = useCallback(
    async ({ jobId, providerId } = {}) => {
      const normalizedJobId = toText(jobId);
      const normalizedProviderId = toText(providerId);
      if (!plugin?.switchTo || !normalizedJobId) {
        throw new Error("Job ID is missing.");
      }
      if (!normalizedProviderId) {
        throw new Error("Select admin first.");
      }
      const jobModel = plugin.switchTo("PeterpmJob");
      if (!jobModel?.query) {
        throw new Error("Job context is not ready.");
      }

      let lastError = null;
      for (const fieldName of JOB_TAKEN_BY_FIELD_ALIASES) {
        try {
          await updateJobFieldsById({
            plugin,
            jobId: normalizedJobId,
            payload: {
              [fieldName]: normalizedProviderId,
            },
          });

          const verified = await fetchJobTakenByValue({
            jobModel,
            jobId: normalizedJobId,
          });
          if (!verified?.resolved || toText(verified?.value) === normalizedProviderId) {
            return true;
          }
          lastError = new Error(`Unable to verify ${fieldName} update.`);
        } catch (mutationError) {
          lastError = mutationError;
        }
      }

      throw lastError || new Error("Unable to update job taken by.");
    },
    [plugin]
  );

  useEffect(() => {
    if (serviceProviderPrefilledRef.current) return;

    const providerId = toText(allocatedServiceProviderId);
    if (!providerId) return;
    if (!serviceProviderItems.length) return;

    const selectedId = toText(selectedServiceProviderId);
    if (selectedId && selectedId !== providerId) {
      serviceProviderPrefilledRef.current = true;
      return;
    }

    const matchedProvider = serviceProviderItems.find(
      (item) => toText(item?.id) === providerId
    );

    setSelectedServiceProviderId(providerId);
    setServiceProviderSearch(
      toText(matchedProvider?.valueLabel || matchedProvider?.label) || `Provider #${providerId}`
    );
    serviceProviderPrefilledRef.current = true;
  }, [allocatedServiceProviderId, selectedServiceProviderId, serviceProviderItems]);

  useEffect(() => {
    const currentId = toText(jobTakenBySelectedLookupRecord?.id || jobTakenByIdResolved);
    setSelectedJobTakenById(currentId);
    setJobTakenBySearch(currentId ? jobTakenByPrefillLabel : "");
  }, [jobTakenByIdResolved, jobTakenByPrefillLabel, jobTakenBySelectedLookupRecord?.id]);

  useEffect(() => {
    const nextJobEmailId = isQuoteCompanyAccount
      ? toText(loadedClientEntityId)
      : toText(loadedClientIndividualId);
    setSelectedJobEmailContactId(nextJobEmailId);
  }, [
    isQuoteCompanyAccount,
    loadedClientEntityId,
    loadedClientIndividualId,
  ]);

  useEffect(() => {
    setSelectedAccountsContactId(toText(loadedAccountsContactId));
  }, [loadedAccountsContactId]);

  useEffect(() => {
    const currentSelectedId = toText(selectedAccountsContactId);
    if (!currentSelectedId || !accountsContactItems.length) return;
    if (accountsContactItems.some((item) => toText(item?.id) === currentSelectedId)) return;
    const legacyMatch = accountsContactItems.find((item) =>
      Array.isArray(item?.legacyIds) ? item.legacyIds.includes(currentSelectedId) : false
    );
    if (!legacyMatch?.id) return;
    setSelectedAccountsContactId(toText(legacyMatch.id));
  }, [accountsContactItems, selectedAccountsContactId]);

  useEffect(() => {
    if (!selectedJobEmailContactId) {
      setJobEmailContactSearchValue("");
      return;
    }
    const selected = jobEmailItems.find(
      (item) => toText(item?.id) === toText(selectedJobEmailContactId)
    );
    setJobEmailContactSearchValue(
      toText(selected?.label || jobEmailFallbackLabel || selectedJobEmailContactId)
    );
  }, [jobEmailFallbackLabel, jobEmailItems, selectedJobEmailContactId]);

  useEffect(() => {
    if (!selectedAccountsContactId) {
      setAccountsContactSearchValue("");
      return;
    }
    const selected = accountsContactItems.find(
      (item) => toText(item?.id) === toText(selectedAccountsContactId)
    );
    setAccountsContactSearchValue(toText(selected?.label || selectedAccountsContactId));
  }, [accountsContactItems, selectedAccountsContactId]);

  useEffect(() => {
    if (!isSdkReady || !plugin) return;
    if (isNewJob) return;
    if (!isJobAllocationPrefillResolved) return;
    if (!isLoadedJobTakenByMissing) return;
    if (!effectiveJobId) return;
    if (!configuredAdminProviderId) return;

    const marker = `${effectiveJobId}:${configuredAdminProviderId}`;
    if (jobTakenByAutofillRef.current.has(marker)) return;
    jobTakenByAutofillRef.current.add(marker);

    let cancelled = false;
    updateJobTakenByWithFallback({
      jobId: effectiveJobId,
      providerId: configuredAdminProviderId,
    })
      .then(() => {
        if (cancelled) return;
        setAllocatedJobTakenById(configuredAdminProviderId);
        setIsLoadedJobTakenByMissing(false);
      })
      .catch((autoAssignError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to auto-set job taken by", autoAssignError);
        jobTakenByAutofillRef.current.delete(marker);
      });

    return () => {
      cancelled = true;
    };
  }, [
    configuredAdminProviderId,
    effectiveJobId,
    isNewJob,
    isJobAllocationPrefillResolved,
    isLoadedJobTakenByMissing,
    isSdkReady,
    plugin,
    updateJobTakenByWithFallback,
  ]);

  useEffect(() => {
    const normalizedLoadedPropertyId = toText(loadedPropertyId);
    if (!normalizedLoadedPropertyId) return;
    setSelectedWorkspacePropertyId(normalizedLoadedPropertyId);
  }, [loadedPropertyId]);

  useEffect(() => {
    if (selectedWorkspacePropertyId) return;
    const fallbackPropertyId = toText(
      loadedPropertyId ||
        linkedWorkspaceProperties[0]?.id ||
        linkedWorkspaceProperties[0]?.ID ||
        linkedWorkspaceProperties[0]?.Property_ID
    );
    if (!fallbackPropertyId) return;
    setSelectedWorkspacePropertyId(fallbackPropertyId);
  }, [linkedWorkspaceProperties, loadedPropertyId, selectedWorkspacePropertyId]);

  useEffect(() => {
    if (!selectedWorkspacePropertyId) {
      setWorkspacePropertySearchValue("");
      return;
    }
    const selected = workspacePropertySearchItems.find(
      (item) => toText(item?.id) === toText(selectedWorkspacePropertyId)
    );
    setWorkspacePropertySearchValue(
      toText(selected?.label || activeWorkspaceProperty?.property_name || selectedWorkspacePropertyId)
    );
  }, [
    activeWorkspaceProperty?.property_name,
    selectedWorkspacePropertyId,
    workspacePropertySearchItems,
  ]);

  useEffect(() => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!isSdkReady || !plugin || !propertyId) {
      setAffiliations([]);
      setIsAffiliationsLoading(false);
      setAffiliationsError("");
      return;
    }

    let cancelled = false;
    setIsAffiliationsLoading(true);
    setAffiliationsError("");
    fetchPropertyAffiliationsForDetails({
      plugin,
      propertyId,
    })
      .then((records) => {
        if (cancelled) return;
        setAffiliations(Array.isArray(records) ? records : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading property affiliations", loadError);
        setAffiliations([]);
        setAffiliationsError(loadError?.message || "Unable to load property contacts.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsAffiliationsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, loadedPropertyId, plugin, selectedWorkspacePropertyId]);

  useEffect(() => {
    setMountedWorkspaceTabs((previous) => ({
      ...(previous || {}),
      [activeWorkspaceTab]: true,
    }));
  }, [activeWorkspaceTab]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !relatedInquiryId) {
      setRelatedInquiryRecord(null);
      return;
    }
    let cancelled = false;
    fetchInquiryAccountContextById({ plugin, inquiryId: relatedInquiryId })
      .then((record) => {
        if (cancelled) return;
        setRelatedInquiryRecord(record || null);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading related inquiry details", loadError);
        setRelatedInquiryRecord(null);
      });
    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin, relatedInquiryId]);

  useEffect(() => {
    if (!isSdkReady || !plugin || !effectiveJobId) {
      setJobActivities([]);
      setJobMaterials([]);
      setIsWorkspaceSectionsLoading(false);
      setWorkspaceSectionsError("");
      return;
    }

    let cancelled = false;
    setIsWorkspaceSectionsLoading(true);
    setWorkspaceSectionsError("");

    Promise.all([
      fetchActivitiesByJobId({ plugin, jobId: effectiveJobId }),
      fetchMaterialsByJobId({ plugin, jobId: effectiveJobId }),
    ])
      .then(([activities, materials]) => {
        if (cancelled) return;
        setJobActivities(Array.isArray(activities) ? activities : []);
        setJobMaterials(Array.isArray(materials) ? materials : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed loading job workspace sections", loadError);
        setJobActivities([]);
        setJobMaterials([]);
        setWorkspaceSectionsError(loadError?.message || "Unable to load activities and materials.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsWorkspaceSectionsLoading(false);
      });

    const unsubscribeActivities = subscribeActivitiesByJobId({
      plugin,
      jobId: effectiveJobId,
      onChange: (records) => {
        if (cancelled) return;
        setJobActivities(Array.isArray(records) ? records : []);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Activities subscription failed", streamError);
      },
    });
    const unsubscribeMaterials = subscribeMaterialsByJobId({
      plugin,
      jobId: effectiveJobId,
      onChange: (records) => {
        if (cancelled) return;
        setJobMaterials(Array.isArray(records) ? records : []);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Materials subscription failed", streamError);
      },
    });

    return () => {
      cancelled = true;
      unsubscribeActivities?.();
      unsubscribeMaterials?.();
    };
  }, [effectiveJobId, isSdkReady, plugin]);

  // Real-time sync: update quote/payment status when external changes arrive
  // (e.g. customer accepts quote on the public job sheet page)
  useEffect(() => {
    if (!isSdkReady || !plugin || !effectiveJobId) return;

    const jobModel = plugin.switchTo?.("PeterpmJob");
    if (!jobModel?.query) return;

    const numericId = /^\d+$/.test(effectiveJobId) ? Number(effectiveJobId) : effectiveJobId;
    const query = jobModel
      .query()
      .where("id", numericId)
      .deSelectAll()
      .select(["id", "quote_status", "payment_status"])
      .noDestroy();

    query.getOrInitQueryCalc?.();

    let stream = null;
    let subscription = null;
    try {
      stream = typeof query.subscribe === "function" ? query.subscribe() : null;
      if (!stream && typeof query.localSubscribe === "function") {
        stream = query.localSubscribe();
      }
      if (stream && typeof stream.subscribe === "function") {
        subscription = stream.subscribe({
          next: (payload) => {
            const record = extractFirstRecord(payload);
            if (!record) return;
            const nextQuoteStatus = toText(record.quote_status || record.Quote_Status);
            const nextPaymentStatus = toText(record.payment_status || record.Payment_Status);
            setQuotePaymentDetails((prev) => {
              if (
                nextQuoteStatus === prev.quote_status &&
                nextPaymentStatus === prev.payment_status
              ) {
                return prev;
              }
              return {
                ...prev,
                ...(nextQuoteStatus ? { quote_status: nextQuoteStatus } : {}),
                ...(nextPaymentStatus ? { payment_status: nextPaymentStatus } : {}),
              };
            });
          },
          error: (err) => {
            console.warn("[JobDetailsBlank] Quote status subscription error", err);
          },
        });
      }
    } catch (err) {
      console.warn("[JobDetailsBlank] Failed to set up quote status subscription", err);
    }

    return () => {
      try {
        subscription?.unsubscribe?.();
        query?.destroy?.();
      } catch (_) {}
    };
  }, [effectiveJobId, isSdkReady, plugin]);

  const handleToggleRelatedInquiryLink = useCallback(
    async (deal = {}) => {
      if (isSavingLinkedInquiry || !effectiveJobId) return;
      const dealId = toText(deal?.id || deal?.ID);
      if (!dealId) {
        error("Save failed", "Selected inquiry is missing a record ID.");
        return;
      }
      const dealUid = toText(deal?.unique_id || deal?.Unique_ID || deal?.id || deal?.ID);
      const isCurrentlySelected = Boolean(relatedInquiryId) && relatedInquiryId === dealId;
      const nextInquiryId = isCurrentlySelected ? "" : dealId;
      const nextInquiryUid = isCurrentlySelected ? "" : dealUid;

      setIsSavingLinkedInquiry(true);
      try {
        await updateJobFieldsById({
          plugin,
          jobId: effectiveJobId,
          payload: { inquiry_record_id: nextInquiryId },
        });
        setRelatedInquiryId(nextInquiryId);
        setRelatedInquiryUid(nextInquiryUid);
        if (isCurrentlySelected) {
          success("Inquiry unlinked", "Inquiry link was removed.");
        } else {
          success("Inquiry linked", `Job linked to ${nextInquiryUid || nextInquiryId}.`);
        }
      } catch (saveError) {
        console.error("[JobDetailsBlank] Failed to update linked inquiry", saveError);
        error("Save failed", saveError?.message || "Unable to update linked inquiry.");
      } finally {
        setIsSavingLinkedInquiry(false);
      }
    },
    [effectiveJobId, error, isSavingLinkedInquiry, plugin, relatedInquiryId, success]
  );

  const jobStatusLabel = loadedJobStatus || routeJobStatus || (isNewJob ? "New" : "Quote Created");
  const jobStatusStyle = useMemo(
    () => resolveJobStatusStyle(jobStatusLabel),
    [jobStatusLabel]
  );
  const hasRelatedInquiry = Boolean(toText(relatedInquiryUid));
  const relatedInquiryDetailsPath = useMemo(() => {
    if (!hasRelatedInquiry) return "";
    return `/inquiry-details/${encodeURIComponent(toText(relatedInquiryUid))}`;
  }, [hasRelatedInquiry, relatedInquiryUid]);
  const accountPrimaryContact = accountContactRecord || {};
  const accountCompany = accountCompanyRecord || {};
  const accountCompanyPrimaryRaw =
    accountCompany?.Primary_Person || accountCompany?.primary_person || {};
  const accountCompanyPrimaryNested = Array.isArray(accountCompanyPrimaryRaw)
    ? accountCompanyPrimaryRaw[0] || {}
    : accountCompanyPrimaryRaw || {};
  const accountCompanyPrimary = {
    first_name:
      accountCompanyPrimaryNested?.first_name ||
      accountCompanyPrimaryNested?.First_Name ||
      accountCompany?.Primary_Person_First_Name,
    last_name:
      accountCompanyPrimaryNested?.last_name ||
      accountCompanyPrimaryNested?.Last_Name ||
      accountCompany?.Primary_Person_Last_Name,
    email:
      accountCompanyPrimaryNested?.email ||
      accountCompanyPrimaryNested?.Email ||
      accountCompany?.Primary_Person_Email,
    sms_number:
      accountCompanyPrimaryNested?.sms_number ||
      accountCompanyPrimaryNested?.SMS_Number ||
      accountCompany?.Primary_Person_SMS_Number,
  };
  const accountType = toText(loadedAccountType);
  const normalizedAccountType = accountType.toLowerCase();
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const hasAccountContactDetails = Boolean(
    fullName(
      accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name,
      accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name
    ) ||
      toText(accountPrimaryContact?.email || accountPrimaryContact?.Email) ||
      toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number) ||
      toText(accountPrimaryContact?.address || accountPrimaryContact?.Address)
  );
  const hasAccountCompanyDetails = Boolean(
    toText(accountCompany?.name || accountCompany?.Name) ||
      toText(accountCompany?.phone || accountCompany?.Phone) ||
      toText(accountCompany?.address || accountCompany?.Address)
  );
  const companyAccountType = toText(
    accountCompany?.account_type || accountCompany?.Account_Type || accountType
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasAccountContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasAccountCompanyDetails);
  const contactPopupComment = toText(
    accountContactRecord?.popup_comment || accountContactRecord?.Popup_Comment
  );
  const companyPopupComment = toText(
    accountCompanyRecord?.popup_comment || accountCompanyRecord?.Popup_Comment
  );
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasMemoContext = Boolean(effectiveJobId);
  const contactLogsContactId = useMemo(() => {
    if (isCompanyAccount) {
      return toText(
        accountCompanyPrimaryNested?.id ||
          accountCompanyPrimaryNested?.ID ||
          accountCompany?.Primary_Person?.id ||
          accountCompany?.Primary_Person?.ID ||
          accountCompany?.primary_person?.id ||
          accountCompany?.primary_person?.ID
      );
    }
    return toText(loadedClientIndividualId);
  }, [
    accountCompany?.Primary_Person,
    accountCompany?.primary_person,
    accountCompanyPrimaryNested?.ID,
    accountCompanyPrimaryNested?.id,
    isCompanyAccount,
    loadedClientIndividualId,
  ]);
  const { profile: currentUserProfile } = useCurrentUserProfile();
  const currentUserId = toText(currentUserProfile?.id || APP_USER?.id);
  const currentUserMemoAuthor = useMemo(
    () => ({
      id: currentUserId,
      display_name: toText(currentUserProfile?.displayName),
      first_name: toText(currentUserProfile?.firstName),
      last_name: toText(currentUserProfile?.lastName),
      profile_image: toText(currentUserProfile?.profileImage),
      email: toText(currentUserProfile?.email),
      sms_number: toText(currentUserProfile?.smsNumber),
    }),
    [
      currentUserId,
      currentUserProfile?.displayName,
      currentUserProfile?.email,
      currentUserProfile?.firstName,
      currentUserProfile?.lastName,
      currentUserProfile?.profileImage,
      currentUserProfile?.smsNumber,
    ]
  );
  const resolveMemoAuthor = useCallback(
    (author = {}, authorId = "") => {
      if (!currentUserId || toText(authorId) !== currentUserId) {
        return author || {};
      }

      return {
        ...currentUserMemoAuthor,
        ...(author && typeof author === "object" ? author : {}),
        id: toText(author?.id) || currentUserMemoAuthor.id,
        display_name: toText(author?.display_name || author?.Display_Name) || currentUserMemoAuthor.display_name,
        first_name: toText(author?.first_name || author?.First_Name) || currentUserMemoAuthor.first_name,
        last_name: toText(author?.last_name || author?.Last_Name) || currentUserMemoAuthor.last_name,
        profile_image:
          toText(author?.profile_image || author?.Profile_Image) || currentUserMemoAuthor.profile_image,
        email: toText(author?.email || author?.Email) || currentUserMemoAuthor.email,
        sms_number:
          toText(author?.sms_number || author?.SMS_Number) || currentUserMemoAuthor.sms_number,
      };
    },
    [currentUserId, currentUserMemoAuthor]
  );

  const accountContactName = fullName(
    accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name,
    accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name
  );
  const accountContactEmail = toText(accountPrimaryContact?.email || accountPrimaryContact?.Email);
  const accountContactPhone = toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number || accountPrimaryContact?.office_phone || accountPrimaryContact?.Office_Phone);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail)
    ? toMailHref(accountContactEmail)
    : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone)
    ? toTelHref(accountContactPhone)
    : "";
  const accountContactAddress = joinAddress([
    accountPrimaryContact?.address || accountPrimaryContact?.Address,
    accountPrimaryContact?.city || accountPrimaryContact?.City,
    accountPrimaryContact?.state || accountPrimaryContact?.State,
    accountPrimaryContact?.zip_code || accountPrimaryContact?.Zip_Code,
  ]);
  const accountContactAddressHref = toGoogleMapsHref(accountContactAddress);

  const accountCompanyName = toText(accountCompany?.name || accountCompany?.Name);
  const accountCompanyPhone = toText(accountCompany?.phone || accountCompany?.Phone);
  const accountCompanyPhoneHref = isLikelyPhoneValue(accountCompanyPhone)
    ? toTelHref(accountCompanyPhone)
    : "";
  const accountCompanyAddress = joinAddress([
    accountCompany?.address || accountCompany?.Address,
    accountCompany?.city || accountCompany?.City,
    accountCompany?.state || accountCompany?.State,
    accountCompany?.postal_code || accountCompany?.Postal_Code || accountCompany?.zip_code || accountCompany?.Zip_Code,
  ]);
  const accountCompanyAddressHref = toGoogleMapsHref(accountCompanyAddress);
  const accountCompanyPrimaryName = fullName(
    accountCompanyPrimary?.first_name || accountCompanyPrimary?.First_Name,
    accountCompanyPrimary?.last_name || accountCompanyPrimary?.Last_Name
  );
  const accountCompanyPrimaryEmail = toText(
    accountCompanyPrimary?.email || accountCompanyPrimary?.Email
  );
  const accountCompanyPrimaryEmailHref = isLikelyEmailValue(accountCompanyPrimaryEmail)
    ? toMailHref(accountCompanyPrimaryEmail)
    : "";
  const accountCompanyPrimaryPhone = toText(
    accountCompanyPrimary?.sms_number || accountCompanyPrimary?.SMS_Number
  );
  const accountCompanyPrimaryPhoneHref = isLikelyPhoneValue(accountCompanyPrimaryPhone)
    ? toTelHref(accountCompanyPrimaryPhone)
    : "";
  const accountBodyCorpRaw =
    accountCompany?.Body_Corporate_Company || accountCompany?.body_corporate_company || null;
  const accountBodyCorpCompany = Array.isArray(accountBodyCorpRaw)
    ? accountBodyCorpRaw[0] || {}
    : accountBodyCorpRaw || {};
  const accountBodyCorpName = toText(
    accountBodyCorpCompany?.name ||
      accountBodyCorpCompany?.Name ||
      accountCompany?.Body_Corporate_Company_Name
  );
  const accountBodyCorpType = toText(
    accountBodyCorpCompany?.type ||
      accountBodyCorpCompany?.Type ||
      accountCompany?.Body_Corporate_Company_Type
  );
  const accountBodyCorpPhone = toText(
    accountBodyCorpCompany?.phone ||
      accountBodyCorpCompany?.Phone ||
      accountCompany?.Body_Corporate_Company_Phone
  );
  const accountBodyCorpPhoneHref = isLikelyPhoneValue(accountBodyCorpPhone)
    ? toTelHref(accountBodyCorpPhone)
    : "";
  const accountBodyCorpAddress = joinAddress([
    accountBodyCorpCompany?.address ||
      accountBodyCorpCompany?.Address ||
      accountCompany?.Body_Corporate_Company_Address,
    accountBodyCorpCompany?.city ||
      accountBodyCorpCompany?.City ||
      accountCompany?.Body_Corporate_Company_City,
    accountBodyCorpCompany?.state ||
      accountBodyCorpCompany?.State ||
      accountCompany?.Body_Corporate_Company_State,
    accountBodyCorpCompany?.postal_code ||
      accountBodyCorpCompany?.Postal_Code ||
      accountCompany?.Body_Corporate_Company_Postal_Code,
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
  const activePropertyAddress = joinAddress([
    activeWorkspaceProperty?.address_1 || activeWorkspaceProperty?.Address_1 || activeWorkspaceProperty?.address,
    activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town || activeWorkspaceProperty?.city,
    activeWorkspaceProperty?.state || activeWorkspaceProperty?.State,
    activeWorkspaceProperty?.postal_code || activeWorkspaceProperty?.Postal_Code,
  ]);
  const uploadsPropertyId = toText(
    activeWorkspaceProperty?.id ||
      activeWorkspaceProperty?.ID ||
      activeWorkspaceProperty?.Property_ID ||
      selectedWorkspacePropertyId ||
      loadedPropertyId
  );
  const appointmentPrefillContext = useMemo(() => {
    const hostId = toText(selectedServiceProviderId || allocatedServiceProviderId);
    const selectedHost = serviceProviderItems.find((item) => toText(item?.id) === hostId);
    const hostLabel = toText(selectedHost?.label || serviceProviderSearch || hostId);
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    const propertyLabel = toText(
      activeWorkspaceProperty?.property_name ||
        activeWorkspaceProperty?.Property_Name ||
        workspacePropertySearchValue ||
        activePropertyAddress
    );
    const accountLabel = isCompanyAccount
      ? toText(accountCompanyName || accountCompanyPrimaryName)
      : toText(accountContactName);
    return {
      accountType: isCompanyAccount ? "Company" : "Contact",
      locationId: propertyId,
      locationLabel: propertyLabel,
      hostId,
      hostLabel,
      guestId: isCompanyAccount ? toText(loadedClientEntityId) : toText(loadedClientIndividualId),
      guestLabel: accountLabel,
      title: [safeUid, accountLabel, propertyLabel].filter(Boolean).join(" | "),
      description: [propertyLabel, activePropertyAddress].filter(Boolean).join("\n"),
    };
  }, [
    accountCompanyName,
    accountCompanyPrimaryName,
    accountContactName,
    activePropertyAddress,
    activeWorkspaceProperty?.Property_Name,
    activeWorkspaceProperty?.property_name,
    allocatedServiceProviderId,
    isCompanyAccount,
    loadedClientEntityId,
    loadedClientIndividualId,
    loadedPropertyId,
    safeUid,
    selectedServiceProviderId,
    selectedWorkspacePropertyId,
    serviceProviderItems,
    serviceProviderSearch,
    workspacePropertySearchValue,
  ]);
  const reviewJobSheetHtml = useMemo(() => {
    const accountLabel = isCompanyAccount ? accountCompanyName || accountCompanyPrimaryName : accountContactName;
    const accountAddressLabel = isCompanyAccount ? accountCompanyAddress : accountContactAddress;
    const residentsRows = [
      [accountContactName, accountContactPhone].filter(Boolean).join("  Ph: "),
      [accountCompanyPrimaryName, accountCompanyPrimaryPhone].filter(Boolean).join("  Ph: "),
    ].filter(Boolean);
    const activitiesRows = (Array.isArray(jobActivities) ? jobActivities : [])
      .filter((item) => {
        const val = item?.include_in_quote ?? item?.Include_in_Quote ?? item?.Include_In_Quote;
        return val === true || String(val || "").toLowerCase() === "true";
      })
      .map((item, index) => ({
        key: toText(item?.id || item?.ID || index + 1),
        task: toText(item?.task || item?.Task),
        option: toText(item?.option || item?.Option),
        service: formatActivityServiceLabel(item) || toText(item?.activity_text),
        qty: toText(item?.quantity || item?.Quantity || "1"),
        price: formatCurrencyDisplay(item?.activity_price || item?.Activity_Price || 0),
      }))
      .filter((row) => row.task || row.option || row.service);

    const recommendationText = toText(
      quotePaymentDetails?.admin_recommendation || relatedInquiryRecord?.recommendations
    );
    const feedbackSection = recommendationText
      ? `
      <div class="js-section-title js-section-title-center">Resident's Feedback</div>
      <div class="js-recommendation"><b>Recommendations:</b> ${escapeHtml(recommendationText)}</div>
      `
      : "";

    const logoAbsUrl = `${window.location.origin}${logoUrl}`;
    return `<style>
  .js-sheet { font-family: Arial, sans-serif; color: #111; font-size: 12px; border: 1px solid #cbd5e1; padding: 10px; }
  .js-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
  .js-logo { max-height: 56px; max-width: 180px; object-fit: contain; }
  .js-top { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
  .js-title { text-align: center; font-weight: 700; font-size: 30px; letter-spacing: .5px; margin: 4px 0 10px; }
  .js-muted { color: #334155; }
  .js-section-title { font-weight: 700; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 3px 0; margin: 8px 0 6px; }
  .js-section-title-center { text-align: center; }
  .js-grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
  .js-recommendation { margin-top: 6px; }
  .js-table { width: 100%; border-collapse: collapse; margin-top: 8px; }
  .js-table th, .js-table td { border: 1px solid #94a3b8; padding: 4px; text-align: left; font-size: 11px; }
  .js-table th { background: #f1f5f9; }
</style>
<div class="js-sheet">
  <div class="js-header">
    <img src="${logoAbsUrl}" class="js-logo" alt="Logo" />
  </div>
  <div class="js-top">
    <div>
      <div><b>Account Name:</b> ${escapeHtml(toText(accountLabel))}</div>
      <div><b>Account Type:</b> ${escapeHtml(toText(accountType || "-"))}</div>
      <div><b>Work Req. By:</b> ${escapeHtml(toText(jobTakenBySearch || jobTakenByPrefillLabel))}</div>
      <div><b>Work Order #:</b> ${escapeHtml(toText(safeUid))}</div>
      <div><b>Job Address:</b> ${escapeHtml(toText(activePropertyAddress || accountAddressLabel))}</div>
      <div><b>Job Suburb:</b> ${escapeHtml(toText(activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town || activeWorkspaceProperty?.city || activeWorkspaceProperty?.City))}</div>
    </div>
    <div class="js-muted"><b>Date:</b> ${escapeHtml(formatDateDisplay(Date.now()))}</div>
  </div>
  <div class="js-title">JOB SHEET</div>
  <div class="js-section-title">Resident's Details</div>
  ${residentsRows.length ? residentsRows.map((row) => `<div>${escapeHtml(row)}</div>`).join("") : "<div>-</div>"}
  ${feedbackSection}
  <div class="js-section-title">Activities</div>
  ${
    activitiesRows.length
      ? `<table class="js-table"><thead><tr><th>Task</th><th>Option</th><th>Service</th><th>Qty</th><th>Price</th></tr></thead><tbody>${
          activitiesRows
            .map(
              (row) =>
                `<tr><td>${escapeHtml(row.task)}</td><td>${escapeHtml(row.option)}</td><td>${escapeHtml(
                  row.service
                )}</td><td>${escapeHtml(row.qty)}</td><td>${escapeHtml(row.price)}</td></tr>`
            )
            .join("")
        }</tbody></table>`
      : "<div>No activities found.</div>"
  }
</div>`;
  }, [
    accountCompanyAddress,
    accountCompanyName,
    accountCompanyPrimaryName,
    accountContactAddress,
    accountContactName,
    accountContactPhone,
    accountType,
    activePropertyAddress,
    activeWorkspaceProperty,
    isCompanyAccount,
    jobActivities,
    jobTakenByPrefillLabel,
    jobTakenBySearch,
    quotePaymentDetails?.admin_recommendation,
    relatedInquiryRecord,
    safeUid,
  ]);
  const quoteHeaderData = useMemo(() => {
    const accountLabel = isCompanyAccount
      ? accountCompanyName || accountCompanyPrimaryName
      : accountContactName;
    const accountAddressLabel = isCompanyAccount ? accountCompanyAddress : accountContactAddress;
    return {
      logoUrl: `${window.location.origin}${logoUrl}`,
      accountName: toText(accountLabel),
      accountType: toText(accountType || "—"),
      workReqBy: toText(jobTakenBySearch || jobTakenByPrefillLabel),
      workOrderUid: toText(safeUid),
      jobAddress: toText(activePropertyAddress || accountAddressLabel),
      jobSuburb: toText(
        activeWorkspaceProperty?.suburb_town ||
        activeWorkspaceProperty?.Suburb_Town ||
        activeWorkspaceProperty?.city ||
        activeWorkspaceProperty?.City
      ),
      date: formatDateDisplay(Date.now()),
      residentsRows: [
        [accountContactName, accountContactPhone].filter(Boolean).join("  Ph: "),
        [accountCompanyPrimaryName, accountCompanyPrimaryPhone].filter(Boolean).join("  Ph: "),
      ].filter(Boolean),
      feedback: null,
      recommendation: toText(
        quotePaymentDetails?.admin_recommendation || relatedInquiryRecord?.recommendations
      ),
    };
  }, [
    accountCompanyAddress,
    accountCompanyName,
    accountCompanyPrimaryName,
    accountCompanyPrimaryPhone,
    accountContactAddress,
    accountContactName,
    accountContactPhone,
    accountType,
    activePropertyAddress,
    activeWorkspaceProperty,
    isCompanyAccount,
    jobTakenByPrefillLabel,
    jobTakenBySearch,
    quotePaymentDetails?.admin_recommendation,
    relatedInquiryRecord,
    safeUid,
  ]);
  const quoteStatusValue = toText(quotePaymentDetails?.quote_status);
  const quoteStatusLabel = quoteStatusValue || "New";
  const quoteStatusNormalized = quoteStatusLabel.toLowerCase();
  const paymentStatusLabel = toText(quotePaymentDetails?.payment_status);
  const hasQuoteStatusValue = Boolean(quoteStatusValue);
  const hasPaymentStatusValue = Boolean(paymentStatusLabel);
  const hasQuoteDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.quote_date));
  const hasFollowUpDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.follow_up_date));
  const hasQuoteValidUntilValue = Boolean(formatDateDisplay(quotePaymentDetails?.quote_valid_until));
  const hasQuoteRequestedDateValue = Boolean(
    formatDateDisplay(quotePaymentDetails?.date_quote_requested)
  );
  const hasQuoteSentDateValue = Boolean(formatDateDisplay(quotePaymentDetails?.date_quote_sent));
  const hasQuoteAcceptedDateValue = Boolean(
    formatDateDisplay(quotePaymentDetails?.date_quoted_accepted)
  );
  const hasPriorityValue = Boolean(toText(quotePaymentDetails?.priority));
  const hasAdminRecommendationValue = Boolean(toText(quotePaymentDetails?.admin_recommendation));
  const hasAnyQuotePaymentDisplayField = Boolean(
    hasQuoteStatusValue ||
      hasPaymentStatusValue ||
      hasQuoteDateValue ||
      hasFollowUpDateValue ||
      hasQuoteValidUntilValue ||
      hasQuoteRequestedDateValue ||
      hasQuoteSentDateValue ||
      hasQuoteAcceptedDateValue ||
      hasPriorityValue ||
      hasAdminRecommendationValue
  );
  const quoteStatusStyle = useMemo(
    () => resolveQuoteStatusStyle(quoteStatusLabel),
    [quoteStatusLabel]
  );
  const paymentStatusStyle = useMemo(
    () => resolvePaymentStatusStyle(paymentStatusLabel),
    [paymentStatusLabel]
  );
  const priorityLabel = toText(quotePaymentDetails?.priority);
  const priorityStyle = useMemo(
    () => (priorityLabel ? resolvePriorityStyle(priorityLabel) : null),
    [priorityLabel]
  );
  const canSendQuote = Boolean(effectiveJobId) &&
    quoteStatusNormalized !== "sent" &&
    quoteStatusNormalized !== "accepted";
  const canAcceptQuote = Boolean(effectiveJobId) && quoteStatusNormalized === "sent";

  const buildQuoteContactPayload = useCallback(() => {
    const selectedJobEmailId = toText(selectedJobEmailContactId);
    const payload = isCompanyAccount
      ? {
          client_entity_id: selectedJobEmailId || null,
          client_individual_id: null,
        }
      : {
          client_individual_id: selectedJobEmailId || null,
          client_entity_id: null,
        };
    return payload;
  }, [isCompanyAccount, selectedJobEmailContactId]);

  const handleSaveQuoteContacts = useCallback(async () => {
    if (isSavingQuoteContacts || isQuoteWorkflowUpdating) return;
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Save failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }

    const selectedAccountsContact = toText(selectedAccountsContactId);
    const selectedJobEmail = toText(selectedJobEmailContactId);

    setIsSavingQuoteContacts(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          ...buildQuoteContactPayload(),
          accounts_contact_id: selectedAccountsContact || null,
        },
      });

      if (isCompanyAccount) {
        setLoadedClientEntityId(selectedJobEmail);
        setLoadedClientIndividualId("");
      } else {
        setLoadedClientIndividualId(selectedJobEmail);
        setLoadedClientEntityId("");
      }
      setLoadedAccountsContactId(selectedAccountsContact);
      success("Contacts saved", "Quote contacts updated.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed saving quote contacts", saveError);
      error("Save failed", saveError?.message || "Unable to update quote contacts.");
    } finally {
      setIsSavingQuoteContacts(false);
    }
  }, [
    buildQuoteContactPayload,
    effectiveJobId,
    error,
    isCompanyAccount,
    isQuoteWorkflowUpdating,
    isSavingQuoteContacts,
    isSdkReady,
    plugin,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    success,
  ]);

  const handleSendQuote = useCallback(async () => {
    if (isQuoteWorkflowUpdating) return;
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Send failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Send failed", "Job ID is missing.");
      return;
    }
    if (!toText(selectedAccountsContactId)) {
      error("Send failed", "Select Accounts Contact before sending quote.");
      return;
    }

    const now = Math.trunc(Date.now() / 1000);
    setIsQuoteWorkflowUpdating(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          quote_status: "Sent",
          date_quote_sent: now,
          accounts_contact_id: toText(selectedAccountsContactId),
          ...buildQuoteContactPayload(),
          ...buildJobLastActionPayload({
            type: "job.quote.send",
            message: "Quote marked as sent.",
            status: LAST_ACTION_STATUSES.SUCCEEDED,
          }),
        },
      });
      setQuotePaymentDetails((previous) => ({
        ...previous,
        quote_status: "Sent",
        date_quote_sent: now,
      }));
      setLoadedAccountsContactId(toText(selectedAccountsContactId));
      if (isCompanyAccount) {
        setLoadedClientEntityId(toText(selectedJobEmailContactId));
        setLoadedClientIndividualId("");
      } else {
        setLoadedClientIndividualId(toText(selectedJobEmailContactId));
        setLoadedClientEntityId("");
      }
      success("Quote sent", "Quote status was updated to Sent.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed sending quote", saveError);
      error("Send failed", saveError?.message || "Unable to mark quote as sent.");
    } finally {
      setIsQuoteWorkflowUpdating(false);
    }
  }, [
    buildQuoteContactPayload,
    effectiveJobId,
    error,
    isCompanyAccount,
    isQuoteWorkflowUpdating,
    isSdkReady,
    plugin,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    success,
  ]);

  const handlePrintJobSheet = useCallback(() => {
    const header = quoteHeaderData || {};
    const activities = (Array.isArray(jobActivities) ? jobActivities : []).filter((a) => {
      const v = a?.include_in_quote ?? a?.Include_in_Quote ?? a?.Include_In_Quote;
      return v === true || String(v).toLowerCase() === "true" || v === 1 || v === "1";
    });

    const formatCurrencyAud = (value) => {
      const n = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
      return Number.isFinite(n)
        ? new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(n)
        : "$0.00";
    };

    const total = activities.reduce((sum, a) => {
      const price = Number(a?.quoted_price ?? a?.Quoted_Price ?? a?.activity_price ?? 0);
      return sum + (Number.isFinite(price) ? price : 0);
    }, 0);
    const gst = total / 11;

    const escHtml = (s) =>
      String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const rowsHtml = activities
      .map((a) => {
        const serviceLabel = formatActivityServiceLabel(a);
        const price = Number(a?.quoted_price ?? a?.Quoted_Price ?? a?.activity_price ?? 0);
        return `<tr>
          <td>${escHtml(a.task || a.Task || "-")}</td>
          <td>${escHtml(a.option || a.Option || "-")}</td>
          <td>${escHtml(serviceLabel || "-")}${a.quoted_text || a.Quoted_Text ? `<br><small>${escHtml(a.quoted_text || a.Quoted_Text)}</small>` : ""}${a.warranty || a.Warranty ? `<br><small>Warranty: ${escHtml(a.warranty || a.Warranty)}</small>` : ""}</td>
          <td style="text-align:right;font-weight:600">${escHtml(formatCurrencyAud(price))}</td>
        </tr>`;
      })
      .join("");

    const residentsHtml = (header.residentsRows || [])
      .map((r) => `<div>${escHtml(r)}</div>`)
      .join("");

    const recommendationHtml = header.recommendation
      ? `<div style="font-size:11px;margin-bottom:10px"><strong>Recommendations:</strong> ${escHtml(header.recommendation)}</div>`
      : "";

    const popup = window.open("", "_blank", "width=960,height=800,scrollbars=yes,resizable=yes");
    if (!popup) {
      error("Popup blocked", "Please allow popups to print the job sheet.");
      return;
    }
    popup.document.write(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Job Sheet — ${escHtml(header.workOrderUid || "")}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #1e293b; padding: 24px; }
  .logo { max-height: 56px; max-width: 180px; object-fit: contain; display: block; margin-bottom: 12px; }
  .title { text-align: center; font-size: 18px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin-bottom: 12px; font-size: 11px; }
  .section-bar { border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; padding: 3px 0; font-size: 11px; font-weight: 700; margin: 10px 0 6px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; margin-bottom: 12px; }
  th, td { border: 1px solid #e2e8f0; padding: 5px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; font-weight: 600; }
  .totals { border: 1px solid #e2e8f0; padding: 10px 14px; margin-bottom: 12px; }
  .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
  .total-row.grand { font-weight: 700; font-size: 13px; border-top: 1px solid #cbd5e1; margin-top: 4px; padding-top: 4px; }
  .feedback-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; font-size: 11px; }
  small { font-size: 10px; color: #64748b; }
  @media print { body { padding: 12px; } button { display: none !important; } }
</style>
</head>
<body>
${header.logoUrl ? `<img class="logo" src="${escHtml(header.logoUrl)}" alt="Logo">` : ""}
<div class="title">JOB SHEET</div>
<div class="info-grid">
  ${header.accountName ? `<div><strong>Account Name:</strong> ${escHtml(header.accountName)}</div>` : ""}
  ${header.accountType ? `<div><strong>Account Type:</strong> ${escHtml(header.accountType)}</div>` : ""}
  ${header.workReqBy ? `<div><strong>Work Req. By:</strong> ${escHtml(header.workReqBy)}</div>` : ""}
  ${header.workOrderUid ? `<div><strong>Work Order #:</strong> ${escHtml(header.workOrderUid)}</div>` : ""}
  ${header.jobAddress ? `<div><strong>Job Address:</strong> ${escHtml(header.jobAddress)}</div>` : ""}
  ${header.jobSuburb ? `<div><strong>Job Suburb:</strong> ${escHtml(header.jobSuburb)}</div>` : ""}
  <div style="text-align:right;grid-column:2"><strong>Date:</strong> ${escHtml(header.date || "")}</div>
</div>
<div class="section-bar">Resident's Details</div>
<div style="margin-bottom:10px;font-size:11px">${residentsHtml || "<div>-</div>"}</div>
${recommendationHtml ? `<div class="section-bar">Resident's Feedback</div>${recommendationHtml}` : ""}
<div class="section-bar">Services</div>
${activities.length ? `<table>
  <thead><tr><th>Task</th><th>Option</th><th>Service</th><th style="text-align:right">Quoted Price</th></tr></thead>
  <tbody>${rowsHtml}</tbody>
</table>` : "<p style='font-size:11px;color:#64748b;margin-bottom:10px'>No activities added to quote.</p>"}
<div class="totals">
  <div class="total-row"><span>GST (incl.)</span><span>${escHtml(formatCurrencyAud(gst))}</span></div>
  <div class="total-row grand"><span>Quote Total (incl. GST)</span><span>${escHtml(formatCurrencyAud(total))}</span></div>
</div>
<div style="text-align:center;margin-top:16px"><button onclick="window.print()" style="padding:8px 20px;font-size:12px;cursor:pointer;background:#003882;color:#fff;border:none;border-radius:4px">Print / Save as PDF</button></div>
</body>
</html>`);
    popup.document.close();
    popup.focus();
  }, [error, jobActivities, quoteHeaderData]);

  const handleAcceptQuote = useCallback(async ({ signatureBlob } = {}) => {
    if (isQuoteWorkflowUpdating) return;
    if (quoteStatusNormalized !== "sent") {
      error("Accept failed", "Quote can be accepted only after it is sent.");
      return;
    }
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady) {
      error("Accept failed", "Job context is not ready.");
      return;
    }
    if (!jobId) {
      error("Accept failed", "Job ID is missing.");
      return;
    }

    const now = Math.trunc(Date.now() / 1000);
    setIsQuoteWorkflowUpdating(true);
    try {
      let signatureUrl = "";
      if (signatureBlob) {
        const signatureFile = new File([signatureBlob], "signature.png", { type: "image/png" });
        const uploaded = await uploadMaterialFile({
          file: signatureFile,
          uploadPath: `signatures/${jobId}`,
        });
        signatureUrl = String(uploaded?.url || "").trim();
      }

      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          quote_status: "Accepted",
          job_status: "In Progress",
          date_quoted_accepted: now,
          terms_and_conditions_accepted: true,
          ...(signatureUrl ? { signature: signatureUrl } : {}),
          ...buildJobLastActionPayload({
            type: "job.quote.accept",
            message: "Quote accepted.",
            status: LAST_ACTION_STATUSES.SUCCEEDED,
          }),
        },
      });
      setQuotePaymentDetails((previous) => ({
        ...previous,
        quote_status: "Accepted",
        date_quoted_accepted: now,
      }));
      setLoadedJobStatus("In Progress");
      success("Quote accepted", "Quote status was updated to Accepted.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Failed accepting quote", saveError);
      error("Accept failed", saveError?.message || "Unable to mark quote as accepted.");
    } finally {
      setIsQuoteWorkflowUpdating(false);
    }
  }, [
    effectiveJobId,
    error,
    isQuoteWorkflowUpdating,
    isSdkReady,
    plugin,
    quoteStatusNormalized,
    success,
    uploadMaterialFile,
  ]);

  const handleDuplicateJob = useCallback(async () => {
    if (!isSdkReady || !effectiveJobId || isDuplicatingJob) return;
    setIsDuplicatingJob(true);
    try {
      await updateJobFieldsById({ plugin, jobId: effectiveJobId, payload: { duplicate_job: true } });
      success("Job duplicated", "A duplicate of this job has been queued.");
    } catch (dupError) {
      console.error("[JobDetailsBlank] Failed duplicating job", dupError);
      error("Duplicate failed", dupError?.message || "Unable to duplicate this job.");
    } finally {
      setIsDuplicatingJob(false);
    }
  }, [effectiveJobId, error, isDuplicatingJob, isSdkReady, plugin, success]);

  const handleCreateCallback = useCallback(async () => {
    if (!isSdkReady || !effectiveJobId || isCreatingCallback) return;
    setIsCreatingCallback(true);
    try {
      await updateJobFieldsById({ plugin, jobId: effectiveJobId, payload: { create_a_callback: true } });
      success("Callback created", "A callback has been created for this job.");
    } catch (cbError) {
      console.error("[JobDetailsBlank] Failed creating callback", cbError);
      error("Callback failed", cbError?.message || "Unable to create a callback.");
    } finally {
      setIsCreatingCallback(false);
    }
  }, [effectiveJobId, error, isCreatingCallback, isSdkReady, plugin, success]);

  const accountEditorContactInitialValues = useMemo(
    () => ({
      id: toText(accountPrimaryContact?.id || accountPrimaryContact?.ID),
      first_name: toText(accountPrimaryContact?.first_name || accountPrimaryContact?.First_Name),
      last_name: toText(accountPrimaryContact?.last_name || accountPrimaryContact?.Last_Name),
      email: toText(accountPrimaryContact?.email || accountPrimaryContact?.Email),
      sms_number: toText(accountPrimaryContact?.sms_number || accountPrimaryContact?.SMS_Number),
      address: toText(accountPrimaryContact?.address || accountPrimaryContact?.Address),
      city: toText(accountPrimaryContact?.city || accountPrimaryContact?.City),
      state: toText(accountPrimaryContact?.state || accountPrimaryContact?.State),
      zip_code: toText(accountPrimaryContact?.zip_code || accountPrimaryContact?.Zip_Code),
      country: "AU",
      postal_country: "AU",
    }),
    [accountPrimaryContact]
  );
  const accountEditorCompanyInitialValues = useMemo(
    () => ({
      id: toText(accountCompany?.id || accountCompany?.ID),
      company_name: toText(accountCompany?.name || accountCompany?.Name),
      company_type: toText(accountCompany?.type || accountCompany?.Type),
      company_description: toText(accountCompany?.description || accountCompany?.Description),
      company_phone: toText(accountCompany?.phone || accountCompany?.Phone),
      company_address: toText(accountCompany?.address || accountCompany?.Address),
      company_city: toText(accountCompany?.city || accountCompany?.City),
      company_state: toText(accountCompany?.state || accountCompany?.State),
      company_postal_code: toText(
        accountCompany?.postal_code || accountCompany?.Postal_Code || accountCompany?.zip_code
      ),
      company_industry: toText(accountCompany?.industry || accountCompany?.Industry),
      company_annual_revenue: toText(
        accountCompany?.annual_revenue || accountCompany?.Annual_Revenue
      ),
      company_number_of_employees: toText(
        accountCompany?.number_of_employees || accountCompany?.Number_of_Employees
      ),
      company_account_type: toText(
        accountCompany?.account_type || accountCompany?.Account_Type || loadedAccountType
      ),
      primary_person_contact_id: toText(accountCompanyPrimary?.id || accountCompanyPrimary?.ID),
      first_name: toText(accountCompanyPrimary?.first_name || accountCompanyPrimary?.First_Name),
      last_name: toText(accountCompanyPrimary?.last_name || accountCompanyPrimary?.Last_Name),
      email: toText(accountCompanyPrimary?.email || accountCompanyPrimary?.Email),
      sms_number: toText(accountCompanyPrimary?.sms_number || accountCompanyPrimary?.SMS_Number),
      country: "AU",
      postal_country: "AU",
    }),
    [accountCompany, accountCompanyPrimary, loadedAccountType]
  );

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

  const handleOpenAccountEditor = useCallback(() => {
    if (!plugin || !effectiveJobId) return;
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
        delete companyPayload.id;
        delete companyPayload.ID;
        delete companyPayload.Company_ID;
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
          draftRecord?.id || draftRecord?.ID || draftRecord?.Company_ID
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
        const preservedContactId = toText(loadedClientIndividualId);

        await updateJobFieldsById({
          plugin,
          jobId: effectiveJobId,
          payload: {
            account_type: "Company",
            Account_Type: "Company",
            client_entity_id: companyId,
            Client_Entity_ID: companyId,
            client_individual_id: preservedContactId || null,
            Client_Individual_ID: preservedContactId || null,
          },
        });
        setLoadedAccountType("Company");
        setLoadedClientEntityId(companyId);
        setLoadedClientIndividualId(preservedContactId || "");
        success("Job updated", "Company account was linked and contact was preserved.");
        return;
      }

      const existingContactId = toText(
        draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
      );
      const contactPayload = {
        ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
      };
      delete contactPayload.id;
      delete contactPayload.ID;
      delete contactPayload.Contact_ID;
      const savedContact = existingContactId
        ? await updateContactFieldsById({
            plugin,
            contactId: existingContactId,
            payload: contactPayload,
          }).then(() => ({ id: existingContactId }))
        : await createContactRecord({
            plugin,
            payload: contactPayload,
          });
      const contactId = toText(savedContact?.id || savedContact?.ID || existingContactId);
      if (!contactId) {
        throw new Error("Unable to resolve contact ID.");
      }
      const preservedCompanyId = toText(loadedClientEntityId);

      await updateJobFieldsById({
        plugin,
        jobId: effectiveJobId,
        payload: {
          account_type: "Contact",
          Account_Type: "Contact",
          client_individual_id: contactId,
          Client_Individual_ID: contactId,
          client_entity_id: preservedCompanyId || null,
          Client_Entity_ID: preservedCompanyId || null,
        },
      });
      setLoadedAccountType("Contact");
      setLoadedClientIndividualId(contactId);
      setLoadedClientEntityId(preservedCompanyId || "");
      success("Job updated", "Contact account was linked and company was preserved.");
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
    effectiveJobId,
    isCompanyAccount,
    loadedClientEntityId,
    loadedClientIndividualId,
    openContactDetailsModal,
    plugin,
    success,
  ]);

  const handleAddJobEmailContact = useCallback(() => {
    const mode = isCompanyAccount ? "entity" : "individual";
    openContactDetailsModal({
      mode,
      titleVerb: "Add",
      allowModeSwitch: false,
      onSave: async (draftRecord) => {
        if (!plugin) {
          throw new Error("SDK plugin is not ready.");
        }

        if (mode === "entity") {
          const companyPayload = {
            ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          };
          delete companyPayload.id;
          delete companyPayload.ID;
          delete companyPayload.Company_ID;
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          const createdCompanyId = toText(createdCompany?.id || createdCompany?.ID);
          await searchCompaniesInDatabase("");
          if (createdCompanyId) {
            setSelectedJobEmailContactId(createdCompanyId);
            setJobEmailContactSearchValue(
              formatCompanyLookupLabel({
                ...createdCompany,
                id: createdCompanyId,
              })
            );
          }
          return;
        }

        const contactPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
        };
        delete contactPayload.id;
        delete contactPayload.ID;
        delete contactPayload.Contact_ID;
        const createdContact = await createContactRecord({
          plugin,
          payload: contactPayload,
        });
        const createdContactId = toText(createdContact?.id || createdContact?.ID);
        await searchContactsInDatabase("");
        if (createdContactId) {
          setSelectedJobEmailContactId(createdContactId);
          setJobEmailContactSearchValue(
            formatContactLookupLabel({
              ...createdContact,
              id: createdContactId,
            })
          );
        }
      },
    });
  }, [
    isCompanyAccount,
    openContactDetailsModal,
    plugin,
    searchCompaniesInDatabase,
    searchContactsInDatabase,
  ]);

  const openAddAffiliationModal = useCallback(({ autoSelect = false } = {}) => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!propertyId) {
      error("Add contact unavailable", "Please link a property first.");
      return;
    }
    setShouldAutoSelectNewAffiliation(Boolean(autoSelect));
    setAffiliationModalState({
      open: true,
      initialData: null,
    });
  }, [error, loadedPropertyId, selectedWorkspacePropertyId]);

  const handleAddAccountsContact = useCallback(() => {
    openAddAffiliationModal({ autoSelect: true });
  }, [openAddAffiliationModal]);

  const handleAffiliationSaved = useCallback(() => {
    const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
    if (!plugin || !propertyId) return;
    fetchPropertyAffiliationsForDetails({ plugin, propertyId })
      .then((records) => {
        setAffiliations(Array.isArray(records) ? records : []);
      })
      .catch((err) => {
        console.warn("[JobDetailsBlank] Failed to refresh affiliations after save", err);
      });
  }, [loadedPropertyId, plugin, selectedWorkspacePropertyId]);

  const closeAffiliationModal = useCallback(() => {
    setAffiliationModalState({
      open: false,
      initialData: null,
    });
  }, []);

  const saveAffiliation = useCallback(
    async (payload, meta = {}) => {
      const propertyId = toText(selectedWorkspacePropertyId || loadedPropertyId);
      if (!plugin) {
        throw new Error("SDK plugin is not ready.");
      }
      if (!propertyId) {
        throw new Error("Property ID is missing.");
      }

      const editId = toText(meta?.id);
      const savedAffiliation = editId
        ? await updateAffiliationRecord({
            plugin,
            id: editId,
            payload,
          })
        : await createAffiliationRecord({
            plugin,
            payload,
          });

      const refreshed = await fetchPropertyAffiliationsForDetails({
        plugin,
        propertyId,
      });
      const refreshedList = Array.isArray(refreshed) ? refreshed : [];
      setAffiliations(refreshedList);
      setAffiliationsError("");
      success(
        editId ? "Property contact updated" : "Property contact added",
        editId ? "Property contact details were updated." : "New property contact was added."
      );

      const savedAffiliationId = toText(savedAffiliation?.id || savedAffiliation?.ID || editId);
      if (!editId && shouldAutoSelectNewAffiliation && savedAffiliationId) {
        const matchedAffiliation = refreshedList.find(
          (item) => toText(item?.id || item?.ID) === savedAffiliationId
        );
        const option = toAffiliationOption(matchedAffiliation || { id: savedAffiliationId });
        setSelectedAccountsContactId(savedAffiliationId);
        setAccountsContactSearchValue(toText(option?.label || savedAffiliationId));
        setShouldAutoSelectNewAffiliation(false);
      }
    },
    [
      loadedPropertyId,
      plugin,
      selectedWorkspacePropertyId,
      shouldAutoSelectNewAffiliation,
    ]
  );

  const handleOpenAddPropertyModal = useCallback(() => {
    setPropertyModalMode("create");
    setIsAddPropertyOpen(true);
  }, []);

  const handleOpenEditPropertyModal = useCallback((record = null) => {
    const targetProperty = record || activeWorkspaceProperty;
    if (!targetProperty) return;
    const targetPropertyId = toText(
      targetProperty?.id || targetProperty?.ID || targetProperty?.Property_ID
    );
    if (targetPropertyId) {
      setSelectedWorkspacePropertyId(targetPropertyId);
    }
    setPropertyModalMode("edit");
    setIsAddPropertyOpen(true);
  }, [activeWorkspaceProperty]);

  const handleSaveProperty = useCallback(
    async (payload) => {
      if (!plugin) {
        throw new Error("SDK plugin is not ready.");
      }
      const savedPropertyId = await savePropertyForDetails({
        plugin,
        propertyId:
          propertyModalMode === "edit"
            ? toText(selectedWorkspacePropertyId || loadedPropertyId)
            : "",
        propertyPayload: payload,
        inquiryId: relatedInquiryId,
        jobId: effectiveJobId,
      });

      const nextPropertyId = toText(savedPropertyId);
      if (nextPropertyId) {
        setLoadedPropertyId(nextPropertyId);
        setSelectedWorkspacePropertyId(nextPropertyId);
      }

      const [linkedPropertyRecords, allPropertyRecords] = await Promise.all([
        relatedRecordsAccountId
          ? fetchLinkedPropertiesByAccount({
              plugin,
              accountType: relatedRecordsAccountType,
              accountId: relatedRecordsAccountId,
            })
          : Promise.resolve([]),
        fetchPropertiesForSearch({ plugin }),
      ]);

      const normalizedLinkedProperties = mergePropertyLookupRecords(
        Array.isArray(linkedPropertyRecords) ? linkedPropertyRecords : []
      );
      const normalizedLookupProperties = mergePropertyLookupRecords(
        Array.isArray(allPropertyRecords) ? allPropertyRecords : []
      );
      setLinkedProperties(normalizedLinkedProperties);
      setWorkspacePropertyLookupRecords(
        mergePropertyLookupRecords(normalizedLookupProperties, normalizedLinkedProperties)
      );
      setIsAddPropertyOpen(false);
      success(
        propertyModalMode === "edit" ? "Property updated" : "Property created",
        propertyModalMode === "edit"
          ? "Property details have been updated."
          : "Property has been created and linked."
      );
    },
    [
      effectiveJobId,
      loadedPropertyId,
      plugin,
      propertyModalMode,
      relatedInquiryId,
      relatedRecordsAccountId,
      relatedRecordsAccountType,
      selectedWorkspacePropertyId,
      success,
    ]
  );

  const handleOpenUploadsModal = useCallback(() => {
    setIsUploadsModalOpen(true);
  }, []);

  const closeUploadsModal = useCallback(() => {
    setIsUploadsModalOpen(false);
  }, []);

  const handleOpenCreateAppointmentModal = useCallback(() => {
    setAppointmentModalMode("create");
    setEditingAppointmentId("");
    setIsAppointmentModalOpen(true);
  }, []);

  const handleOpenEditAppointmentModal = useCallback((record) => {
    setAppointmentModalMode("update");
    setEditingAppointmentId(toText(record?.id || record?.ID));
    setIsAppointmentModalOpen(true);
  }, []);

  const handleCloseAppointmentModal = useCallback(() => {
    setIsAppointmentModalOpen(false);
    setAppointmentModalMode("create");
    setEditingAppointmentId("");
  }, []);

  const handleOpenCreateActivityModal = useCallback(() => {
    setActivityModalMode("create");
    setEditingActivityId("");
    setIsActivityModalOpen(true);
  }, []);

  const handleOpenEditActivityModal = useCallback((record) => {
    setActivityModalMode("update");
    setEditingActivityId(toText(record?.id || record?.ID));
    setIsActivityModalOpen(true);
  }, []);

  const handleCloseActivityModal = useCallback(() => {
    setIsActivityModalOpen(false);
    setActivityModalMode("create");
    setEditingActivityId("");
  }, []);

  const handleActivitySaved = useCallback((savedActivity) => {
    if (!savedActivity) return;
    const savedId = toText(savedActivity?.id || savedActivity?.ID);
    if (!savedId) return;
    setJobActivities((prev) => {
      const exists = prev.some((a) => toText(a?.id || a?.ID) === savedId);
      if (exists) {
        return prev.map((a) =>
          toText(a?.id || a?.ID) === savedId ? { ...a, ...savedActivity } : a
        );
      }
      return [...prev, savedActivity];
    });
  }, []);

  const handleOpenCreateMaterialModal = useCallback(() => {
    setMaterialModalMode("create");
    setEditingMaterialId("");
    setIsMaterialModalOpen(true);
  }, []);

  const handleOpenEditMaterialModal = useCallback((record) => {
    setMaterialModalMode("update");
    setEditingMaterialId(toText(record?.id || record?.ID));
    setIsMaterialModalOpen(true);
  }, []);

  const handleCloseMaterialModal = useCallback(() => {
    setIsMaterialModalOpen(false);
    setMaterialModalMode("create");
    setEditingMaterialId("");
  }, []);

  const handleCopyUid = useCallback(async () => {
    if (!safeUid || isNewJob) return;
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
  }, [error, isNewJob, safeUid, success]);
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

  const handleOpenTasksModal = useCallback(() => {
    if (!effectiveJobId && !relatedInquiryId) return;
    setIsTasksModalOpen(true);
  }, [effectiveJobId, relatedInquiryId]);

  const handleSelectWorkspacePropertyFromSearch = useCallback(
    async (item) => {
      const propertyId = toText(item?.id);
      if (!propertyId) return;
      setSelectedWorkspacePropertyId(propertyId);
      setWorkspacePropertySearchValue(toText(item?.label));
      if (!plugin || !effectiveJobId) return;
      try {
        await savePropertyForDetails({
          plugin,
          propertyId,
          jobId: effectiveJobId,
          inquiryId: relatedInquiryId || null,
        });
        setLoadedPropertyId(propertyId);
        setLinkedProperties((previous) => {
          const existing = Array.isArray(previous) ? previous : [];
          if (
            existing.some(
              (record) => toText(record?.id || record?.ID || record?.Property_ID) === propertyId
            )
          ) {
            return existing;
          }
          const matchedRecord = (Array.isArray(workspacePropertyLookupRecords)
            ? workspacePropertyLookupRecords
            : []
          ).find((record) => toText(record?.id || record?.ID || record?.Property_ID) === propertyId);
          return matchedRecord
            ? mergePropertyLookupRecords(existing, [matchedRecord])
            : existing;
        });
        success("Property linked", "Property was linked to this job.");
      } catch (saveError) {
        console.error("[JobDetailsBlank] Failed linking property", saveError);
        error("Link failed", saveError?.message || "Unable to link selected property.");
      }
    },
    [effectiveJobId, error, plugin, relatedInquiryId, success, workspacePropertyLookupRecords]
  );

  const handleSelectWorkspacePropertyId = useCallback(
    (nextPropertyId) => {
      const nextId = toText(nextPropertyId);
      if (!nextId) return;
      const selectedItem = workspacePropertySearchItems.find(
        (item) => toText(item?.id) === nextId
      );
      void handleSelectWorkspacePropertyFromSearch({
        id: nextId,
        label: toText(selectedItem?.label || nextId),
      });
    },
    [handleSelectWorkspacePropertyFromSearch, workspacePropertySearchItems]
  );

  const handleConfirmServiceProviderAllocation = useCallback(async () => {
    if (isAllocatingServiceProvider) return;
    if (!plugin || !isSdkReady) {
      error("Allocation failed", "Job context is not ready.");
      return;
    }

    const jobId = toText(effectiveJobId);
    if (!jobId) {
      error("Allocation failed", "Job ID is missing.");
      return;
    }

    const providerId = toText(selectedServiceProviderId);
    if (!providerId) {
      error("Allocation failed", "Select a service provider first.");
      return;
    }

    setIsAllocatingServiceProvider(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          primary_service_provider_id: providerId,
        },
      });
      setAllocatedServiceProviderId(providerId);
      success("Service provider allocated", "Job was updated with selected service provider.");
    } catch (allocationError) {
      console.error("[JobDetailsBlank] Service provider allocation failed", allocationError);
      error("Allocation failed", allocationError?.message || "Unable to allocate service provider.");
    } finally {
      setIsAllocatingServiceProvider(false);
    }
  }, [
    error,
    effectiveJobId,
    isAllocatingServiceProvider,
    isSdkReady,
    plugin,
    selectedServiceProviderId,
    success,
  ]);

  const handleConfirmJobTakenBy = useCallback(async () => {
    if (isSavingJobTakenBy) return;
    if (!plugin || !isSdkReady) {
      error("Save failed", "Job context is not ready.");
      return;
    }

    const jobId = toText(effectiveJobId);
    if (!jobId) {
      error("Save failed", "Job ID is missing.");
      return;
    }

    const providerId = toText(selectedJobTakenById);
    if (!providerId) {
      error("Save failed", "Select admin first.");
      return;
    }

    setIsSavingJobTakenBy(true);
    try {
      await updateJobTakenByWithFallback({
        jobId,
        providerId,
      });
      setAllocatedJobTakenById(providerId);
      setIsLoadedJobTakenByMissing(false);
      success("Job taken by updated", "Job was updated with selected admin.");
    } catch (saveError) {
      console.error("[JobDetailsBlank] Job taken by update failed", saveError);
      error("Save failed", saveError?.message || "Unable to update job taken by.");
    } finally {
      setIsSavingJobTakenBy(false);
    }
  }, [
    effectiveJobId,
    error,
    isSavingJobTakenBy,
    isSdkReady,
    plugin,
    selectedJobTakenById,
    success,
    updateJobTakenByWithFallback,
  ]);

  const updateJobBooleanField = useCallback(
    async ({ fieldName, value, additionalPayload = null } = {}) => {
      const jobId = toText(effectiveJobId);
      if (!plugin || !isSdkReady) {
        throw new Error("Job context is not ready.");
      }
      if (!jobId) {
        throw new Error("Job ID is missing.");
      }
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          [fieldName]: Boolean(value),
          ...(additionalPayload && typeof additionalPayload === "object" ? additionalPayload : {}),
        },
      });
      return true;
    },
    [effectiveJobId, isSdkReady, plugin]
  );

  const handlePcaDoneToggle = useCallback(
    async (nextValue) => {
      if (isSavingPcaDone) return;
      const previousValue = isPcaDone;
      setIsPcaDone(Boolean(nextValue));
      setIsSavingPcaDone(true);
      try {
        await updateJobBooleanField({
          fieldName: "pca_done",
          value: nextValue,
        });
      } catch (toggleError) {
        setIsPcaDone(previousValue);
        error("Save failed", toggleError?.message || "Unable to update PCA Done.");
      } finally {
        setIsSavingPcaDone(false);
      }
    },
    [error, isPcaDone, isSavingPcaDone, updateJobBooleanField]
  );

  const handlePrestartDoneToggle = useCallback(
    async (nextValue) => {
      if (isSavingPrestartDone) return;
      const previousValue = isPrestartDone;
      setIsPrestartDone(Boolean(nextValue));
      setIsSavingPrestartDone(true);
      try {
        await updateJobBooleanField({
          fieldName: "prestart_done",
          value: nextValue,
        });
      } catch (toggleError) {
        setIsPrestartDone(previousValue);
        error("Save failed", toggleError?.message || "Unable to update Prestart Done.");
      } finally {
        setIsSavingPrestartDone(false);
      }
    },
    [error, isPrestartDone, isSavingPrestartDone, updateJobBooleanField]
  );

  const [isSendingJobUpdate, setIsSendingJobUpdate] = useState(false);
  const [isRecordingEmailAction, setIsRecordingEmailAction] = useState(false);
  const handleRecordEmailAction = useCallback(
    async ({ groupKey = "", option = null, target = "button" } = {}) => {
      const jobId = toText(effectiveJobId);
      if (!plugin || !isSdkReady || !jobId) {
        error("Action failed", "Job context is not ready.");
        return;
      }
      if (isRecordingEmailAction) return;

      const { type, message } = buildEmailMenuLastAction({
        groupKey,
        option,
        target,
      });
      if (!type) return;

      setIsRecordingEmailAction(true);
      try {
        await updateJobFieldsById({
          plugin,
          jobId,
          payload: buildJobLastActionPayload({
            type,
            message,
            status: LAST_ACTION_STATUSES.QUEUED,
          }),
        });
        success("Email action recorded", message);
      } catch (recordError) {
        console.error("[JobDetailsBlank] Failed recording email action", recordError);
        error("Action failed", recordError?.message || "Unable to record email action.");
      } finally {
        setIsRecordingEmailAction(false);
      }
    },
    [effectiveJobId, error, isRecordingEmailAction, isSdkReady, plugin, success]
  );

  const handleEmailJob = useCallback(async () => {
    const jobId = toText(effectiveJobId);
    if (!plugin || !isSdkReady || !jobId) {
      error("Action failed", "Job context is not ready.");
      return;
    }
    if (isSendingJobUpdate) return;
    setIsSendingJobUpdate(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          send_job_update_to_service_provider: true,
          ...buildJobLastActionPayload({
            type: "job.email.job-update",
            message: "Job update email requested.",
            status: LAST_ACTION_STATUSES.QUEUED,
          }),
        },
      });
      success("Job update sent", "Service provider has been notified of the job update.");
    } catch (sendError) {
      console.error("[JobDetailsBlank] Failed to send job update", sendError);
      error("Send failed", sendError?.message || "Unable to send job update to service provider.");
    } finally {
      setIsSendingJobUpdate(false);
    }
  }, [effectiveJobId, error, isSdkReady, isSendingJobUpdate, plugin, success]);

  const handleMarkCompleteClick = useCallback(() => {
    if (isSavingMarkComplete) return;
    setPendingMarkCompleteValue(!isMarkComplete);
    setIsMarkCompleteConfirmOpen(true);
  }, [isMarkComplete, isSavingMarkComplete]);

  const handleConfirmMarkComplete = useCallback(async () => {
    if (isSavingMarkComplete) return;
    const previousValue = isMarkComplete;
    const nextValue = Boolean(pendingMarkCompleteValue);
    setIsSavingMarkComplete(true);
    setIsMarkComplete(nextValue);
    try {
      await updateJobBooleanField({
        fieldName: "mark_complete",
        value: nextValue,
        additionalPayload: nextValue
          ? buildJobLastActionPayload({
              type: "job.mark-complete",
              message: "Job marked as complete.",
              status: LAST_ACTION_STATUSES.SUCCEEDED,
            })
          : null,
      });
      success(
        nextValue ? "Complete" : "Incomplete",
        nextValue ? "Job marked as complete." : "Job marked as incomplete."
      );
      setIsMarkCompleteConfirmOpen(false);
    } catch (saveError) {
      setIsMarkComplete(previousValue);
      error("Save failed", saveError?.message || "Unable to update Mark Complete.");
    } finally {
      setIsSavingMarkComplete(false);
    }
  }, [
    error,
    isMarkComplete,
    isSavingMarkComplete,
    pendingMarkCompleteValue,
    success,
    updateJobBooleanField,
  ]);

  useEffect(() => {
    setPopupCommentDrafts({
      contact: contactPopupComment,
      company: companyPopupComment,
    });
  }, [companyPopupComment, contactPopupComment, loadedClientEntityId, loadedClientIndividualId]);

  useEffect(() => {
    let cancelled = false;
    const normalizedContactId = toText(contactLogsContactId);

    if (!isRelatedDataTabMounted) return undefined;

    if (!plugin || !isSdkReady || !normalizedContactId) {
      setContactLogs([]);
      setIsContactLogsLoading(false);
      setContactLogsError("");
      return undefined;
    }

    setIsContactLogsLoading(true);
    setContactLogsError("");

    fetchContactLogsForDetails({
      plugin,
      contactId: normalizedContactId,
    })
      .then((rows) => {
        if (cancelled) return;
        setContactLogs(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load contact logs", loadError);
        setContactLogs([]);
        setContactLogsError(loadError?.message || "Unable to load contact logs.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsContactLogsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [contactLogsContactId, isRelatedDataTabMounted, isSdkReady, plugin]);

  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [effectiveJobId, hasMemoContext, isSdkReady, plugin, relatedInquiryId]);

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
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
      limit: 120,
    })
      .then((rows) => {
        if (cancelled) return;
        setMemos(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load memos", loadError);
        setMemos([]);
        setMemosError(loadError?.message || "Unable to load memos.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsMemosLoading(false);
      });

    const unsubscribeMemos = subscribeMemosForDetails({
      plugin,
      jobId: effectiveJobId,
      inquiryId: relatedInquiryId || undefined,
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
        console.error("[JobDetails] Memo subscription failed", streamError);
        setMemosError((previous) => previous || "Live memo updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeMemos?.();
    };
  }, [effectiveJobId, hasMemoContext, isSdkReady, plugin, relatedInquiryId]);

  useEffect(() => {
    if (!isMemoChatOpen || !plugin || !isSdkReady || !hasMemoContext) return undefined;

    let cancelled = false;
    let isPolling = false;
    const pollMemos = async () => {
      if (cancelled || isPolling) return;
      isPolling = true;
      try {
        const rows = await fetchMemosForDetails({
          plugin,
          jobId: effectiveJobId,
          inquiryId: relatedInquiryId || undefined,
          limit: 120,
        });
        if (cancelled) return;
        setMemos((previous) =>
          mergeMemosPreservingComments(previous, Array.isArray(rows) ? rows : [])
        );
        setMemosError("");
      } catch (pollError) {
        if (cancelled) return;
        console.warn("[JobDetails] Memo polling failed", pollError);
      } finally {
        isPolling = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void pollMemos();
    }, 1000);
    void pollMemos();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    effectiveJobId,
    hasMemoContext,
    isMemoChatOpen,
    isSdkReady,
    plugin,
    relatedInquiryId,
  ]);

  const handleMemoFileChange = useCallback((event) => {
    const nextFile = Array.from(event?.target?.files || [])[0] || null;
    setMemoFile(nextFile);
    if (event?.target) event.target.value = "";
  }, []);

  const handleClearMemoFile = useCallback(() => {
    setMemoFile(null);
    if (memoFileInputRef.current) {
      memoFileInputRef.current.value = "";
    }
  }, []);

  const handleOpenMemoReply = useCallback((memoId) => {
    const normalizedMemoId = toText(memoId);
    if (!normalizedMemoId) return;
    setAreFloatingWidgetsVisible(true);
    setIsMemoChatOpen(true);
    setMemoFocusRequest({
      memoId: normalizedMemoId,
      key: Date.now(),
    });
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      error("Post failed", "No job context found for memos.");
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
          uploadPath: `forum-memos/${effectiveJobId || safeUid || "job-details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      await createMemoPostForDetails({
        plugin,
        payload: {
          author_id: currentUserId || null,
          post_copy: text,
          post_status: "Published",
          related_job_id: effectiveJobId || null,
          related_inquiry_id: relatedInquiryId || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      success("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[JobDetails] Failed posting memo", postError);
      error("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    currentUserId,
    effectiveJobId,
    error,
    hasMemoContext,
    isPostingMemo,
    memoFile,
    memoText,
    plugin,
    refreshMemos,
    relatedInquiryId,
    safeUid,
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
            author_id: currentUserId || null,
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
        console.error("[JobDetails] Failed posting memo reply", replyError);
        error("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [currentUserId, error, memoReplyDrafts, plugin, refreshMemos, sendingReplyPostId, success]
  );

  const confirmDeleteMemoItem = useCallback(async () => {
    if (!memoDeleteTarget || isDeletingMemoItem) return;
    const deleteType = toText(memoDeleteTarget?.type);
    const targetId = toText(memoDeleteTarget?.id);
    if (!deleteType || !targetId) return;

    const targetAuthorId = (() => {
      if (deleteType === "post") {
        const targetMemo = memos.find(
          (memo, memoIndex) =>
            (toText(memo?.id || memo?.ID) || `memo-chat-${memoIndex}`) === targetId
        );
        if (!targetMemo) return "";
        const targetMemoAuthor = resolveMemoAuthor(
          targetMemo?.Author || {},
          targetMemo?.author_id || targetMemo?.Author_ID
        );
        return toText(targetMemo?.author_id || targetMemoAuthor?.id);
      }

      for (const memo of memos) {
        const replies = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
        const targetReply = replies.find((reply, replyIndex) => {
          const replyId =
            toText(reply?.id || reply?.ID) ||
            `${toText(memo?.id || memo?.ID) || "memo"}-reply-${replyIndex}`;
          return replyId === targetId;
        });
        if (!targetReply) continue;
        const targetReplyAuthor = resolveMemoAuthor(
          targetReply?.Author || {},
          targetReply?.author_id || targetReply?.Author_ID
        );
        return toText(targetReply?.author_id || targetReplyAuthor?.id);
      }

      return "";
    })();

    if (!currentUserId || !targetAuthorId || targetAuthorId !== currentUserId) {
      setMemoDeleteTarget(null);
      error("Delete failed", "Only the author can delete this item.");
      return;
    }

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
      console.error("[JobDetails] Failed deleting memo item", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [
    currentUserId,
    error,
    isDeletingMemoItem,
    memoDeleteTarget,
    memos,
    plugin,
    refreshMemos,
    success,
  ]);

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
        if (!loadedClientIndividualId) {
          throw new Error("Primary contact is missing.");
        }
        await updateContactFieldsById({
          plugin,
          contactId: loadedClientIndividualId,
          payload: {
            popup_comment: nextContactComment || null,
          },
        });
      }

      if (companyChanged) {
        if (!loadedClientEntityId) {
          throw new Error("Company is missing.");
        }
        await updateCompanyFieldsById({
          plugin,
          companyId: loadedClientEntityId,
          payload: {
            popup_comment: nextCompanyComment || null,
          },
        });
      }

      success("Saved", "Popup comment updated.");
      setIsPopupCommentModalOpen(false);
    } catch (saveError) {
      console.error("[JobDetails] Popup comment save failed", saveError);
      error("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally {
      setIsSavingPopupComment(false);
    }
  }, [
    companyPopupComment,
    contactPopupComment,
    error,
    isSavingPopupComment,
    loadedClientEntityId,
    loadedClientIndividualId,
    plugin,
    popupCommentDrafts,
    success,
  ]);

  const toggleMenu = (menuKey) => {
    setOpenMenu((previous) => (previous === menuKey ? "" : menuKey));
  };

  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']" data-page="job-details">
      <GlobalTopHeader />

      <section className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
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
                <div className="truncate text-sm font-semibold text-slate-900">Job Details</div>
                {!isNewJob ? (
                  <>
                    {externalJobUrl ? (
                      <a
                        href={externalJobUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="uid-link hover:text-blue-800"
                        title={`Open job ${effectiveJobId} in Ontraport`}
                      >
                        {safeUid}
                      </a>
                    ) : (
                      <span className="uid-link">{safeUid}</span>
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
                style={jobStatusStyle}
              >
                {jobStatusLabel}
              </span>
              {priorityLabel && priorityStyle ? (
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={priorityStyle}
                >
                  {priorityLabel}
                </span>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2" ref={menuRootRef}>
              <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
                <span className="service-provider-allocation-legend">Service Provider</span>
                <SearchDropdownInput
                  label=""
                  field="service_provider_allocation"
                  value={serviceProviderSearch}
                  placeholder="Allocate service provider"
                  items={serviceProviderItems}
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
                  addButtonLabel={isAllocatingServiceProvider ? "Allocating..." : "Confirm Allocation"}
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
                <span className="service-provider-allocation-legend">Job Taken By</span>
                <SearchDropdownInput
                  label=""
                  field="job_taken_by_allocation"
                  value={jobTakenBySearch}
                  placeholder="Set job taken by"
                  items={jobTakenByItems}
                  onValueChange={(value) => {
                    setJobTakenBySearch(value);
                    setSelectedJobTakenById("");
                  }}
                  onSelect={(item) => {
                    const providerId = toText(item?.id);
                    setSelectedJobTakenById(providerId);
                    setJobTakenBySearch(toText(item?.valueLabel || item?.label));
                  }}
                  onAdd={handleConfirmJobTakenBy}
                  addButtonLabel={isSavingJobTakenBy ? "Saving..." : "Confirm Selection"}
                  closeOnSelect={false}
                  autoConfirmOnClose
                  emptyText={
                    isJobTakenByLookupLoading ? "Loading admins..." : "No admin records found."
                  }
                  rootData={{
                    className: "service-provider-allocation-root w-full",
                    "data-search-root": "job-taken-by-allocation",
                  }}
                />
              </div>

              <label className="inline-flex h-8 cursor-pointer select-none items-center gap-2 px-1 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                  checked={isPcaDone}
                  onChange={(event) => {
                    handlePcaDoneToggle(event.target.checked);
                  }}
                  disabled={isSavingPcaDone}
                />
                <span>PCA Done</span>
              </label>

              <label className="inline-flex h-8 cursor-pointer select-none items-center gap-2 px-1 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                  checked={isPrestartDone}
                  onChange={(event) => {
                    handlePrestartDoneToggle(event.target.checked);
                  }}
                  disabled={isSavingPrestartDone}
                />
                <span>Prestart Done</span>
              </label>

              {hasRelatedInquiry ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 whitespace-nowrap px-3 !text-xs"
                  onClick={() => {
                    if (!relatedInquiryDetailsPath) return;
                    navigate(relatedInquiryDetailsPath);
                  }}
                >
                  View Inquiry
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={handleOpenTasksModal}
                disabled={!effectiveJobId && !relatedInquiryId}
              >
                Manage Tasks
              </Button>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 whitespace-nowrap px-3 !text-xs"
                  onClick={() => toggleMenu("review")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "review"}
                >
                  Review
                  <ChevronDownIcon />
                </Button>
                {openMenu === "review" ? (
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setOpenMenu("");
                        setActiveWorkspaceTab("invoice-payment");
                        setInvoiceActiveTab("quote");
                        setInvoiceActiveTabVersion((v) => v + 1);
                      }}
                    >
                      Review Quote
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setOpenMenu("");
                        setActiveWorkspaceTab("invoice-payment");
                        setInvoiceActiveTab("client-invoice");
                        setInvoiceActiveTabVersion((v) => v + 1);
                      }}
                    >
                      Review Invoice
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setOpenMenu("")}
                    >
                      Review Receipt
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 whitespace-nowrap px-3 !text-xs"
                  onClick={() => {
                    setActiveEmailGroup((previous) => previous || "general");
                    toggleMenu("email");
                  }}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "email"}
                >
                  Email
                  <ChevronDownIcon />
                </Button>
                {openMenu === "email" ? (
                  <div className="absolute right-0 top-full z-40 mt-1 flex min-w-[460px] rounded-md border border-slate-200 bg-white shadow-lg">
                    <div className="w-48 border-r border-slate-200 py-1">
                      <button
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        disabled={isSendingJobUpdate || !effectiveJobId}
                        onClick={() => {
                          setOpenMenu("");
                          handleEmailJob();
                        }}
                      >
                        <span>{isSendingJobUpdate ? "Sending..." : "Email Job"}</span>
                      </button>
                      <div className="mx-2 my-1 border-t border-slate-200" />
                      {Object.entries(EMAIL_OPTIONS_DATA).map(([groupKey, group]) => (
                        <button
                          key={groupKey}
                          type="button"
                          className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                            activeEmailGroup === groupKey
                              ? "bg-slate-100 text-slate-900"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                          onMouseEnter={() => setActiveEmailGroup(groupKey)}
                          onClick={() => setActiveEmailGroup(groupKey)}
                        >
                          <span>{group.label}</span>
                          <ChevronRightIcon />
                        </button>
                      ))}
                    </div>
                    <div className="w-[280px] py-1">
                      {(EMAIL_OPTIONS_DATA[activeEmailGroup]?.buttons || []).map((option) => (
                        <div
                          key={`${activeEmailGroup}-${option.button_name}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-100"
                        >
                          <button
                            type="button"
                            className="text-left text-sm text-slate-700 disabled:opacity-50"
                            disabled={isRecordingEmailAction || !effectiveJobId}
                            onClick={() => {
                              setOpenMenu("");
                              void handleRecordEmailAction({
                                groupKey: activeEmailGroup,
                                option,
                                target: "button",
                              });
                            }}
                          >
                            {option.button_name}
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-blue-700 underline disabled:opacity-50"
                            disabled={isRecordingEmailAction || !effectiveJobId}
                            onClick={() => {
                              setOpenMenu("");
                              void handleRecordEmailAction({
                                groupKey: activeEmailGroup,
                                option,
                                target: "template",
                              });
                            }}
                          >
                            ({option.template_link_button})
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              {(hasQuoteAcceptedDateValue || quoteStatusNormalized === "accepted" || isMarkComplete) ? (
                <Button
                  variant={isMarkComplete ? "outline" : "primary"}
                  size="sm"
                  className={`h-8 whitespace-nowrap px-3 !text-xs ${
                    isMarkComplete
                      ? "!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700"
                      : ""
                  }`}
                  onClick={handleMarkCompleteClick}
                >
                  {isMarkComplete ? "Complete" : "Mark Complete"}
                </Button>
              ) : null}

              <div className="relative">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 whitespace-nowrap px-3 !text-xs"
                  onClick={() => toggleMenu("more")}
                  aria-haspopup="menu"
                  aria-expanded={openMenu === "more"}
                >
                  More
                  <ChevronDownIcon />
                </Button>
                {openMenu === "more" ? (
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      disabled={isDuplicatingJob}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => {
                        setOpenMenu("");
                        handleDuplicateJob();
                      }}
                    >
                      {isDuplicatingJob ? "Duplicating..." : "Duplicate Job"}
                    </button>
                    <button
                      type="button"
                      disabled={isCreatingCallback}
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      onClick={() => {
                        setOpenMenu("");
                        handleCreateCallback();
                      }}
                    >
                      {isCreatingCallback ? "Creating..." : "Create Callback"}
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => {
                        setOpenMenu("");
                        handlePrintJobSheet();
                      }}
                    >
                      Print Job Sheet
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                      onClick={() => setOpenMenu("")}
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

      <section className="w-full px-2 py-2" data-page="job-details">
        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AccountDetailsSection
            isLoading={isAccountDetailsLoading}
            editDisabled={!effectiveJobId}
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

          <DetailsCard title="Job Payment & Quote Details" className="xl:col-span-2">
            {!effectiveJobId || isNewJob ? (
              <div className="text-sm text-slate-500">Open an existing job to view quote/payment details.</div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                  {hasQuoteStatusValue ? (
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        Quote Status
                      </div>
                      <span
                        className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={quoteStatusStyle}
                      >
                        {quoteStatusLabel}
                      </span>
                    </div>
                  ) : null}

                  {hasPaymentStatusValue ? (
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        Payment Status
                      </div>
                      <span
                        className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={paymentStatusStyle}
                      >
                        {paymentStatusLabel}
                      </span>
                    </div>
                  ) : null}

                  <CardField
                    label="Quote Date"
                    value={formatDateDisplay(quotePaymentDetails?.quote_date)}
                  />
                  <CardField
                    label="Follow Up Date"
                    value={formatDateDisplay(quotePaymentDetails?.follow_up_date)}
                  />
                  <CardField
                    label="Quote Valid Until"
                    value={formatDateDisplay(quotePaymentDetails?.quote_valid_until)}
                  />
                  <CardField
                    label="Quote Requested Date"
                    value={formatDateDisplay(quotePaymentDetails?.date_quote_requested)}
                  />
                  <CardField
                    label="Quote Sent Date"
                    value={formatDateDisplay(quotePaymentDetails?.date_quote_sent)}
                  />
                  <CardField
                    label="Quote Accepted Date"
                    value={formatDateDisplay(quotePaymentDetails?.date_quoted_accepted)}
                  />
                  {priorityLabel ? (
                    <div className="min-w-0">
                      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                        Priority
                      </div>
                      <span
                        className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                        style={priorityStyle}
                      >
                        {priorityLabel}
                      </span>
                    </div>
                  ) : null}
                  <CardField
                    label="Admin Recommendation"
                    value={toText(quotePaymentDetails?.admin_recommendation)}
                    className="sm:col-span-2"
                  />

                  {!hasAnyQuotePaymentDisplayField ? (
                    <div className="text-sm text-slate-500">No quote/payment details available.</div>
                  ) : null}
                </div>
              </div>
            )}
          </DetailsCard>
        </div>

        <div className="mt-2 space-y-2">
          <section className="rounded-[4px] border border-[#003882] bg-[#003882] px-2 py-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {JOB_WORKSPACE_TABS.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded-[4px] border px-2.5 py-1.5 text-xs font-semibold transition ${
                      isActive
                        ? "border-[#003882] bg-[#003882] text-white"
                        : "border-white/80 bg-white text-[#003882] hover:bg-slate-100"
                    }`}
                    onClick={() => setActiveWorkspaceTab(tab.id)}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </section>

          <JobDirectStoreProvider
            jobUid={safeUid || null}
            jobData={jobDirectBootstrapJobData}
            lookupData={workspaceLookupData}
          >
            <section className="rounded border border-slate-200 bg-white p-2">
              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs["related-data"])}
                isActive={activeWorkspaceTab === "related-data"}
              >
                <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                  <RelatedRecordsSection
                    deals={relatedDealsForDisplay}
                    jobs={relatedJobsForDisplay}
                    stackPrimaryColumns
                    extraPanels={[
                      <div className="flex h-full min-h-[420px] min-w-0 flex-col gap-2">
                        <JobMemosPreviewPanel
                          hasMemoContext={hasMemoContext}
                          isLoading={isMemosLoading}
                          errorMessage={memosError}
                          memos={memos}
                          resolveMemoAuthor={resolveMemoAuthor}
                          onOpen={handleOpenMemoReply}
                          panelClassName="min-h-[148px]"
                        />
                        <JobNotesPanel
                          plugin={plugin}
                          jobId={effectiveJobId}
                          inquiryId={relatedInquiryId}
                          contextType="job"
                          panelClassName="min-h-0 flex-1"
                          listMaxHeightClass="min-h-0 flex-1"
                        />
                      </div>,
                    ]}
                    isLoading={relatedRecords?.isLoading}
                    error={relatedRecords?.error}
                    hasAccount={Boolean(relatedRecordsAccountId)}
                    noAccountMessage="Link a contact/company on this job to load related records."
                    linkedDealId={relatedInquiryId}
                    onToggleDealLink={handleToggleRelatedInquiryLink}
                    isLinkingDeal={isSavingLinkedInquiry}
                    currentJobId={effectiveJobId}
                    onNavigateToDeal={(uid) => navigate(`/inquiry-details/${encodeURIComponent(uid)}`)}
                    onNavigateToJob={(uid) => navigate(`/job-details/${encodeURIComponent(uid)}`)}
                  />

                  <ContactLogsPanel
                    hasContactContext={Boolean(contactLogsContactId)}
                    isLoading={isContactLogsLoading}
                    errorMessage={contactLogsError}
                    logs={contactLogs}
                    panelClassName="h-full"
                  />
                </div>
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs.properties)}
                isActive={activeWorkspaceTab === "properties"}
              >
                <PropertyTabSection
                  plugin={plugin}
                  preloadedLookupData={workspaceLookupData}
                  quoteJobId={effectiveJobId}
                  inquiryId={relatedInquiryId}
                  currentPropertyId={toText(selectedWorkspacePropertyId || loadedPropertyId)}
                  onOpenContactDetailsModal={openContactDetailsModal}
                  accountType={relatedRecordsAccountType}
                  selectedAccountId={relatedRecordsAccountId}
                  propertySearchValue={workspacePropertySearchValue}
                  propertySearchItems={workspacePropertySearchItems}
                  onPropertySearchValueChange={setWorkspacePropertySearchValue}
                  onPropertySearchQueryChange={searchWorkspacePropertiesInDatabase}
                  onSelectPropertyFromSearch={handleSelectWorkspacePropertyFromSearch}
                  onAddProperty={handleOpenAddPropertyModal}
                  activeRelatedProperty={activeWorkspaceProperty}
                  linkedProperties={linkedWorkspaceProperties}
                  isLoading={isLinkedPropertiesLoading}
                  loadError={linkedPropertiesError || workspacePropertyLookupError}
                  selectedPropertyId={toText(selectedWorkspacePropertyId)}
                  onSelectProperty={handleSelectWorkspacePropertyId}
                  onEditRelatedProperty={handleOpenEditPropertyModal}
                  sameAsContactLabel=""
                  isSameAsContactChecked={false}
                  isSameAsContactDisabled
                  onSameAsContactChange={null}
                  showPropertyUploadsSection={false}
                  propertyDetailsVariant="cards"
                  onAffiliationSaved={handleAffiliationSaved}
                />
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs.uploads)}
                isActive={activeWorkspaceTab === "uploads"}
              >
                <UploadsSection
                  plugin={plugin}
                  uploadsMode={effectiveJobId ? "job" : "inquiry"}
                  jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                  inquiryId={relatedInquiryId}
                  inquiryUid={relatedInquiryUid}
                  linkedJobId={effectiveJobId}
                  additionalCreatePayload={{
                    ...(relatedInquiryId ? { inquiry_id: relatedInquiryId, Inquiry_ID: relatedInquiryId } : {}),
                    ...(effectiveJobId ? { job_id: effectiveJobId, Job_ID: effectiveJobId } : {}),
                    ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
                  }}
                  layoutMode="table"
                  existingUploadsView="tiles"
                  onRequestAddUpload={handleOpenUploadsModal}
                  enableFormUploads
                />
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs.appointments)}
                isActive={activeWorkspaceTab === "appointments"}
              >
                <AppointmentTabSection
                  plugin={plugin}
                  jobData={jobDirectBootstrapJobData}
                  preloadedLookupData={workspaceLookupData}
                  inquiryRecordId={relatedInquiryId}
                  inquiryUid={relatedInquiryUid}
                  prefillContext={appointmentPrefillContext}
                  layoutMode="table"
                  onRequestCreate={handleOpenCreateAppointmentModal}
                  onRequestEdit={handleOpenEditAppointmentModal}
                />
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs.activities)}
                isActive={activeWorkspaceTab === "activities"}
              >
                {isWorkspaceSectionsLoading && !jobActivities.length ? (
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Loading activities...
                  </div>
                ) : workspaceSectionsError && !jobActivities.length ? (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                    {workspaceSectionsError}
                  </div>
                ) : (
                  <AddActivitiesSection
                    plugin={plugin}
                    jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                    layoutMode="table"
                    onRequestCreate={handleOpenCreateActivityModal}
                    onRequestEdit={handleOpenEditActivityModal}
                  />
                )}
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs.materials)}
                isActive={activeWorkspaceTab === "materials"}
              >
                {isWorkspaceSectionsLoading && !jobMaterials.length ? (
                  <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                    Loading materials...
                  </div>
                ) : workspaceSectionsError && !jobMaterials.length ? (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                    {workspaceSectionsError}
                  </div>
                ) : (
                  <AddMaterialsSection
                    plugin={plugin}
                    jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                    preloadedLookupData={workspaceLookupData}
                    layoutMode="table"
                    onRequestCreate={handleOpenCreateMaterialModal}
                    onRequestEdit={handleOpenEditMaterialModal}
                  />
                )}
              </WorkspaceTabPanel>

              <WorkspaceTabPanel
                isMounted={Boolean(mountedWorkspaceTabs["invoice-payment"])}
                isActive={activeWorkspaceTab === "invoice-payment"}
              >
                <InvoiceSection
                  plugin={plugin}
                  jobData={jobDirectBootstrapJobData}
                  jobUid={safeUid}
                  quoteHeaderData={quoteHeaderData}
                  onAcceptQuote={handleAcceptQuote}
                  isAcceptingQuote={isQuoteWorkflowUpdating}
                  canAcceptQuote={canAcceptQuote}
                  canSendQuote={canSendQuote}
                  onSendQuote={handleSendQuote}
                  isSendingQuote={isQuoteWorkflowUpdating}
                  hasAccountsContact={Boolean(toText(selectedAccountsContactId))}
                  quoteContactSelectorSlot={
                    <div className="grid grid-cols-2 gap-3">
                      <SearchDropdownInput
                        label={isCompanyAccount ? "Job Email Company" : "Job Email Contact"}
                        field="job_email_contact_search"
                        value={jobEmailContactSearchValue}
                        placeholder={isCompanyAccount ? "Search company" : "Search contact"}
                        items={jobEmailItems}
                        onValueChange={setJobEmailContactSearchValue}
                        onSearchQueryChange={
                          isCompanyAccount ? searchCompaniesInDatabase : searchContactsInDatabase
                        }
                        onSelect={(item) => {
                          const nextId = toText(item?.id);
                          setSelectedJobEmailContactId(nextId);
                          setJobEmailContactSearchValue(toText(item?.label));
                        }}
                        onAdd={handleAddJobEmailContact}
                        addButtonLabel={isCompanyAccount ? "Add New Company" : "Add New Contact"}
                        emptyText={
                          isCompanyAccount
                            ? isCompanyLookupLoading
                              ? "Loading companies..."
                              : "No companies found."
                            : isContactLookupLoading
                              ? "Loading contacts..."
                              : "No contacts found."
                        }
                      />
                      <SearchDropdownInput
                        label="Accounts Contact"
                        field="accounts_contact_search"
                        value={accountsContactSearchValue}
                        placeholder="Search property contact"
                        items={accountsContactItems}
                        onValueChange={setAccountsContactSearchValue}
                        onSearchQueryChange={null}
                        onSelect={(item) => {
                          const nextId = toText(item?.id);
                          setSelectedAccountsContactId(nextId);
                          setAccountsContactSearchValue(toText(item?.label));
                        }}
                        onAdd={handleAddAccountsContact}
                        addButtonLabel="Add Property Contact"
                        emptyText={
                          isAffiliationsLoading
                            ? "Loading property contacts..."
                            : affiliationsError
                              ? affiliationsError
                              : "No property contacts found."
                        }
                      />
                    </div>
                  }
                  activeTab={invoiceActiveTab}
                  activeTabVersion={invoiceActiveTabVersion}
                />
              </WorkspaceTabPanel>
            </section>

            <PropertyAffiliationModal
              open={affiliationModalState.open}
              onClose={closeAffiliationModal}
              onSave={saveAffiliation}
              initialData={affiliationModalState.initialData}
              plugin={plugin}
              propertyId={toText(selectedWorkspacePropertyId || loadedPropertyId)}
              onOpenContactDetailsModal={openContactDetailsModal}
            />

            <Modal
              open={isUploadsModalOpen}
              onClose={closeUploadsModal}
              title="Add Uploads"
              widthClass="max-w-[min(96vw,1280px)]"
            >
              <div className="max-h-[78vh] overflow-y-auto pr-1">
                <UploadsSection
                  plugin={plugin}
                  uploadsMode={effectiveJobId ? "job" : "inquiry"}
                  jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                  inquiryId={relatedInquiryId}
                  inquiryUid={relatedInquiryUid}
                  linkedJobId={effectiveJobId}
                  additionalCreatePayload={{
                    ...(relatedInquiryId
                      ? { inquiry_id: relatedInquiryId, Inquiry_ID: relatedInquiryId }
                      : {}),
                    ...(effectiveJobId ? { job_id: effectiveJobId, Job_ID: effectiveJobId } : {}),
                    ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
                  }}
                  layoutMode="form"
                  enableFormUploads
                />
              </div>
            </Modal>

            <Modal
              open={isAppointmentModalOpen}
              onClose={handleCloseAppointmentModal}
              title={appointmentModalMode === "update" ? "Edit Appointment" : "Add Appointment"}
              widthClass="max-w-[min(96vw,1280px)]"
            >
              <div className="max-h-[78vh] overflow-y-auto pr-1">
                <AppointmentTabSection
                  plugin={plugin}
                  jobData={jobDirectBootstrapJobData}
                  preloadedLookupData={workspaceLookupData}
                  inquiryRecordId={relatedInquiryId}
                  inquiryUid={relatedInquiryUid}
                  prefillContext={appointmentPrefillContext}
                  layoutMode="form"
                  mode={appointmentModalMode}
                  editingAppointmentId={editingAppointmentId}
                  onSubmitSuccess={handleCloseAppointmentModal}
                />
              </div>
            </Modal>

            <Modal
              open={isActivityModalOpen}
              onClose={handleCloseActivityModal}
              title={activityModalMode === "update" ? "Edit Activity" : "Add Activity"}
              widthClass="max-w-[min(96vw,1280px)]"
            >
              <div className="max-h-[78vh] overflow-y-auto pr-1">
                <AddActivitiesSection
                  plugin={plugin}
                  jobData={{
                    id: effectiveJobId,
                    ID: effectiveJobId,
                    inquiry_record_id: relatedInquiryId,
                  }}
                  layoutMode="form"
                  mode={activityModalMode}
                  editingActivityId={editingActivityId}
                  onActivitySaved={handleActivitySaved}
                  onSubmitSuccess={handleCloseActivityModal}
                />
              </div>
            </Modal>

            <Modal
              open={isMaterialModalOpen}
              onClose={handleCloseMaterialModal}
              title={materialModalMode === "update" ? "Edit Material" : "Add Material"}
              widthClass="max-w-[min(96vw,1280px)]"
            >
              <div className="max-h-[78vh] overflow-y-auto pr-1">
                <AddMaterialsSection
                  plugin={plugin}
                  jobData={{
                    id: effectiveJobId,
                    ID: effectiveJobId,
                    inquiry_record_id: relatedInquiryId,
                  }}
                  preloadedLookupData={workspaceLookupData}
                  layoutMode="form"
                  mode={materialModalMode}
                  editingMaterialId={editingMaterialId}
                  onSubmitSuccess={handleCloseMaterialModal}
                />
              </div>
            </Modal>
          </JobDirectStoreProvider>
        </div>
      </section>

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

      <AddPropertyModal
        open={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSave={handleSaveProperty}
        plugin={plugin}
        initialData={propertyModalMode === "edit" ? activeWorkspaceProperty : null}
      />

      <TasksModal
        open={isTasksModalOpen}
        onClose={() => {
          setIsTasksModalOpen(false);
          if (!plugin || (!effectiveJobId && !relatedInquiryId)) return;
          fetchTasksForDetails({
            plugin,
            jobId: effectiveJobId,
            inquiryId: relatedInquiryId,
          }).catch((loadError) => {
            console.error("[JobDetailsBlank] Failed to refresh tasks", loadError);
          });
        }}
        plugin={plugin}
        jobData={{
          ...(relatedInquiryRecord || {}),
          id: effectiveJobId,
          ID: effectiveJobId,
          inquiry_record_id: relatedInquiryId || null,
          Inquiry_Record_ID: relatedInquiryId || null,
          deal_id: relatedInquiryId || null,
          Deal_id: relatedInquiryId || null,
        }}
        contextType={effectiveJobId ? "job" : "deal"}
        contextId={effectiveJobId || relatedInquiryId}
        additionalCreatePayload={{
          ...(effectiveJobId ? { job_id: effectiveJobId, Job_id: effectiveJobId } : {}),
          ...(relatedInquiryId ? { deal_id: relatedInquiryId, Deal_id: relatedInquiryId } : {}),
        }}
        additionalUpdatePayload={{
          ...(effectiveJobId ? { job_id: effectiveJobId, Job_id: effectiveJobId } : {}),
          ...(relatedInquiryId ? { deal_id: relatedInquiryId, Deal_id: relatedInquiryId } : {}),
        }}
      />

      <Modal
        open={isMarkCompleteConfirmOpen}
        title={pendingMarkCompleteValue ? "Mark Complete" : "Mark Incomplete"}
        onClose={() => {
          if (isSavingMarkComplete) return;
          setIsMarkCompleteConfirmOpen(false);
        }}
        widthClass="max-w-md"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsMarkCompleteConfirmOpen(false)}
              disabled={isSavingMarkComplete}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleConfirmMarkComplete}
              disabled={isSavingMarkComplete}
            >
              {isSavingMarkComplete ? "Saving..." : "Confirm"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          {pendingMarkCompleteValue
            ? "Are you sure you want to mark this job as complete?"
            : "Are you sure you want to mark this job as incomplete?"}
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

      <button
        type="button"
        className="pointer-events-auto fixed bottom-[144px] right-[-2px] z-[61] inline-flex h-9 w-9 translate-x-1/2 items-center justify-center rounded-full border border-slate-300/90 bg-white text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.2)] transition hover:bg-slate-50"
        onClick={() => setAreFloatingWidgetsVisible((previous) => !previous)}
        aria-label={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
        title={areFloatingWidgetsVisible ? "Hide widgets" : "Show widgets"}
      >
        {hasPopupCommentsSection || memos.length ? (
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
          <MemoChatPanel
            title="Memos"
            contextDescription="Memo thread for this job."
            hasMemoContext={hasMemoContext}
            isLoading={isMemosLoading}
            errorMessage={memosError}
            memos={memos}
            currentUserId={currentUserId}
            resolveMemoAuthor={resolveMemoAuthor}
            sendingReplyPostId={sendingReplyPostId}
            memoReplyDrafts={memoReplyDrafts}
            onChangeReplyDraft={(memoId, value) =>
              setMemoReplyDrafts((previous) => ({
                ...(previous || {}),
                [memoId]: value,
              }))
            }
            onSendReply={handleSendMemoReply}
            onDeleteItem={setMemoDeleteTarget}
            memoText={memoText}
            onMemoTextChange={setMemoText}
            isPostingMemo={isPostingMemo}
            onSendMemo={handleSendMemo}
            memoFile={memoFile}
            memoFileInputRef={memoFileInputRef}
            onMemoFileChange={handleMemoFileChange}
            onAttachClick={() => memoFileInputRef.current?.click()}
            onClearMemoFile={handleClearMemoFile}
            onClose={() => setIsMemoChatOpen(false)}
            unavailableMessage="Memos are available when the job record is loaded."
            emptyMessage="No memos yet. Start the thread with a quick update or attachment."
            DeleteIcon={TrashIcon}
            focusMemoId={memoFocusRequest.memoId}
            focusRequestKey={memoFocusRequest.key}
          />
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
            <path
              d="M6.5 8.5h8M6.5 11.5h6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          {memos.length ? (
            <span className="absolute -right-1 -top-1 inline-flex min-h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
              {memos.length > 99 ? "99+" : memos.length}
            </span>
          ) : null}
        </button>
      </div>
    </main>
  );
}
