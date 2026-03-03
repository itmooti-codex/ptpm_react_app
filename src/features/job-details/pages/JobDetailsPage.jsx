import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { getFriendlyServiceMessage } from "../../../shared/utils/userFacingErrors.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { APP_USER } from "../../../config/userConfig.js";
import { JobDirectStoreProvider } from "../../job-direct/hooks/useJobDirectStore.jsx";
import { useVitalStatsPlugin } from "../../job-direct/hooks/useVitalStatsPlugin.js";
import { AddPropertyModal } from "../../job-direct/components/modals/AddPropertyModal.jsx";
import { DealInformationModal } from "../../job-direct/components/modals/DealInformationModal.jsx";
import { ContactDetailsModal } from "../../job-direct/components/modals/ContactDetailsModal.jsx";
import { TasksModal } from "../../job-direct/components/modals/TasksModal.jsx";
import { AddActivitiesSection } from "../../job-direct/components/sections/AddActivitiesSection.jsx";
import { AddMaterialsSection } from "../../job-direct/components/sections/AddMaterialsSection.jsx";
import { InvoiceSection } from "../../job-direct/components/sections/InvoiceSection.jsx";
import { UploadsSection } from "../../job-direct/components/sections/UploadsSection.jsx";
import { AppointmentTabSection } from "../../job-direct/components/sections/job-information/AppointmentTabSection.jsx";
import { SearchDropdownInput } from "../../job-direct/components/sections/job-information/JobInfoFormFields.jsx";
import {
  EditActionIcon as EditIcon,
  TrashActionIcon as TrashIcon,
} from "../../job-direct/components/icons/ActionIcons.jsx";
import { StarIcon } from "../../job-direct/components/sections/job-information/JobInfoOptionCards.jsx";
import {
  getAffiliationCompanyName,
  getAffiliationContactName,
  getPropertyFeatureText,
  isPrimaryAffiliation,
} from "../../job-direct/components/sections/job-information/jobInfoUtils.js";
import { resolveStatusStyle } from "../../dashboard/constants/statusStyles.js";
import {
  createAffiliationRecord,
  createCompanyRecord,
  createContactRecord,
  deleteAffiliationRecord,
  fetchActivitiesByJobId,
  fetchPropertiesForSearch,
  fetchMaterialsByJobId,
  fetchCompaniesForSearch,
  fetchServiceProvidersForSearch,
  subscribeActivitiesByJobId,
  subscribeMaterialsByJobId,
  uploadMaterialFile,
  updateAffiliationRecord,
} from "../../job-direct/sdk/jobDirectSdk.js";
import { TitleBackIcon } from "../../job-direct/components/icons/JobDirectIcons.jsx";
import {
  allocateServiceProviderForInquiry,
  createUploadForDetails,
  deleteUploadForDetails,
  createLinkedJobForInquiry,
  fetchContactsForLookup,
  fetchPropertyAffiliationsForDetails,
  fetchMemosForDetails,
  fetchTasksForDetails,
  fetchUploadsForDetails,
  resolveJobDetailsContext,
  savePropertyForDetails,
  subscribeMemosForDetails,
  createMemoPostForDetails,
  createMemoCommentForDetails,
  deleteMemoPostForDetails,
  deleteMemoCommentForDetails,
  updateContactFieldsById,
  updateCompanyFieldsById,
  updateInquiryFieldsById,
  updateJobFieldsById,
} from "../sdk/jobDetailsSdk.js";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../shared/announcements/announcementEmitter.js";
import { parseAnnouncementLocationSearch } from "../../../shared/announcements/announcementNavigation.js";

const PAGE_TABS = [
  "Overview",
  "Uploads",
  "Appointments",
  "Tasks",
  "Activities",
  "Materials",
  "Invoice & Payment",
];

const STAGES = [
  { key: "inquiry", label: "Inquiry" },
  { key: "allocated", label: "Provider Allocated" },
  { key: "quoteCreated", label: "Quote Created" },
  { key: "quoteSent", label: "Quote Sent" },
  { key: "quoteAccepted", label: "Quote Accepted" },
  { key: "invoiceSent", label: "Invoice Sent" },
  { key: "paid", label: "Paid" },
];

const EMAIL_OPTIONS_DATA = {
  general: {
    label: "General Emails",
    buttons: [
      {
        button_name: "Email Customer",
        template_link_button: "Job Email",
        message_id: "35",
        field_id: "email_customer_job_email",
      },
      {
        button_name: "Email Tenant",
        template_link_button: "Job Email",
        message_id: "msg_gen_2",
        field_id: "email_tenant_job_email",
      },
      {
        button_name: "Request Review",
        template_link_button: "Job Email",
        message_id: "msg_gen_3",
        field_id: "request_review",
      },
    ],
  },
  quote: {
    label: "Quote Emails",
    buttons: [
      {
        button_name: "Email Manual Quote",
        template_link_button: "Job Email",
        message_id: "msg_quote_1",
        field_id: "email_manual_quote",
      },
      {
        button_name: "Email Electronic Quote",
        template_link_button: "Job Email",
        message_id: "msg_quote_2",
        field_id: "email_electronic_quote",
      },
      {
        button_name: "Email RE Quote FU",
        template_link_button: "Job Email",
        message_id: "msg_quote_3",
        field_id: "email_re_quote_fu",
      },
      {
        button_name: "Email BC Quote FU",
        template_link_button: "Job Email",
        message_id: "msg_quote_4",
        field_id: "email_bc_quote_fu",
      },
      {
        button_name: "Email O Quote FU",
        template_link_button: "Job Email",
        message_id: "msg_quote_5",
        field_id: "email_o_quote_fu",
      },
      {
        button_name: "Email 2nd Quote FU",
        template_link_button: "Job Email",
        message_id: "msg_quote_6",
        field_id: "field_quote_6",
      },
    ],
  },
  invoice: {
    label: "Invoice Emails",
    buttons: [
      {
        button_name: "Email Invoice",
        template_link_button: "Account Email",
        message_id: "msg_inv_1",
        field_id: "field_inv_1",
      },
      {
        button_name: "Email Invoice FU",
        template_link_button: "Account Email",
        message_id: "msg_inv_2",
        field_id: "field_inv_2",
      },
      {
        button_name: "Email RE INV FU",
        template_link_button: "Account Email",
        message_id: "msg_inv_3",
        field_id: "field_inv_3",
      },
    ],
  },
};

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeStatus(value) {
  return toText(value).toLowerCase();
}

function isCompanyAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized === "company" || normalized === "entity";
}

function isContactAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized === "contact" || normalized === "individual";
}

function isBodyCorpCompanyAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized.includes("body corp");
}

function formatDate(value) {
  const text = toText(value);
  if (!text) return "—";

  let date = null;
  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      date = new Date(asMs);
    }
  } else if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    date = new Date(text);
  } else {
    const parsed = new Date(text);
    if (!Number.isNaN(parsed.getTime())) date = parsed;
  }

  if (!date || Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function parseJsonLike(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  const text = toText(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function getMemoFileMeta(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const parsed = parseJsonLike(input);
    if (parsed && typeof parsed === "object") {
      return getMemoFileMeta(parsed);
    }
    const link = toText(input);
    if (!link) return null;
    return {
      link,
      name: link.split("/").filter(Boolean).pop() || "Attachment",
      size: "",
      type: "",
    };
  }
  if (typeof input === "object") {
    if (Array.isArray(input)) {
      const first = input.find(Boolean);
      return first ? getMemoFileMeta(first) : null;
    }
    if (input.fileObject) {
      return getMemoFileMeta(input.fileObject);
    }
    const link = toText(input.link || input.url || input.path);
    if (!link) return null;
    return {
      link,
      name: toText(input.name || input.filename) || link.split("/").filter(Boolean).pop() || "Attachment",
      size: input.size || "",
      type: toText(input.type || input.mime),
    };
  }
  return null;
}

function formatRelativeTime(value) {
  if (value == null || value === "") return "-";
  let ms = null;
  if (typeof value === "number" && Number.isFinite(value)) {
    ms = value > 1e12 ? value : value * 1000;
  } else {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) ms = parsed.getTime();
  }
  if (!Number.isFinite(ms)) return "-";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(ms).toLocaleDateString();
}

function getAuthorName(author = {}) {
  return (
    toText(author?.display_name || author?.Display_Name) ||
    [toText(author?.first_name || author?.First_Name), toText(author?.last_name || author?.Last_Name)]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Unknown"
  );
}

function dedupeById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((record, index) => {
    const key = toText(record?.id || record?.ID) || `idx-${index}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mergeMemosPreservingComments(previous = [], next = []) {
  const prevList = Array.isArray(previous) ? previous : [];
  const nextList = Array.isArray(next) ? next : [];
  if (!prevList.length || !nextList.length) return nextList;

  const previousById = new Map();
  prevList.forEach((memo, index) => {
    const key = toText(memo?.id || memo?.ID) || `prev-${index}`;
    previousById.set(key, memo);
  });

  return nextList.map((memo, index) => {
    const key = toText(memo?.id || memo?.ID) || `next-${index}`;
    const previousMemo = previousById.get(key);
    if (!previousMemo) return memo;

    const nextComments = Array.isArray(memo?.ForumComments) ? memo.ForumComments : [];
    if (nextComments.length > 0) return memo;

    const previousComments = Array.isArray(previousMemo?.ForumComments)
      ? previousMemo.ForumComments
      : [];
    if (!previousComments.length) return memo;

    return {
      ...memo,
      ForumComments: previousComments,
    };
  });
}

function mapAffiliationToForm(initialData = null) {
  if (!initialData) {
    return {
      id: "",
      role: "",
      is_primary: false,
      contact_id: "",
      contact_label: "",
      company_id: "",
      company_label: "",
      same_as_company: false,
      company_as_accounts_contact_id: "",
      company_as_accounts_contact_label: "",
    };
  }

  const companyId = toText(initialData.company_id || initialData.Company_ID);
  const accountsCompanyId = toText(
    initialData.company_as_accounts_contact_id || initialData.Company_as_Accounts_Contact_ID
  );
  const sameAsCompany = Boolean(companyId && accountsCompanyId && companyId === accountsCompanyId);
  const isPrimary = Boolean(
    initialData.primary_owner_contact ||
      initialData.Primary_Owner_Contact ||
      initialData.primary_resident_contact ||
      initialData.Primary_Resident_Contact ||
      initialData.primary_property_manager_contact ||
      initialData.Primary_Property_Manager_Contact
  );

  return {
    id: toText(initialData.id || initialData.ID),
    role: toText(initialData.role || initialData.Role),
    is_primary: isPrimary,
    contact_id: toText(initialData.contact_id || initialData.Contact_ID),
    contact_label:
      fullName(initialData.contact_first_name, initialData.contact_last_name) ||
      toText(initialData.contact_email || initialData.ContactEmail),
    company_id: companyId,
    company_label: toText(initialData.company_name || initialData.CompanyName),
    same_as_company: sameAsCompany,
    company_as_accounts_contact_id: accountsCompanyId,
    company_as_accounts_contact_label:
      toText(
        initialData.company_as_accounts_contact_name || initialData.Company_as_Accounts_Contact_Name
      ) || (sameAsCompany ? toText(initialData.company_name || initialData.CompanyName) : ""),
  };
}

function fullName(firstName, lastName) {
  return [toText(firstName), toText(lastName)].filter(Boolean).join(" ").trim();
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
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Primary_Contact_Popup_Comment
    ),
  };
}

function getInquiryCompany(inquiry = {}) {
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
    account_type: toText(nested?.account_type || nested?.Account_Type || inquiry?.Company_Account_Type),
    popup_comment: toText(
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Company_Popup_Comment
    ),
    Primary_Person: {
      id: toText(
        nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || inquiry?.Contact_Contact_ID
      ),
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

function getProviderName(provider) {
  if (!provider || typeof provider !== "object") return "";
  const info = provider.Contact_Information || provider.contact_information || {};
  return (
    fullName(
      info.first_name || info.First_Name || provider.first_name || provider.First_Name,
      info.last_name || info.Last_Name || provider.last_name || provider.Last_Name
    ) ||
    toText(info.email || info.Email || provider.email || provider.Email)
  );
}

function getInquiryClient(inquiry) {
  if (!inquiry) return { name: "", phone: "", email: "" };
  const accountType = inquiry.account_type || inquiry.Account_Type;
  const isCompany = isCompanyAccountType(accountType);
  if (isCompany) {
    const company = getInquiryCompany(inquiry);
    const primaryPerson = company?.Primary_Person || company?.primary_person || {};
    return {
      name: toText(company?.name),
      phone: toText(company?.phone),
      email: toText(primaryPerson?.email || primaryPerson?.Email),
    };
  }
  const contact = getInquiryPrimaryContact(inquiry);
  return {
    name: fullName(contact.first_name || contact.First_Name, contact.last_name || contact.Last_Name),
    phone: toText(contact.sms_number || contact.SMS_Number),
    email: toText(contact.email || contact.Email),
  };
}

function getJobClient(job) {
  if (!job) return { name: "", phone: "", email: "" };
  const accountType = job.account_type || job.Account_Type;
  const isCompany = isCompanyAccountType(accountType);
  if (isCompany) {
    const clientEntity = job?.Client_Entity || {};
    const primaryPerson = clientEntity?.Primary_Person || {};
    return {
      name: toText(clientEntity?.name),
      phone: toText(clientEntity?.phone),
      email: toText(primaryPerson?.email || primaryPerson?.Email),
    };
  }
  const person = job?.Client_Individual || {};
  return {
    name: fullName(person.first_name || person.First_Name, person.last_name || person.Last_Name),
    phone: toText(person.sms_number || person.SMS_Number),
    email: toText(person.email || person.Email),
  };
}

function toAffiliationOption(affiliation = {}) {
  const contactName = fullName(
    affiliation?.contact_first_name,
    affiliation?.contact_last_name
  );
  const companyLabel = toText(
    affiliation?.company_as_accounts_contact_name || affiliation?.company_name
  );
  const label =
    contactName ||
    companyLabel ||
    toText(affiliation?.contact_email) ||
    toText(affiliation?.role) ||
    `Affiliation #${toText(affiliation?.id)}`;
  return {
    id: toText(affiliation?.id),
    label,
    meta: [toText(affiliation?.role), toText(affiliation?.contact_email)]
      .filter(Boolean)
      .join(" | "),
    legacyIds: [
      toText(affiliation?.contact_id),
      toText(affiliation?.company_as_accounts_contact_id),
      toText(affiliation?.company_id),
    ].filter(Boolean),
  };
}

function getStageState({ inquiry, job }) {
  const quoteStatus = normalizeStatus(job?.quote_status || job?.Quote_Status);
  const paymentStatus = normalizeStatus(job?.payment_status || job?.Payment_Status);
  const hasInvoiceSignal = Boolean(
    toText(job?.invoice_number || job?.Invoice_Number) ||
      ["invoice sent", "paid", "overdue", "written off"].includes(paymentStatus)
  );

  return {
    inquiry: Boolean(inquiry),
    allocated: Boolean(
      toText(inquiry?.service_provider_id || inquiry?.Service_Provider_ID) ||
        toText(job?.primary_service_provider_id || job?.Primary_Service_Provider_ID)
    ),
    quoteCreated: Boolean(job),
    quoteSent: quoteStatus === "sent" || quoteStatus === "accepted",
    quoteAccepted: quoteStatus === "accepted",
    invoiceSent: hasInvoiceSignal,
    paid: paymentStatus === "paid",
  };
}

function nowUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

function getQuoteStatusStyle(value) {
  const normalized = normalizeStatus(value);
  const palette = {
    new: { color: "#e91e63", backgroundColor: "#fbd2e0", borderColor: "#e91e63" },
    requested: { color: "#8e24aa", backgroundColor: "#e8d3ee", borderColor: "#8e24aa" },
    sent: { color: "#3949ab", backgroundColor: "#d7dbee", borderColor: "#3949ab" },
    accepted: { color: "#43a047", backgroundColor: "#d9ecda", borderColor: "#43a047" },
    declined: { color: "#f4511e", backgroundColor: "#fddcd2", borderColor: "#f4511e" },
    expired: { color: "#000000", backgroundColor: "#cccccc", borderColor: "#000000" },
    cancelled: { color: "#000000", backgroundColor: "#cccccc", borderColor: "#000000" },
  };
  return palette[normalized] || resolveStatusStyle(value) || null;
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

function buildStatusCardTheme(statusStyle, fallback = {}) {
  const borderColor =
    toText(statusStyle?.borderColor) ||
    toText(statusStyle?.color) ||
    toText(fallback.borderColor) ||
    "#cbd5e1";
  const headerBackground =
    toText(statusStyle?.backgroundColor) ||
    toText(fallback.headerBackground) ||
    "#f1f5f9";
  const headerTextColor =
    toText(statusStyle?.color) || toText(fallback.headerTextColor) || "#334155";

  return {
    wrapperStyle: {
      borderColor,
    },
    headerStyle: {
      borderBottomColor: borderColor,
      backgroundColor: headerBackground,
      color: headerTextColor,
    },
    accentStyle: {
      color: headerTextColor,
    },
  };
}

function InfoRow({ label, value, mono = false }) {
  const text = toText(value) || "—";
  const normalizedLabel = toText(label).toLowerCase();
  const isEmailField = normalizedLabel.includes("email");
  const isPhoneField =
    normalizedLabel.includes("phone") || normalizedLabel.includes("sms");
  const canRenderEmailLink = isEmailField && isLikelyEmailValue(text);
  const canRenderPhoneLink = isPhoneField && isLikelyPhoneValue(text);
  const telHref = canRenderPhoneLink ? toTelHref(text) : "";

  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 last:border-b-0 xl:grid-cols-[140px_minmax(0,1fr)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`min-w-0 text-sm text-slate-700 ${mono ? "uid-text" : ""}`} title={text}>
        {canRenderEmailLink ? (
          <a
            href={`mailto:${text}`}
            className="block break-words text-[#0056a8] underline [overflow-wrap:anywhere] hover:text-[#003882]"
          >
            {text}
          </a>
        ) : canRenderPhoneLink && telHref ? (
          <a
            href={telHref}
            className="block break-words text-[#0056a8] underline [overflow-wrap:anywhere] hover:text-[#003882]"
          >
            {text}
          </a>
        ) : (
          <span className="block break-words [overflow-wrap:anywhere]">{text}</span>
        )}
      </div>
    </div>
  );
}

function StatusRow({ label, value, style }) {
  const text = toText(value);
  const colorStyle = style || resolveStatusStyle(text) || {
    color: "#475569",
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e1",
  };
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 border-b border-slate-100 py-2.5 last:border-b-0 xl:grid-cols-[140px_minmax(0,1fr)]">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="min-w-0">
        {text ? (
          <span
            className="inline-flex rounded border px-2 py-1 text-xs font-semibold"
            style={{
              color: colorStyle.color,
              backgroundColor: colorStyle.backgroundColor,
              borderColor: colorStyle.borderColor || colorStyle.color,
            }}
          >
            {text}
          </span>
        ) : (
          "—"
        )}
      </div>
    </div>
  );
}

function InlineInfoItem({ label, value, mono = false }) {
  const text = toText(value) || "—";
  const normalizedLabel = toText(label).toLowerCase();
  const isEmailField = normalizedLabel.includes("email");
  const isPhoneField =
    normalizedLabel.includes("phone") || normalizedLabel.includes("sms");
  const canRenderEmailLink = isEmailField && isLikelyEmailValue(text);
  const canRenderPhoneLink = isPhoneField && isLikelyPhoneValue(text);
  const telHref = canRenderPhoneLink ? toTelHref(text) : "";

  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}:
      </span>
      <span
        className={`max-w-[280px] truncate text-sm text-slate-700 ${mono ? "uid-text" : ""}`}
        title={text}
      >
        {canRenderEmailLink ? (
          <a href={`mailto:${text}`} className="text-[#0056a8] underline hover:text-[#003882]">
            {text}
          </a>
        ) : canRenderPhoneLink && telHref ? (
          <a href={telHref} className="text-[#0056a8] underline hover:text-[#003882]">
            {text}
          </a>
        ) : (
          text
        )}
      </span>
    </div>
  );
}

function InlineStatusItem({ label, value, style }) {
  const text = toText(value) || "—";
  const colorStyle = style || resolveStatusStyle(text) || {
    color: "#475569",
    backgroundColor: "#e2e8f0",
    borderColor: "#cbd5e1",
  };
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}:
      </span>
      {text === "—" ? (
        <span className="text-sm text-slate-700">—</span>
      ) : (
        <span
          className="inline-flex rounded border px-1.5 py-0.5 text-xs font-semibold"
          style={{
            color: colorStyle.color,
            backgroundColor: colorStyle.backgroundColor,
            borderColor: colorStyle.borderColor || colorStyle.color,
          }}
        >
          {text}
        </span>
      )}
    </div>
  );
}

function InquirySubAccordion({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded border border-slate-200 bg-slate-50">
      <button
        type="button"
        className={`flex w-full items-center justify-between px-3 py-2 text-left ${
          isOpen ? "border-b border-slate-200" : ""
        }`}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">{title}</span>
        <span className="text-xs font-semibold text-slate-600">{isOpen ? "⌃" : "⌄"}</span>
      </button>
      {isOpen ? <div className="space-y-3 p-3">{children}</div> : null}
    </section>
  );
}

function LongTextRow({ label, value }) {
  const text = toText(value) || "—";
  return (
    <div className="rounded border border-slate-200 bg-white p-2">
      <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-slate-700">{text}</p>
    </div>
  );
}

function StageChip({ label, active }) {
  return (
    <div
      className={`rounded border px-3 py-2 text-xs font-semibold uppercase tracking-wide ${
        active
          ? "bg-[rgba(54,146,107,0.12)] [border-color:var(--color-success)] [color:var(--color-success)]"
          : "border-slate-200 bg-white text-slate-500"
      }`}
    >
      {label}
    </div>
  );
}

function SectionPlaceholder({ title, description, rows = 3 }) {
  return (
    <div className="rounded border border-slate-200 bg-white p-4">
      <div className="mb-3 text-sm font-semibold text-slate-800">{title}</div>
      <div className="mb-4 text-sm text-slate-600">{description}</div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={`${title}-${index}`}
            className="h-10 rounded border border-slate-200 bg-slate-50"
          />
        ))}
      </div>
    </div>
  );
}

function HeaderDropdown({
  label,
  isOpen,
  onToggle,
  children,
  align = "left",
  buttonVariant = "ghost",
  buttonClassName = "",
  panelClassName = "",
  textTrigger = false,
}) {
  const position = align === "right" ? "right-0" : "left-0";
  return (
    <div className="relative" data-header-dropdown-root="true">
      {textTrigger ? (
        <button
          type="button"
          className={`inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold text-slate-700 hover:text-brand-primary ${buttonClassName}`}
          onClick={onToggle}
        >
          {label}
          <span className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>
        </button>
      ) : (
        <Button
          variant={buttonVariant}
          className={`whitespace-nowrap ${buttonClassName}`}
          onClick={onToggle}
        >
          {label}
          <span className={`text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>⌄</span>
        </Button>
      )}
      {isOpen ? (
        <div
          className={`absolute ${position} top-11 z-20 min-w-[220px] rounded border border-slate-200 bg-white py-1 text-slate-700 shadow-lg ${panelClassName}`}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function FullPageLoader({ text = "Starting app..." }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
            <div className="text-sm font-semibold text-slate-800">{text}</div>
          </div>
        </div>
      </div>
    </main>
  );
}

function FullPageError({
  title = "Unable to load details.",
  description = "Please try refreshing the page.",
  onBack,
}) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-xl rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-red-700">{title}</div>
          <p className="mt-2 text-sm text-slate-600">{description}</p>
          <div className="mt-4">
            <Button variant="secondary" onClick={onBack}>
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function JobDetailsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { uid = "" } = useParams();
  const { plugin, isReady: isSdkReady, error: sdkError } = useVitalStatsPlugin();
  const { success, error: showError } = useToast();

  const sourceTab = toText(location?.state?.sourceTab || "");

  const [activeTab, setActiveTab] = useState("Overview");
  const [announcementFocus, setAnnouncementFocus] = useState({ kind: "", id: "" });
  const [context, setContext] = useState({
    found: false,
    primaryType: "",
    inquiry: null,
    job: null,
  });
  const [isLoadingContext, setIsLoadingContext] = useState(true);
  const [hasInitialContextResolved, setHasInitialContextResolved] = useState(false);
  const [contextError, setContextError] = useState(null);
  const [isAddPropertyOpen, setIsAddPropertyOpen] = useState(false);
  const [propertyModalMode, setPropertyModalMode] = useState("create");
  const [draftProperty, setDraftProperty] = useState(null);
  const [serviceProviders, setServiceProviders] = useState([]);
  const [contactsLookup, setContactsLookup] = useState([]);
  const [companiesLookup, setCompaniesLookup] = useState([]);
  const [propertiesLookup, setPropertiesLookup] = useState([]);
  const [providerSearchValue, setProviderSearchValue] = useState("");
  const [propertySearchValue, setPropertySearchValue] = useState("");
  const [jobEmailContactSearchValue, setJobEmailContactSearchValue] = useState("");
  const [accountsContactSearchValue, setAccountsContactSearchValue] = useState("");
  const [isProviderLookupLoading, setIsProviderLookupLoading] = useState(false);
  const [isContactLookupLoading, setIsContactLookupLoading] = useState(false);
  const [isCompanyLookupLoading, setIsCompanyLookupLoading] = useState(false);
  const [isPropertyLookupLoading, setIsPropertyLookupLoading] = useState(false);
  const [linkedPropertyIdOverride, setLinkedPropertyIdOverride] = useState("");
  const [selectedProviderId, setSelectedProviderId] = useState("");
  const [selectedJobEmailContactId, setSelectedJobEmailContactId] = useState("");
  const [selectedAccountsContactId, setSelectedAccountsContactId] = useState("");
  const [isAllocatingProvider, setIsAllocatingProvider] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);
  const [isLinkingProperty, setIsLinkingProperty] = useState(false);
  const [isSavingQuoteContacts, setIsSavingQuoteContacts] = useState(false);
  const [quoteActionState, setQuoteActionState] = useState({
    processing: false,
    key: "",
  });
  const [isDealInfoOpen, setIsDealInfoOpen] = useState(false);
  const [affiliations, setAffiliations] = useState([]);
  const [isAffiliationsLoading, setIsAffiliationsLoading] = useState(false);
  const [affiliationsError, setAffiliationsError] = useState("");
  const [affiliationModalState, setAffiliationModalState] = useState({
    open: false,
    initialData: null,
  });
  const [affiliationForm, setAffiliationForm] = useState(mapAffiliationToForm(null));
  const [isAffiliationSaving, setIsAffiliationSaving] = useState(false);
  const [deleteAffiliationTarget, setDeleteAffiliationTarget] = useState(null);
  const [isDeletingAffiliation, setIsDeletingAffiliation] = useState(false);
  const [uploads, setUploads] = useState([]);
  const [pendingUploads, setPendingUploads] = useState([]);
  const [isUploadsLoading, setIsUploadsLoading] = useState(false);
  const [isUploadsSaving, setIsUploadsSaving] = useState(false);
  const [uploadsError, setUploadsError] = useState("");
  const [deleteUploadTarget, setDeleteUploadTarget] = useState(null);
  const [isDeletingUpload, setIsDeletingUpload] = useState(false);
  const [isTasksModalOpen, setIsTasksModalOpen] = useState(false);
  const [taskRows, setTaskRows] = useState([]);
  const [isTaskRowsLoading, setIsTaskRowsLoading] = useState(false);
  const [taskRowsError, setTaskRowsError] = useState("");
  const [memos, setMemos] = useState([]);
  const [isMemosLoading, setIsMemosLoading] = useState(false);
  const [memosError, setMemosError] = useState("");
  const [memoText, setMemoText] = useState("");
  const [isMemoChatOpen, setIsMemoChatOpen] = useState(false);
  const [memoFile, setMemoFile] = useState(null);
  const [popupCommentDrafts, setPopupCommentDrafts] = useState({
    contact: "",
    company: "",
  });
  const [isPopupCommentModalOpen, setIsPopupCommentModalOpen] = useState(false);
  const [isSavingPopupComment, setIsSavingPopupComment] = useState(false);
  const [memoReplyDrafts, setMemoReplyDrafts] = useState({});
  const [isPostingMemo, setIsPostingMemo] = useState(false);
  const [sendingReplyPostId, setSendingReplyPostId] = useState("");
  const [memoDeleteTarget, setMemoDeleteTarget] = useState(null);
  const [isDeletingMemoItem, setIsDeletingMemoItem] = useState(false);
  const [jobActivities, setJobActivities] = useState([]);
  const [jobMaterials, setJobMaterials] = useState([]);
  const [isWorkSectionsLoading, setIsWorkSectionsLoading] = useState(false);
  const [workSectionsError, setWorkSectionsError] = useState("");
  const [contactModalState, setContactModalState] = useState({
    open: false,
    mode: "individual",
    onSave: null,
  });
  const [sendingEmailOptionId, setSendingEmailOptionId] = useState("");
  const [jobActionState, setJobActionState] = useState({
    processing: false,
    key: "",
  });
  const [isEmailJobUpdating, setIsEmailJobUpdating] = useState(false);
  const [openDropdown, setOpenDropdown] = useState("");
  const [collapsedCards, setCollapsedCards] = useState({
    inquiry: true,
    property: true,
    job: true,
  });
  const [collapsedInquirySections, setCollapsedInquirySections] = useState({
    overview: true,
    primaryContact: true,
    companyDetails: true,
    bodyCorpCompany: true,
    dealProvider: true,
  });
  const [collapsedPropertySections, setCollapsedPropertySections] = useState({
    address: true,
    building: true,
    features: true,
    contacts: true,
  });
  const [collapsedJobSections, setCollapsedJobSections] = useState({
    status: true,
    timeline: true,
    invoice: true,
    contacts: true,
    workflow: true,
  });
  const uploadsInputRef = useRef(null);
  const memoFileInputRef = useRef(null);
  const pendingUploadsRef = useRef([]);
  const popupCommentAutoShownRef = useRef({});

  useEffect(() => {
    if (!openDropdown) return undefined;
    const onPointerDown = (event) => {
      const target = event?.target;
      if (target instanceof Element && target.closest("[data-header-dropdown-root='true']")) {
        return;
      }
      setOpenDropdown("");
    };
    const onKeyDown = (event) => {
      if (event?.key === "Escape") {
        setOpenDropdown("");
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [openDropdown]);

  useEffect(() => {
    setLinkedPropertyIdOverride("");
    setHasInitialContextResolved(false);
    setAnnouncementFocus({ kind: "", id: "" });
    setCollapsedInquirySections({
      overview: true,
      primaryContact: true,
      companyDetails: true,
      bodyCorpCompany: true,
      dealProvider: true,
    });
    setCollapsedPropertySections({
      address: true,
      building: true,
      features: true,
      contacts: true,
    });
    setCollapsedJobSections({
      status: true,
      timeline: true,
      invoice: true,
      contacts: true,
      workflow: true,
    });
  }, [uid]);

  useEffect(() => {
    const parsed = parseAnnouncementLocationSearch(location?.search || "");
    const parsedTab = toText(parsed?.tab);
    if (parsedTab && PAGE_TABS.includes(parsedTab)) {
      setActiveTab(parsedTab);
    }
    const focusKind = toText(parsed?.focusKind).toLowerCase();
    const focusId = toText(parsed?.focusId);
    if (focusKind && focusId) {
      setAnnouncementFocus({ kind: focusKind, id: focusId });
    }
    if (parsed?.openMemo) {
      setIsMemoChatOpen(true);
    }
  }, [location?.search]);

  useEffect(() => {
    if (!announcementFocus?.id) return;
    const timeoutId = setTimeout(() => {
      setAnnouncementFocus({ kind: "", id: "" });
    }, 12000);
    return () => clearTimeout(timeoutId);
  }, [announcementFocus]);

  useEffect(() => {
    if (isLoadingContext) return;
    setHasInitialContextResolved(true);
  }, [isLoadingContext]);

  const toggleCardCollapse = useCallback((cardKey) => {
    setCollapsedCards((previous) => ({
      ...(previous || {}),
      [cardKey]: !Boolean(previous?.[cardKey]),
    }));
  }, []);

  const toggleInquirySection = useCallback((sectionKey) => {
    setCollapsedInquirySections((previous) => ({
      ...(previous || {}),
      [sectionKey]: !Boolean(previous?.[sectionKey]),
    }));
  }, []);

  const togglePropertySection = useCallback((sectionKey) => {
    setCollapsedPropertySections((previous) => ({
      ...(previous || {}),
      [sectionKey]: !Boolean(previous?.[sectionKey]),
    }));
  }, []);

  const toggleJobSection = useCallback((sectionKey) => {
    setCollapsedJobSections((previous) => ({
      ...(previous || {}),
      [sectionKey]: !Boolean(previous?.[sectionKey]),
    }));
  }, []);

  const reloadContext = useCallback(async () => {
    if (!plugin || !isSdkReady) return;
    setIsLoadingContext(true);
    setContextError(null);
    try {
      const result = await resolveJobDetailsContext({ plugin, uid, sourceTab });
      setContext(result || { found: false, primaryType: "", inquiry: null, job: null });
    } catch (fetchError) {
      console.error("[JobDetails] Failed to resolve context", fetchError);
      setContextError(fetchError);
    } finally {
      setIsLoadingContext(false);
    }
  }, [plugin, isSdkReady, uid, sourceTab]);

  useEffect(() => {
    if (!plugin || !isSdkReady) return undefined;
    (async () => {
      await reloadContext();
    })();
  }, [plugin, isSdkReady, reloadContext]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady) return undefined;
    setIsProviderLookupLoading(true);
    fetchServiceProvidersForSearch({ plugin })
      .then((providers) => {
        if (cancelled) return;
        setServiceProviders(Array.isArray(providers) ? providers : []);
      })
      .catch((providerError) => {
        if (cancelled) return;
        console.warn("[JobDetails] Failed to load service providers", providerError);
        setServiceProviders([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsProviderLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady) return undefined;
    setIsPropertyLookupLoading(true);
    fetchPropertiesForSearch({ plugin })
      .then((properties) => {
        if (cancelled) return;
        setPropertiesLookup(Array.isArray(properties) ? properties : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.warn("[JobDetails] Failed to load property lookup data", lookupError);
        setPropertiesLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsPropertyLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady) return undefined;
    setIsCompanyLookupLoading(true);
    fetchCompaniesForSearch({ plugin })
      .then((companies) => {
        if (cancelled) return;
        setCompaniesLookup(Array.isArray(companies) ? companies : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.warn("[JobDetails] Failed to load company lookup data", lookupError);
        setCompaniesLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsCompanyLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady) return undefined;
    setIsContactLookupLoading(true);
    fetchContactsForLookup({ plugin })
      .then((contacts) => {
        if (cancelled) return;
        setContactsLookup(Array.isArray(contacts) ? contacts : []);
      })
      .catch((lookupError) => {
        if (cancelled) return;
        console.warn("[JobDetails] Failed to load contact lookup data", lookupError);
        setContactsLookup([]);
      })
      .finally(() => {
        if (cancelled) return;
        setIsContactLookupLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady]);

  const inquiry = context?.inquiry || null;
  const job = context?.job || null;

  const inquiryClient = useMemo(() => getInquiryClient(inquiry), [inquiry]);
  const jobClient = useMemo(() => getJobClient(job), [job]);
  const stageState = useMemo(() => getStageState({ inquiry, job }), [inquiry, job]);
  const dealModalJobData = useMemo(
    () => ({
      ...(job || {}),
      inquiry_record_id: toText(job?.inquiry_record_id || job?.Inquiry_Record_ID || inquiry?.id || inquiry?.ID),
    }),
    [inquiry, job]
  );

  const inquiryStatus = toText(inquiry?.inquiry_status || inquiry?.Inquiry_Status);
  const jobStatus = toText(job?.job_status || job?.Job_Status);
  const quoteStatus = toText(job?.quote_status || job?.Quote_Status);
  const quoteStatusNormalized = normalizeStatus(quoteStatus);
  const paymentStatus = toText(job?.payment_status || job?.Payment_Status);
  const allocatedProviderId = toText(
    inquiry?.service_provider_id ||
      inquiry?.Service_Provider_ID ||
      job?.primary_service_provider_id ||
      job?.Primary_Service_Provider_ID
  );
  const inquiryId = toText(inquiry?.id || inquiry?.ID);
  const currentJobId = toText(
    job?.id ||
      job?.ID ||
      inquiry?.quote_record_id ||
      inquiry?.Quote_Record_ID ||
      inquiry?.Quote_record_ID ||
      inquiry?.inquiry_for_job_id ||
      inquiry?.Inquiry_For_Job_ID ||
      inquiry?.Inquiry_for_Job_ID
  );
  const currentJobUniqueId = toText(job?.unique_id || job?.Unique_ID || uid);
  const currentInquiryUniqueId = toText(
    inquiry?.unique_id ||
      inquiry?.Unique_ID ||
      job?.Inquiry_Record?.unique_id ||
      job?.Inquiry_Record?.Unique_ID ||
      job?.Inquiry_Record_Unique_ID
  );
  const isQuoteAccepted = quoteStatusNormalized === "accepted";
  const hasLinkedJob = Boolean(currentJobId);
  const focusedKind = toText(announcementFocus?.kind).toLowerCase();
  const focusedId = toText(announcementFocus?.id);

  const isFocusedEntity = useCallback(
    (kind, id) => {
      const normalizedKind = toText(kind).toLowerCase();
      const normalizedId = toText(id);
      return Boolean(
        normalizedKind &&
          normalizedId &&
          normalizedKind === focusedKind &&
          normalizedId === focusedId
      );
    },
    [focusedKind, focusedId]
  );

  useEffect(() => {
    if (!focusedKind || !focusedId) return;

    const scrollToAnnouncementTarget = () => {
      const matches = Array.from(
        document.querySelectorAll(`[data-ann-kind="${focusedKind}"]`)
      );
      const target = matches.find(
        (node) => toText(node?.getAttribute("data-ann-id")) === focusedId
      );
      if (!target) return false;
      if (typeof target.scrollIntoView === "function") {
        target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      }
      return true;
    };

    if (scrollToAnnouncementTarget()) return;

    let attempts = 0;
    const intervalId = window.setInterval(() => {
      attempts += 1;
      if (scrollToAnnouncementTarget() || attempts >= 40) {
        window.clearInterval(intervalId);
      }
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [focusedKind, focusedId, activeTab]);

  const handleOpenPrintJobSheet = useCallback(() => {
    if (!currentJobUniqueId) {
      showError("Print unavailable", "No linked job unique ID found.");
      return;
    }
    const targetUrl = `https://my.awesomate.pro/${encodeURIComponent(currentJobUniqueId)}/job-sheet`;
    window.open(targetUrl, "_blank", "noopener,noreferrer");
  }, [currentJobUniqueId, showError]);

  const handleTasksChanged = useCallback((rows) => {
    const normalized = Array.isArray(rows) ? rows : [];
    setTaskRows((previous) => {
      const prevRows = Array.isArray(previous) ? previous : [];
      if (prevRows.length !== normalized.length) return normalized;
      const hasChanges = normalized.some((row, index) => {
        const prev = prevRows[index] || {};
        return (
          toText(prev?.id || prev?.ID) !== toText(row?.id || row?.ID) ||
          toText(prev?.subject || prev?.Subject) !== toText(row?.subject || row?.Subject) ||
          toText(prev?.status || prev?.Status) !== toText(row?.status || row?.Status) ||
          toText(prev?.date_due || prev?.Date_Due) !== toText(row?.date_due || row?.Date_Due) ||
          toText(prev?.assignee_id || prev?.Assignee_ID) !==
            toText(row?.assignee_id || row?.Assignee_ID)
        );
      });
      return hasChanges ? normalized : prevRows;
    });
  }, []);

  const resolvedPropertyId = toText(
    linkedPropertyIdOverride ||
      inquiry?.property_id ||
      inquiry?.Property_ID ||
      job?.property_id ||
      job?.Property_ID ||
      inquiry?.Property?.id ||
      inquiry?.Property?.ID ||
      job?.Property?.id ||
      job?.Property?.ID ||
      job?.Inquiry_Record?.Property?.id ||
      job?.Inquiry_Record?.Property?.ID
  );
  const resolvedProperty = useMemo(() => {
    const directProperty = inquiry?.Property || job?.Property || job?.Inquiry_Record?.Property || null;
    const fromLookup = (Array.isArray(propertiesLookup) ? propertiesLookup : []).find(
      (property) => toText(property?.id || property?.ID) === toText(resolvedPropertyId)
    );
    if (directProperty && fromLookup) {
      return { ...fromLookup, ...directProperty };
    }
    if (directProperty) return directProperty;
    if (fromLookup) return fromLookup;
    return null;
  }, [inquiry, job, propertiesLookup, resolvedPropertyId]);
  const resolvedProviderName = useMemo(() => {
    const fromInquiry = getProviderName(inquiry?.Service_Provider);
    if (fromInquiry) return fromInquiry;
    const fromJob = getProviderName(job?.Primary_Service_Provider);
    if (fromJob) return fromJob;
    const fromLookup = (Array.isArray(serviceProviders) ? serviceProviders : [])
      .map((provider) => {
        const firstName = toText(provider.first_name || provider.First_Name);
        const lastName = toText(provider.last_name || provider.Last_Name);
        const label =
          fullName(firstName, lastName) ||
          toText(provider.email || provider.Email) ||
          toText(provider.sms_number || provider.SMS_Number);
        return {
          id: toText(provider.id || provider.ID),
          label,
        };
      })
      .find((item) => toText(item.id) === toText(allocatedProviderId))?.label;
    if (fromLookup) return fromLookup;
    if (allocatedProviderId) return `Provider #${allocatedProviderId}`;
    return "";
  }, [allocatedProviderId, inquiry, job, serviceProviders]);
  const inquiryCardTheme = useMemo(
    () =>
      buildStatusCardTheme(resolveStatusStyleNormalized(inquiryStatus), {
        borderColor: "#cbd5e1",
        headerBackground: "#f1f5f9",
        headerTextColor: "#334155",
      }),
    [inquiryStatus]
  );
  const jobSectionStatusStyle = useMemo(() => {
    const hasPaymentStage = Boolean(
      toText(paymentStatus) && (Boolean(stageState?.invoiceSent) || Boolean(stageState?.paid))
    );
    if (hasPaymentStage) return resolveStatusStyleNormalized(paymentStatus);
    if (quoteStatusNormalized === "accepted" && toText(jobStatus)) {
      return resolveStatusStyleNormalized(jobStatus);
    }
    if (toText(quoteStatus)) return getQuoteStatusStyle(quoteStatus);
    if (toText(jobStatus)) return resolveStatusStyleNormalized(jobStatus);
    return resolveStatusStyleNormalized(paymentStatus);
  }, [jobStatus, paymentStatus, quoteStatus, quoteStatusNormalized, stageState]);
  const quoteCardTheme = useMemo(
    () =>
      buildStatusCardTheme(jobSectionStatusStyle, {
        borderColor: "#cbd5e1",
        headerBackground: "#f1f5f9",
        headerTextColor: "#334155",
      }),
    [jobSectionStatusStyle]
  );
  const quoteStatusStyle = useMemo(() => getQuoteStatusStyle(quoteStatus), [quoteStatus]);
  const canShowSendQuote = Boolean(job && quoteStatusNormalized !== "sent" && quoteStatusNormalized !== "accepted");
  const canShowAcceptQuote = Boolean(job && quoteStatusNormalized === "sent");
  const inquiryAccountType = toText(
    inquiry?.account_type || inquiry?.Account_Type || job?.account_type || job?.Account_Type
  );
  const normalizedAccountType = inquiryAccountType.toLowerCase();
  const inquiryPrimaryContact = getInquiryPrimaryContact(inquiry || {});
  const inquiryCompany = getInquiryCompany(inquiry || {});
  const inquiryCompanyPrimaryPerson =
    inquiryCompany?.Primary_Person || inquiryCompany?.primary_person || {};
  const inquiryBodyCorpCompanyRaw =
    inquiryCompany?.Body_Corporate_Company || inquiryCompany?.body_corporate_company || null;
  const inquiryBodyCorpCompany = Array.isArray(inquiryBodyCorpCompanyRaw)
    ? inquiryBodyCorpCompanyRaw[0] || {}
    : inquiryBodyCorpCompanyRaw || {};
  const companyAccountType = toText(
    inquiryCompany?.account_type ||
      inquiryCompany?.Account_Type ||
      job?.Client_Entity?.account_type ||
      job?.Client_Entity?.Account_Type
  );
  const isContactAccount = isContactAccountType(normalizedAccountType);
  const isCompanyAccount = isCompanyAccountType(normalizedAccountType);
  const hasInquiryContactDetails = Boolean(
    fullName(
      inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name,
      inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name
    ) ||
      toText(inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email) ||
      toText(inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number) ||
      toText(inquiryPrimaryContact?.address || inquiryPrimaryContact?.Address)
  );
  const hasInquiryCompanyDetails = Boolean(
    toText(inquiryCompany?.name || inquiryCompany?.Name) ||
      toText(inquiryCompany?.phone || inquiryCompany?.Phone) ||
      toText(inquiryCompany?.address || inquiryCompany?.Address)
  );
  const isBodyCorpAccount = isBodyCorpCompanyAccountType(companyAccountType);
  const showContactDetails = isContactAccount || (!isCompanyAccount && hasInquiryContactDetails);
  const showCompanyDetails = isCompanyAccount || (!isContactAccount && hasInquiryCompanyDetails);
  const inquiryPrimaryContactId = toText(inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID);
  const inquiryCompanyId = toText(inquiryCompany?.id || inquiryCompany?.ID);
  const contactPopupComment = toText(
    inquiryPrimaryContact?.popup_comment || inquiryPrimaryContact?.Popup_Comment
  );
  const companyPopupComment = toText(inquiryCompany?.popup_comment || inquiryCompany?.Popup_Comment);
  const hasPopupCommentsSection = Boolean(showContactDetails || showCompanyDetails);
  const hasAnyPopupComment = Boolean(contactPopupComment || companyPopupComment);

  useEffect(() => {
    setPopupCommentDrafts({
      contact: contactPopupComment,
      company: companyPopupComment,
    });
  }, [contactPopupComment, companyPopupComment, inquiryPrimaryContactId, inquiryCompanyId]);

  useEffect(() => {
    const safeUid = toText(uid);
    if (!safeUid || isLoadingContext) return;
    if (!hasAnyPopupComment) return;
    if (popupCommentAutoShownRef.current?.[safeUid]) return;
    popupCommentAutoShownRef.current[safeUid] = true;
    setIsPopupCommentModalOpen(true);
  }, [uid, isLoadingContext, hasAnyPopupComment]);

  const notFound = !isLoadingContext && !contextError && !context?.found;
  const loadFailure = sdkError || contextError;

  const handleBackDashboard = useCallback(() => {
    navigate("/");
  }, [navigate]);

  const handleEditRecord = useCallback(() => {
    if (isQuoteAccepted) {
      if (!currentJobUniqueId) {
        showError("Navigation unavailable", "No linked job found.");
        return;
      }
      navigate(`/job-direct/${encodeURIComponent(currentJobUniqueId)}`);
      return;
    }
    if (!currentInquiryUniqueId) {
      showError("Navigation unavailable", "No linked inquiry found.");
      return;
    }
    navigate(`/inquiry-direct/${encodeURIComponent(currentInquiryUniqueId)}`);
  }, [isQuoteAccepted, currentJobUniqueId, currentInquiryUniqueId, navigate, showError]);

  const handleAddPropertySave = useCallback(
    async (payload) => {
      try {
        const savedPropertyId = await savePropertyForDetails({
          plugin,
          propertyId: propertyModalMode === "edit" ? resolvedPropertyId : "",
          propertyPayload: payload,
          inquiryId,
          jobId: currentJobId,
        });
        setDraftProperty(payload || null);
        setIsAddPropertyOpen(false);
        success("Property saved", "Property details have been updated.");
        const refreshedProperties = await fetchPropertiesForSearch({ plugin });
        setPropertiesLookup(Array.isArray(refreshedProperties) ? refreshedProperties : []);
        if (savedPropertyId) {
          setLinkedPropertyIdOverride(toText(savedPropertyId));
          const selected = (Array.isArray(refreshedProperties) ? refreshedProperties : []).find(
            (property) => toText(property?.id || property?.ID) === toText(savedPropertyId)
          );
          setPropertySearchValue(
            toText(
              selected?.property_name || selected?.Property_Name || selected?.Property_Property_Name
            ) ||
              toText(payload?.property_name || payload?.Property_Name || payload?.address_1 || payload?.Address_1)
          );

          await emitAnnouncement({
            plugin,
            eventKey:
              propertyModalMode === "edit"
                ? ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED
                : ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED,
            quoteJobId: currentJobId,
            inquiryId,
            focusId: toText(savedPropertyId),
            dedupeEntityId: toText(savedPropertyId),
            title:
              propertyModalMode === "edit"
                ? "Property details updated"
                : "New property created",
            content:
              propertyModalMode === "edit"
                ? "Property information was updated."
                : "A new property was created and linked.",
            logContext: "job-details:handleAddPropertySave",
          });
        }
        await reloadContext();
      } catch (saveError) {
        console.error("[JobDetails] Property save failed", saveError);
        showError("Save failed", saveError?.message || "Unable to save property.");
      }
    },
    [
      plugin,
      propertyModalMode,
      resolvedPropertyId,
      inquiryId,
      currentJobId,
      propertyModalMode,
      success,
      reloadContext,
      showError,
    ]
  );

  const openCreatePropertyModal = useCallback(() => {
    setPropertyModalMode("create");
    setIsAddPropertyOpen(true);
  }, []);

  const openEditPropertyModal = useCallback(() => {
    setPropertyModalMode("edit");
    setIsAddPropertyOpen(true);
  }, []);

  const handleSelectPropertyFromSearch = useCallback(
    async (item) => {
      const propertyId = toText(item?.id);
      if (!propertyId) return;
      setLinkedPropertyIdOverride(propertyId);
      setPropertySearchValue(toText(item?.label));
      if (isLinkingProperty) return;
      setIsLinkingProperty(true);
      try {
        if (inquiryId) {
          await updateInquiryFieldsById({
            plugin,
            inquiryId,
            payload: { property_id: propertyId },
          });
        }
        if (currentJobId) {
          await updateJobFieldsById({
            plugin,
            jobId: currentJobId,
            payload: { property_id: propertyId },
          });
        }
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_LINKED,
          quoteJobId: currentJobId,
          inquiryId,
          focusId: propertyId,
          dedupeEntityId: propertyId,
          title: "Property linked",
          content: "A property was linked to this record.",
          logContext: "job-details:handleSelectPropertyFromSearch",
        });
        success("Property linked", "Selected property is now linked.");
        await reloadContext();
      } catch (linkError) {
        console.error("[JobDetails] Property link failed", linkError);
        showError("Link failed", linkError?.message || "Unable to link selected property.");
      } finally {
        setIsLinkingProperty(false);
      }
    },
    [plugin, inquiryId, currentJobId, success, reloadContext, showError, isLinkingProperty]
  );

  const handleAllocateProvider = useCallback(async () => {
    const inquiryId = inquiry?.id || inquiry?.ID;
    if (!inquiryId) {
      showError("Allocation failed", "Inquiry ID is missing.");
      return;
    }
    if (!selectedProviderId) {
      showError("Allocation failed", "Select a service provider first.");
      return;
    }
    setIsAllocatingProvider(true);
    try {
      await allocateServiceProviderForInquiry({
        plugin,
        inquiryId,
        serviceProviderId: selectedProviderId,
      });
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.INQUIRY_ALLOCATED,
        inquiryId: toText(inquiryId),
        serviceProviderId: selectedProviderId,
        focusId: toText(inquiryId),
        dedupeEntityId: `${toText(inquiryId)}:${toText(selectedProviderId)}`,
        title: "New inquiry allocation",
        content: "A new inquiry was allocated to you.",
        logContext: "job-details:handleAllocateProvider",
      });
      success("Provider allocated", "Service provider allocation updated.");
      await reloadContext();
    } catch (allocationError) {
      console.error("[JobDetails] Provider allocation failed", allocationError);
      showError("Allocation failed", allocationError?.message || "Unable to allocate provider.");
    } finally {
      setIsAllocatingProvider(false);
    }
  }, [inquiry, plugin, reloadContext, selectedProviderId, showError, success]);

  const handleCreateJob = useCallback(async () => {
    if (!inquiry) {
      showError("Create failed", "Inquiry details are missing.");
      return;
    }
    if (!allocatedProviderId) {
      showError("Create failed", "Allocate and submit a service provider before creating a quote.");
      return;
    }
    setIsCreatingJob(true);
    try {
      const createdJob = await createLinkedJobForInquiry({
        plugin,
        inquiry,
        serviceProviderId: allocatedProviderId,
      });
      const createdJobId = toText(createdJob?.id || createdJob?.ID);
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.QUOTE_CREATED,
        quoteJobId: createdJobId || currentJobId,
        inquiryId,
        serviceProviderId: allocatedProviderId,
        focusId: createdJobId || currentJobId,
        dedupeEntityId: createdJobId || currentJobId || inquiryId,
        title: "Quote created",
        content: "A quote has been created from this inquiry.",
        logContext: "job-details:handleCreateJob",
      });
      success(
        "Quote created",
        `Quote ${toText(createdJob?.unique_id || createdJob?.Unique_ID) || ""} created.`
      );
      await reloadContext();
    } catch (createError) {
      console.error("[JobDetails] Create job failed", createError);
      showError("Create failed", createError?.message || "Unable to create quote.");
    } finally {
      setIsCreatingJob(false);
    }
  }, [allocatedProviderId, inquiry, plugin, reloadContext, showError, success]);

  const hasQuoteCreated = Boolean(
    toText(job?.quote_status || job?.Quote_Status || job?.quote_date || job?.Quote_Date)
  );
  const canDuplicateJob = Boolean(currentJobId && hasQuoteCreated);
  const isJobActionProcessing = useCallback(
    (actionKey) => Boolean(jobActionState.processing && jobActionState.key === actionKey),
    [jobActionState]
  );
  const actionLabel = useCallback(
    (actionKey, idleLabel, busyLabel = "Processing...") =>
      isJobActionProcessing(actionKey) ? busyLabel : idleLabel,
    [isJobActionProcessing]
  );
  const providerItems = useMemo(
    () =>
      serviceProviders.map((provider) => {
        const firstName = toText(provider.first_name || provider.First_Name);
        const lastName = toText(provider.last_name || provider.Last_Name);
        const label =
          fullName(firstName, lastName) ||
          toText(provider.email || provider.Email) ||
          toText(provider.sms_number || provider.SMS_Number) ||
          toText(provider.unique_id || provider.Unique_ID) ||
          `Provider #${toText(provider.id || provider.ID)}`;
        return {
          id: toText(provider.id || provider.ID),
          label,
          meta: [
            toText(provider.email || provider.Email),
            toText(provider.sms_number || provider.SMS_Number),
            toText(provider.unique_id || provider.Unique_ID),
          ]
            .filter(Boolean)
            .join(" | "),
        };
      }),
    [serviceProviders]
  );

  const contactItems = useMemo(
    () =>
      contactsLookup.map((contact) => {
        const firstName = toText(contact.first_name || contact.First_Name);
        const lastName = toText(contact.last_name || contact.Last_Name);
        const label =
          fullName(firstName, lastName) ||
          toText(contact.email || contact.Email) ||
          toText(contact.sms_number || contact.SMS_Number) ||
          toText(contact.id || contact.ID);
        return {
          id: toText(contact.id || contact.ID),
          label,
          meta: [
            toText(contact.email || contact.Email),
            toText(contact.sms_number || contact.SMS_Number),
            toText(contact.office_phone || contact.Office_Phone),
          ]
            .filter(Boolean)
            .join(" | "),
        };
      }),
    [contactsLookup]
  );
  const jobDirectBootstrapJobData = useMemo(() => {
    if (!currentJobId) return null;
    return {
      ...(job || {}),
      id: currentJobId,
      ID: currentJobId,
      activities: Array.isArray(jobActivities) ? jobActivities : [],
      materials: Array.isArray(jobMaterials) ? jobMaterials : [],
    };
  }, [currentJobId, job, jobActivities, jobMaterials]);
  const jobDirectLookupData = useMemo(
    () => ({
      contacts: Array.isArray(contactsLookup) ? contactsLookup : [],
      companies: Array.isArray(companiesLookup) ? companiesLookup : [],
      properties: Array.isArray(propertiesLookup) ? propertiesLookup : [],
      serviceProviders: Array.isArray(serviceProviders) ? serviceProviders : [],
    }),
    [contactsLookup, companiesLookup, propertiesLookup, serviceProviders]
  );
  const jobDirectUid = toText(job?.unique_id || job?.Unique_ID || uid);
  const companyItems = useMemo(
    () =>
      companiesLookup.map((company) => {
        const primaryPerson = company?.Primary_Person || {};
        const label = toText(company.name || company.Name) || toText(company.id || company.ID);
        return {
          id: toText(company.id || company.ID),
          label,
          meta: [
            toText(company.account_type || company.Account_Type),
            toText(company.phone || company.Phone),
            fullName(
              primaryPerson?.first_name || primaryPerson?.First_Name,
              primaryPerson?.last_name || primaryPerson?.Last_Name
            ),
            toText(primaryPerson?.email || primaryPerson?.Email),
          ]
            .filter(Boolean)
            .join(" | "),
        };
      }),
    [companiesLookup]
  );
  const jobEmailItems = useMemo(
    () => (isCompanyAccount ? companyItems : contactItems),
    [companyItems, contactItems, isCompanyAccount]
  );
  const propertySearchItems = useMemo(
    () =>
      propertiesLookup.map((property) => {
        const propertyId = toText(property.id || property.ID);
        const uniqueId = toText(property.unique_id || property.Unique_ID);
        const propertyName =
          toText(property.property_name || property.Property_Name || property.Property_Property_Name) ||
          toText(property.address_1 || property.Address_1 || property.address || property.Address) ||
          `Property #${propertyId}`;
        const meta = [
          uniqueId,
          toText(property.address_1 || property.Address_1 || property.address || property.Address),
          toText(property.suburb_town || property.Suburb_Town || property.city || property.City),
          toText(property.state || property.State),
        ]
          .filter(Boolean)
          .join(" | ");
        return {
          id: propertyId,
          label: propertyName,
          meta,
        };
      }),
    [propertiesLookup]
  );
  const affiliationItems = useMemo(
    () =>
      (Array.isArray(affiliations) ? affiliations : [])
        .map((affiliation) => toAffiliationOption(affiliation))
        .filter((item) => Boolean(toText(item.id))),
    [affiliations]
  );
  const resolvedJobEmailSelectionLabel = useMemo(() => {
    const selected = jobEmailItems.find(
      (item) => toText(item.id) === toText(selectedJobEmailContactId)
    );
    if (selected?.label) return selected.label;
    if (jobEmailContactSearchValue) return jobEmailContactSearchValue;
    return toText(selectedJobEmailContactId);
  }, [jobEmailContactSearchValue, jobEmailItems, selectedJobEmailContactId]);
  const resolvedAccountsContactSelectionLabel = useMemo(() => {
    const selectedId = toText(selectedAccountsContactId);
    if (!selectedId) return "";
    const selected = affiliationItems.find(
      (item) => toText(item.id) === selectedId
    );
    if (selected?.label) return selected.label;
    const legacyMatch = affiliationItems.find((item) =>
      Array.isArray(item?.legacyIds) ? item.legacyIds.includes(selectedId) : false
    );
    if (legacyMatch?.label) return legacyMatch.label;
    return selectedId;
  }, [affiliationItems, selectedAccountsContactId]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !resolvedPropertyId) {
      setAffiliations([]);
      setAffiliationsError("");
      setIsAffiliationsLoading(false);
      return undefined;
    }
    setIsAffiliationsLoading(true);
    setAffiliationsError("");
    fetchPropertyAffiliationsForDetails({
      plugin,
      propertyId: resolvedPropertyId,
    })
      .then((rows) => {
        if (cancelled) return;
        setAffiliations(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load property affiliations", loadError);
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
  }, [plugin, isSdkReady, resolvedPropertyId]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !currentJobId) {
      setUploads([]);
      setUploadsError("");
      setIsUploadsLoading(false);
      return undefined;
    }
    setIsUploadsLoading(true);
    setUploadsError("");
    fetchUploadsForDetails({
      plugin,
      jobId: currentJobId,
    })
      .then((rows) => {
        if (cancelled) return;
        setUploads(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load uploads", loadError);
        setUploads([]);
        setUploadsError(loadError?.message || "Unable to load uploads.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsUploadsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady, currentJobId]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || (!currentJobId && !inquiryId)) {
      setTaskRows([]);
      setTaskRowsError("");
      setIsTaskRowsLoading(false);
      return undefined;
    }
    setIsTaskRowsLoading(true);
    setTaskRowsError("");
    fetchTasksForDetails({
      plugin,
      jobId: currentJobId,
      inquiryId,
    })
      .then((rows) => {
        if (cancelled) return;
        setTaskRows(Array.isArray(rows) ? rows : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load tasks", loadError);
        setTaskRows([]);
        setTaskRowsError(loadError?.message || "Unable to load tasks.");
      })
      .finally(() => {
        if (cancelled) return;
        setIsTaskRowsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [plugin, isSdkReady, currentJobId, inquiryId]);

  useEffect(() => {
    let cancelled = false;
    if (!plugin || !isSdkReady || !currentJobId) {
      setJobActivities([]);
      setJobMaterials([]);
      setIsWorkSectionsLoading(false);
      setWorkSectionsError("");
      return undefined;
    }

    setIsWorkSectionsLoading(true);
    setWorkSectionsError("");

    Promise.all([
      fetchActivitiesByJobId({ plugin, jobId: currentJobId }),
      fetchMaterialsByJobId({ plugin, jobId: currentJobId }),
    ])
      .then(([activities, materials]) => {
        if (cancelled) return;
        setJobActivities(Array.isArray(activities) ? activities : []);
        setJobMaterials(Array.isArray(materials) ? materials : []);
      })
      .catch((loadError) => {
        if (cancelled) return;
        console.error("[JobDetails] Failed to load activities/materials", loadError);
        setJobActivities([]);
        setJobMaterials([]);
        setWorkSectionsError(
          loadError?.message || "Unable to load activities and materials."
        );
      })
      .finally(() => {
        if (cancelled) return;
        setIsWorkSectionsLoading(false);
      });

    const unsubscribeActivities = subscribeActivitiesByJobId({
      plugin,
      jobId: currentJobId,
      onChange: (records) => {
        if (cancelled) return;
        setJobActivities(Array.isArray(records) ? records : []);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[JobDetails] Activities subscription failed", streamError);
        setWorkSectionsError((previous) => previous || "Live activity updates are unavailable.");
      },
    });

    const unsubscribeMaterials = subscribeMaterialsByJobId({
      plugin,
      jobId: currentJobId,
      onChange: (records) => {
        if (cancelled) return;
        setJobMaterials(Array.isArray(records) ? records : []);
      },
      onError: (streamError) => {
        if (cancelled) return;
        console.error("[JobDetails] Materials subscription failed", streamError);
        setWorkSectionsError((previous) => previous || "Live material updates are unavailable.");
      },
    });

    return () => {
      cancelled = true;
      unsubscribeActivities?.();
      unsubscribeMaterials?.();
    };
  }, [plugin, isSdkReady, currentJobId]);

  const hasMemoContext = Boolean(toText(inquiryId) || toText(currentJobId));
  const currentUserId = toText(APP_USER?.id);

  const refreshMemos = useCallback(async () => {
    if (!plugin || !isSdkReady || !hasMemoContext) {
      setMemos([]);
      return;
    }
    const rows = await fetchMemosForDetails({
      plugin,
      inquiryId,
      jobId: currentJobId,
      limit: 120,
    });
    setMemos(Array.isArray(rows) ? rows : []);
  }, [plugin, isSdkReady, hasMemoContext, inquiryId, currentJobId]);

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
      inquiryId,
      jobId: currentJobId,
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
      inquiryId,
      jobId: currentJobId,
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
  }, [plugin, isSdkReady, hasMemoContext, inquiryId, currentJobId]);

  const isQuoteActionProcessing = useCallback(
    (actionKey) => Boolean(quoteActionState.processing && quoteActionState.key === actionKey),
    [quoteActionState]
  );

  const quoteActionLabel = useCallback(
    (actionKey, idleLabel, busyLabel = "Processing...") =>
      isQuoteActionProcessing(actionKey) ? busyLabel : idleLabel,
    [isQuoteActionProcessing]
  );

  const handleMemoFileChange = useCallback((event) => {
    const nextFile = Array.from(event?.target?.files || [])[0] || null;
    setMemoFile(nextFile);
    if (event?.target) event.target.value = "";
  }, []);

  const handleSendMemo = useCallback(async () => {
    const text = toText(memoText);
    if (!hasMemoContext) {
      showError("Post failed", "No linked inquiry or job found for memos.");
      return;
    }
    if (!text && !memoFile) {
      showError("Post failed", "Enter a message or attach a file.");
      return;
    }
    if (isPostingMemo) return;

    setIsPostingMemo(true);
    try {
      let memoFilePayload = "";
      if (memoFile) {
        const uploaded = await uploadMaterialFile({
          file: memoFile,
          uploadPath: `forum-memos/${currentJobId || inquiryId || "details"}`,
        });
        memoFilePayload = JSON.stringify(uploaded?.fileObject || {});
      }

      const createdPost = await createMemoPostForDetails({
        plugin,
        payload: {
          post_copy: text,
          post_status: "Published",
          related_inquiry_id: inquiryId || null,
          related_job_id: currentJobId || null,
          created_at: Math.floor(Date.now() / 1000),
          file: memoFilePayload || "",
        },
      });
      const createdPostId = toText(createdPost?.id || createdPost?.ID);
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.POST_CREATED,
        quoteJobId: currentJobId,
        inquiryId,
        postId: createdPostId,
        focusId: createdPostId,
        dedupeEntityId: createdPostId || `${currentJobId}:${inquiryId}:${text}`,
        title: "New memo post",
        content: text || "A new memo post was added.",
        openMemo: true,
        logContext: "job-details:handleSendMemo",
      });

      setMemoText("");
      setMemoFile(null);
      await refreshMemos();
      success("Memo posted", "Your memo was added to the thread.");
    } catch (postError) {
      console.error("[JobDetails] Failed posting memo", postError);
      showError("Post failed", postError?.message || "Unable to post memo.");
    } finally {
      setIsPostingMemo(false);
    }
  }, [
    memoText,
    hasMemoContext,
    memoFile,
    isPostingMemo,
    currentJobId,
    inquiryId,
    plugin,
    refreshMemos,
    success,
    showError,
  ]);

  const handleSendMemoReply = useCallback(
    async (postId) => {
      const normalizedPostId = toText(postId);
      const text = toText(memoReplyDrafts?.[normalizedPostId]);
      if (!normalizedPostId || !text) return;
      if (sendingReplyPostId) return;

      setSendingReplyPostId(normalizedPostId);
      try {
        const createdComment = await createMemoCommentForDetails({
          plugin,
          payload: {
            forum_post_id: normalizedPostId,
            comment: text,
            comment_status: "Published",
            created_at: Math.floor(Date.now() / 1000),
          },
        });
        const createdCommentId = toText(createdComment?.id || createdComment?.ID);
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.COMMENT_CREATED,
          quoteJobId: currentJobId,
          inquiryId,
          postId: normalizedPostId,
          commentId: createdCommentId,
          focusId: createdCommentId || normalizedPostId,
          dedupeEntityId: createdCommentId || `${normalizedPostId}:${text}`,
          title: "New memo comment",
          content: text,
          openMemo: true,
          logContext: "job-details:handleSendMemoReply",
        });
        setMemoReplyDrafts((previous) => ({
          ...(previous || {}),
          [normalizedPostId]: "",
        }));
        await refreshMemos();
        success("Reply posted", "Your reply was added.");
      } catch (replyError) {
        console.error("[JobDetails] Failed posting memo reply", replyError);
        showError("Reply failed", replyError?.message || "Unable to post reply.");
      } finally {
        setSendingReplyPostId("");
      }
    },
    [
      memoReplyDrafts,
      sendingReplyPostId,
      plugin,
      refreshMemos,
      success,
      showError,
      currentJobId,
      inquiryId,
    ]
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
      console.error("[JobDetails] Failed deleting memo item", deleteError);
      showError("Delete failed", deleteError?.message || "Unable to delete item.");
    } finally {
      setIsDeletingMemoItem(false);
    }
  }, [memoDeleteTarget, isDeletingMemoItem, plugin, refreshMemos, success, showError]);

  const openTemplateLink = useCallback((messageId) => {
    if (!messageId) return;
    const url = `https://app.ontraport.com/#!/message/edit&id=${messageId}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, []);

  const handleEmailOptionClick = useCallback(
    async (option) => {
      if (!currentJobId) {
        showError("Action unavailable", "No linked job found for this action.");
        return;
      }
      if (!option?.field_id) return;
      if (sendingEmailOptionId) return;
      const optionKey = toText(option?.message_id || option?.field_id || option?.button_name);
      setSendingEmailOptionId(optionKey);
      try {
        await updateJobFieldsById({
          plugin,
          jobId: currentJobId,
          payload: { [option.field_id]: true },
        });
        success("Success", "Email Sent Successfully");
        setOpenDropdown("");
      } catch (mutationError) {
        console.error("[JobDetails] Email action failed", mutationError);
        showError("Email failed", mutationError?.message || "Unable to send email.");
      } finally {
        setSendingEmailOptionId("");
      }
    },
    [currentJobId, plugin, sendingEmailOptionId, showError, success]
  );

  const handleSaveQuoteContacts = useCallback(async () => {
    if (!currentJobId) {
      showError("Action unavailable", "No linked job found for this action.");
      return;
    }
    if (isSavingQuoteContacts) return;

    setIsSavingQuoteContacts(true);
    try {
      const jobEmailPayload = isCompanyAccount
        ? {
            client_entity_id: selectedJobEmailContactId || null,
            client_individual_id: null,
          }
        : {
            client_individual_id: selectedJobEmailContactId || null,
            client_entity_id: null,
          };
      await updateJobFieldsById({
        plugin,
        jobId: currentJobId,
        payload: {
          ...jobEmailPayload,
          accounts_contact_id: selectedAccountsContactId || null,
        },
      });
      success("Contacts saved", "Quote contacts updated.");
      await reloadContext();
    } catch (mutationError) {
      console.error("[JobDetails] Save quote contacts failed", mutationError);
      showError("Save failed", mutationError?.message || "Unable to update quote contacts.");
    } finally {
      setIsSavingQuoteContacts(false);
    }
  }, [
    currentJobId,
    isSavingQuoteContacts,
    plugin,
    reloadContext,
    isCompanyAccount,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    showError,
    success,
  ]);

  const handleSendQuote = useCallback(async () => {
    if (!currentJobId) {
      showError("Action unavailable", "No linked job found for this action.");
      return;
    }
    if (!selectedAccountsContactId) {
      showError("Send failed", "Select Accounts Contact before sending quote.");
      return;
    }
    if (quoteActionState.processing) return;

    setQuoteActionState({ processing: true, key: "send" });
    try {
      const jobEmailPayload = isCompanyAccount
        ? {
            client_entity_id: selectedJobEmailContactId || null,
            client_individual_id: null,
          }
        : {
            client_individual_id: selectedJobEmailContactId || null,
            client_entity_id: null,
          };
      await updateJobFieldsById({
        plugin,
        jobId: currentJobId,
        payload: {
          quote_status: "Sent",
          date_quote_sent: nowUnixSeconds(),
          accounts_contact_id: selectedAccountsContactId,
          ...jobEmailPayload,
        },
      });
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.QUOTE_SENT,
        quoteJobId: currentJobId,
        inquiryId,
        focusId: currentJobId,
        dedupeEntityId: `${currentJobId}:sent`,
        title: "Quote sent",
        content: "Quote status was updated to Sent.",
        logContext: "job-details:handleSendQuote",
      });
      success("Quote sent", "Quote status updated to Sent.");
      await reloadContext();
    } catch (mutationError) {
      console.error("[JobDetails] Send quote failed", mutationError);
      showError("Send failed", mutationError?.message || "Unable to send quote.");
    } finally {
      setQuoteActionState({ processing: false, key: "" });
    }
  }, [
    currentJobId,
    plugin,
    quoteActionState.processing,
    reloadContext,
    isCompanyAccount,
    selectedAccountsContactId,
    selectedJobEmailContactId,
    inquiryId,
    showError,
    success,
  ]);

  const handleAcceptQuote = useCallback(async () => {
    if (!currentJobId) {
      showError("Action unavailable", "No linked job found for this action.");
      return;
    }
    if (quoteStatusNormalized !== "sent") {
      showError("Accept failed", "Quote can be accepted only after it is sent.");
      return;
    }
    if (quoteActionState.processing) return;

    setQuoteActionState({ processing: true, key: "accept" });
    try {
      await updateJobFieldsById({
        plugin,
        jobId: currentJobId,
        payload: {
          quote_status: "Accepted",
          job_status: "In Progress",
          date_quoted_accepted: nowUnixSeconds(),
        },
      });
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.QUOTE_ACCEPTED,
        quoteJobId: currentJobId,
        inquiryId,
        focusId: currentJobId,
        dedupeEntityId: `${currentJobId}:accepted`,
        title: "Quote accepted",
        content: "Quote status was updated to Accepted.",
        logContext: "job-details:handleAcceptQuote",
      });
      success("Quote accepted", "Quote status updated to Accepted.");
      await reloadContext();
    } catch (mutationError) {
      console.error("[JobDetails] Accept quote failed", mutationError);
      showError("Accept failed", mutationError?.message || "Unable to accept quote.");
    } finally {
      setQuoteActionState({ processing: false, key: "" });
    }
  }, [
    currentJobId,
    plugin,
    quoteActionState.processing,
    quoteStatusNormalized,
    reloadContext,
    showError,
    success,
    inquiryId,
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
        if (!inquiryPrimaryContactId) {
          throw new Error("Primary contact is missing.");
        }
        await updateContactFieldsById({
          plugin,
          contactId: inquiryPrimaryContactId,
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
      await reloadContext();
    } catch (saveError) {
      console.error("[JobDetails] Popup comment save failed", saveError);
      showError("Save failed", saveError?.message || "Unable to update popup comment.");
    } finally {
      setIsSavingPopupComment(false);
    }
  }, [
    companyPopupComment,
    contactPopupComment,
    inquiryCompanyId,
    inquiryPrimaryContactId,
    isSavingPopupComment,
    plugin,
    popupCommentDrafts,
    reloadContext,
    showError,
    success,
  ]);

  const handleJobAction = useCallback(
    async (actionKey) => {
      if (jobActionState.processing) return;
      if (actionKey === "duplicate" && !canDuplicateJob) {
        return;
      }
      if (actionKey === "callback" && !inquiryId) {
        showError("Action unavailable", "No linked inquiry found for this action.");
        return;
      }
      if (!currentJobId && actionKey !== "delete" && actionKey !== "callback") {
        showError("Action unavailable", "No linked job found for this action.");
        return;
      }
      setJobActionState({ processing: true, key: actionKey });
      try {
        if (actionKey === "callback") {
          await updateInquiryFieldsById({
            plugin,
            inquiryId,
            payload: { call_back: true },
          });
          success("Success", "Callback request created successfully.");
        } else if (actionKey === "duplicate") {
          await updateJobFieldsById({
            plugin,
            jobId: currentJobId,
            payload: { duplicate_job: true },
          });
          success("Success", "Job duplicated successfully.");
        } else if (actionKey === "delete") {
          if (currentJobId) {
            await updateJobFieldsById({
              plugin,
              jobId: currentJobId,
              payload: { job_status: "Cancelled" },
            });
          } else if (inquiryId) {
            await updateInquiryFieldsById({
              plugin,
              inquiryId,
              payload: { inquiry_status: "Cancelled" },
            });
          } else {
            throw new Error("No linked job or inquiry found to cancel.");
          }
          success("Success", "Record marked as cancelled.");
          navigate("/");
        }
      } catch (actionError) {
        console.error("[JobDetails] Job action failed", actionError);
        showError("Action failed", actionError?.message || "Unable to complete action.");
      } finally {
        setJobActionState({ processing: false, key: "" });
        setOpenDropdown("");
      }
    },
    [canDuplicateJob, currentJobId, inquiryId, jobActionState.processing, navigate, plugin, showError, success]
  );

  const handleEmailJob = useCallback(async () => {
    if (!currentJobId || !plugin || isEmailJobUpdating) return;
    setIsEmailJobUpdating(true);
    try {
      await updateJobFieldsById({
        plugin,
        jobId: currentJobId,
        payload: {
          send_job_update_to_service_provider: true,
        },
      });
      success("Email job queued", "Service provider update email was marked for sending.");
      await reloadContext();
    } catch (error) {
      console.error("[JobDetails] Failed to queue email job", error);
      showError("Email job failed", error?.message || "Unable to update email flag.");
    } finally {
      setIsEmailJobUpdating(false);
    }
  }, [currentJobId, isEmailJobUpdating, plugin, reloadContext, showError, success]);

  const openContactDetailsModal = useCallback(({ mode = "individual", onSave = null } = {}) => {
    setContactModalState({
      open: true,
      mode,
      onSave: typeof onSave === "function" ? onSave : null,
    });
  }, []);

  const closeContactDetailsModal = useCallback(() => {
    setContactModalState((previous) => ({
      ...previous,
      open: false,
    }));
  }, []);

  const handleAddJobEmailContact = useCallback(() => {
    if (isCompanyAccount) {
      openContactDetailsModal({
        mode: "entity",
        onSave: async (draftRecord) => {
          if (!plugin) {
            throw new Error("SDK plugin is not ready.");
          }
          const created = await createCompanyRecord({
            plugin,
            payload: draftRecord || {},
          });
          const createdId = toText(created?.id || created?.ID);
          const refreshed = await fetchCompaniesForSearch({ plugin });
          setCompaniesLookup(Array.isArray(refreshed) ? refreshed : []);
          if (createdId) {
            setSelectedJobEmailContactId(createdId);
          }
        },
      });
      return;
    }

    openContactDetailsModal({
      mode: "individual",
      onSave: async (draftRecord) => {
        if (!plugin) {
          throw new Error("SDK plugin is not ready.");
        }
        const created = await createContactRecord({
          plugin,
          payload: draftRecord || {},
        });
        const createdId = toText(created?.id || created?.ID);
        const refreshed = await fetchContactsForLookup({ plugin });
        setContactsLookup(Array.isArray(refreshed) ? refreshed : []);
        if (createdId) {
          setSelectedJobEmailContactId(createdId);
        }
      },
    });
  }, [isCompanyAccount, openContactDetailsModal, plugin]);

  const openAddAffiliationModal = useCallback(() => {
    if (!resolvedPropertyId) {
      showError("Add contact unavailable", "Please set a property first.");
      return;
    }
    setAffiliationModalState({
      open: true,
      initialData: null,
    });
  }, [resolvedPropertyId, showError]);

  const openEditAffiliationModal = useCallback((affiliation) => {
    if (!affiliation) return;
    setAffiliationModalState({
      open: true,
      initialData: affiliation,
    });
  }, []);

  const closeAffiliationModal = useCallback(() => {
    setAffiliationModalState({
      open: false,
      initialData: null,
    });
  }, []);

  const saveAffiliation = useCallback(
    async (payload, meta = {}) => {
      if (!plugin) {
        throw new Error("SDK plugin is not ready.");
      }
      const editId = toText(meta?.id);
      let savedAffiliation = null;
      if (editId) {
        savedAffiliation = await updateAffiliationRecord({
          plugin,
          id: editId,
          payload,
        });
      } else {
        savedAffiliation = await createAffiliationRecord({
          plugin,
          payload,
        });
      }
      const refreshed = await fetchPropertyAffiliationsForDetails({
        plugin,
        propertyId: resolvedPropertyId,
      });
      setAffiliations(Array.isArray(refreshed) ? refreshed : []);
      success(
        editId ? "Property contact updated" : "Property contact added",
        editId ? "Property contact details were updated." : "New property contact was added."
      );
      const savedAffiliationId = toText(savedAffiliation?.id || savedAffiliation?.ID || editId);
      await emitAnnouncement({
        plugin,
        eventKey: editId
          ? ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_UPDATED
          : ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_ADDED,
        quoteJobId: currentJobId,
        inquiryId,
        focusId: savedAffiliationId,
        dedupeEntityId:
          savedAffiliationId || `${toText(currentJobId)}:${toText(inquiryId)}:${toText(resolvedPropertyId)}`,
        title: editId ? "Property contact updated" : "Property contact added",
        content: editId
          ? "Property contact details were updated."
          : "A new property contact was linked.",
        logContext: "job-details:saveAffiliation",
      });
    },
    [plugin, resolvedPropertyId, success, currentJobId, inquiryId]
  );

  const handleAddAffiliationContact = useCallback(() => {
    openContactDetailsModal({
      mode: "individual",
      onSave: async (draftRecord) => {
        if (!plugin) throw new Error("SDK plugin is not ready.");
        const created = await createContactRecord({
          plugin,
          payload: draftRecord || {},
        });
        const createdId = toText(created?.id || created?.ID);
        const refreshed = await fetchContactsForLookup({ plugin });
        setContactsLookup(Array.isArray(refreshed) ? refreshed : []);
        if (createdId) {
          const item = (Array.isArray(refreshed) ? refreshed : []).find(
            (contact) => toText(contact?.id || contact?.ID) === createdId
          );
          const label =
            fullName(item?.first_name || item?.First_Name, item?.last_name || item?.Last_Name) ||
            toText(item?.email || item?.Email) ||
            createdId;
          setAffiliationForm((previous) => ({
            ...previous,
            contact_id: createdId,
            contact_label: label,
          }));
        }
      },
    });
  }, [openContactDetailsModal, plugin]);

  const handleAddAffiliationCompany = useCallback(() => {
    openContactDetailsModal({
      mode: "entity",
      onSave: async (draftRecord) => {
        if (!plugin) throw new Error("SDK plugin is not ready.");
        const created = await createCompanyRecord({
          plugin,
          payload: draftRecord || {},
        });
        const createdId = toText(created?.id || created?.ID);
        const refreshed = await fetchCompaniesForSearch({ plugin });
        setCompaniesLookup(Array.isArray(refreshed) ? refreshed : []);
        if (createdId) {
          const item = (Array.isArray(refreshed) ? refreshed : []).find(
            (company) => toText(company?.id || company?.ID) === createdId
          );
          const label = toText(item?.name || item?.Name) || createdId;
          setAffiliationForm((previous) => ({
            ...previous,
            company_id: createdId,
            company_label: label,
            ...(previous.same_as_company
              ? {
                  company_as_accounts_contact_id: createdId,
                  company_as_accounts_contact_label: label,
                }
              : {}),
          }));
        }
      },
    });
  }, [openContactDetailsModal, plugin]);

  const handleSaveAffiliationForm = useCallback(async () => {
    if (!resolvedPropertyId) {
      showError("Save failed", "Property ID is missing.");
      return;
    }
    const hasContact = Boolean(toText(affiliationForm.contact_id));
    const hasCompany = Boolean(toText(affiliationForm.company_id));
    if (!hasContact && !hasCompany) {
      showError("Save failed", "Select at least one contact or company.");
      return;
    }
    const roleNormalized = normalizeStatus(affiliationForm.role);
    const payload = {
      role: toText(affiliationForm.role),
      property_id: resolvedPropertyId,
      contact_id: hasContact ? toText(affiliationForm.contact_id) : null,
      company_id: hasCompany ? toText(affiliationForm.company_id) : null,
      company_as_accounts_contact_id: affiliationForm.same_as_company
        ? toText(affiliationForm.company_id) || null
        : toText(affiliationForm.company_as_accounts_contact_id) || null,
      primary_owner_contact: affiliationForm.is_primary && roleNormalized.includes("owner"),
      primary_resident_contact: affiliationForm.is_primary && roleNormalized.includes("resident"),
      primary_property_manager_contact:
        affiliationForm.is_primary &&
        (roleNormalized.includes("manager") || roleNormalized.includes("property manager")),
    };
    setIsAffiliationSaving(true);
    try {
      await saveAffiliation(payload, { id: toText(affiliationForm.id) });
      closeAffiliationModal();
    } catch (saveError) {
      console.error("[JobDetails] Failed saving property affiliation", saveError);
      showError("Save failed", saveError?.message || "Unable to save property contact.");
    } finally {
      setIsAffiliationSaving(false);
    }
  }, [resolvedPropertyId, affiliationForm, showError, saveAffiliation, closeAffiliationModal]);

  const confirmDeleteAffiliation = useCallback(async () => {
    const targetId = toText(deleteAffiliationTarget?.id);
    if (!plugin || !targetId || isDeletingAffiliation) return;
    setIsDeletingAffiliation(true);
    try {
      await deleteAffiliationRecord({
        plugin,
        id: targetId,
      });
      setAffiliations((previous) =>
        (Array.isArray(previous) ? previous : []).filter(
          (item) => toText(item?.id) !== targetId
        )
      );
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_AFFILIATION_DELETED,
        quoteJobId: currentJobId,
        inquiryId,
        focusId: targetId,
        dedupeEntityId: `${targetId}:deleted`,
        title: "Property contact removed",
        content: "A property contact link was removed.",
        logContext: "job-details:confirmDeleteAffiliation",
      });
      setDeleteAffiliationTarget(null);
      success("Property contact deleted", "Property contact was removed.");
    } catch (deleteError) {
      console.error("[JobDetails] Failed deleting property contact", deleteError);
      showError("Delete failed", deleteError?.message || "Unable to delete property contact.");
    } finally {
      setIsDeletingAffiliation(false);
    }
  }, [deleteAffiliationTarget, isDeletingAffiliation, plugin, showError, success, currentJobId, inquiryId]);

  const queuePendingUploads = useCallback((files = []) => {
    const nextFiles = Array.from(files || []);
    if (!nextFiles.length) return;
    setPendingUploads((previous) => {
      const existing = new Set(
        (Array.isArray(previous) ? previous : []).map(
          (item) => `${item.name}::${item.size}::${item.type}::${item.lastModified}`
        )
      );
      const next = [...(Array.isArray(previous) ? previous : [])];
      nextFiles.forEach((file) => {
        const signature = `${file.name}::${file.size}::${file.type}::${file.lastModified}`;
        if (existing.has(signature)) return;
        existing.add(signature);
        next.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          size: file.size,
          type: file.type || "application/octet-stream",
          lastModified: file.lastModified || 0,
          previewUrl: URL.createObjectURL(file),
        });
      });
      return next;
    });
  }, []);

  const handleUploadFilesSelected = useCallback(
    (event) => {
      const input = event?.target;
      const files = Array.from(input?.files || []);
      queuePendingUploads(files);
      if (input) input.value = "";
    },
    [queuePendingUploads]
  );

  const removePendingUpload = useCallback((pendingId) => {
    setPendingUploads((previous) => {
      const next = [];
      (Array.isArray(previous) ? previous : []).forEach((item) => {
        if (toText(item?.id) === toText(pendingId)) {
          if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
          return;
        }
        next.push(item);
      });
      return next;
    });
  }, []);

  const savePendingUploads = useCallback(async () => {
    if (!plugin || !currentJobId || !pendingUploads.length || isUploadsSaving) return;
    setIsUploadsSaving(true);
    setUploadsError("");
    const created = [];
    const failed = [];
    for (const pending of pendingUploads) {
      try {
        const saved = await createUploadForDetails({
          plugin,
          file: pending.file,
          jobId: currentJobId,
          inquiryId,
          uploadPath: `job-uploads/${currentJobId}`,
        });
        if (saved) created.push(saved);
        if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
      } catch (uploadError) {
        failed.push({
          ...pending,
          uploadError: uploadError?.message || "Unable to upload file.",
        });
      }
    }
    if (created.length) {
      setUploads((previous) => dedupeById([...created, ...(Array.isArray(previous) ? previous : [])]));
      success(
        created.length > 1 ? "Uploads added" : "Upload added",
        created.length > 1
          ? `${created.length} files were uploaded.`
          : "File was uploaded."
      );
    }
    setPendingUploads(failed);
    if (failed.length) {
      const message = failed[0]?.uploadError || "Unable to upload one or more files.";
      setUploadsError(message);
      showError("Upload failed", message);
    }
    setIsUploadsSaving(false);
  }, [plugin, currentJobId, pendingUploads, isUploadsSaving, inquiryId, showError, success]);

  const confirmDeleteUpload = useCallback(async () => {
    const targetId = toText(deleteUploadTarget?.id || deleteUploadTarget?.ID);
    if (!plugin || !targetId || isDeletingUpload) return;
    setIsDeletingUpload(true);
    try {
      await deleteUploadForDetails({
        plugin,
        uploadId: targetId,
      });
      setUploads((previous) =>
        (Array.isArray(previous) ? previous : []).filter(
          (upload) => toText(upload?.id || upload?.ID) !== targetId
        )
      );
      setDeleteUploadTarget(null);
      success("Upload deleted", "Upload was removed.");
    } catch (deleteError) {
      console.error("[JobDetails] Failed deleting upload", deleteError);
      showError("Delete failed", deleteError?.message || "Unable to delete upload.");
    } finally {
      setIsDeletingUpload(false);
    }
  }, [deleteUploadTarget, isDeletingUpload, plugin, showError, success]);

  useEffect(() => {
    const existingProviderId = toText(
      inquiry?.service_provider_id || inquiry?.Service_Provider_ID
    );
    setSelectedProviderId(existingProviderId);
  }, [inquiry]);

  useEffect(() => {
    const jobEmailId = isCompanyAccount
      ? toText(job?.client_entity_id || job?.Client_Entity_ID || inquiry?.Company?.id || inquiry?.Company_ID)
      : toText(job?.client_individual_id || job?.Client_Individual_ID || inquiry?.Primary_Contact?.id);
    const accountEmailId = toText(job?.accounts_contact_id || job?.Accounts_Contact_ID);
    setSelectedJobEmailContactId(jobEmailId);
    setSelectedAccountsContactId(accountEmailId);
  }, [inquiry, isCompanyAccount, job]);

  useEffect(() => {
    if (!selectedProviderId) {
      setProviderSearchValue("");
      return;
    }
    const selected = providerItems.find(
      (item) => toText(item.id) === toText(selectedProviderId)
    );
    if (selected) {
      setProviderSearchValue(selected.label || "");
    }
  }, [providerItems, selectedProviderId]);

  useEffect(() => {
    if (!resolvedPropertyId) {
      setPropertySearchValue("");
      return;
    }
    const selected = propertySearchItems.find(
      (item) => toText(item.id) === toText(resolvedPropertyId)
    );
    if (selected) {
      setPropertySearchValue(selected.label || "");
      return;
    }
    setPropertySearchValue(
      toText(
        resolvedProperty?.property_name || resolvedProperty?.Property_Name || resolvedProperty?.address_1 || resolvedProperty?.Address_1
      )
    );
  }, [resolvedPropertyId, propertySearchItems, resolvedProperty]);

  useEffect(() => {
    if (!selectedJobEmailContactId) {
      setJobEmailContactSearchValue("");
      return;
    }
    const selected = jobEmailItems.find(
      (item) => toText(item.id) === toText(selectedJobEmailContactId)
    );
    if (selected) {
      setJobEmailContactSearchValue(selected.label || "");
      return;
    }
    setJobEmailContactSearchValue("");
  }, [jobEmailItems, selectedJobEmailContactId]);

  useEffect(() => {
    if (!selectedAccountsContactId) {
      setAccountsContactSearchValue("");
      return;
    }
    setAccountsContactSearchValue(resolvedAccountsContactSelectionLabel);
  }, [resolvedAccountsContactSelectionLabel, selectedAccountsContactId]);

  useEffect(() => {
    pendingUploadsRef.current = Array.isArray(pendingUploads) ? pendingUploads : [];
  }, [pendingUploads]);

  useEffect(() => {
    if (!affiliationModalState.open) return;
    setIsAffiliationSaving(false);
    setAffiliationForm(mapAffiliationToForm(affiliationModalState.initialData));
  }, [affiliationModalState]);

  useEffect(
    () => () => {
      (Array.isArray(pendingUploadsRef.current) ? pendingUploadsRef.current : []).forEach((item) => {
        if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    []
  );

  if (!isSdkReady && !sdkError) {
    return <FullPageLoader text="Starting app..." />;
  }

  if (isSdkReady && !sdkError && !hasInitialContextResolved) {
    return <FullPageLoader text="Loading job details..." />;
  }

  if (loadFailure) {
    const friendly = getFriendlyServiceMessage(loadFailure);
    return (
      <FullPageError
        title={friendly ? "Temporary maintenance" : "Unable to load details."}
        description={friendly || "Please try refreshing the page."}
        onBack={handleBackDashboard}
      />
    );
  }

  if (notFound) {
    return (
      <FullPageError
        title="Record not found"
        description="This UID could not be resolved to an inquiry or job record."
        onBack={handleBackDashboard}
      />
    );
  }

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-slate-50 font-['Inter']">
      <GlobalTopHeader />

      <header className="border-b border-slate-300 bg-brand-primary px-6 py-4 text-white">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <div className="justify-self-start">
            <Link to="/" className="type-headline inline-flex items-center gap-3">
              <TitleBackIcon className="h-6 w-6 text-white" />
              <span>Job Details</span>
            </Link>
          </div>

          <div />

          <div className="flex items-center justify-self-end gap-2">
            <HeaderDropdown
              label="Job Actions"
              isOpen={openDropdown === "job-actions"}
              onToggle={() => {
                if (jobActionState.processing) return;
                setOpenDropdown((prev) => (prev === "job-actions" ? "" : "job-actions"));
              }}
              align="right"
              buttonVariant="ghost"
              buttonClassName="border border-white text-white"
            >
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 ${
                  jobActionState.processing ? "pointer-events-none opacity-70" : ""
                }`}
                onClick={() => handleJobAction("callback")}
              >
                {actionLabel("callback", "Create Call Back", "Creating...")}
              </button>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100 ${
                  !canDuplicateJob || jobActionState.processing
                    ? "pointer-events-none opacity-70"
                    : ""
                }`}
                onClick={() => handleJobAction("duplicate")}
              >
                {actionLabel("duplicate", "Duplicate Job", "Duplicating...")}
              </button>
              <button
                type="button"
                className={`block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-slate-100 ${
                  jobActionState.processing ? "pointer-events-none opacity-70" : ""
                }`}
                onClick={() => handleJobAction("delete")}
              >
                {actionLabel("delete", "Delete Record", "Deleting...")}
              </button>
            </HeaderDropdown>

            <HeaderDropdown
              label="Review"
              isOpen={openDropdown === "review"}
              onToggle={() => setOpenDropdown((prev) => (prev === "review" ? "" : "review"))}
              align="right"
              buttonVariant="ghost"
              buttonClassName="border border-white text-white"
            >
              {["Review Quote", "Review Invoice", "Review Receipt"].map((item) => (
                <button
                  key={item}
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-100"
                  onClick={() => {
                    setOpenDropdown("");
                    success("Review action", `${item} flow will be wired in behavior slice.`);
                  }}
                >
                  {item}
                </button>
              ))}
            </HeaderDropdown>

            <Button
              variant="secondary"
              className="!text-brand-primary whitespace-nowrap"
              disabled={!currentJobUniqueId}
              onClick={handleOpenPrintJobSheet}
            >
              Print Job Sheet
            </Button>
            <Button
              variant="secondary"
              className="!text-brand-primary whitespace-nowrap"
              disabled={!currentJobId || isEmailJobUpdating}
              onClick={handleEmailJob}
            >
              {isEmailJobUpdating ? "Sending..." : "Email Job"}
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-auto">
        <div className="min-w-[1260px] px-6 py-5">
          <div className="space-y-4">
            <section className="rounded border border-slate-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-6">
                  {Object.entries(EMAIL_OPTIONS_DATA).map(([groupKey, group]) => (
                    <HeaderDropdown
                      key={groupKey}
                      label={group.label}
                      isOpen={openDropdown === `email-${groupKey}`}
                      onToggle={() =>
                        setOpenDropdown((prev) => (prev === `email-${groupKey}` ? "" : `email-${groupKey}`))
                      }
                      panelClassName="min-w-[360px]"
                      textTrigger
                    >
                      {group.buttons.map((option) => (
                        <div
                          key={`${groupKey}-${option.field_id}`}
                          className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-100"
                        >
                          {(() => {
                            const optionKey = toText(
                              option?.message_id || option?.field_id || option?.button_name
                            );
                            const isSending = Boolean(
                              sendingEmailOptionId && sendingEmailOptionId === optionKey
                            );
                            return (
                              <button
                                type="button"
                                className={`whitespace-nowrap text-left text-sm text-slate-600 ${
                                  sendingEmailOptionId ? "pointer-events-none opacity-70" : ""
                                }`}
                                onClick={() => handleEmailOptionClick(option)}
                              >
                                {isSending ? "Sending email..." : option.button_name}
                              </button>
                            );
                          })()}
                          <button
                            type="button"
                            className="text-sm font-medium text-blue-700 underline"
                            onClick={() => openTemplateLink(option.message_id)}
                          >
                            ({option.template_link_button})
                          </button>
                        </div>
                      ))}
                    </HeaderDropdown>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={() => setIsDealInfoOpen(true)}
                  >
                    Deal Info
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="whitespace-nowrap"
                    onClick={handleEditRecord}
                    disabled={isQuoteAccepted ? !currentJobUniqueId : !currentInquiryUniqueId}
                  >
                    {isQuoteAccepted ? "Edit Job" : "Edit Inquiry"}
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded border border-slate-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-slate-800">Progress</div>
              <div className="grid grid-cols-7 gap-2">
                {STAGES.map((stage) => (
                  <StageChip
                    key={stage.key}
                    label={stage.label}
                    active={Boolean(stageState?.[stage.key])}
                  />
                ))}
              </div>
            </section>

            <div className="w-[360px] max-w-full">
              <div className="mb-1 text-sm font-semibold" style={inquiryCardTheme.accentStyle}>
                {selectedProviderId ? "Service Provider Assigned" : "Assign Service Provider"}
              </div>
              {inquiry ? (
                <div className="flex items-end gap-2">
                  <div
                    className={`min-w-0 flex-1 ${
                      hasLinkedJob ? "pointer-events-none" : ""
                    }`}
                  >
                    <SearchDropdownInput
                      label=""
                      field="service_provider_search"
                      value={hasLinkedJob ? resolvedProviderName || providerSearchValue : providerSearchValue}
                      placeholder="Search by name, email, phone"
                      items={providerItems}
                      onValueChange={(nextValue) => {
                        if (hasLinkedJob) return;
                        setProviderSearchValue(nextValue);
                      }}
                      onSelect={(item) => {
                        if (hasLinkedJob) return;
                        const nextId = toText(item?.id);
                        setSelectedProviderId(nextId);
                        setProviderSearchValue(item?.label || "");
                      }}
                      hideAddAction
                      emptyText={
                        isProviderLookupLoading ? "Loading service providers..." : "No service providers found."
                      }
                      rootData={{
                        className: `w-full ${
                          hasLinkedJob ? "opacity-75" : ""
                        } [&_[data-field='service_provider_search']]:border-[var(--provider-border)] [&_[data-field='service_provider_search']]:focus:border-[var(--provider-border)]`,
                        style: {
                          "--provider-border":
                            inquiryCardTheme?.wrapperStyle?.borderColor || "#94a3b8",
                        },
                      }}
                    />
                  </div>
                  {!hasLinkedJob ? (
                    <Button
                      variant="secondary"
                      onClick={handleAllocateProvider}
                      disabled={isAllocatingProvider || !selectedProviderId}
                      className="whitespace-nowrap"
                    >
                      {isAllocatingProvider ? "Submitting..." : "Submit information"}
                    </Button>
                  ) : null}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No linked inquiry.</div>
              )}
            </div>

            <section className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-start gap-4">
              <article className="min-w-0 overflow-hidden rounded border bg-white" style={inquiryCardTheme.wrapperStyle}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                    collapsedCards.inquiry ? "" : "border-b"
                  }`}
                  style={inquiryCardTheme.headerStyle}
                  onClick={() => toggleCardCollapse("inquiry")}
                  aria-expanded={!collapsedCards.inquiry}
                  aria-label={
                    collapsedCards.inquiry ? "Expand inquiry details" : "Collapse inquiry details"
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={inquiryCardTheme.accentStyle}>◉</span>
                    <h2 className="text-sm font-semibold" style={inquiryCardTheme.accentStyle}>
                      Inquiry Details
                    </h2>
                  </div>
                  <span className="text-xs font-semibold" style={inquiryCardTheme.accentStyle}>
                    {collapsedCards.inquiry ? "⌄" : "⌃"}
                  </span>
                </button>
                {!collapsedCards.inquiry ? (
                <div className="p-4">
                    {inquiry ? (
                      <div className="space-y-2">
                        <InquirySubAccordion
                          title="Inquiry Overview"
                          isOpen={!collapsedInquirySections.overview}
                          onToggle={() => toggleInquirySection("overview")}
                        >
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Identity
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <InlineInfoItem label="UID" value={inquiry.unique_id || inquiry.Unique_ID} mono />
                              <InlineStatusItem
                                label="Status"
                                value={inquiryStatus}
                                style={resolveStatusStyle(inquiryStatus)}
                              />
                              <InlineInfoItem label="Created" value={formatDate(inquiry.created_at || inquiry.Date_Added)} />
                              <InlineInfoItem label="Account Type" value={inquiry.account_type || inquiry.Account_Type} />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Source & Request
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <InlineInfoItem label="Source" value={inquiry.inquiry_source || inquiry.Inquiry_Source} />
                              <InlineInfoItem label="Inquiry Type" value={inquiry.type || inquiry.Type} />
                              <InlineInfoItem
                                label="How Did You Hear"
                                value={inquiry.how_did_you_hear || inquiry.How_did_you_hear}
                              />
                              <InlineInfoItem label="Other" value={inquiry.other || inquiry.Other} />
                              <InlineInfoItem label="How Can We Help" value={inquiry.how_can_we_help || inquiry.How_can_we_help} />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Notes
                            </div>
                            <div className="space-y-2">
                              <LongTextRow label="Admin Notes" value={inquiry.admin_notes || inquiry.Admin_Notes} />
                              <LongTextRow label="Client Notes" value={inquiry.client_notes || inquiry.Client_Notes} />
                            </div>
                          </div>
                        </InquirySubAccordion>

                        {showContactDetails ? (
                          <InquirySubAccordion
                            title="Primary Contact"
                            isOpen={!collapsedInquirySections.primaryContact}
                            onToggle={() => toggleInquirySection("primaryContact")}
                          >
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Identity
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem label="ID" value={toText(inquiryPrimaryContact?.id)} mono />
                                <InlineInfoItem
                                  label="First Name"
                                  value={toText(inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name)}
                                />
                                <InlineInfoItem
                                  label="Last Name"
                                  value={toText(inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name)}
                                />
                                <InlineInfoItem label="Name" value={inquiryClient.name} />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Reachability
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Email"
                                  value={toText(inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email)}
                                />
                                <InlineInfoItem
                                  label="SMS Number"
                                  value={toText(inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Address
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Address"
                                  value={toText(inquiryPrimaryContact?.address || inquiryPrimaryContact?.Address)}
                                />
                                <InlineInfoItem
                                  label="City"
                                  value={toText(inquiryPrimaryContact?.city || inquiryPrimaryContact?.City)}
                                />
                                <InlineInfoItem
                                  label="State"
                                  value={toText(inquiryPrimaryContact?.state || inquiryPrimaryContact?.State)}
                                />
                                <InlineInfoItem
                                  label="Zip Code"
                                  value={toText(inquiryPrimaryContact?.zip_code || inquiryPrimaryContact?.Zip_Code)}
                                />
                              </div>
                            </div>
                          </InquirySubAccordion>
                        ) : null}

                        {showCompanyDetails ? (
                          <InquirySubAccordion
                            title="Company Details"
                            isOpen={!collapsedInquirySections.companyDetails}
                            onToggle={() => toggleInquirySection("companyDetails")}
                          >
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Profile
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem label="ID" value={toText(inquiryCompany?.id || inquiryCompany?.ID)} mono />
                                <InlineInfoItem label="Name" value={toText(inquiryCompany?.name || inquiryCompany?.Name)} />
                                <InlineInfoItem label="Type" value={companyAccountType} />
                                <InlineInfoItem
                                  label="Category"
                                  value={toText(inquiryCompany?.type || inquiryCompany?.Type)}
                                />
                                <InlineInfoItem
                                  label="Description"
                                  value={toText(inquiryCompany?.description || inquiryCompany?.Description)}
                                />
                                <InlineInfoItem label="Phone" value={toText(inquiryCompany?.phone || inquiryCompany?.Phone)} />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Location
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Address"
                                  value={toText(inquiryCompany?.address || inquiryCompany?.Address)}
                                />
                                <InlineInfoItem
                                  label="City"
                                  value={toText(inquiryCompany?.city || inquiryCompany?.City)}
                                />
                                <InlineInfoItem
                                  label="State"
                                  value={toText(inquiryCompany?.state || inquiryCompany?.State)}
                                />
                                <InlineInfoItem
                                  label="Postal Code"
                                  value={toText(inquiryCompany?.postal_code || inquiryCompany?.Postal_Code)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Business Metrics
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Industry"
                                  value={toText(inquiryCompany?.industry || inquiryCompany?.Industry)}
                                />
                                <InlineInfoItem
                                  label="Annual Revenue"
                                  value={toText(inquiryCompany?.annual_revenue || inquiryCompany?.Annual_Revenue)}
                                />
                                <InlineInfoItem
                                  label="Employees"
                                  value={toText(
                                    inquiryCompany?.number_of_employees || inquiryCompany?.Number_of_Employees
                                  )}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Primary Person
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Name"
                                  value={fullName(
                                    inquiryCompanyPrimaryPerson?.first_name ||
                                      inquiryCompanyPrimaryPerson?.First_Name,
                                    inquiryCompanyPrimaryPerson?.last_name ||
                                      inquiryCompanyPrimaryPerson?.Last_Name
                                  )}
                                />
                                <InlineInfoItem
                                  label="Email"
                                  value={toText(inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email)}
                                />
                                <InlineInfoItem
                                  label="Phone"
                                  value={toText(
                                    inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number
                                  )}
                                />
                              </div>
                            </div>
                          </InquirySubAccordion>
                        ) : null}

                        {isBodyCorpAccount ? (
                          <InquirySubAccordion
                            title="Body Corp Company"
                            isOpen={!collapsedInquirySections.bodyCorpCompany}
                            onToggle={() => toggleInquirySection("bodyCorpCompany")}
                          >
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Profile
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Name"
                                  value={toText(inquiryBodyCorpCompany?.name || inquiryBodyCorpCompany?.Name)}
                                />
                                <InlineInfoItem
                                  label="Type"
                                  value={toText(inquiryBodyCorpCompany?.type || inquiryBodyCorpCompany?.Type)}
                                />
                                <InlineInfoItem
                                  label="Description"
                                  value={toText(inquiryBodyCorpCompany?.description || inquiryBodyCorpCompany?.Description)}
                                />
                                <InlineInfoItem
                                  label="Phone"
                                  value={toText(inquiryBodyCorpCompany?.phone || inquiryBodyCorpCompany?.Phone)}
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Location & Metrics
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                <InlineInfoItem
                                  label="Address"
                                  value={toText(inquiryBodyCorpCompany?.address || inquiryBodyCorpCompany?.Address)}
                                />
                                <InlineInfoItem
                                  label="City"
                                  value={toText(inquiryBodyCorpCompany?.city || inquiryBodyCorpCompany?.City)}
                                />
                                <InlineInfoItem
                                  label="State"
                                  value={toText(inquiryBodyCorpCompany?.state || inquiryBodyCorpCompany?.State)}
                                />
                                <InlineInfoItem
                                  label="Postal Code"
                                  value={toText(inquiryBodyCorpCompany?.postal_code || inquiryBodyCorpCompany?.Postal_Code)}
                                />
                                <InlineInfoItem
                                  label="Industry"
                                  value={toText(inquiryBodyCorpCompany?.industry || inquiryBodyCorpCompany?.Industry)}
                                />
                                <InlineInfoItem
                                  label="Annual Revenue"
                                  value={toText(
                                    inquiryBodyCorpCompany?.annual_revenue || inquiryBodyCorpCompany?.Annual_Revenue
                                  )}
                                />
                                <InlineInfoItem
                                  label="Employees"
                                  value={toText(
                                    inquiryBodyCorpCompany?.number_of_employees ||
                                      inquiryBodyCorpCompany?.Number_of_Employees
                                  )}
                                />
                              </div>
                            </div>
                          </InquirySubAccordion>
                        ) : null}

                        <InquirySubAccordion
                          title="Deal & Provider"
                          isOpen={!collapsedInquirySections.dealProvider}
                          onToggle={() => toggleInquirySection("dealProvider")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem label="Deal Name" value={inquiry.deal_name || inquiry.Deal_Name} />
                            <InlineInfoItem label="Deal Value" value={inquiry.deal_value || inquiry.Deal_Value} />
                            <InlineInfoItem label="Provider" value={resolvedProviderName} />
                          </div>
                        </InquirySubAccordion>
                      </div>
                    ) : (
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                        No linked inquiry
                      </div>
                    )}
                </div>
                ) : null}
              </article>

              <article className="min-w-0 overflow-hidden rounded border border-slate-200 bg-white">
                <button
                  type="button"
                  className={`flex w-full items-center justify-between bg-slate-100 px-4 py-3 text-left ${
                    collapsedCards.property ? "" : "border-b border-slate-200"
                  }`}
                  onClick={() => toggleCardCollapse("property")}
                  aria-expanded={!collapsedCards.property}
                  aria-label={
                    collapsedCards.property ? "Expand property details" : "Collapse property details"
                  }
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base text-slate-600">◉</span>
                    <h2 className="text-sm font-semibold text-slate-800">Property</h2>
                  </div>
                  <span className="text-xs font-semibold text-slate-700">
                    {collapsedCards.property ? "⌄" : "⌃"}
                  </span>
                </button>
                {!collapsedCards.property ? (
                <div className="space-y-3 p-4">
                    <div className="rounded border border-slate-200 bg-slate-50 p-3">
                      <SearchDropdownInput
                        label="Property Search"
                        field="job_details_property_search"
                        value={propertySearchValue}
                        placeholder="Search by property name, UID, or address"
                        items={propertySearchItems}
                        onValueChange={setPropertySearchValue}
                        onSelect={handleSelectPropertyFromSearch}
                        onAdd={openCreatePropertyModal}
                        addButtonLabel="Add New Property"
                        emptyText={
                          isPropertyLookupLoading ? "Loading properties..." : "No properties found."
                        }
                      />
                      {isLinkingProperty ? (
                        <div className="mt-2 text-xs text-slate-500">Linking selected property...</div>
                      ) : null}
                    </div>
                    {!resolvedPropertyId ? (
                      <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                        No property
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-end">
                          <Button size="sm" variant="outline" onClick={openEditPropertyModal}>
                            Edit Property
                          </Button>
                        </div>
                        <InquirySubAccordion
                          title="Address"
                          isOpen={!collapsedPropertySections.address}
                          onToggle={() => togglePropertySection("address")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem
                              label="Property Name"
                              value={resolvedProperty?.property_name || resolvedProperty?.Property_Name}
                            />
                            <InlineInfoItem
                              label="Address 1"
                              value={resolvedProperty?.address_1 || resolvedProperty?.Address_1}
                            />
                            <InlineInfoItem
                              label="Address 2"
                              value={resolvedProperty?.address_2 || resolvedProperty?.Address_2}
                            />
                            <InlineInfoItem
                              label="Suburb / Town"
                              value={resolvedProperty?.suburb_town || resolvedProperty?.Suburb_Town}
                            />
                            <InlineInfoItem label="State" value={resolvedProperty?.state || resolvedProperty?.State} />
                            <InlineInfoItem
                              label="Postal Code"
                              value={resolvedProperty?.postal_code || resolvedProperty?.Postal_Code}
                            />
                          </div>
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Building Details"
                          isOpen={!collapsedPropertySections.building}
                          onToggle={() => togglePropertySection("building")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem
                              label="Property Type"
                              value={resolvedProperty?.property_type || resolvedProperty?.Property_Type}
                            />
                            <InlineInfoItem
                              label="Building Type"
                              value={resolvedProperty?.building_type || resolvedProperty?.Building_Type}
                            />
                            <InlineInfoItem
                              label="Building Type Other"
                              value={
                                resolvedProperty?.building_type_other ||
                                resolvedProperty?.Building_Type_Other
                              }
                            />
                            <InlineInfoItem
                              label="Foundation Type"
                              value={resolvedProperty?.foundation_type || resolvedProperty?.Foundation_Type}
                            />
                            <InlineInfoItem
                              label="Bedrooms"
                              value={resolvedProperty?.bedrooms || resolvedProperty?.Bedrooms}
                            />
                            <InlineInfoItem
                              label="Manhole"
                              value={
                                resolvedProperty?.manhole === true ||
                                String(
                                  resolvedProperty?.manhole ?? resolvedProperty?.Manhole ?? ""
                                ).toLowerCase() === "true"
                                  ? "Yes"
                                  : resolvedProperty?.manhole === false ||
                                      String(
                                        resolvedProperty?.manhole ?? resolvedProperty?.Manhole ?? ""
                                      ).toLowerCase() === "false"
                                    ? "No"
                                    : "—"
                              }
                            />
                            <InlineInfoItem
                              label="Stories"
                              value={resolvedProperty?.stories || resolvedProperty?.Stories}
                            />
                            <InlineInfoItem
                              label="Building Age"
                              value={resolvedProperty?.building_age || resolvedProperty?.Building_Age}
                            />
                          </div>
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Features"
                          isOpen={!collapsedPropertySections.features}
                          onToggle={() => togglePropertySection("features")}
                        >
                          <LongTextRow label="Building Features" value={getPropertyFeatureText(resolvedProperty)} />
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Property Contacts"
                          isOpen={!collapsedPropertySections.contacts}
                          onToggle={() => togglePropertySection("contacts")}
                        >
                          <div className="rounded border border-slate-200 bg-white">
                            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                              <div className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                                Property Contacts
                              </div>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={openAddAffiliationModal}
                                disabled={!resolvedPropertyId}
                              >
                                Add Property Contact
                              </Button>
                            </div>
                            {isAffiliationsLoading ? (
                              <div className="px-3 py-4 text-sm text-slate-500">Loading property contacts...</div>
                            ) : affiliationsError ? (
                              <div className="px-3 py-4 text-sm text-red-600">{affiliationsError}</div>
                            ) : affiliations.length ? (
                              <div className="max-h-56 overflow-auto">
                                <table className="table-fixed w-full text-left text-sm text-slate-600">
                                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                                    <tr>
                                      <th className="w-1/5 px-2 py-2">Primary</th>
                                      <th className="w-1/5 px-2 py-2">Role</th>
                                      <th className="w-1/5 px-2 py-2">Contact</th>
                                      <th className="w-1/5 px-2 py-2">Company</th>
                                      <th className="w-1/5 px-2 py-2 text-right">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {affiliations.map((affiliation) => (
                                      <tr
                                        key={toText(affiliation?.id)}
                                        data-ann-kind="affiliation"
                                        data-ann-id={toText(affiliation?.id)}
                                        data-ann-highlighted={
                                          isFocusedEntity("affiliation", toText(affiliation?.id))
                                            ? "true"
                                            : "false"
                                        }
                                        className={`border-b border-slate-100 last:border-b-0 ${
                                          isFocusedEntity("affiliation", toText(affiliation?.id))
                                            ? "bg-amber-50"
                                            : ""
                                        }`}
                                      >
                                        <td className="px-2 py-3">
                                          <span
                                            className="inline-flex items-center"
                                            title={isPrimaryAffiliation(affiliation) ? "Primary" : "Not Primary"}
                                          >
                                            <StarIcon active={isPrimaryAffiliation(affiliation)} />
                                          </span>
                                        </td>
                                        <td className="px-2 py-3">{toText(affiliation?.role) || "-"}</td>
                                        <td className="px-2 py-3">
                                          {getAffiliationContactName(affiliation) !== "-"
                                            ? getAffiliationContactName(affiliation)
                                            : fullName(
                                                contactLookupById.get(toText(affiliation?.contact_id))?.first_name,
                                                contactLookupById.get(toText(affiliation?.contact_id))?.last_name
                                              ) || "-"}
                                        </td>
                                        <td className="px-2 py-3">
                                          {getAffiliationCompanyName(affiliation) !== "-"
                                            ? getAffiliationCompanyName(affiliation)
                                            : toText(companyLookupById.get(toText(affiliation?.company_id))?.name) || "-"}
                                        </td>
                                        <td className="px-2 py-3 text-right">
                                          <div className="flex w-full items-center justify-end gap-2">
                                            <button
                                              type="button"
                                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                                              onClick={() => openEditAffiliationModal(affiliation)}
                                              aria-label="Edit property contact"
                                              title="Edit"
                                            >
                                              <EditIcon />
                                            </button>
                                            <button
                                              type="button"
                                              className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                                              onClick={() => setDeleteAffiliationTarget(affiliation)}
                                              aria-label="Delete property contact"
                                              title="Delete"
                                            >
                                              <TrashIcon />
                                            </button>
                                          </div>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <div className="px-3 py-4 text-sm text-slate-500">No property contacts yet.</div>
                            )}
                          </div>
                        </InquirySubAccordion>
                      </>
                    )}
                </div>
                ) : null}
              </article>

              <article className="min-w-0 overflow-hidden rounded border bg-white" style={quoteCardTheme.wrapperStyle}>
                <button
                  type="button"
                  className={`flex w-full items-center justify-between px-4 py-3 text-left ${
                    collapsedCards.job ? "" : "border-b"
                  }`}
                  style={quoteCardTheme.headerStyle}
                  onClick={() => toggleCardCollapse("job")}
                  aria-expanded={!collapsedCards.job}
                  aria-label={collapsedCards.job ? "Expand job details" : "Collapse job details"}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base" style={quoteCardTheme.accentStyle}>◉</span>
                    <h2 className="text-sm font-semibold" style={quoteCardTheme.accentStyle}>
                      Job / Quote / Payment
                    </h2>
                  </div>
                  <span className="text-xs font-semibold" style={quoteCardTheme.accentStyle}>
                    {collapsedCards.job ? "⌄" : "⌃"}
                  </span>
                </button>

                {!collapsedCards.job ? (
                <div className="p-4">
                    {job ? (
                      <div className="space-y-2">
                        <div className="rounded border border-slate-200 bg-slate-50 p-3">
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
                            Quote Workflow
                          </div>
                          {quoteStatusNormalized === "accepted" ? (
                            <div className="flex flex-wrap gap-1.5">
                              <InlineInfoItem
                                label={isCompanyAccount ? "Job Email Company" : "Job Email Contact"}
                                value={resolvedJobEmailSelectionLabel || selectedJobEmailContactId || "-"}
                              />
                              <InlineInfoItem
                                label="Accounts Contact"
                                value={resolvedAccountsContactSelectionLabel || selectedAccountsContactId || "-"}
                              />
                            </div>
                          ) : (
                            <div className="space-y-3">
                              <div className="relative z-40">
                                <SearchDropdownInput
                                  label={isCompanyAccount ? "Job Email Company" : "Job Email Contact"}
                                  field="job_email_contact_search"
                                  value={jobEmailContactSearchValue}
                                  placeholder={isCompanyAccount ? "Search company" : "Search contact"}
                                  items={jobEmailItems}
                                  onValueChange={setJobEmailContactSearchValue}
                                  onSelect={(item) => {
                                    const nextId = toText(item?.id);
                                    setSelectedJobEmailContactId(nextId);
                                    setJobEmailContactSearchValue(item?.label || "");
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
                              <div className="relative z-30">
                                <SearchDropdownInput
                                  label="Accounts Contact"
                                  field="accounts_contact_search"
                                  value={accountsContactSearchValue}
                                  placeholder="Search property contact"
                                  items={affiliationItems}
                                  onValueChange={setAccountsContactSearchValue}
                                  onSelect={(item) => {
                                    const nextId = toText(item?.id);
                                    setSelectedAccountsContactId(nextId);
                                    setAccountsContactSearchValue(item?.label || "");
                                  }}
                                  hideAddAction
                                  emptyText={
                                    isAffiliationsLoading
                                      ? "Loading property contacts..."
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
                                onClick={handleSaveQuoteContacts}
                                disabled={isSavingQuoteContacts || quoteActionState.processing}
                              >
                                {isSavingQuoteContacts ? "Saving..." : "Save Contacts"}
                              </Button>
                            ) : null}
                            {canShowSendQuote ? (
                              <Button
                                variant="secondary"
                                onClick={handleSendQuote}
                                disabled={quoteActionState.processing || !selectedAccountsContactId}
                              >
                                {quoteActionLabel("send", "Send Quote", "Sending...")}
                              </Button>
                            ) : null}
                            {canShowAcceptQuote ? (
                              <Button
                                variant="secondary"
                                onClick={handleAcceptQuote}
                                disabled={quoteActionState.processing}
                              >
                                {quoteActionLabel("accept", "Accept Quote", "Accepting...")}
                              </Button>
                            ) : null}
                            {quoteStatusNormalized === "accepted" ? (
                              <span className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
                                Quote Accepted
                              </span>
                            ) : null}
                            <span className="text-xs text-slate-500">Current quote status: {quoteStatus || "New"}</span>
                          </div>
                        </div>
                        <InquirySubAccordion
                          title="Status"
                          isOpen={!collapsedJobSections.status}
                          onToggle={() => toggleJobSection("status")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem label="Job UID" value={job.unique_id || job.Unique_ID} mono />
                            <InlineStatusItem
                              label="Job Status"
                              value={jobStatus}
                              style={resolveStatusStyleNormalized(jobStatus)}
                            />
                            <InlineStatusItem label="Quote Status" value={quoteStatus} style={quoteStatusStyle} />
                            <InlineStatusItem
                              label="Payment Status"
                              value={paymentStatus}
                              style={resolveStatusStyleNormalized(paymentStatus)}
                            />
                          </div>
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Timeline"
                          isOpen={!collapsedJobSections.timeline}
                          onToggle={() => toggleJobSection("timeline")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem label="Created" value={formatDate(job.created_at || job.Date_Added)} />
                            <InlineInfoItem label="Quote Date" value={formatDate(job.quote_date || job.Quote_Date)} />
                            <InlineInfoItem
                              label="Quote Sent Date"
                              value={formatDate(job.date_quote_sent || job.Date_Quote_Sent)}
                            />
                            <InlineInfoItem
                              label="Quote Accepted Date"
                              value={formatDate(job.date_quoted_accepted || job.Date_Quoted_Accepted)}
                            />
                            <InlineInfoItem label="Invoice Date" value={formatDate(job.invoice_date || job.Invoice_Date)} />
                            <InlineInfoItem label="Due Date" value={formatDate(job.due_date || job.Due_Date)} />
                          </div>
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Invoice"
                          isOpen={!collapsedJobSections.invoice}
                          onToggle={() => toggleJobSection("invoice")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem label="Invoice #" value={job.invoice_number || job.Invoice_Number} mono />
                            <InlineInfoItem
                              label="Invoice Total"
                              value={formatCurrency(job.invoice_total || job.Invoice_Total)}
                            />
                          </div>
                        </InquirySubAccordion>
                        <InquirySubAccordion
                          title="Contacts"
                          isOpen={!collapsedJobSections.contacts}
                          onToggle={() => toggleJobSection("contacts")}
                        >
                          <div className="flex flex-wrap gap-1.5">
                            <InlineInfoItem label="Client Name" value={jobClient.name} />
                            <InlineInfoItem label="Phone" value={jobClient.phone} />
                            <InlineInfoItem label="Email" value={jobClient.email} />
                            <InlineInfoItem label="Provider" value={resolvedProviderName} />
                          </div>
                        </InquirySubAccordion>
                      </div>
                    ) : (
                      <div className="space-y-3 rounded border border-slate-200 bg-slate-50 px-3 py-6 text-sm text-slate-500">
                        <div>No linked job yet</div>
                        {inquiry ? (
                          <div>
                            <Button
                              variant="secondary"
                              onClick={handleCreateJob}
                              disabled={isCreatingJob || !allocatedProviderId}
                            >
                              {isCreatingJob ? "Creating Quote..." : "Create Quote"}
                            </Button>
                            {!allocatedProviderId ? (
                              <p className="mt-2 text-xs text-slate-500">
                                Allocate and submit a service provider to enable quote creation.
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    )}
                </div>
                ) : null}
              </article>
            </section>

            <section className="rounded border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center gap-2">
                {PAGE_TABS.map((tab) => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      className={`rounded px-3 py-1.5 text-sm font-medium ${
                        isActive
                          ? "bg-[#003882] text-white"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                      }`}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            </section>

            <JobDirectStoreProvider
              jobUid={jobDirectUid || null}
              jobData={jobDirectBootstrapJobData}
              lookupData={jobDirectLookupData}
            >
              <section className="space-y-4">
              {activeTab === "Overview" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">Overview Snapshot</h3>
                    <InfoRow label="Inquiry" value={inquiry?.unique_id || inquiry?.Unique_ID} mono />
                    <InfoRow label="Quote / Job" value={job?.unique_id || job?.Unique_ID} mono />
                    <InfoRow label="Inquiry Status" value={inquiryStatus} />
                    <InfoRow label="Quote Status" value={quoteStatus} />
                    <InfoRow label="Payment Status" value={paymentStatus} />
                    <InfoRow label="Property" value={resolvedProperty?.property_name || resolvedProperty?.Property_Name} />
                  </div>
                  <div className="rounded border border-slate-200 bg-white p-4">
                    <h3 className="mb-3 text-sm font-semibold text-slate-800">Recent Updates</h3>
                    <InfoRow label="Created" value={formatDate(inquiry?.created_at || inquiry?.Date_Added)} />
                    <InfoRow label="Quote Date" value={formatDate(job?.quote_date || job?.Quote_Date)} />
                    <InfoRow label="Quote Sent" value={formatDate(job?.date_quote_sent || job?.Date_Quote_Sent)} />
                    <InfoRow
                      label="Quote Accepted"
                      value={formatDate(job?.date_quoted_accepted || job?.Date_Quoted_Accepted)}
                    />
                    <InfoRow label="Invoice Date" value={formatDate(job?.invoice_date || job?.Invoice_Date)} />
                  </div>
                </div>
              ) : null}

              {activeTab === "Uploads" ? (
                <div
                  className={`rounded border border-slate-200 bg-white p-4 ${
                    focusedKind === "upload" ? "ring-2 ring-amber-300" : ""
                  }`}
                >
                  {!currentJobId && !inquiryId ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Uploads are available when inquiry or quote/job is linked.
                    </div>
                  ) : (
                    <UploadsSection
                      plugin={plugin}
                      uploadsMode={currentJobId ? "job" : "inquiry"}
                      jobData={currentJobId ? { id: currentJobId, ID: currentJobId } : { id: "", ID: "" }}
                      inquiryId={inquiryId}
                      inquiryUid={currentInquiryUniqueId}
                      linkedJobId={currentJobId}
                      highlightUploadId={focusedKind === "upload" ? focusedId : ""}
                      additionalCreatePayload={inquiryId ? { inquiry_id: inquiryId } : null}
                    />
                  )}
                </div>
              ) : null}

              {activeTab === "Appointments" ? (
                <div className="rounded border border-slate-200 bg-white p-4">
                  {!currentJobId && !inquiryId ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Appointments are available when inquiry or quote/job is linked.
                    </div>
                  ) : (
                    <AppointmentTabSection
                      plugin={plugin}
                      jobData={jobDirectBootstrapJobData || { id: currentJobId, ID: currentJobId }}
                      preloadedLookupData={jobDirectLookupData}
                      inquiryRecordId={inquiryId}
                      inquiryUid={currentInquiryUniqueId}
                      highlightAppointmentId={focusedKind === "appointment" ? focusedId : ""}
                    />
                  )}
                </div>
              ) : null}

              {activeTab === "Tasks" ? (
                <div className="rounded border border-slate-200 bg-white p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-slate-800">Tasks</h3>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setIsTasksModalOpen(true)}
                      disabled={!currentJobId && !inquiryId}
                    >
                      Manage Tasks
                    </Button>
                  </div>
                  {isTaskRowsLoading ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Loading tasks...
                    </div>
                  ) : taskRowsError ? (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                      {taskRowsError}
                    </div>
                  ) : taskRows.length ? (
                    <div className="max-h-80 overflow-auto rounded border border-slate-200">
                      <table className="w-full text-left text-sm text-slate-700">
                        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Subject</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Due</th>
                            <th className="px-3 py-2">Assignee</th>
                          </tr>
                        </thead>
                        <tbody>
                          {taskRows.map((task) => (
                            <tr
                              key={toText(task?.id || task?.ID)}
                              data-ann-kind="task"
                              data-ann-id={toText(task?.id || task?.ID)}
                              data-ann-highlighted={
                                isFocusedEntity("task", toText(task?.id || task?.ID))
                                  ? "true"
                                  : "false"
                              }
                              className={`border-b border-slate-100 last:border-b-0 ${
                                isFocusedEntity("task", toText(task?.id || task?.ID))
                                  ? "bg-amber-50"
                                  : ""
                              }`}
                            >
                              <td className="px-3 py-2">{toText(task?.subject || task?.Subject) || "-"}</td>
                              <td className="px-3 py-2">{toText(task?.status || task?.Status) || "-"}</td>
                              <td className="px-3 py-2">{formatDate(task?.date_due || task?.Date_Due)}</td>
                              <td className="px-3 py-2">
                                {fullName(
                                  task?.assignee_first_name || task?.Assignee_First_Name,
                                  task?.assignee_last_name || task?.Assignee_Last_Name
                                ) || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      No tasks found.
                    </div>
                  )}
                </div>
              ) : null}

              {activeTab === "Activities" ? (
                <div className="rounded border border-slate-200 bg-white p-4">
                  {!currentJobId ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Activities are available only after quote/job is created.
                    </div>
                  ) : isWorkSectionsLoading && !jobActivities.length ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Loading activities...
                    </div>
                  ) : workSectionsError && !jobActivities.length ? (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                      {workSectionsError}
                    </div>
                  ) : (
                    <AddActivitiesSection
                      plugin={plugin}
                      jobData={{ id: currentJobId, ID: currentJobId }}
                      highlightActivityId={focusedKind === "activity" ? focusedId : ""}
                    />
                  )}
                </div>
              ) : null}

              {activeTab === "Materials" ? (
                <div
                  className={`rounded border border-slate-200 bg-white p-4 ${
                    focusedKind === "material" ? "ring-2 ring-amber-300" : ""
                  }`}
                >
                  {!currentJobId ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Materials are available only after quote/job is created.
                    </div>
                  ) : isWorkSectionsLoading && !jobMaterials.length ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Loading materials...
                    </div>
                  ) : workSectionsError && !jobMaterials.length ? (
                    <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                      {workSectionsError}
                    </div>
                  ) : (
                    <AddMaterialsSection
                      plugin={plugin}
                      jobData={{ id: currentJobId, ID: currentJobId }}
                      preloadedLookupData={jobDirectLookupData}
                    />
                  )}
                </div>
              ) : null}

              {activeTab === "Invoice & Payment" ? (
                <div
                  className={`rounded border border-slate-200 bg-white p-4 ${
                    ["invoice", "bill", "payment", "invoice_send"].includes(focusedKind)
                      ? "ring-2 ring-amber-300"
                      : ""
                  }`}
                >
                  {!currentJobId ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Invoice and payment are available only after quote/job is created.
                    </div>
                  ) : quoteStatusNormalized !== "accepted" ? (
                    <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Invoice and payment unlock only after quote is accepted.
                    </div>
                  ) : (
                    <InvoiceSection
                      plugin={plugin}
                      jobData={jobDirectBootstrapJobData || { id: currentJobId, ID: currentJobId }}
                    />
                  )}
                </div>
              ) : null}

              </section>
            </JobDirectStoreProvider>
          </div>
        </div>
      </div>

      <div className="pointer-events-none fixed bottom-5 right-6 z-[60] flex flex-col items-end gap-3">
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
                  Memos are available when inquiry or quote/job is linked.
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
                      data-ann-kind="post"
                      data-ann-id={memoId}
                      data-ann-highlighted={isFocusedEntity("post", memoId) ? "true" : "false"}
                      className={`rounded-lg border px-2.5 py-2 ${
                        isFocusedEntity("post", memoId)
                          ? "border-amber-300 bg-amber-50"
                          : memoIsMine
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
                                data-ann-kind="comment"
                                data-ann-id={replyId}
                                data-ann-highlighted={
                                  isFocusedEntity("comment", replyId) ? "true" : "false"
                                }
                                className={`rounded border px-2 py-1.5 ${
                                  isFocusedEntity("comment", replyId)
                                    ? "border-amber-300 bg-amber-50"
                                    : "border-slate-200 bg-slate-50"
                                }`}
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
                    <span className="max-w-[150px] truncate text-[11px] text-slate-500">{memoFile.name}</span>
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

      <AddPropertyModal
        open={isAddPropertyOpen}
        onClose={() => setIsAddPropertyOpen(false)}
        onSave={handleAddPropertySave}
        initialData={propertyModalMode === "edit" && resolvedPropertyId ? resolvedProperty : null}
      />

      <Modal
        open={affiliationModalState.open}
        onClose={closeAffiliationModal}
        title={toText(affiliationForm.id) ? "Edit Property Contact" : "Add Property Contact"}
        widthClass="max-w-3xl"
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={closeAffiliationModal} disabled={isAffiliationSaving}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSaveAffiliationForm} disabled={isAffiliationSaving}>
              {isAffiliationSaving
                ? "Saving..."
                : toText(affiliationForm.id)
                  ? "Update Contact"
                  : "Save Contact"}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium leading-4 text-neutral-700">Role</label>
            <input
              type="text"
              value={affiliationForm.role}
              onChange={(event) =>
                setAffiliationForm((previous) => ({ ...previous, role: event.target.value }))
              }
              placeholder="Owner, Resident, Property Manager"
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(affiliationForm.is_primary)}
              onChange={(event) =>
                setAffiliationForm((previous) => ({
                  ...previous,
                  is_primary: event.target.checked,
                }))
              }
            />
            Is Primary?
          </label>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <SearchDropdownInput
              label="Contact"
              field="property_affiliation_contact"
              value={affiliationForm.contact_label}
              placeholder="Search contact"
              items={contactItems}
              onValueChange={(value) =>
                setAffiliationForm((previous) => ({
                  ...previous,
                  contact_label: value,
                  contact_id: "",
                }))
              }
              onSelect={(item) =>
                setAffiliationForm((previous) => ({
                  ...previous,
                  contact_id: toText(item?.id),
                  contact_label: toText(item?.label),
                }))
              }
              onAdd={handleAddAffiliationContact}
              addButtonLabel="Add New Contact"
              emptyText={isContactLookupLoading ? "Loading contacts..." : "No contacts found."}
            />
            <SearchDropdownInput
              label="Company"
              field="property_affiliation_company"
              value={affiliationForm.company_label}
              placeholder="Search company"
              items={companyItems}
              onValueChange={(value) =>
                setAffiliationForm((previous) => ({
                  ...previous,
                  company_label: value,
                  company_id: "",
                }))
              }
              onSelect={(item) =>
                setAffiliationForm((previous) => ({
                  ...previous,
                  company_id: toText(item?.id),
                  company_label: toText(item?.label),
                  ...(previous.same_as_company
                    ? {
                        company_as_accounts_contact_id: toText(item?.id),
                        company_as_accounts_contact_label: toText(item?.label),
                      }
                    : {}),
                }))
              }
              onAdd={handleAddAffiliationCompany}
              addButtonLabel="Add New Company"
              emptyText={isCompanyLookupLoading ? "Loading companies..." : "No companies found."}
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={Boolean(affiliationForm.same_as_company)}
              onChange={(event) =>
                setAffiliationForm((previous) => {
                  const checked = event.target.checked;
                  return {
                    ...previous,
                    same_as_company: checked,
                    company_as_accounts_contact_id: checked ? previous.company_id : "",
                    company_as_accounts_contact_label: checked ? previous.company_label : "",
                  };
                })
              }
            />
            Company as accounts contact?
          </label>
          <SearchDropdownInput
            label="Company as Accounts Contact"
            field="property_affiliation_accounts_company"
            value={affiliationForm.company_as_accounts_contact_label}
            placeholder="Search company"
            items={companyItems}
            onValueChange={(value) =>
              setAffiliationForm((previous) => ({
                ...previous,
                company_as_accounts_contact_label: value,
                company_as_accounts_contact_id: "",
                same_as_company: false,
              }))
            }
            onSelect={(item) =>
              setAffiliationForm((previous) => ({
                ...previous,
                company_as_accounts_contact_id: toText(item?.id),
                company_as_accounts_contact_label: toText(item?.label),
                same_as_company: toText(previous.company_id) === toText(item?.id),
              }))
            }
            onAdd={handleAddAffiliationCompany}
            addButtonLabel="Add New Company"
            emptyText={isCompanyLookupLoading ? "Loading companies..." : "No companies found."}
            hideAddAction={Boolean(affiliationForm.same_as_company)}
          />
        </div>
      </Modal>

      <ContactDetailsModal
        open={contactModalState.open}
        onClose={closeContactDetailsModal}
        mode={contactModalState.mode}
        onSave={contactModalState.onSave}
      />

      <TasksModal
        open={isTasksModalOpen}
        onClose={() => {
          setIsTasksModalOpen(false);
          if (!plugin || (!currentJobId && !inquiryId)) return;
          fetchTasksForDetails({
            plugin,
            jobId: currentJobId,
            inquiryId,
          })
            .then((rows) => setTaskRows(Array.isArray(rows) ? rows : []))
            .catch((loadError) => {
              console.error("[JobDetails] Failed to refresh tasks", loadError);
            });
        }}
        plugin={plugin}
        jobData={{
          ...(job || {}),
          ...(inquiry || {}),
          inquiry_record_id:
            inquiryId ||
            toText(job?.inquiry_record_id || job?.Inquiry_Record_ID),
          deal_id: inquiryId,
          quote_record_id: toText(
            inquiry?.quote_record_id ||
              inquiry?.Quote_Record_ID ||
              inquiry?.Quote_record_ID
          ),
          inquiry_for_job_id: toText(
            inquiry?.inquiry_for_job_id ||
              inquiry?.Inquiry_For_Job_ID ||
              inquiry?.Inquiry_for_Job_ID
          ),
        }}
        contextType={currentJobId ? "job" : "deal"}
        contextId={currentJobId || inquiryId}
        additionalCreatePayload={{
          ...(currentJobId ? { job_id: currentJobId, Job_id: currentJobId } : {}),
          ...(inquiryId ? { deal_id: inquiryId, Deal_id: inquiryId } : {}),
        }}
        additionalUpdatePayload={{
          ...(currentJobId ? { job_id: currentJobId, Job_id: currentJobId } : {}),
          ...(inquiryId ? { deal_id: inquiryId, Deal_id: inquiryId } : {}),
        }}
        onTasksChanged={handleTasksChanged}
      />

      <Modal
        open={Boolean(deleteAffiliationTarget)}
        onClose={() => {
          if (isDeletingAffiliation) return;
          setDeleteAffiliationTarget(null);
        }}
        title="Delete Property Contact"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteAffiliationTarget(null)}
              disabled={isDeletingAffiliation}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteAffiliation}
              disabled={isDeletingAffiliation}
            >
              {isDeletingAffiliation ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this property contact?
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteUploadTarget)}
        onClose={() => {
          if (isDeletingUpload) return;
          setDeleteUploadTarget(null);
        }}
        title="Delete Upload"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteUploadTarget(null)}
              disabled={isDeletingUpload}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteUpload}
              disabled={isDeletingUpload}
            >
              {isDeletingUpload ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this upload?
        </p>
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
              variant="ghost"
              onClick={() => setMemoDeleteTarget(null)}
              disabled={isDeletingMemoItem}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
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

      <input
        ref={uploadsInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleUploadFilesSelected}
      />

      <DealInformationModal
        open={isDealInfoOpen}
        onClose={() => setIsDealInfoOpen(false)}
        plugin={plugin}
        jobData={dealModalJobData}
      />
    </div>
  );
}
