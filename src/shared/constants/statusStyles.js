// Status → { color, backgroundColor } inline style map
// Ported from HTML DASHBOARD_STATUS_CLASSES
const STATUS_STYLES = {
  // Inquiry statuses
  "New Inquiry":                    { color: "#d81b60", backgroundColor: "#f7d1df" },
  "Not Allocated":                  { color: "#d81b60", backgroundColor: "#f7d1df" },
  "Contact Client":                 { color: "#ab47bc", backgroundColor: "#eedaf2" },
  "Contact For Site Visit":         { color: "#8e24aa", backgroundColor: "#e8d3ee" },
  "Site Visit Scheduled":           { color: "#ffb300", backgroundColor: "#fff0cc" },
  "Site Visit to be Re-Scheduled":  { color: "#fb8c00", backgroundColor: "#fee8cc" },
  "Generate Quote":                 { color: "#00acc1", backgroundColor: "#cceef3" },
  "Quote Created":                  { color: "#43a047", backgroundColor: "#d9ecda" },

  // Quote statuses
  New: { color: "#0369a1", backgroundColor: "#e0f2fe" },
  Requested: { color: "#b45309", backgroundColor: "#fef3c7" },
  Sent: { color: "#0d9488", backgroundColor: "#ccfbf1" },
  Accepted: { color: "#15803d", backgroundColor: "#dcfce7" },
  Declined: { color: "#dc2626", backgroundColor: "#fee2e2" },

  // Shared statuses
  Completed: { color: "#43a047", backgroundColor: "#d9ecda" },
  Cancelled: { color: "#000000", backgroundColor: "#cccccc" },
  Expired:   { color: "#757575", backgroundColor: "#e3e3e3" },

  // Job statuses
  Quote: { color: "#7c3aed", backgroundColor: "#ede9fe" },
  "On Hold": { color: "#b45309", backgroundColor: "#fef3c7" },
  Booked: { color: "#0369a1", backgroundColor: "#e0f2fe" },
  "Call Back": { color: "#be185d", backgroundColor: "#fce7f3" },
  Scheduled: { color: "#0d9488", backgroundColor: "#ccfbf1" },
  Reschedule: { color: "#dc2626", backgroundColor: "#fee2e2" },
  "In Progress": { color: "#0891b2", backgroundColor: "#cffafe" },
  "In progress": { color: "#0891b2", backgroundColor: "#cffafe" },
  "Waiting For Payment": { color: "#9a3412", backgroundColor: "#ffedd5" },

  // Payment statuses
  "Invoice Required": { color: "#b45309", backgroundColor: "#fef3c7" },
  "Invoice Sent": { color: "#0369a1", backgroundColor: "#e0f2fe" },
  Paid: { color: "#15803d", backgroundColor: "#dcfce7" },
  Overdue: { color: "#dc2626", backgroundColor: "#fee2e2" },
  "Written Off": { color: "#6b7280", backgroundColor: "#f3f4f6" },
};

export function resolveStatusStyle(status) {
  const key = String(status || "").trim();
  return STATUS_STYLES[key] || { color: "#475569", backgroundColor: "#f1f5f9" };
}
