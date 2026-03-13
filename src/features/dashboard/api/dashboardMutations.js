import { fetchDirectWithTimeout, extractFromPayload } from "@shared/api/dashboardCore.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/details-workspace/exports/api.js";
import { TAB_IDS } from "../constants/tabs.js";

// ─── Private Helpers ──────────────────────────────────────────────────────────

function getModels(plugin) {
  return {
    dealModel: plugin.switchTo("PeterpmDeal"),
    jobModel: plugin.switchTo("PeterpmJob"),
    spModel: plugin.switchTo("PeterpmServiceProvider"),
  };
}

function firstRecordFromAnyPayload(payload) {
  const records = extractFromPayload(payload);
  return Array.isArray(records) && records.length ? records[0] : null;
}

function extractCreatedRecordId(result, modelKey) {
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

function normalizeMutationError(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    const message = extractMutationErrorMessage(failure.statusMessage);
    if (message) return message;
  }
  return String(fallbackMessage || "Operation failed.");
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function createJobRecord({ plugin, payload = null } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const { jobModel } = getModels(plugin);
  const mutation = await jobModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Job create was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create job."
    );
  }

  const createdId = extractCreatedRecordId(result, "PeterpmJob");
  if (!isPersistedId(createdId)) {
    throw new Error(normalizeMutationError(result, "Job create did not return an ID."));
  }

  const detailQuery = jobModel
    .query()
    .where("id", createdId)
    .deSelectAll()
    .select(["id", "unique_id", "job_status"])
    .noDestroy();
  detailQuery.getOrInitQueryCalc?.();
  const detailResult = await fetchDirectWithTimeout(detailQuery);
  const record = firstRecordFromAnyPayload(detailResult);
  if (!record) {
    throw new Error("Job created but failed to load job details.");
  }

  const id = String(record?.id ?? record?.ID ?? createdId).trim();
  const uniqueId = String(record?.unique_id ?? record?.Unique_ID ?? "").trim();
  const jobStatus = String(record?.job_status ?? record?.Job_Status ?? "").trim();

  return {
    id,
    unique_id: uniqueId,
    job_status: jobStatus,
  };
}

export async function cancelInquiryById({ plugin, dealId } = {}) {
  return cancelDashboardRecord({
    plugin,
    tabId: TAB_IDS.INQUIRY,
    recordId: dealId,
  });
}

export async function cancelDashboardRecord({ plugin, tabId, recordId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = String(recordId ?? "").trim();
  if (!normalizedId) {
    throw new Error("Record ID is missing.");
  }

  const isInquiry = tabId === TAB_IDS.INQUIRY;
  const isQuote = tabId === TAB_IDS.QUOTE;
  const isPayment = tabId === TAB_IDS.PAYMENT;

  const model = isInquiry ? getModels(plugin).dealModel : getModels(plugin).jobModel;
  const statusField = isInquiry
    ? "inquiry_status"
    : isQuote
      ? "quote_status"
      : isPayment
        ? "payment_status"
        : "job_status";

  const mutation = await model.mutation();
  mutation.update((query) =>
    query.where("id", normalizedId).set({
      [statusField]: "Cancelled",
    })
  );

  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Record update was cancelled."));
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to cancel record."
    );
  }

  const verifyQuery = model
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select(["id", statusField])
    .noDestroy();
  verifyQuery.getOrInitQueryCalc?.();
  const verifyResult = await fetchDirectWithTimeout(verifyQuery);
  const record = firstRecordFromAnyPayload(verifyResult);
  if (!record) {
    throw new Error("Record update succeeded but verification failed.");
  }

  const nextStatus = String(record?.[statusField] ?? "").trim();
  if (nextStatus.toLowerCase() !== "cancelled") {
    throw new Error("Record status update was not applied.");
  }

  return {
    statusField,
    status: nextStatus,
  };
}

export async function cancelDashboardRecordsByUniqueIds({
  plugin,
  tabId,
  uniqueIds = [],
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const ids = Array.from(
    new Set(
      (Array.isArray(uniqueIds) ? uniqueIds : [])
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    )
  );
  if (!ids.length) return { cancelled: 0 };

  const isInquiry = tabId === TAB_IDS.INQUIRY;
  const isQuote = tabId === TAB_IDS.QUOTE;
  const isPayment = tabId === TAB_IDS.PAYMENT;

  const model = isInquiry ? getModels(plugin).dealModel : getModels(plugin).jobModel;
  const statusField = isInquiry
    ? "inquiry_status"
    : isQuote
      ? "quote_status"
      : isPayment
        ? "payment_status"
        : "job_status";

  const mutation = await model.mutation();
  ids.forEach((uid) => {
    mutation.update((query) =>
      query.where("unique_id", uid).set({
        [statusField]: "Cancelled",
      })
    );
  });

  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Record update was cancelled."));
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to cancel selected records."
    );
  }

  return { cancelled: ids.length, statusField };
}

// ─── Stubs ────────────────────────────────────────────────────────────────────

export async function fetchNotifications(_args = {}) {
  return [];
}

export async function createTask(_args = {}) {
  return null;
}
