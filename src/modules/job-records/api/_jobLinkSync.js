import {
  fetchAppointmentsByInquiryUid,
  fetchInquiryUploads,
  fetchTasksByDealId,
} from "@modules/details-workspace/exports/api.js";
import {
  collectRecordIds,
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractRowsFromPayload,
  extractStatusFailure,
  fetchDirectWithTimeout,
  normalizeId,
  toPromiseLike,
} from "./_helpers.js";
import { toText } from "@shared/utils/formatters.js";
import { fetchMemosForDetails } from "./jobMemosApi.js";

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

async function fetchRecordIdsByInquiryFieldAliases({
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

async function syncRecordsByIdWithJob({
  plugin,
  modelName,
  recordIds = [],
  jobId,
  payloadJobKeys = [],
  verifyJobFieldAliases = [],
  updateErrorLabel = "",
} = {}) {
  const normalizedJobId = normalizeId(jobId);
  if (!plugin?.switchTo || !modelName || !normalizedJobId) return 0;
  const ids = collectRecordIds((Array.isArray(recordIds) ? recordIds : []).map((id) => ({ id })));
  if (!ids.length) return 0;
  const keys = Array.from(
    new Set(
      (Array.isArray(payloadJobKeys) ? payloadJobKeys : [])
        .map((key) => toText(key))
        .filter(Boolean)
    )
  );
  if (!keys.length) return 0;

  let updatedCount = 0;
  for (const id of ids) {
    let updated = false;
    let lastError = null;
    for (const key of keys) {
      try {
        await updateModelRecordFieldById({
          plugin,
          modelName,
          recordId: id,
          payload: { [key]: normalizedJobId },
          fallbackErrorMessage: `Unable to update ${updateErrorLabel || modelName}.`,
        });
        if (Array.isArray(verifyJobFieldAliases) && verifyJobFieldAliases.length) {
          const verifyRecord = await fetchModelRecordByIdFields({
            plugin,
            modelName,
            recordId: id,
            fields: verifyJobFieldAliases,
          });
          if (
            !recordHasExpectedValue(verifyRecord, verifyJobFieldAliases, normalizedJobId)
          ) {
            throw new Error(
              `Verification failed for ${updateErrorLabel || modelName} ${id} using key ${key}.`
            );
          }
        }
        updated = true;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (updated) {
      updatedCount += 1;
    } else {
      console.warn(
        `[jobDetailsSdk] Failed syncing ${updateErrorLabel || modelName} record ${id} with job ID`,
        lastError
      );
    }
  }

  return updatedCount;
}

export async function syncInquiryLinkedRecordsToQuoteJob({ plugin, inquiryId, inquiryUid, jobId } = {}) {
  const normalizedInquiryId = normalizeId(inquiryId);
  const normalizedInquiryUid = toText(inquiryUid);
  const normalizedJobId = normalizeId(jobId);
  if (!plugin?.switchTo || !normalizedInquiryId || !normalizedJobId) {
    return {
      uploads: 0,
      appointments: 0,
      memoPosts: 0,
      tasks: 0,
    };
  }

  const [uploadRecords, appointmentRecordsByUid, taskRecords, memoPostRecords] = await Promise.all([
    fetchInquiryUploads({ plugin, inquiryId: normalizedInquiryId }).catch((error) => {
      console.warn("[jobDetailsSdk] Failed loading uploads for job link sync", error);
      return [];
    }),
    normalizedInquiryUid
      ? fetchAppointmentsByInquiryUid({ plugin, inquiryUid: normalizedInquiryUid }).catch((error) => {
          console.warn("[jobDetailsSdk] Failed loading appointments for job link sync", error);
          return [];
        })
      : Promise.resolve([]),
    fetchTasksByDealId({ plugin, dealId: normalizedInquiryId }).catch((error) => {
      console.warn("[jobDetailsSdk] Failed loading tasks for job link sync", error);
      return [];
    }),
    fetchMemosForDetails({ plugin, inquiryId: normalizedInquiryId, limit: 120 }).catch((error) => {
      console.warn("[jobDetailsSdk] Failed loading memo posts for job link sync", error);
      return [];
    }),
  ]);

  const uploadIds = collectRecordIds(uploadRecords);
  const appointmentIdsFromUid = collectRecordIds(appointmentRecordsByUid);
  const taskIds = collectRecordIds(taskRecords);
  const memoPostIds = collectRecordIds(memoPostRecords);

  const appointmentIdsFallback = appointmentIdsFromUid.length
    ? []
    : await fetchRecordIdsByInquiryFieldAliases({
        plugin,
        modelName: "PeterpmAppointment",
        inquiryId: normalizedInquiryId,
        inquiryFieldAliases: ["inquiry_id"],
        fetchErrorLabel: "appointments",
      });
  const uploadIdsFallback = uploadIds.length
    ? []
    : await fetchRecordIdsByInquiryFieldAliases({
        plugin,
        modelName: "PeterpmUpload",
        inquiryId: normalizedInquiryId,
        inquiryFieldAliases: ["inquiry_id"],
        fetchErrorLabel: "uploads",
      });
  const taskIdsFallback = taskIds.length
    ? []
    : await fetchRecordIdsByInquiryFieldAliases({
        plugin,
        modelName: "PeterpmTask",
        inquiryId: normalizedInquiryId,
        inquiryFieldAliases: ["Deal_id"],
        fetchErrorLabel: "tasks",
      });
  const memoIdsFallback = memoPostIds.length
    ? []
    : await fetchRecordIdsByInquiryFieldAliases({
        plugin,
        modelName: "PeterpmForumPost",
        inquiryId: normalizedInquiryId,
        inquiryFieldAliases: ["related_inquiry_id"],
        fetchErrorLabel: "memo posts",
      });

  const [uploads, appointments, memoPosts, tasks] = await Promise.all([
    syncRecordsByIdWithJob({
      plugin,
      modelName: "PeterpmUpload",
      recordIds: [...uploadIds, ...uploadIdsFallback],
      jobId: normalizedJobId,
      payloadJobKeys: ["job_id", "Job_ID"],
      verifyJobFieldAliases: ["job_id", "Job_ID"],
      updateErrorLabel: "upload",
    }),
    syncRecordsByIdWithJob({
      plugin,
      modelName: "PeterpmAppointment",
      recordIds: [...appointmentIdsFromUid, ...appointmentIdsFallback],
      jobId: normalizedJobId,
      payloadJobKeys: ["job_id", "Job_ID"],
      verifyJobFieldAliases: ["job_id", "Job_ID"],
      updateErrorLabel: "appointment",
    }),
    syncRecordsByIdWithJob({
      plugin,
      modelName: "PeterpmForumPost",
      recordIds: [...memoPostIds, ...memoIdsFallback],
      jobId: normalizedJobId,
      payloadJobKeys: ["related_job_id", "Related_Job_ID"],
      verifyJobFieldAliases: ["related_job_id", "Related_Job_ID"],
      updateErrorLabel: "memo post",
    }),
    syncRecordsByIdWithJob({
      plugin,
      modelName: "PeterpmTask",
      recordIds: [...taskIds, ...taskIdsFallback],
      jobId: normalizedJobId,
      payloadJobKeys: ["Job_id", "job_id", "Job_ID"],
      verifyJobFieldAliases: ["Job_id", "job_id", "Job_ID"],
      updateErrorLabel: "task",
    }),
  ]);

  return {
    uploads,
    appointments,
    memoPosts,
    tasks,
  };
}
