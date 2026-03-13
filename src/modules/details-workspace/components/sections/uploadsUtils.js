import {
  FORM_KIND_CONFIG,
  PCA_CHECKBOX_FIELDS,
  PCA_DATETIME_FIELDS,
  PCA_FORM_KIND,
  PCA_NUMBER_FIELDS,
  PCA_TEXT_FIELDS,
  PRESTART_CHECKBOX_FIELDS,
  PRESTART_FORM_KIND,
  PRESTART_TEXT_FIELDS,
  UPLOADS_CACHE_KEY_PREFIX,
  UPLOADS_CACHE_TTL_MS,
} from "./uploadsConstants.js";
import { toText } from "../../../../shared/utils/formatters.js";

export function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = toText(value).toLowerCase();
  if (!normalized) return false;
  return ["1", "true", "yes", "y", "checked", "on"].includes(normalized);
}

export function toNumberString(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? String(parsed) : "";
}

export function formatDateDisplay(value = null) {
  const date = value instanceof Date ? value : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export function parseUnixValue(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  if (String(Math.trunc(Math.abs(numeric))).length <= 10) {
    return Math.trunc(numeric);
  }
  return Math.trunc(numeric / 1000);
}

export function formatDateTimeLocalInput(value = "") {
  const raw = value ?? "";
  const unix = parseUnixValue(raw);
  const date = unix === null ? new Date(raw) : new Date(unix * 1000);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function parseDateTimeInputToUnix(value = "") {
  const normalized = toText(value);
  if (!normalized) return null;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

export function buildUploadFormDisplayName(kind = PRESTART_FORM_KIND, date = null) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  return `${config.shortLabel} ${formatDateDisplay(date)}`.trim();
}

export function humanizeFieldLabel(fieldName = "") {
  const normalized = toText(fieldName);
  if (!normalized) return "";
  const withoutIndexPrefix = normalized.replace(/^f_\d+_/i, "");
  const withSpaces = withoutIndexPrefix.replaceAll("_", " ");
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

export function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) && value !== 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return toText(value).length > 0;
}

export function resolveUploadDisplayName(record = null) {
  return String(record?.name || record?.file_name || record?.title || "Upload").trim() || "Upload";
}

export function resolveUploadExtension(record = null) {
  const explicitType = String(record?.type || "").trim().toLowerCase();
  const fromName = resolveUploadDisplayName(record).split(".").pop() || "";
  if (fromName && fromName !== resolveUploadDisplayName(record)) {
    return fromName.toUpperCase();
  }
  if (explicitType.includes("pdf")) return "PDF";
  if (explicitType.includes("image")) return "IMG";
  if (
    explicitType.includes("sheet") ||
    explicitType.includes("excel") ||
    explicitType.includes("csv")
  ) {
    return "XLS";
  }
  if (explicitType.includes("word")) return "DOC";
  if (explicitType.includes("zip")) return "ZIP";
  return "FILE";
}

export function isImageUpload(record = null) {
  const type = String(record?.type || "").toLowerCase();
  const name = resolveUploadDisplayName(record).toLowerCase();
  return (
    type === "photo" ||
    type.includes("image") ||
    type.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].some((suffix) =>
      name.endsWith(suffix)
    )
  );
}

export function isPdfUpload(record = null) {
  const type = String(record?.type || "").toLowerCase();
  const name = resolveUploadDisplayName(record).toLowerCase();
  return type.includes("pdf") || name.endsWith(".pdf");
}

export function isUploadFormRecord(record = null) {
  const typeValue = toText(record?.type).toLowerCase();
  if (typeValue === "form") return true;
  const hasKnownFormField = [
    ...PRESTART_CHECKBOX_FIELDS,
    ...PRESTART_TEXT_FIELDS,
    ...PCA_CHECKBOX_FIELDS,
    ...PCA_NUMBER_FIELDS,
    ...PCA_TEXT_FIELDS,
    ...PCA_DATETIME_FIELDS,
    "activity_description",
    "activity_other",
  ].some((field) => hasMeaningfulValue(record?.[field]));
  return hasKnownFormField;
}

export function inferUploadFormKind(record = null) {
  const name = toText(resolveUploadDisplayName(record)).toLowerCase();
  if (name.startsWith("pca")) return PCA_FORM_KIND;
  if (name.includes("pest control advice")) return PCA_FORM_KIND;
  const hasPcaSignals = [
    ...PCA_CHECKBOX_FIELDS,
    ...PCA_NUMBER_FIELDS,
    ...PCA_TEXT_FIELDS,
    ...PCA_DATETIME_FIELDS,
  ].some((field) => hasMeaningfulValue(record?.[field]));
  return hasPcaSignals ? PCA_FORM_KIND : PRESTART_FORM_KIND;
}

export function buildUploadFormDraft(kind = PRESTART_FORM_KIND, sourceRecord = null) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  const draft = {};
  if (config.includeActivityDescription) {
    draft.activity_description = toText(sourceRecord?.activity_description);
    draft.activity_other = toText(sourceRecord?.activity_other);
  }
  config.checkboxFields.forEach((fieldName) => {
    draft[fieldName] = toBoolean(sourceRecord?.[fieldName]);
  });
  config.numberFields.forEach((fieldName) => {
    draft[fieldName] = toNumberString(sourceRecord?.[fieldName]);
  });
  config.textFields.forEach((fieldName) => {
    draft[fieldName] = toText(sourceRecord?.[fieldName]);
  });
  (Array.isArray(config.datetimeFields) ? config.datetimeFields : []).forEach((fieldName) => {
    draft[fieldName] = formatDateTimeLocalInput(sourceRecord?.[fieldName]);
  });
  return draft;
}

export function buildUploadFormPayload({
  kind = PRESTART_FORM_KIND,
  draft = {},
  displayName = "",
} = {}) {
  const config = FORM_KIND_CONFIG[kind] || FORM_KIND_CONFIG[PRESTART_FORM_KIND];
  const safeDraft = draft && typeof draft === "object" ? draft : {};
  const payload = {
    type: "Form",
    file_name: toText(displayName),
    photo_name: "",
    photo_upload: "",
    file_upload: "",
  };

  if (config.includeActivityDescription) {
    const activityDescription = toText(safeDraft.activity_description);
    payload.activity_description = activityDescription;
    payload.activity_other =
      activityDescription === "Other" ? toText(safeDraft.activity_other) : "";
  }

  config.checkboxFields.forEach((fieldName) => {
    payload[fieldName] = Boolean(safeDraft[fieldName]);
  });
  config.numberFields.forEach((fieldName) => {
    const normalized = toText(safeDraft[fieldName]);
    payload[fieldName] = normalized ? Number(normalized) : null;
  });
  config.textFields.forEach((fieldName) => {
    payload[fieldName] = toText(safeDraft[fieldName]);
  });
  (Array.isArray(config.datetimeFields) ? config.datetimeFields : []).forEach((fieldName) => {
    payload[fieldName] = parseDateTimeInputToUnix(safeDraft[fieldName]);
  });

  return payload;
}

export function resolveUploadCategory(record = null) {
  if (isUploadFormRecord(record)) return "forms";
  if (isImageUpload(record)) return "photo";
  return "file";
}

export function normalizeRecordId(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return /^\d+$/.test(raw) ? String(Number.parseInt(raw, 10)) : raw;
}

export function normalizeJobId(jobData = null) {
  return normalizeRecordId(jobData?.id || jobData?.ID || "");
}

export function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function dedupeUploadRecords(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((item, index) => {
    const key = String(item?.id || item?.url || `upload-${index}`).trim();
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

export function canUseLocalStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

export function buildUploadsCacheKey(mode = "job", targetRecordId = "") {
  const normalizedMode = String(mode || "job").trim().toLowerCase();
  const normalizedTarget = normalizeRecordId(targetRecordId);
  if (!normalizedTarget) return "";
  return `${UPLOADS_CACHE_KEY_PREFIX}${normalizedMode}:${normalizedTarget}`;
}

export function readUploadsCache(mode = "job", targetRecordId = "") {
  if (!canUseLocalStorage()) return null;
  const key = buildUploadsCacheKey(mode, targetRecordId);
  if (!key) return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const cachedAt = Number(parsed?.cachedAt || 0);
    if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > UPLOADS_CACHE_TTL_MS) {
      return null;
    }
    return {
      cachedAt,
      records: dedupeUploadRecords(parsed?.records || []),
    };
  } catch {
    return null;
  }
}

export function writeUploadsCache(mode = "job", targetRecordId = "", records = []) {
  if (!canUseLocalStorage()) return false;
  const key = buildUploadsCacheKey(mode, targetRecordId);
  if (!key) return false;
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        cachedAt: Date.now(),
        records: dedupeUploadRecords(records || []),
      })
    );
    return true;
  } catch {
    return false;
  }
}

export function resolveUploadPreviewUrl(record = null) {
  return String(
    record?.url || record?.link || record?.file_url || record?.preview_url || ""
  ).trim();
}

export function triggerFileDownload(url = "", name = "") {
  const targetUrl = String(url || "").trim();
  if (!targetUrl) return;
  const fileName = String(name || "").trim();
  const anchor = document.createElement("a");
  anchor.href = targetUrl;
  anchor.rel = "noopener noreferrer";
  anchor.target = "_blank";
  if (fileName) {
    anchor.setAttribute("download", fileName);
  }
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
