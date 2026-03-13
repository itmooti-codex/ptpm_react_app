import { formatActivityServiceLabel, toText } from "@shared/utils/formatters.js";
import {
  PAYMENT_STATUS_OPTIONS,
  XERO_BILL_STATUS_OPTIONS,
  XERO_INVOICE_STATUS_OPTIONS,
} from "../../../constants/options.js";

export function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

export function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

export function formatCurrency(value) {
  return Number(value || 0).toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function toDateInput(value) {
  const text = toText(value);
  if (!text) return "";

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric)) {
      const asMs = String(Math.abs(numeric)).length <= 10 ? numeric * 1000 : numeric;
      const date = new Date(asMs);
      if (!Number.isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toEpochSecondsFromDateInput(value) {
  const text = toText(value);
  if (!text) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T00:00:00` : text;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

export function formatDateDisplay(value) {
  const iso = toDateInput(value);
  if (!iso) return "-";
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatDateTimeDisplay(value) {
  const text = toText(value);
  if (!text) return "-";

  let date = null;
  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (Number.isFinite(numeric)) {
      const asMs = String(Math.abs(numeric)).length <= 10 ? numeric * 1000 : numeric;
      date = new Date(asMs);
    }
  } else {
    date = new Date(text);
  }

  if (!date || Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

export function normalizeStatus(value = "") {
  return String(value || "").trim().toLowerCase();
}

export function resolveStatusOption(options = [], value = "") {
  const key = normalizeStatus(value);
  if (!key) return null;
  return (
    options.find((item) => normalizeStatus(item?.value) === key) ||
    options.find((item) => normalizeStatus(item?.label) === key) ||
    null
  );
}

export function isTrue(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeStatus(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function lineAmount(record) {
  const quantity = Math.max(1, toNumber(record?.quantity || 1));
  const price = toNumber(record?.activity_price || record?.quoted_price || 0);
  return round2(quantity * price);
}

export function createStatusStyle(option) {
  if (!option) return undefined;
  return {
    color: option.color,
    backgroundColor: option.backgroundColor,
  };
}

export function statusWithFallback(status, palette) {
  const raw = toText(status);
  if (!raw) {
    return {
      label: "Not Synced",
      style: createStatusStyle(resolveStatusOption(palette, "Not Synced")),
    };
  }
  const option = resolveStatusOption(palette, raw);
  return {
    label: option?.label || raw,
    style: createStatusStyle(option),
  };
}

export function statusFromRawValue(status, palette) {
  const raw = toText(status);
  if (!raw) {
    return {
      label: "--",
      style: {
        color: "#475569",
        backgroundColor: "#f1f5f9",
      },
    };
  }
  const option = resolveStatusOption(palette, raw);
  return {
    label: option?.label || raw,
    style: option
      ? createStatusStyle(option)
      : {
          color: "#475569",
          backgroundColor: "#f1f5f9",
        },
  };
}

export function resolveApiResponseTone(responseText = "") {
  const text = normalizeStatus(responseText);
  if (!text) {
    return {
      tone: "idle",
      className: "border-slate-200 bg-slate-50 text-slate-700",
      title: "Xero API Response",
    };
  }
  if (/error|fail|failed|invalid|unable|cancel|denied|rejected/.test(text)) {
    return {
      tone: "error",
      className: "border-red-200 bg-red-50 text-red-700",
      title: "Xero API Response (Error)",
    };
  }
  if (/pending|processing|in progress|queued|wait/.test(text)) {
    return {
      tone: "pending",
      className: "border-amber-200 bg-amber-50 text-amber-800",
      title: "Xero API Response (Processing)",
    };
  }
  if (/success|created|updated|complete|completed|ok/.test(text)) {
    return {
      tone: "success",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      title: "Xero API Response (Success)",
    };
  }
  return {
    tone: "info",
    className: "border-sky-200 bg-sky-50 text-sky-800",
    title: "Xero API Response",
  };
}

export function collectMaterialSummary(materials = []) {
  return (Array.isArray(materials) ? materials : []).reduce(
    (acc, item) => {
      const total = toNumber(item?.total || item?.Total);
      const transactionType = normalizeStatus(item?.transaction_type || item?.Transaction_Type);
      if (transactionType === "reimburse") acc.reimburse += total;
      if (transactionType === "deduct") acc.deduct += total;
      return acc;
    },
    { reimburse: 0, deduct: 0 }
  );
}

export function hasRenderableActivityRecord(record = {}) {
  if (!record || typeof record !== "object") return false;
  const task = toText(record?.task || record?.Task);
  const option = toText(record?.option || record?.Option);
  const serviceName = formatActivityServiceLabel(record);
  const activityText = toText(record?.activity_text || record?.Activity_Text);
  const note = toText(record?.note || record?.Note);
  const warranty = toText(record?.warranty || record?.Warranty);
  const quantity = toNumber(record?.quantity || record?.Quantity || 0);
  const price = toNumber(record?.activity_price || record?.Activity_Price || record?.quoted_price || 0);

  return Boolean(
    task ||
      option ||
      serviceName ||
      activityText ||
      note ||
      warranty ||
      quantity > 0 ||
      price > 0
  );
}

export function activityTaskGroupKey(record = {}) {
  return normalizeStatus(record?.task || record?.Task);
}

export function normalizeSelectedActivityIdsByTask(selectedIds = [], activities = []) {
  const uniqueIds = Array.from(
    new Set((selectedIds || []).map((value) => toText(value)).filter(Boolean))
  );
  if (!uniqueIds.length) return [];

  const activityById = new Map();
  (Array.isArray(activities) ? activities : []).forEach((record) => {
    const id = toText(record?.id || record?.ID);
    if (!id) return;
    activityById.set(id, record);
  });

  const seenTaskGroups = new Set();
  const normalized = [];
  uniqueIds.forEach((id) => {
    const record = activityById.get(id);
    const groupKey = activityTaskGroupKey(record);
    if (groupKey && seenTaskGroups.has(groupKey)) return;
    if (groupKey) seenTaskGroups.add(groupKey);
    normalized.push(id);
  });
  return normalized;
}

export function areTextArraysEqual(a = [], b = []) {
  if (a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) {
    if (toText(a[index]) !== toText(b[index])) return false;
  }
  return true;
}

export function buildAccountSummary(job = {}) {
  const accountType =
    normalizeStatus(job?.account_type || job?.Account_Type) === "company"
      ? "Company"
      : "Contact";
  const accountsContact = job?.Accounts_Contact?.Contact || {};
  const accountsContactFirstName = toText(
    job?.accounts_contact_contact_first_name ||
      job?.Accounts_Contact_Contact_First_Name ||
      job?.Contact_First_Name ||
      job?.Contact_First_Name1 ||
      accountsContact?.first_name ||
      accountsContact?.First_Name
  );
  const accountsContactLastName = toText(
    job?.accounts_contact_contact_last_name ||
      job?.Accounts_Contact_Contact_Last_Name ||
      job?.Contact_Last_Name ||
      job?.Contact_Last_Name1 ||
      accountsContact?.last_name ||
      accountsContact?.Last_Name
  );
  const accountsContactName = [accountsContactFirstName, accountsContactLastName]
    .filter(Boolean)
    .join(" ")
    .trim();
  const accountsContactEmail = toText(
    job?.accounts_contact_contact_email ||
      job?.Accounts_Contact_Contact_Email ||
      job?.ContactEmail ||
      job?.ContactEmail1 ||
      accountsContact?.email ||
      accountsContact?.Email
  );

  return {
    accountType,
    accountName: accountsContactName || "--",
    accountEmail: accountsContactEmail || "--",
    accountId:
      accountType === "Company"
        ? normalizeId(job?.client_entity_id || job?.Client_Entity_ID)
        : normalizeId(job?.client_individual_id || job?.Client_Individual_ID),
    accountsContactId:
      normalizeId(job?.accounts_contact_id || job?.Accounts_Contact_ID) ||
      normalizeId(job?.contact_id || job?.Contact_ID) ||
      normalizeId(job?.client_individual_id || job?.Client_Individual_ID) ||
      "",
    contactXeroId: toText(job?.client_individual_xero_contact_id || job?.Client_Individual_Xero_Contact_ID),
    companyXeroId: toText(job?.client_entity_xero_contact_id || job?.Client_Entity_Xero_Contact_ID),
  };
}

export function buildServiceProviderSummary(job = {}) {
  const firstName = toText(
    job?.primary_service_provider_contact_first_name ||
      job?.Primary_Service_Provider_Contact_First_Name ||
      job?.Contact_First_Name1 ||
      job?.Contact_First_Name2 ||
      job?.Primary_Service_Provider?.Contact_Information?.first_name ||
      job?.Primary_Service_Provider?.Contact_Information?.First_Name
  );
  const lastName = toText(
    job?.primary_service_provider_contact_last_name ||
      job?.Primary_Service_Provider_Contact_Last_Name ||
      job?.Contact_Last_Name1 ||
      job?.Contact_Last_Name2 ||
      job?.Primary_Service_Provider?.Contact_Information?.last_name ||
      job?.Primary_Service_Provider?.Contact_Information?.Last_Name
  );
  const email = toText(
    job?.primary_service_provider_contact_email ||
      job?.Primary_Service_Provider_Contact_Email ||
      job?.ContactEmail1 ||
      job?.ContactEmail2 ||
      job?.Primary_Service_Provider?.Contact_Information?.email ||
      job?.Primary_Service_Provider?.Contact_Information?.Email
  );
  const id = normalizeId(
    job?.primary_service_provider_id ||
      job?.Primary_Service_Provider_ID ||
      job?.Primary_Service_Provider?.id ||
      job?.Primary_Service_Provider?.ID
  );
  const label =
    [firstName, lastName].filter(Boolean).join(" ").trim() ||
    email ||
    (id ? `Provider #${id}` : "--");

  return {
    id,
    firstName,
    lastName,
    email,
    label,
  };
}

export { PAYMENT_STATUS_OPTIONS, XERO_BILL_STATUS_OPTIONS, XERO_INVOICE_STATUS_OPTIONS };
