export function resolveDetailsLayoutColumns(layoutMode) {
  switch (layoutMode) {
    case "focus-inquiry":
      return "minmax(0,2.4fr) minmax(260px,0.9fr) minmax(260px,0.9fr)";
    case "focus-property":
      return "minmax(260px,0.9fr) minmax(0,2.4fr) minmax(260px,0.9fr)";
    case "focus-job":
      return "minmax(260px,0.9fr) minmax(260px,0.9fr) minmax(0,2.4fr)";
    default:
      return "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)";
  }
}

export function resolveFocusedDetailsCard(layoutMode) {
  if (layoutMode === "focus-inquiry") return "inquiry";
  if (layoutMode === "focus-property") return "property";
  if (layoutMode === "focus-job") return "job";
  return "";
}

export function toText(value) {
  return String(value ?? "").trim();
}

export function normalizeStatus(value) {
  return toText(value).toLowerCase();
}

export function isCompanyAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized === "company" || normalized === "entity";
}

export function isContactAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized === "contact" || normalized === "individual";
}

export function isBodyCorpCompanyAccountType(value) {
  const normalized = normalizeStatus(value);
  return normalized.includes("body corp");
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

export function getMemoFileMeta(input) {
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
    [toText(author?.first_name || author?.First_Name), toText(author?.last_name || author?.Last_Name)]
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

    return {
      ...memo,
      ForumComments: previousComments,
    };
  });
}

export function fullName(firstName, lastName) {
  return [toText(firstName), toText(lastName)].filter(Boolean).join(" ").trim();
}

export function isLikelyEmailValue(value) {
  const text = toText(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function isLikelyPhoneValue(value) {
  const text = toText(value);
  if (!text) return false;
  const digits = text.replace(/\D+/g, "");
  return digits.length >= 6;
}

export function toTelHref(value) {
  const text = toText(value);
  if (!text) return "";
  const normalized = text.replace(/[^\d+]+/g, "");
  return normalized ? `tel:${normalized}` : "";
}
