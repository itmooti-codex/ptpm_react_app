import assigneesJson from "../../../../../assignees.json";

export function toString(value) {
  return String(value ?? "").trim();
}

export function pickFirstId(...values) {
  for (const value of values) {
    const text = toString(value);
    if (text) return text;
  }
  return "";
}

export function dedupeTasksById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((task, index) => {
    const id = toString(task?.id || task?.ID || task?.Task_ID);
    const key = id || `idx-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Parses "\n\nAssigned to: John Doe | 5" appended at end of details
export function parseAssignedTo(details) {
  const match = String(details || "").match(/\n\nAssigned to: (.+?) \| (\w+)\s*$/);
  if (!match) return null;
  return { name: match[1], id: match[2] };
}

export function stripAssignedTo(details) {
  return String(details || "").replace(/\n\nAssigned to: .+$/s, "").trimEnd();
}

export const TASKS_CACHE_TTL_MS = 2 * 60 * 1000;
export const tasksCacheByContext = new Map();

export function buildTasksCacheKey({
  contextType = "",
  contextId = "",
  resolvedJobId = "",
  resolvedDealId = "",
  jobUid = "",
} = {}) {
  return [
    toString(contextType) || "job",
    toString(contextId),
    toString(resolvedJobId),
    toString(resolvedDealId),
    toString(jobUid).toLowerCase(),
  ].join("|");
}

export function readTasksFromCache(cacheKey = "") {
  const key = toString(cacheKey);
  if (!key) return null;
  const cached = tasksCacheByContext.get(key);
  if (!cached || typeof cached !== "object") return null;
  const cachedAt = Number(cached.cachedAt || 0);
  if (!Number.isFinite(cachedAt) || Date.now() - cachedAt > TASKS_CACHE_TTL_MS) {
    tasksCacheByContext.delete(key);
    return null;
  }
  return {
    cachedAt,
    records: Array.isArray(cached.records) ? cached.records : [],
  };
}

export function writeTasksToCache(cacheKey = "", records = []) {
  const key = toString(cacheKey);
  if (!key) return;
  tasksCacheByContext.set(key, {
    cachedAt: Date.now(),
    records: Array.isArray(records) ? records : [],
  });
}

export function formatDateForInput(value) {
  const text = toString(value);
  if (!text) return "";

  const normalizedNumericText = text.replace(/,/g, "");
  const hasOnlyNumericChars = /^-?\d+(\.\d+)?$/.test(normalizedNumericText);
  if (hasOnlyNumericChars) {
    const numeric = Number(normalizedNumericText);
    if (Number.isFinite(numeric)) {
      const rounded = Math.trunc(numeric);
      const length = String(Math.abs(rounded)).length;
      const asMs = length <= 10 ? rounded * 1000 : rounded;
      const fromUnix = new Date(asMs);
      if (!Number.isNaN(fromUnix.getTime())) {
        const year = fromUnix.getFullYear();
        const month = String(fromUnix.getMonth() + 1).padStart(2, "0");
        const day = String(fromUnix.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      }
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    return `${ausMatch[3]}-${month}-${day}`;
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDateForDisplay(value) {
  const iso = formatDateForInput(value);
  if (!iso) return "-";

  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;

  const day = String(parsed.getDate()).padStart(2, "0");
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const year = String(parsed.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export function statusBadgeClass(status) {
  const normalized = toString(status).toLowerCase();
  if (normalized === "completed") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (normalized === "in progress") {
    return "bg-sky-100 text-sky-700";
  }
  if (normalized === "cancelled") {
    return "bg-slate-200 text-slate-700";
  }
  return "bg-amber-100 text-amber-700";
}

export function emptyFormState() {
  return {
    id: "",
    subject: "",
    dueDate: "",
    spId: "",
    spName: "",
    details: "",
  };
}

export function hasMeaningfulTaskData(task) {
  if (!task || typeof task !== "object") return false;
  return Boolean(
    toString(task.id) ||
      toString(task.subject) ||
      toString(task.assignee_id) ||
      toString(task.details) ||
      toString(task.date_due) ||
      toString(task.status)
  );
}

// The silent assignee ID always sent from assignees.json
export const silentAssigneeId = toString(assigneesJson?.[0]?.id ?? "");
