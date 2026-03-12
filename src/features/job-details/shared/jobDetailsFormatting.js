import {
  fullName,
  toBoolean,
  toText,
} from "@shared/utils/formatters.js";

export function parseDateLikeValue(value) {
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

export function formatDateDisplay(value) {
  const parsed = parseDateLikeValue(value);
  if (!parsed) return "";
  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function pickBooleanValue(record = {}, keys = []) {
  for (const key of Array.isArray(keys) ? keys : []) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) continue;
    return toBoolean(record?.[key]);
  }
  return false;
}

export function toAffiliationOption(affiliation = {}) {
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

export function escapeHtml(value) {
  const text = toText(value);
  if (!text) return "";
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatCurrencyDisplay(value) {
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
