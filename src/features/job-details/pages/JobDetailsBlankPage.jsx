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
  AppointmentTabSection,
  ContactDetailsModal,
  EditActionIcon as EditIcon,
  InvoiceSection,
  PropertyAffiliationModal,
  PropertyTabSection,
  SearchDropdownInput,
  TasksModal,
  TitleBackIcon,
  UploadsSection,
} from "@modules/job-workspace/public/components.js";
import { JobDirectStoreProvider } from "@modules/job-workspace/public/hooks.js";
import {
  extractFirstRecord,
  fetchLinkedPropertiesByAccount,
  fetchActivitiesByJobId,
  fetchMaterialsByJobId,
  fetchPropertiesForSearch,
  fetchServiceProvidersForSearch,
  searchPropertiesForLookup,
  subscribeActivitiesByJobId,
  subscribeMaterialsByJobId,
} from "@modules/job-workspace/public/sdk.js";
import {
  fetchPropertyAffiliationsForDetails,
  fetchTasksForDetails,
  savePropertyForDetails,
  updateCompanyFieldsById,
  updateContactFieldsById,
  updateInquiryFieldsById,
  updateJobFieldsById,
} from "@modules/job-records/public/sdk.js";
import {
  createAffiliationRecord,
  createCompanyRecord,
  createContactRecord,
  searchCompaniesForLookup,
  searchContactsForLookup,
  updateAffiliationRecord,
} from "@modules/job-workspace/sdk/core/runtime.js";
import { useRelatedRecordsData } from "../../inquiry/shared/useRelatedRecordsData.js";

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M5 15V6C5 4.89543 5.89543 4 7 4H16"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6 9l6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function toText(value) {
  return String(value || "").trim();
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  const text = toText(value).toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "1" || text === "yes" || text === "y") return true;
  if (text === "false" || text === "0" || text === "no" || text === "n") return false;
  return Boolean(value);
}

function isContactAccountType(value) {
  const normalized = toText(value).toLowerCase();
  return normalized === "contact" || normalized === "individual";
}

function isCompanyAccountType(value) {
  const normalized = toText(value).toLowerCase();
  return normalized === "company" || normalized === "entity";
}

function isBodyCorpCompanyAccountType(value) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return false;
  const collapsed = normalized.replace(/[^a-z0-9]+/g, "");
  return (
    normalized.includes("body corp") ||
    normalized.includes("body corporate") ||
    collapsed.includes("bodycorp")
  );
}

function isLikelyEmailValue(value) {
  const text = toText(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

function isLikelyPhoneValue(value) {
  const text = toText(value);
  if (!text) return false;
  const digits = text.replace(/\D+/g, "");
  return digits.length >= 6;
}

function toTelHref(value) {
  const text = toText(value);
  if (!text) return "";
  const normalized = text.replace(/[^\d+]+/g, "");
  return normalized ? `tel:${normalized}` : "";
}

function toMailHref(value) {
  const text = toText(value);
  return text ? `mailto:${text}` : "";
}

function toGoogleMapsHref(value) {
  const text = toText(value);
  if (!text || text === "—") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

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

function joinAddress(parts = []) {
  const cleaned = (Array.isArray(parts) ? parts : [])
    .map((value) => toText(value))
    .filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "";
}

function compactStringFields(source = {}) {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const trimmed = toText(value);
    if (trimmed) output[key] = trimmed;
  });
  return output;
}

function pickBooleanValue(record = {}, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    return toBoolean(record?.[key]);
  }
  return false;
}

function toPromiseLike(result) {
  if (result && typeof result.then === "function") return result;
  if (result && typeof result.toPromise === "function") return result.toPromise();
  return Promise.resolve(result);
}

function fullName(firstName, lastName) {
  return [toText(firstName), toText(lastName)].filter(Boolean).join(" ").trim();
}

function formatServiceProviderAllocationLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

function formatServiceProviderInputLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

function formatContactLookupLabel(contact = {}) {
  const id = toText(contact?.id || contact?.ID || contact?.Contact_ID);
  const name = fullName(contact?.first_name || contact?.First_Name, contact?.last_name || contact?.Last_Name);
  const email = toText(contact?.email || contact?.Email);
  const phone = toText(
    contact?.sms_number ||
      contact?.SMS_Number ||
      contact?.mobile_number ||
      contact?.Mobile_Number
  );
  const resolvedName = name || email || (id ? `Contact #${id}` : "Contact");
  const metadata = [email, phone].filter(Boolean).join(" | ");
  return metadata ? `${resolvedName} [${metadata}]` : resolvedName;
}

function formatCompanyLookupLabel(company = {}) {
  const id = toText(company?.id || company?.ID || company?.Company_ID);
  const name = toText(company?.name || company?.Name);
  const phone = toText(company?.phone || company?.Phone);
  const accountType = toText(company?.account_type || company?.Account_Type);
  const resolvedName = name || (id ? `Company #${id}` : "Company");
  const metadata = [accountType, phone].filter(Boolean).join(" | ");
  return metadata ? `${resolvedName} [${metadata}]` : resolvedName;
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
  { id: "invoice-payment", label: "Invoice and Payment" },
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

function DetailsCard({ title, onEdit, editDisabled = false, className = "", children }) {
  const showEditAction = typeof onEdit === "function";
  return (
    <article className={`rounded border border-slate-200 bg-white ${className}`}>
      <header className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-slate-900">{title}</div>
        {showEditAction ? (
          <button
            type="button"
            className="inline-flex items-center justify-center p-0 text-slate-500 transition hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
            onClick={onEdit}
            disabled={editDisabled}
            aria-label={`Edit ${title}`}
            title={`Edit ${title}`}
          >
            <EditIcon />
          </button>
        ) : null}
      </header>
      <div className="p-2.5">{children}</div>
    </article>
  );
}

function isMissingFieldValue(value) {
  const text = toText(value);
  return !text || text === "—" || text === "-";
}

function CardField({
  label,
  value,
  mono = false,
  className = "",
  href = "",
  openInNewTab = false,
  copyable = false,
  copyValue = "",
  onCopy = null,
}) {
  const displayValue = toText(value);
  if (isMissingFieldValue(displayValue)) return null;
  const canLink = Boolean(toText(href));
  const copyText = toText(copyValue || value);
  const canCopy = Boolean(copyable && copyText);
  const valueMaxWidthClass = canCopy ? "max-w-[calc(100%-1.5rem)]" : "max-w-full";
  const handleCopyClick = async () => {
    if (!canCopy) return;
    if (typeof onCopy === "function") {
      await onCopy({ label, value: copyText });
      return;
    }
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(copyText);
    }
  };
  return (
    <div className={`group min-w-0 ${className}`}>
      <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 flex w-full min-w-0 items-start gap-2">
        {canLink ? (
          <a
            href={href}
            target={openInNewTab ? "_blank" : undefined}
            rel={openInNewTab ? "noreferrer" : undefined}
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-blue-700 underline underline-offset-2 hover:text-blue-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </a>
        ) : (
          <div
            className={`inline-block min-w-0 ${valueMaxWidthClass} truncate text-[12px] font-medium text-slate-800 ${
              mono ? "font-mono" : ""
            }`}
            title={displayValue}
          >
            {displayValue}
          </div>
        )}
        {canCopy ? (
          <button
            type="button"
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:text-slate-700"
            onClick={handleCopyClick}
            aria-label={`Copy ${label}`}
            title={`Copy ${label}`}
          >
            <CopyIcon />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function SectionLoadingState({
  label = "Loading",
  blocks = 4,
  columnsClass = "sm:grid-cols-2",
  className = "",
}) {
  const placeholderItems = Array.from(
    { length: Math.max(1, Number.parseInt(blocks, 10) || 1) },
    (_, index) => index
  );
  return (
    <div className={`space-y-2 ${className}`}>
      <div className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-500">
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
        <span>{label}</span>
      </div>
      <div className={`grid grid-cols-1 gap-2 ${columnsClass}`}>
        {placeholderItems.map((item) => (
          <div
            key={`section-loader-${label}-${item}`}
            className="rounded border border-slate-200 bg-slate-50 p-2"
          >
            <div className="h-2.5 w-20 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  );
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

function normalizeWorkspacePropertyRecord(rawProperty = {}) {
  return {
    ...(rawProperty && typeof rawProperty === "object" ? rawProperty : {}),
    id: toText(
      rawProperty?.id ||
        rawProperty?.ID ||
        rawProperty?.Property_ID ||
        rawProperty?.PropertiesID
    ),
    unique_id: toText(
      rawProperty?.unique_id ||
        rawProperty?.Unique_ID ||
        rawProperty?.Property_Unique_ID ||
        rawProperty?.Properties_Unique_ID
    ),
    property_name: toText(
      rawProperty?.property_name ||
        rawProperty?.Property_Name ||
        rawProperty?.Property_Property_Name ||
        rawProperty?.Properties_Property_Name
    ),
    lot_number: toText(rawProperty?.lot_number || rawProperty?.Lot_Number),
    unit_number: toText(rawProperty?.unit_number || rawProperty?.Unit_Number),
    address_1: toText(rawProperty?.address_1 || rawProperty?.Address_1 || rawProperty?.address || rawProperty?.Address),
    address_2: toText(rawProperty?.address_2 || rawProperty?.Address_2),
    address: toText(rawProperty?.address || rawProperty?.Address),
    city: toText(rawProperty?.city || rawProperty?.City),
    suburb_town: toText(rawProperty?.suburb_town || rawProperty?.Suburb_Town),
    state: toText(rawProperty?.state || rawProperty?.State),
    postal_code: toText(
      rawProperty?.postal_code ||
        rawProperty?.Postal_Code ||
        rawProperty?.zip_code ||
        rawProperty?.Zip_Code
    ),
    zip_code: toText(rawProperty?.zip_code || rawProperty?.Zip_Code),
    country: toText(rawProperty?.country || rawProperty?.Country),
    property_type: toText(rawProperty?.property_type || rawProperty?.Property_Type),
    building_type: toText(rawProperty?.building_type || rawProperty?.Building_Type),
    building_type_other: toText(
      rawProperty?.building_type_other || rawProperty?.Building_Type_Other
    ),
    foundation_type: toText(rawProperty?.foundation_type || rawProperty?.Foundation_Type),
    bedrooms: toText(rawProperty?.bedrooms || rawProperty?.Bedrooms),
    manhole: toBoolean(rawProperty?.manhole ?? rawProperty?.Manhole),
    stories: toText(rawProperty?.stories || rawProperty?.Stories),
    building_age: toText(rawProperty?.building_age || rawProperty?.Building_Age),
    building_features: rawProperty?.building_features || rawProperty?.Building_Features || [],
    building_features_options_as_text: toText(
      rawProperty?.building_features_options_as_text ||
        rawProperty?.Building_Features_Options_As_Text ||
        rawProperty?.building_features
    ),
  };
}

function mergeNormalizedPropertyRecords(...collections) {
  const byId = new Map();
  collections
    .flatMap((records) => (Array.isArray(records) ? records : [records]))
    .forEach((record) => {
      const normalized = normalizeWorkspacePropertyRecord(record);
      const id = toText(normalized?.id || normalized?.ID || normalized?.Property_ID);
      if (!id) return;
      const previous = byId.get(id) || {};
      byId.set(id, { ...previous, ...normalized });
    });
  return Array.from(byId.values());
}

async function fetchCompanyAccountRecordById({ plugin, companyId } = {}) {
  const normalizedCompanyId = toText(companyId);
  if (!plugin?.switchTo || !normalizedCompanyId) return null;
  const whereValue = /^\d+$/.test(normalizedCompanyId)
    ? Number.parseInt(normalizedCompanyId, 10)
    : normalizedCompanyId;
  const query = plugin
    .switchTo("PeterpmCompany")
    .query()
    .where("id", whereValue)
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
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

async function fetchContactAccountRecordById({ plugin, contactId } = {}) {
  const normalizedContactId = toText(contactId);
  if (!plugin?.switchTo || !normalizedContactId) return null;
  const whereValue = /^\d+$/.test(normalizedContactId)
    ? Number.parseInt(normalizedContactId, 10)
    : normalizedContactId;
  const query = plugin
    .switchTo("PeterpmContact")
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
      "id",
      "first_name",
      "last_name",
      "email",
      "sms_number",
      "office_phone",
      "lot_number",
      "unit_number",
      "address",
      "city",
      "state",
      "zip_code",
      "country",
      "postal_address",
      "postal_city",
      "postal_state",
      "postal_country",
      "postal_code",
      "xero_contact_id",
    ])
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
  return normalizeWorkspacePropertyRecord(extractFirstRecord(result) || {});
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

export function JobDetailsBlankPage() {
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
  const [serviceProviderLookup, setServiceProviderLookup] = useState([]);
  const [isServiceProviderLookupLoading, setIsServiceProviderLookupLoading] = useState(false);
  const [allocatedServiceProviderId, setAllocatedServiceProviderId] = useState("");
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState("");
  const [isAllocatingServiceProvider, setIsAllocatingServiceProvider] = useState(false);
  const [jobTakenByLookup, setJobTakenByLookup] = useState([]);
  const [isJobTakenByLookupLoading, setIsJobTakenByLookupLoading] = useState(false);
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
  const [isReviewAcceptModalOpen, setIsReviewAcceptModalOpen] = useState(false);
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
  const [isBodyCorpDetailsOpen, setIsBodyCorpDetailsOpen] = useState(false);
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
    setIsReviewAcceptModalOpen(false);
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
    setJobEmailContactSearchValue("");
    setAccountsContactSearchValue("");
    setSelectedJobEmailContactId("");
    setSelectedAccountsContactId("");
    setIsSavingQuoteContacts(false);
    setCompanyLookupRecords([]);
    setContactLookupRecords([]);
    setIsCompanyLookupLoading(false);
    setIsContactLookupLoading(false);
    setIsBodyCorpDetailsOpen(false);
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
    if (!isSdkReady || !plugin) {
      setServiceProviderLookup([]);
      setIsServiceProviderLookupLoading(false);
      return;
    }

    let cancelled = false;
    setIsServiceProviderLookupLoading(true);
    fetchServiceProvidersForSearch({ plugin })
      .then((records) => {
        if (cancelled) return;
        setServiceProviderLookup(Array.isArray(records) ? records : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to fetch service provider lookup", lookupError);
        setServiceProviderLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsServiceProviderLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

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
      setIsReviewAcceptModalOpen(false);
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
      setIsBodyCorpDetailsOpen(false);
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
      setIsReviewAcceptModalOpen(false);
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
      setIsBodyCorpDetailsOpen(false);
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
        setIsBodyCorpDetailsOpen(false);
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
        setIsReviewAcceptModalOpen(false);
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
        setIsBodyCorpDetailsOpen(false);
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
          const normalizedProperty = normalizeWorkspacePropertyRecord(
            resolvedJobProperty || { id: resolvedPropertyId }
          );
          setLoadedPropertyId((previous) => toText(previous || normalizedProperty.id));
          setSelectedWorkspacePropertyId((previous) => toText(previous || normalizedProperty.id));
          setWorkspacePropertyLookupRecords((previous) =>
            mergeNormalizedPropertyRecords(previous, [normalizedProperty])
          );
          setLinkedProperties((previous) =>
            mergeNormalizedPropertyRecords(previous, [normalizedProperty])
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

  useEffect(() => {
    if (!isSdkReady || !plugin) {
      setJobTakenByLookup([]);
      setIsJobTakenByLookupLoading(false);
      return;
    }

    let cancelled = false;
    setIsJobTakenByLookupLoading(true);
    fetchServiceProvidersForSearch({ plugin, providerType: "Admin", status: "" })
      .then((records) => {
        if (cancelled) return;
        setJobTakenByLookup(Array.isArray(records) ? records : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.error("[JobDetailsBlank] Failed to fetch job taken by lookup", lookupError);
        setJobTakenByLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsJobTakenByLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isSdkReady, plugin]);

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
        const normalized = mergeNormalizedPropertyRecords(Array.isArray(records) ? records : []);
        setWorkspacePropertyLookupRecords((previous) =>
          mergeNormalizedPropertyRecords(previous, normalized)
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
          mergeNormalizedPropertyRecords(Array.isArray(records) ? records : [])
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
        const normalized = mergeNormalizedPropertyRecords(Array.isArray(records) ? records : []);
        setLinkedProperties(normalized);
        setWorkspacePropertyLookupRecords((previous) =>
          mergeNormalizedPropertyRecords(previous, normalized)
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
    const acFirstName = toText(selectedAffiliation?.contact_first_name);
    const acLastName = toText(selectedAffiliation?.contact_last_name);
    const acEmail = toText(
      selectedAffiliation?.contact_email ||
        selectedAffiliation?.company_as_accounts_contact_email
    );
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
    fullName(accountPrimaryContact?.first_name, accountPrimaryContact?.last_name) ||
      toText(accountPrimaryContact?.email) ||
      toText(accountPrimaryContact?.sms_number) ||
      toText(accountPrimaryContact?.address)
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

  const accountContactName = fullName(
    accountPrimaryContact?.first_name,
    accountPrimaryContact?.last_name
  );
  const accountContactEmail = toText(accountPrimaryContact?.email);
  const accountContactPhone = toText(accountPrimaryContact?.sms_number);
  const accountContactEmailHref = isLikelyEmailValue(accountContactEmail)
    ? toMailHref(accountContactEmail)
    : "";
  const accountContactPhoneHref = isLikelyPhoneValue(accountContactPhone)
    ? toTelHref(accountContactPhone)
    : "";
  const accountContactAddress = joinAddress([
    accountPrimaryContact?.address,
    accountPrimaryContact?.city,
    accountPrimaryContact?.state,
    accountPrimaryContact?.zip_code,
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
  const residentFeedbackAvailable = Boolean(toText(relatedInquiryId));
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
        service: toText(item?.service_name || item?.Service_Service_Name || item?.activity_text),
        qty: toText(item?.quantity || item?.Quantity || "1"),
        price: formatCurrencyDisplay(item?.activity_price || item?.Activity_Price || 0),
      }))
      .filter((row) => row.task || row.option || row.service);

    const feedbackSection = residentFeedbackAvailable
      ? `
      <div class="section-title center">Resident's Feedback</div>
      <div class="grid-two">
        <div><b>Animals:</b> ${escapeHtml(toText(relatedInquiryRecord?.how_can_we_help))}</div>
        <div><b>Renovations:</b> ${escapeHtml(toText(relatedInquiryRecord?.renovations))}</div>
        <div><b>Building:</b> ${escapeHtml(toText(activeWorkspaceProperty?.building_type || activeWorkspaceProperty?.Building_Type || activeWorkspaceProperty?.property_type || activeWorkspaceProperty?.Property_Type))}</div>
        <div><b>Times:</b> ${escapeHtml(toText(relatedInquiryRecord?.pest_active_times_options_as_text))}</div>
        <div><b>Noises:</b> ${escapeHtml(toText(relatedInquiryRecord?.noise_signs_options_as_text))}</div>
        <div><b>Location:</b> ${escapeHtml(toText(relatedInquiryRecord?.pest_location_options_as_text))}</div>
        <div><b>Res. Hrs:</b> ${escapeHtml(toText(relatedInquiryRecord?.resident_availability))}</div>
        <div><b>Stories:</b> ${escapeHtml(toText(activeWorkspaceProperty?.stories || activeWorkspaceProperty?.Stories))}</div>
        <div><b>Building Age:</b> ${escapeHtml(toText(activeWorkspaceProperty?.building_age || activeWorkspaceProperty?.Building_Age))}</div>
        <div><b>Manhole?</b> ${escapeHtml(toText(activeWorkspaceProperty?.manhole || activeWorkspaceProperty?.Manhole))}</div>
      </div>
      <div class="recommendation"><b>Recommendations:</b> ${escapeHtml(toText(quotePaymentDetails?.admin_recommendation || relatedInquiryRecord?.recommendations))}</div>
      `
      : "";

    const logoAbsUrl = `${window.location.origin}${logoUrl}`;
    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Job Sheet</title>
  <style>
    body { font-family: Arial, sans-serif; color: #111; margin: 0; padding: 12px; font-size: 12px; }
    .sheet { border: 1px solid #cbd5e1; padding: 10px; }
    .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
    .logo { max-height: 56px; max-width: 180px; object-fit: contain; }
    .top { display: grid; grid-template-columns: 1fr auto; gap: 8px; align-items: start; }
    .title { text-align: center; font-weight: 700; font-size: 30px; letter-spacing: .5px; margin: 4px 0 10px; }
    .muted { color: #334155; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 4px; }
    .section-title { font-weight: 700; border-top: 1px solid #111; border-bottom: 1px solid #111; padding: 3px 0; margin: 8px 0 6px; }
    .section-title.center { text-align: center; }
    .grid-two { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
    .recommendation { margin-top: 6px; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th, td { border: 1px solid #94a3b8; padding: 4px; text-align: left; font-size: 11px; }
    th { background: #f1f5f9; }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="header">
      <img src="${logoAbsUrl}" class="logo" alt="Logo" />
    </div>
    <div class="top">
      <div>
        <div><b>Account Name:</b> ${escapeHtml(toText(accountLabel))}</div>
        <div><b>Account Type:</b> ${escapeHtml(toText(accountType || "-"))}</div>
        <div><b>Work Req. By:</b> ${escapeHtml(toText(jobTakenBySearch || jobTakenByPrefillLabel))}</div>
        <div><b>Work Order #:</b> ${escapeHtml(toText(safeUid))}</div>
        <div><b>Job Address:</b> ${escapeHtml(toText(activePropertyAddress || accountAddressLabel))}</div>
        <div><b>Job Suburb:</b> ${escapeHtml(toText(activeWorkspaceProperty?.suburb_town || activeWorkspaceProperty?.Suburb_Town || activeWorkspaceProperty?.city || activeWorkspaceProperty?.City))}</div>
      </div>
      <div class="muted"><b>Date:</b> ${escapeHtml(formatDateDisplay(Date.now()))}</div>
    </div>

    <div class="title">JOB SHEET</div>
    <div class="section-title">Resident's Details</div>
    ${residentsRows.length ? residentsRows.map((row) => `<div>${escapeHtml(row)}</div>`).join("") : "<div>-</div>"}
    ${feedbackSection}

    <div class="section-title">Activities</div>
    ${
      activitiesRows.length
        ? `<table><thead><tr><th>Task</th><th>Option</th><th>Service</th><th>Qty</th><th>Price</th></tr></thead><tbody>${
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
  </div>
</body>
</html>`;
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
    relatedInquiryId,
    relatedInquiryRecord,
    residentFeedbackAvailable,
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

  const handleAcceptQuote = useCallback(async () => {
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
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          quote_status: "Accepted",
          job_status: "In Progress",
          date_quoted_accepted: now,
        },
      });
      setQuotePaymentDetails((previous) => ({
        ...previous,
        quote_status: "Accepted",
        date_quoted_accepted: now,
      }));
      setLoadedJobStatus("In Progress");
      setIsReviewAcceptModalOpen(false);
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
  ]);

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

      const normalizedLinkedProperties = mergeNormalizedPropertyRecords(
        Array.isArray(linkedPropertyRecords) ? linkedPropertyRecords : []
      );
      const normalizedLookupProperties = mergeNormalizedPropertyRecords(
        Array.isArray(allPropertyRecords) ? allPropertyRecords : []
      );
      setLinkedProperties(normalizedLinkedProperties);
      setWorkspacePropertyLookupRecords(
        mergeNormalizedPropertyRecords(normalizedLookupProperties, normalizedLinkedProperties)
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
            ? mergeNormalizedPropertyRecords(existing, [matchedRecord])
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
    async ({ fieldName, value } = {}) => {
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
        payload: { send_job_update_to_service_provider: true },
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
                        setIsReviewAcceptModalOpen(true);
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
                            className="text-left text-sm text-slate-700"
                            onClick={() => setOpenMenu("")}
                          >
                            {option.button_name}
                          </button>
                          <button
                            type="button"
                            className="text-sm font-medium text-blue-700 underline"
                            onClick={() => setOpenMenu("")}
                          >
                            ({option.template_link_button})
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

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
                  <div className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setOpenMenu("")}
                    >
                      Duplicate Job
                    </button>
                    <button
                      type="button"
                      className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                      onClick={() => setOpenMenu("")}
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
          <DetailsCard
            title="Account Details"
            onEdit={handleOpenAccountEditor}
            editDisabled={!effectiveJobId}
          >
            {isAccountDetailsLoading ? (
              <SectionLoadingState
                label="Loading account details"
                blocks={6}
                columnsClass="sm:grid-cols-2"
              />
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                  <CardField
                    label="UID"
                    value={safeUid}
                    mono
                    copyable
                    copyValue={safeUid}
                    onCopy={handleCopyFieldValue}
                  />
                  <CardField label="Account Type" value={accountType} />
                </div>

                {showContactDetails && hasAccountContactFields ? (
                  <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                    <CardField label="Contact Name" value={accountContactName} />
                    <CardField
                      label="Contact Email"
                      value={accountContactEmail}
                      href={accountContactEmailHref}
                      copyable
                      copyValue={accountContactEmail}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Contact Phone"
                      value={accountContactPhone}
                      href={accountContactPhoneHref}
                      copyable
                      copyValue={accountContactPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Contact Address"
                      value={accountContactAddress}
                      href={accountContactAddressHref}
                      openInNewTab
                      copyable
                      copyValue={accountContactAddressHref ? accountContactAddress : ""}
                      onCopy={handleCopyFieldValue}
                      className="sm:col-span-2"
                    />
                  </div>
                ) : null}

                {showCompanyDetails && hasAccountCompanyFields ? (
                  <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
                    <CardField label="Company" value={accountCompanyName} />
                    <CardField
                      label="Company Phone"
                      value={accountCompanyPhone}
                      href={accountCompanyPhoneHref}
                      copyable
                      copyValue={accountCompanyPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField label="Company Primary" value={accountCompanyPrimaryName} />
                    <CardField
                      label="Primary Email"
                      value={accountCompanyPrimaryEmail}
                      href={accountCompanyPrimaryEmailHref}
                      copyable
                      copyValue={accountCompanyPrimaryEmail}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Primary Phone"
                      value={accountCompanyPrimaryPhone}
                      href={accountCompanyPrimaryPhoneHref}
                      copyable
                      copyValue={accountCompanyPrimaryPhone}
                      onCopy={handleCopyFieldValue}
                    />
                    <CardField
                      label="Company Address"
                      value={accountCompanyAddress}
                      href={accountCompanyAddressHref}
                      openInNewTab
                      copyable
                      copyValue={accountCompanyAddressHref ? accountCompanyAddress : ""}
                      onCopy={handleCopyFieldValue}
                      className="sm:col-span-2"
                    />
                  </div>
                ) : null}

                {showCompanyDetails && isBodyCorpAccount && hasBodyCorpDetails ? (
                  <div className="rounded border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
                      onClick={() => setIsBodyCorpDetailsOpen((previous) => !previous)}
                      aria-expanded={isBodyCorpDetailsOpen}
                      aria-controls="body-corp-company-details"
                    >
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Body Corp Company
                      </span>
                      <span
                        className={`text-slate-500 transition-transform ${
                          isBodyCorpDetailsOpen ? "rotate-180" : ""
                        }`}
                      >
                        <ChevronDownIcon />
                      </span>
                    </button>
                    {isBodyCorpDetailsOpen ? (
                      <div
                        id="body-corp-company-details"
                        className="grid grid-cols-1 gap-x-3 gap-y-2 px-2 pb-2 sm:grid-cols-2"
                      >
                        <CardField label="Body Corp Name" value={accountBodyCorpName} />
                        <CardField label="Body Corp Type" value={accountBodyCorpType} />
                        <CardField
                          label="Body Corp Phone"
                          value={accountBodyCorpPhone}
                          href={accountBodyCorpPhoneHref}
                          copyable
                          copyValue={accountBodyCorpPhone}
                          onCopy={handleCopyFieldValue}
                        />
                        <CardField
                          label="Body Corp Address"
                          value={accountBodyCorpAddress}
                          href={accountBodyCorpAddressHref}
                          openInNewTab
                          copyable
                          copyValue={accountBodyCorpAddressHref ? accountBodyCorpAddress : ""}
                          onCopy={handleCopyFieldValue}
                          className="sm:col-span-2"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {!hasAccountContactFields && !hasAccountCompanyFields && !hasBodyCorpDetails ? (
                  <div className="text-sm text-slate-500">No account details available.</div>
                ) : null}
              </div>
            )}
          </DetailsCard>

          <DetailsCard title="Job Payment & Quote Details" className="xl:col-span-2">
            {!effectiveJobId || isNewJob ? (
              <div className="text-sm text-slate-500">Open an existing job to view quote/payment details.</div>
            ) : (
              <div className="space-y-2">
                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Quote Workflow
                  </div>
                  {quoteStatusNormalized === "sent" || quoteStatusNormalized === "accepted" ? (
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          {isCompanyAccount ? "Job Email Company" : "Job Email Contact"}:
                        </span>
                        <span
                          className="max-w-[280px] truncate text-sm text-slate-700"
                          title={resolvedJobEmailSelectionLabel || selectedJobEmailContactId || "-"}
                        >
                          {resolvedJobEmailSelectionLabel || selectedJobEmailContactId || "-"}
                        </span>
                      </span>
                      <span className="inline-flex max-w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                          Accounts Contact:
                        </span>
                        <span
                          className="max-w-[280px] truncate text-sm text-slate-700"
                          title={resolvedAccountsContactSelectionLabel || selectedAccountsContactId || "-"}
                        >
                          {resolvedAccountsContactSelectionLabel || selectedAccountsContactId || "-"}
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
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
                      </div>

                      <div>
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
                    </div>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {quoteStatusNormalized !== "accepted" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 whitespace-nowrap px-3 !text-xs"
                        onClick={handleSaveQuoteContacts}
                        disabled={isSavingQuoteContacts || isQuoteWorkflowUpdating}
                      >
                        {isSavingQuoteContacts ? "Saving..." : "Save Contacts"}
                      </Button>
                    ) : null}
                    {canSendQuote ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 whitespace-nowrap px-3 !text-xs"
                        onClick={handleSendQuote}
                        disabled={
                          isQuoteWorkflowUpdating ||
                          !toText(selectedAccountsContactId)
                        }
                      >
                        {isQuoteWorkflowUpdating ? "Sending..." : "Send Quote"}
                      </Button>
                    ) : null}
                    {canAcceptQuote ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 whitespace-nowrap px-3 !text-xs"
                        onClick={() => setIsReviewAcceptModalOpen(true)}
                        disabled={isQuoteWorkflowUpdating}
                      >
                        {isQuoteWorkflowUpdating ? "Accepting..." : "Review and Accept Quote"}
                      </Button>
                    ) : null}
                    {quoteStatusNormalized === "accepted" ? (
                      <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800">
                        Quote Accepted
                      </span>
                    ) : null}
                    {hasQuoteStatusValue ? (
                      <span className="text-xs text-slate-500">
                        Current quote status: {quoteStatusLabel}
                      </span>
                    ) : null}
                  </div>
                </div>

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
          <section className="rounded border border-slate-200 bg-white px-2.5 py-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {JOB_WORKSPACE_TABS.map((tab) => {
                const isActive = activeWorkspaceTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    className={`rounded px-2.5 py-1.5 text-xs font-semibold ${
                      isActive
                        ? "bg-[#003882] text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
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
                {!relatedRecordsAccountId ? (
                  <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                    Link a contact/company on this job to load related records.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {relatedRecords?.isLoading &&
                    !relatedRecords?.relatedDeals?.length &&
                    !relatedRecords?.relatedJobs?.length ? (
                      <div className="text-[11px] text-slate-500">
                        Loading related inquiries and jobs...
                      </div>
                    ) : null}
                    {relatedRecords?.error ? (
                      <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
                        {toText(relatedRecords.error)}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                      <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Related Inquiries
                        </div>
                        {Array.isArray(relatedRecords?.relatedDeals) && relatedRecords.relatedDeals.length ? (
                          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                            {relatedRecords.relatedDeals.slice(0, 12).map((deal) => {
                              const dealId = toText(deal?.id || deal?.ID);
                              const dealUid = toText(deal?.unique_id || deal?.Unique_ID || deal?.id || deal?.ID);
                              const dealName = toText(deal?.deal_name || deal?.Deal_Name);
                              if (!dealUid) return null;
                              const isSelected = Boolean(relatedInquiryId) && relatedInquiryId === dealId;
                              return (
                                <div
                                  key={dealUid}
                                  className={`rounded border bg-white px-2 py-1.5 ${
                                    isSelected ? "border-sky-400" : "border-slate-200"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                      <button
                                        type="button"
                                        className="truncate text-[11px] font-semibold text-sky-700 underline"
                                        onClick={() =>
                                          navigate(`/inquiry-details/${encodeURIComponent(dealUid)}`)
                                        }
                                      >
                                        {dealUid}
                                      </button>
                                      {dealName ? (
                                        <div className="truncate text-[11px] text-slate-600">{dealName}</div>
                                      ) : null}
                                    </div>
                                    <input
                                      type="checkbox"
                                      className="h-3.5 w-3.5 shrink-0 accent-[#003882]"
                                      checked={isSelected}
                                      disabled={!dealId || isSavingLinkedInquiry}
                                      onChange={() => handleToggleRelatedInquiryLink(deal)}
                                      aria-label={`Link job to inquiry ${dealUid}`}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            {relatedRecords?.isLoading
                              ? "Loading related inquiries..."
                              : "No related inquiries found."}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
                        <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">
                          Related Jobs
                        </div>
                        {Array.isArray(relatedRecords?.relatedJobs) && relatedRecords.relatedJobs.length ? (
                          <div className="max-h-40 space-y-1.5 overflow-auto pr-1">
                            {relatedRecords.relatedJobs.slice(0, 12).map((jobRecord) => {
                              const jobUid = toText(
                                jobRecord?.unique_id || jobRecord?.Unique_ID || jobRecord?.id || jobRecord?.ID
                              );
                              const jobId = toText(jobRecord?.id || jobRecord?.ID);
                              const propertyName = toText(jobRecord?.property_name || jobRecord?.Property_Name);
                              const jobStatusText = toText(jobRecord?.job_status || jobRecord?.Job_Status);
                              const quoteStatusText = toText(jobRecord?.quote_status || jobRecord?.Quote_Status);
                              const isCurrentJob = Boolean(effectiveJobId) && effectiveJobId === jobId;
                              if (!jobUid) return null;
                              return (
                                <div
                                  key={jobUid}
                                  className={`rounded border bg-white px-2 py-1.5 ${
                                    isCurrentJob ? "border-sky-400" : "border-slate-200"
                                  }`}
                                >
                                  <button
                                    type="button"
                                    className="truncate text-[11px] font-semibold text-sky-700 underline"
                                    onClick={() => navigate(`/job-details/${encodeURIComponent(jobUid)}`)}
                                  >
                                    {jobUid}
                                  </button>
                                  {propertyName ? (
                                    <div className="truncate text-[11px] text-slate-600">{propertyName}</div>
                                  ) : null}
                                  {jobStatusText || quoteStatusText ? (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {jobStatusText ? (
                                        <span
                                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                          style={resolveJobStatusStyle(jobStatusText)}
                                        >
                                          {jobStatusText}
                                        </span>
                                      ) : null}
                                      {quoteStatusText ? (
                                        <span
                                          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                          style={resolveQuoteStatusStyle(quoteStatusText)}
                                        >
                                          {quoteStatusText}
                                        </span>
                                      ) : null}
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-500">
                            {relatedRecords?.isLoading
                              ? "Loading related jobs..."
                              : "No related jobs found."}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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
                <InvoiceSection plugin={plugin} jobData={jobDirectBootstrapJobData} />
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
        open={isReviewAcceptModalOpen}
        title="Review and Accept Quote"
        onClose={() => {
          if (isQuoteWorkflowUpdating) return;
          setIsReviewAcceptModalOpen(false);
        }}
        widthClass="max-w-[min(96vw,1200px)]"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsReviewAcceptModalOpen(false)}
              disabled={isQuoteWorkflowUpdating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleAcceptQuote}
              disabled={isQuoteWorkflowUpdating}
            >
              {isQuoteWorkflowUpdating ? "Accepting..." : "Review and Accept Quote"}
            </Button>
          </div>
        }
      >
        <iframe
          title="Job sheet review"
          srcDoc={reviewJobSheetHtml}
          className="h-[72vh] w-full rounded border border-slate-200 bg-white"
        />
      </Modal>

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
    </main>
  );
}
