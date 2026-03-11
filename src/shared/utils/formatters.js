/**
 * Shared formatting and display utilities used across features.
 */

export function toText(value) {
  return String(value ?? "").trim();
}

export function toBoolean(value) {
  if (value === true || value === false) return value;
  const text = toText(value).toLowerCase();
  if (!text) return false;
  if (text === "true" || text === "1" || text === "yes" || text === "y") return true;
  if (text === "false" || text === "0" || text === "no" || text === "n") return false;
  return Boolean(value);
}

export function fullName(firstName, lastName) {
  return [toText(firstName), toText(lastName)].filter(Boolean).join(" ").trim();
}

export function joinAddress(parts = []) {
  const cleaned = (Array.isArray(parts) ? parts : []).map((v) => toText(v)).filter(Boolean);
  return cleaned.length ? cleaned.join(", ") : "";
}

export function compactStringFields(source = {}) {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const trimmed = toText(value);
    if (trimmed) output[key] = trimmed;
  });
  return output;
}

export function toMailHref(value) {
  const text = toText(value);
  return text ? `mailto:${text}` : "";
}

export function toTelHref(value) {
  const text = toText(value);
  if (!text) return "";
  const normalized = text.replace(/[^\d+]+/g, "");
  return normalized ? `tel:${normalized}` : "";
}

export function toGoogleMapsHref(value) {
  const text = toText(value);
  if (!text || text === "—") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export function normalizeStatus(value) {
  return toText(value).toLowerCase();
}

export function formatDate(value) {
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

export function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "—";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(value) {
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

export function getAuthorName(author = {}) {
  return (
    toText(author?.display_name || author?.Display_Name) ||
    [
      toText(author?.first_name || author?.First_Name),
      toText(author?.last_name || author?.Last_Name),
    ]
      .filter(Boolean)
      .join(" ")
      .trim() ||
    "Unknown"
  );
}

export function dedupeById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((record, index) => {
    const key = toText(record?.id || record?.ID) || `idx-${index}`;
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function parseJsonLike(value) {
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

export function unwrapRelationRecord(value) {
  if (Array.isArray(value)) {
    return value.find((item) => item && typeof item === "object") || null;
  }
  return value && typeof value === "object" ? value : null;
}

export function getActivityServiceParts(activity = {}) {
  const service = unwrapRelationRecord(activity?.Service || activity?.service);
  const primaryService = unwrapRelationRecord(
    service?.Primary_Service ||
      service?.primary_service ||
      activity?.Primary_Service ||
      activity?.primary_service
  );

  return {
    service,
    primaryService,
    serviceName: toText(
      activity?.service_name ||
        activity?.Service_Service_Name ||
        service?.service_name ||
        service?.Service_Name ||
        service?.name
    ),
    primaryServiceName: toText(
      activity?.primary_service_name ||
        activity?.Primary_Service_Name ||
        activity?.Service_Service_Name1 ||
        primaryService?.service_name ||
        primaryService?.Service_Name ||
        primaryService?.name
    ),
  };
}

export function formatActivityServiceLabel(activity = {}, { separator = " - " } = {}) {
  const { serviceName, primaryServiceName } = getActivityServiceParts(activity);
  const labels = [];

  [serviceName, primaryServiceName].forEach((value) => {
    const label = toText(value);
    if (label && !labels.includes(label)) labels.push(label);
  });

  return labels.join(separator);
}

function isPlaceholderAttachmentValue(value) {
  const normalized = toText(value).toLowerCase();
  return (
    !normalized ||
    normalized === "-" ||
    normalized === "—" ||
    normalized === "null" ||
    normalized === "undefined" ||
    normalized === '""' ||
    normalized === "''" ||
    normalized === "{}" ||
    normalized === "[]"
  );
}

export function getMemoFileMeta(input) {
  if (!input) return null;
  if (typeof input === "string") {
    const parsed = parseJsonLike(input);
    if (parsed !== null) return getMemoFileMeta(parsed);
    const link = toText(input);
    if (isPlaceholderAttachmentValue(link)) return null;
    return { link, name: link.split("/").filter(Boolean).pop() || "Attachment", size: "", type: "" };
  }
  if (typeof input === "object") {
    if (Array.isArray(input)) {
      const first = input.find(Boolean);
      return first ? getMemoFileMeta(first) : null;
    }
    if (input.fileObject) return getMemoFileMeta(input.fileObject);
    const link = toText(input.link || input.url || input.path);
    if (isPlaceholderAttachmentValue(link)) return null;
    return {
      link,
      name: toText(input.name || input.filename) || link.split("/").filter(Boolean).pop() || "Attachment",
      size: input.size || "",
      type: toText(input.type || input.mime),
    };
  }
  return null;
}

export function mergeMemosPreservingComments(previous = [], next = []) {
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
    return { ...memo, ForumComments: previousComments };
  });
}

export function formatServiceProviderAllocationLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  return `${resolvedName} [${email || "-"}] | [${phone || "-"}]`;
}

export function formatServiceProviderInputLabel(provider = {}) {
  const id = toText(provider?.id || provider?.ID);
  const name = fullName(provider?.first_name, provider?.last_name);
  const email = toText(provider?.work_email || provider?.Work_Email || provider?.email);
  const phone = toText(provider?.mobile_number || provider?.Mobile_Number || provider?.sms_number);
  const resolvedName = name || email || (id ? `Provider #${id}` : "Provider");
  const metadata = [email, phone].filter(Boolean).join(" | ");
  return metadata ? `${resolvedName} [${metadata}]` : resolvedName;
}

export function formatContactLookupLabel(contact = {}) {
  const id = toText(contact?.id || contact?.ID || contact?.Contact_ID);
  const name = fullName(
    contact?.first_name || contact?.First_Name,
    contact?.last_name || contact?.Last_Name
  );
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

export function isMissingFieldValue(value) {
  const text = toText(value);
  return !text || text === "—" || text === "-";
}

export function formatCompanyLookupLabel(company = {}) {
  const id = toText(company?.id || company?.ID || company?.Company_ID);
  const name = toText(company?.name || company?.Name);
  const phone = toText(company?.phone || company?.Phone);
  const accountType = toText(company?.account_type || company?.Account_Type);
  const resolvedName = name || (id ? `Company #${id}` : "Company");
  const metadata = [accountType, phone].filter(Boolean).join(" | ");
  return metadata ? `${resolvedName} [${metadata}]` : resolvedName;
}
