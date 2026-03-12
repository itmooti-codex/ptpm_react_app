import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensureMutationStatusOrThrow(result, defaultMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || defaultMessage);
  }
}

function findEntityMutationData(result, { operation, singular, plural, matcherTerm }) {
  return (
    findMutationData(result, `${operation}${singular}`) ??
    findMutationData(result, `${operation}${plural}`) ??
    findMutationDataByMatcher(
      result,
      (key) => new RegExp(`^${operation}`, "i").test(key) && new RegExp(matcherTerm, "i").test(key)
    )
  );
}

function parseCreateMutationResult({
  result,
  singular,
  plural,
  matcherTerm,
  modelType,
  cancelledMessage,
  failedMessage,
  unconfirmedMessage,
} = {}) {
  if (!result) throw new Error(cancelledMessage);

  ensureMutationStatusOrThrow(result, failedMessage);
  const created = findEntityMutationData(result, {
    operation: "create",
    singular,
    plural,
    matcherTerm,
  });
  if (created === null) {
    throw new Error(failedMessage);
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, modelType);
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, cancelledMessage));
  }
  if (!isPersistedId(resolvedId)) {
    throw new Error(unconfirmedMessage);
  }

  return {
    record: createdRecord,
    id: resolvedId,
  };
}

function parseUpdateMutationResult({
  result,
  singular,
  plural,
  matcherTerm,
  modelType,
  normalizedId,
  cancelledMessage,
  failedMessage,
} = {}) {
  if (!result) throw new Error(cancelledMessage);

  ensureMutationStatusOrThrow(result, failedMessage);
  const updated = findEntityMutationData(result, {
    operation: "update",
    singular,
    plural,
    matcherTerm,
  });
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const mutationId = extractCreatedRecordId(result, modelType);
  const resolvedId = String(
    updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId || ""
  ).trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, cancelledMessage));
  }

  return {
    record: updatedRecord,
    id: resolvedId,
    mutationId,
  };
}

function parseDeleteMutationResult({
  result,
  singular,
  plural,
  matcherTerm,
  modelType,
  normalizedId,
  cancelledMessage,
  failedMessage,
} = {}) {
  if (!result) throw new Error(cancelledMessage);

  ensureMutationStatusOrThrow(result, failedMessage);
  const deleted = findEntityMutationData(result, {
    operation: "delete",
    singular,
    plural,
    matcherTerm,
  });
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, modelType) ||
      normalizedId
  ).trim();
  if (result?.isCancelling && !deletedId) {
    throw new Error(extractCancellationMessage(result, cancelledMessage));
  }
  if (!deletedId) {
    throw new Error(failedMessage);
  }
  return deletedId;
}

export function parseActivityCreateMutationResult(result) {
  return parseCreateMutationResult({
    result,
    singular: "Activity",
    plural: "Activities",
    matcherTerm: "activity",
    modelType: "PeterpmActivity",
    cancelledMessage: "Activity create was cancelled.",
    failedMessage: "Unable to create activity.",
    unconfirmedMessage: "Activity was not confirmed by server. Please try again.",
  });
}

export function parseActivityUpdateMutationResult(result, { normalizedId } = {}) {
  return parseUpdateMutationResult({
    result,
    singular: "Activity",
    plural: "Activities",
    matcherTerm: "activity",
    modelType: "PeterpmActivity",
    normalizedId,
    cancelledMessage: "Activity update was cancelled.",
    failedMessage: "Unable to update activity.",
  });
}

export function parseActivityDeleteMutationResult(result, { normalizedId } = {}) {
  return parseDeleteMutationResult({
    result,
    singular: "Activity",
    plural: "Activities",
    matcherTerm: "activity",
    modelType: "PeterpmActivity",
    normalizedId,
    cancelledMessage: "Activity delete was cancelled.",
    failedMessage: "Unable to delete activity.",
  });
}

export function parseMaterialCreateMutationResult(result) {
  return parseCreateMutationResult({
    result,
    singular: "Material",
    plural: "Materials",
    matcherTerm: "material",
    modelType: "PeterpmMaterial",
    cancelledMessage: "Material create was cancelled.",
    failedMessage: "Unable to create material.",
    unconfirmedMessage: "Material was not confirmed by server. Please try again.",
  });
}

export function parseMaterialUpdateMutationResult(result, { normalizedId } = {}) {
  return parseUpdateMutationResult({
    result,
    singular: "Material",
    plural: "Materials",
    matcherTerm: "material",
    modelType: "PeterpmMaterial",
    normalizedId,
    cancelledMessage: "Material update was cancelled.",
    failedMessage: "Unable to update material.",
  });
}

export function parseMaterialDeleteMutationResult(result, { normalizedId } = {}) {
  return parseDeleteMutationResult({
    result,
    singular: "Material",
    plural: "Materials",
    matcherTerm: "material",
    modelType: "PeterpmMaterial",
    normalizedId,
    cancelledMessage: "Material delete was cancelled.",
    failedMessage: "Unable to delete material.",
  });
}
