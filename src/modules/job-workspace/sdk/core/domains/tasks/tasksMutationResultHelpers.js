import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensureTaskMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

function findTaskMutationData(result, operation) {
  return (
    findMutationData(result, `${operation}Task`) ??
    findMutationData(result, `${operation}Tasks`) ??
    findMutationDataByMatcher(result, (key) => new RegExp(`^${operation}`, "i").test(key) && /task/i.test(key))
  );
}

export function parseTaskCreateMutationResult(result) {
  if (!result) throw new Error("Task create was cancelled.");

  ensureTaskMutationStatusOrThrow(result, "Unable to create task.");
  const created = findTaskMutationData(result, "create");
  if (created === null) {
    throw new Error("Unable to create task.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmTask");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Task create was cancelled."));
  }

  if (!isPersistedId(resolvedId)) {
    throw new Error("Task was not confirmed by server. Please try again.");
  }

  return {
    record: createdRecord,
    id: resolvedId,
  };
}

export function parseTaskUpdateMutationResult(result, { normalizedId } = {}) {
  if (!result) throw new Error("Task update was cancelled.");

  ensureTaskMutationStatusOrThrow(result, "Unable to update task.");
  const updated = findTaskMutationData(result, "update");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const mutationId = extractCreatedRecordId(result, "PeterpmTask");
  const resolvedId = String(
    updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId || ""
  ).trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Task update was cancelled."));
  }

  if (updatedRecord === null || (!updatedRecord && !mutationId)) {
    throw new Error(extractCancellationMessage(result, "Unable to update task."));
  }

  return {
    record: updatedRecord,
    id: resolvedId || normalizedId,
    mutationId,
  };
}

export function parseTaskDeleteMutationResult(result, { normalizedId } = {}) {
  if (!result) throw new Error("Task delete was cancelled.");

  ensureTaskMutationStatusOrThrow(result, "Unable to delete task.");
  const deleted = findTaskMutationData(result, "delete");
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id || deletedRecord?.ID || extractCreatedRecordId(result, "PeterpmTask") || normalizedId
  ).trim();
  if (result?.isCancelling && !deletedId) {
    throw new Error(extractCancellationMessage(result, "Task delete was cancelled."));
  }
  if (!deletedId) {
    throw new Error("Unable to delete task.");
  }
  return deletedId;
}
