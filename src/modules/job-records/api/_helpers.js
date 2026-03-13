import {
  extractFromPayload,
  fetchDirectWithTimeout,
} from "@shared/api/dashboardCore.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/details-workspace/exports/api.js";
import { toText } from "@shared/utils/formatters.js";

export {
  extractFromPayload,
  fetchDirectWithTimeout,
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
};

export function normalizeStatus(value) {
  return toText(value).toLowerCase();
}

export function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (text === "-" || text === "—") return "";
  return text;
}

export function isTimeoutError(error) {
  return /timed out/i.test(String(error?.message || ""));
}

export function normalizeDateInputToIso(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [yearText, monthText, dayText] = text.split("-");
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return "";
    return new Date(Date.UTC(year, month - 1, day)).toISOString();
  }
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

export function firstRecord(payload) {
  const rows = extractFromPayload(payload);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0] || null;
}

export function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(result);
}

export function extractRowsFromPayload(payload, expectedKey = "") {
  if (!payload) return [];

  if (
    expectedKey &&
    Array.isArray(payload?.payload?.data?.[expectedKey])
  ) {
    return payload.payload.data[expectedKey];
  }
  if (expectedKey && Array.isArray(payload?.data?.[expectedKey])) {
    return payload.data[expectedKey];
  }

  const direct = extractFromPayload(payload);
  if (Array.isArray(direct) && direct.length) return direct;

  const candidates = [];
  if (Array.isArray(payload?.resp)) candidates.push(payload.resp);
  if (Array.isArray(payload?.data)) candidates.push(payload.data);
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

export function extractCreatedRecordId(result, modelKey) {
  const managed = result?.mutations?.[modelKey]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }

  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  return "";
}

export function dedupeById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((record, index) => {
    const key = normalizeId(record?.id || record?.ID || "") || `idx-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function hasVisibleTaskContent(task = {}) {
  return Boolean(
    toText(task?.subject || task?.Subject) ||
      toText(task?.status || task?.Status) ||
      toText(task?.date_due || task?.Date_Due) ||
      toText(task?.assignee_first_name || task?.Assignee_First_Name) ||
      toText(task?.assignee_last_name || task?.Assignee_Last_Name) ||
      toText(task?.assignee_email || task?.AssigneeEmail)
  );
}

export function toSortableTimestamp(value) {
  if (value == null || value === "") return 0;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1e12 ? value : value * 1000;
  }

  const text = toText(value).replace(/,/g, "");
  if (!text) return 0;
  if (/^-?\d+(\.\d+)?$/.test(text)) {
    const numeric = Number(text);
    if (!Number.isFinite(numeric)) return 0;
    return text.length <= 10 ? numeric * 1000 : numeric;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

export async function executeMutationWithOne(model, mutationBuilder, fallbackErrorMessage) {
  const mutation = await model.mutation();
  mutationBuilder(mutation);
  const result = await toPromiseLike(mutation.execute(true));
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Mutation was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || fallbackErrorMessage
    );
  }
  return result;
}

export function collectRecordIds(records = []) {
  const seen = new Set();
  const ids = [];
  for (const row of Array.isArray(records) ? records : []) {
    const id = normalizeId(row?.id || row?.ID);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

export function updateModelRecordFieldById({
  plugin,
  modelName,
  recordId,
  payload,
  fallbackErrorMessage,
} = {}) {
  const id = normalizeId(recordId);
  if (!plugin?.switchTo || !modelName || !id || !payload || typeof payload !== "object") {
    return false;
  }
  const model = plugin.switchTo(modelName);
  if (!model?.mutation) return false;
  return (async () => {
    const mutation = await model.mutation();
    mutation.update((query) => query.where("id", id).set(payload));
    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error(extractCancellationMessage(result, "Mutation was cancelled."));
    }
    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        extractMutationErrorMessage(failure.statusMessage) || fallbackErrorMessage || "Unable to update record."
      );
    }
    return true;
  })();
}

export async function fetchModelRecordByIdFields({
  plugin,
  modelName,
  recordId,
  fields = [],
} = {}) {
  const id = normalizeId(recordId);
  const selectFields = Array.from(
    new Set(
      (Array.isArray(fields) ? fields : [])
        .map((field) => toText(field))
        .filter(Boolean)
    )
  );
  if (!plugin?.switchTo || !modelName || !id || !selectFields.length) return null;
  const model = plugin.switchTo(modelName);
  if (!model?.query) return null;
  const query = model
    .query()
    .where("id", id)
    .deSelectAll()
    .select(["id", ...selectFields])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const response = await fetchDirectWithTimeout(query, null, 20000);
  const rows = extractRowsFromPayload(response);
  const record = Array.isArray(rows) && rows.length ? rows[0] : null;
  return record && typeof record === "object" ? record : null;
}

export function recordHasExpectedValue(record = {}, fieldAliases = [], expectedValue = "") {
  const expected = normalizeId(expectedValue);
  if (!expected) return false;
  const aliases = Array.from(
    new Set(
      (Array.isArray(fieldAliases) ? fieldAliases : [])
        .map((field) => toText(field))
        .filter(Boolean)
    )
  );
  if (!aliases.length) return false;
  for (const alias of aliases) {
    const value = normalizeId(record?.[alias]);
    if (value && value === expected) return true;
  }
  return false;
}

export async function fetchRecordIdsByInquiryFieldAliases({
  plugin,
  modelName,
  inquiryId,
  inquiryFieldAliases = [],
  fetchErrorLabel = "",
} = {}) {
  const normalizedInquiryId = normalizeId(inquiryId);
  if (!plugin?.switchTo || !modelName || !normalizedInquiryId) return [];

  const model = plugin.switchTo(modelName);
  if (!model?.query) return [];

  const aliases = Array.from(
    new Set(
      (Array.isArray(inquiryFieldAliases) ? inquiryFieldAliases : [])
        .map((field) => toText(field))
        .filter(Boolean)
    )
  );
  if (!aliases.length) return [];

  const ids = [];
  const seen = new Set();
  for (const fieldName of aliases) {
    try {
      const query = model
        .query()
        .where(fieldName, normalizedInquiryId)
        .deSelectAll()
        .select(["id"])
        .limit(500)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const response = await fetchDirectWithTimeout(query, null, 30000);
      const extracted = extractRowsFromPayload(response);
      const rows = Array.isArray(extracted) ? extracted : [];
      for (const row of rows) {
        const id = normalizeId(row?.id || row?.ID);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        ids.push(id);
      }
    } catch (error) {
      console.warn(
        `[jobDetailsSdk] Failed loading ${fetchErrorLabel || modelName} by ${fieldName}`,
        error
      );
    }
  }

  return ids;
}
