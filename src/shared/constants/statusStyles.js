// Status color maps — each map is specific to its field/context.
// Colors sourced from VitalStats field definitions (a.js).
// Do NOT share colors across contexts — same label may differ per field.

const DEFAULT_STYLE = { color: "#475569", backgroundColor: "#f1f5f9" };

// ─── Inquiry statuses ───────────────────────────────────────────────────────
const INQUIRY_STATUS_STYLES = {
  "New Inquiry":                   { color: "#d81b60", backgroundColor: "#f7d1df" },
  "Not Allocated":                 { color: "#d81b60", backgroundColor: "#f7d1df" },
  "Contact Client":                { color: "#ab47bc", backgroundColor: "#eedaf2" },
  "Contact For Site Visit":        { color: "#8e24aa", backgroundColor: "#e8d3ee" },
  "Site Visit Scheduled":          { color: "#ffb300", backgroundColor: "#fff0cc" },
  "Site Visit to be Re-Scheduled": { color: "#fb8c00", backgroundColor: "#fee8cc" },
  "Generate Quote":                { color: "#00acc1", backgroundColor: "#cceef3" },
  "Quote Created":                 { color: "#43a047", backgroundColor: "#d9ecda" },
};

// ─── Job statuses (f2019) ────────────────────────────────────────────────────
const JOB_STATUS_STYLES = {
  "Quote":                { color: "#8e24aa", backgroundColor: "#e8d3ee" },
  "On Hold":              { color: "#9e9e9e", backgroundColor: "#ececec" },
  "Booked":               { color: "#1e88e5", backgroundColor: "#d2e7fa" },
  "Call Back":            { color: "#1e88e5", backgroundColor: "#d2e7fa" },
  "Scheduled":            { color: "#00acc1", backgroundColor: "#cceef3" },
  "Reschedule":           { color: "#ef6c00", backgroundColor: "#fce2cc" },
  "In Progress":          { color: "#00acc1", backgroundColor: "#cceef3" },
  "In progress":          { color: "#00acc1", backgroundColor: "#cceef3" },
  "Waiting For Payment":  { color: "#fb8c00", backgroundColor: "#fee8cc" },
  "Completed":            { color: "#43a047", backgroundColor: "#d9ecda" },
  "Cancelled":            { color: "#757575", backgroundColor: "#e3e3e3" },
};

// ─── Quote statuses (f2024) ──────────────────────────────────────────────────
const QUOTE_STATUS_STYLES = {
  "New":       { color: "#e91e63", backgroundColor: "#fbd2e0" },
  "Requested": { color: "#8e24aa", backgroundColor: "#e8d3ee" },
  "Sent":      { color: "#3949ab", backgroundColor: "#d7dbee" },
  "Accepted":  { color: "#43a047", backgroundColor: "#d9ecda" },
  "Declined":  { color: "#f4511e", backgroundColor: "#fddcd2" },
  "Expired":   { color: "#000000", backgroundColor: "#cccccc" },
  "Cancelled": { color: "#000000", backgroundColor: "#cccccc" },
};

// ─── Payment statuses (f2020) ────────────────────────────────────────────────
const PAYMENT_STATUS_STYLES = {
  "Invoice Required": { color: "#8e24aa", backgroundColor: "#e8d3ee" },
  "Invoice Sent":     { color: "#3949ab", backgroundColor: "#d7dbee" },
  "Paid":             { color: "#43a047", backgroundColor: "#d9ecda" },
  "Overdue":          { color: "#f4511e", backgroundColor: "#fddcd2" },
  "Written Off":      { color: "#fb8c00", backgroundColor: "#fee8cc" },
  "Cancelled":        { color: "#616161", backgroundColor: "#dfdfdf" },
};

// ─── Priority (f2018) ────────────────────────────────────────────────────────
const PRIORITY_STYLES = {
  "Low":    { color: "#0097a7", backgroundColor: "#cceaed" },
  "Medium": { color: "#f57c00", backgroundColor: "#fde5cc" },
  "High":   { color: "#d84315", backgroundColor: "#f7d9d0" },
};

// ─── Context-specific resolvers ──────────────────────────────────────────────
function resolveFromMap(map, status) {
  const key = String(status || "").trim();
  if (!key) return null;
  if (map[key]) return map[key];
  // case-insensitive fallback
  const lower = key.toLowerCase();
  const found = Object.keys(map).find((k) => k.toLowerCase() === lower);
  return found ? map[found] : null;
}

export function resolveInquiryStatusStyle(status) {
  return resolveFromMap(INQUIRY_STATUS_STYLES, status) || DEFAULT_STYLE;
}

export function resolveJobStatusStyle(status) {
  return resolveFromMap(JOB_STATUS_STYLES, status) || DEFAULT_STYLE;
}

export function resolveQuoteStatusStyle(status) {
  return resolveFromMap(QUOTE_STATUS_STYLES, status) || DEFAULT_STYLE;
}

export function resolvePaymentStatusStyle(status) {
  return resolveFromMap(PAYMENT_STATUS_STYLES, status) || DEFAULT_STYLE;
}

export function resolvePriorityStyle(priority) {
  return resolveFromMap(PRIORITY_STYLES, priority) || DEFAULT_STYLE;
}

// ─── Legacy resolver (backward compat) ───────────────────────────────────────
// Merges all maps; for conflicting keys (e.g. "Cancelled") job-status color wins.
const LEGACY_STATUS_STYLES = {
  ...PAYMENT_STATUS_STYLES,
  ...QUOTE_STATUS_STYLES,
  ...JOB_STATUS_STYLES,
  ...INQUIRY_STATUS_STYLES,
};

export function resolveStatusStyle(status) {
  const key = String(status || "").trim();
  return LEGACY_STATUS_STYLES[key] || DEFAULT_STYLE;
}
