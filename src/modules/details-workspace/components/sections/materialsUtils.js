import { MATERIAL_TAX_OPTIONS } from "../../constants/options.js";
import { toText } from "../../../../shared/utils/formatters.js";

export function toId(value) {
  const normalized = toText(value);
  if (!normalized) return "";
  if (/^\d+$/.test(normalized)) return Number.parseInt(normalized, 10);
  return normalized;
}

export function formatDateForDisplay(value) {
  const text = toText(value);
  if (!text) return "-";

  let date;
  const numericText = text.replace(/,/g, "");
  if (/^-?\d+(\.\d+)?$/.test(numericText)) {
    const numeric = Number(numericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const asMs = String(Math.abs(rounded)).length <= 10 ? rounded * 1000 : rounded;
      date = new Date(asMs);
    }
  }

  if (!date) {
    date = new Date(text);
  }
  if (Number.isNaN(date.getTime())) return text;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function formatCurrency(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  if (!Number.isFinite(numeric)) return "-";
  return numeric.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  });
}

export function extractFileUrl(input) {
  if (!input) return "";
  if (typeof input === "string") {
    const stripWrappingQuotes = (value = "") => {
      let next = toText(value);
      while (
        (next.startsWith('"') && next.endsWith('"')) ||
        (next.startsWith("'") && next.endsWith("'"))
      ) {
        next = next.slice(1, -1).trim();
      }
      return next;
    };

    let value = stripWrappingQuotes(input);
    if (!value) return "";

    if (/%[0-9A-Fa-f]{2}/.test(value)) {
      try {
        value = stripWrappingQuotes(decodeURIComponent(value));
      } catch {
        // keep as-is
      }
    }

    if (value.startsWith("{") || value.startsWith("[")) {
      try {
        const parsed = JSON.parse(value);
        return extractFileUrl(parsed);
      } catch {
        return value;
      }
    }

    return value;
  }
  if (typeof input === "object") {
    if (input?.File) {
      const nested = extractFileUrl(input.File);
      if (nested) return nested;
    }
    return toText(input?.link || input?.url || input?.src || input?.path);
  }
  return "";
}

export function getFileNameFromUrl(url) {
  const normalized = toText(url);
  if (!normalized) return "";
  try {
    const parsed = new URL(normalized);
    const pathname = parsed.pathname || "";
    const fromPath = pathname.split("/").filter(Boolean).pop() || "";
    return decodeURIComponent(fromPath) || normalized;
  } catch (_) {
    return normalized.split("/").filter(Boolean).pop() || normalized;
  }
}

export function buildFilePayloadFromUrl(url) {
  const normalized = extractFileUrl(url);
  if (!normalized) return "";
  return {
    link: normalized,
    name: getFileNameFromUrl(normalized),
    size: "",
    type: "",
    s3_id: "",
  };
}

export function parseMaterialFilePayload(input) {
  if (!input) return "";
  if (typeof input === "object") {
    if (input?.File) return parseMaterialFilePayload(input.File);
    const link = extractFileUrl(input?.link || input?.url || input?.src || input?.path);
    if (!link) return "";
    return {
      link,
      name: toText(input?.name || input?.filename) || getFileNameFromUrl(link),
      size: input?.size ?? "",
      type: toText(input?.type || input?.mime),
      s3_id: toText(input?.s3_id || input?.s3Id),
    };
  }

  if (typeof input === "string") {
    const text = toText(input);
    if (!text) return "";
    try {
      if (text.startsWith("{") || text.startsWith("[")) {
        const parsed = JSON.parse(text);
        return parseMaterialFilePayload(parsed);
      }
    } catch {
      // Ignore parse failure and treat as URL.
    }
    const link = extractFileUrl(text);
    if (!link) return "";
    return buildFilePayloadFromUrl(link);
  }
  return "";
}

export function resolveMaterialFileUrl(material) {
  return (
    extractFileUrl(material?.file_url) ||
    extractFileUrl(material?.file_payload) ||
    extractFileUrl(material?.file) ||
    extractFileUrl(material?.File) ||
    extractFileUrl(material?.receipt) ||
    extractFileUrl(material?.Receipt)
  );
}

export function resolveTaxOptionValue(rawValue) {
  const current = toText(rawValue).toLowerCase();
  if (!current) return "";
  const matched = MATERIAL_TAX_OPTIONS.find(
    (option) =>
      toText(option.value).toLowerCase() === current ||
      toText(option.label).toLowerCase() === current
  );
  return matched ? toText(matched.value) : toText(rawValue);
}

export function resolveTaxPayloadValue(rawValue) {
  const current = toText(rawValue).toLowerCase();
  if (!current) return "";
  const matched = MATERIAL_TAX_OPTIONS.find(
    (option) =>
      toText(option.value).toLowerCase() === current ||
      toText(option.label).toLowerCase() === current
  );
  return matched ? toText(matched.label) : toText(rawValue);
}

export function defaultMaterialForm() {
  return {
    id: "",
    material_name: "",
    total: "",
    description: "",
    transaction_type: "",
    tax: "",
    status: "New",
    service_provider_id: "",
    file: "",
    file_payload: "",
  };
}
