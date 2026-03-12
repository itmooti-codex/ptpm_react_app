import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensureAffiliationMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

function findAffiliationMutationData(result, operation) {
  return (
    findMutationData(result, `${operation}Affiliation`) ??
    findMutationData(result, `${operation}Affiliations`) ??
    findMutationDataByMatcher(
      result,
      (key) => new RegExp(`^${operation}`, "i").test(key) && /affiliation/i.test(key)
    )
  );
}

export function parseAffiliationCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Property contact create was cancelled.");
  }

  ensureAffiliationMutationStatusOrThrow(result, "Unable to create property contact.");
  const created = findAffiliationMutationData(result, "create");
  if (created === null) {
    throw new Error("Unable to create property contact.");
  }
  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const mutationId = extractCreatedRecordId(result, "PeterpmAffiliation");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || mutationId || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Property contact was not confirmed by server. Please try again.");
  }

  return {
    record: createdRecord,
    id: resolvedId,
  };
}

export function parseAffiliationUpdateMutationResult(result, { normalizedId } = {}) {
  if (!result || result?.isCancelling) {
    throw new Error("Property contact update was cancelled.");
  }

  ensureAffiliationMutationStatusOrThrow(result, "Unable to update property contact.");
  const updated = findAffiliationMutationData(result, "update");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;

  return {
    record: updatedRecord,
    id: updatedRecord?.id || updatedRecord?.ID || normalizedId,
  };
}

export function parseAffiliationDeleteMutationResult(result, { normalizedId } = {}) {
  if (!result || result?.isCancelling) {
    throw new Error("Property contact delete was cancelled.");
  }

  ensureAffiliationMutationStatusOrThrow(result, "Unable to delete property contact.");
  const deleted = findAffiliationMutationData(result, "delete");
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, "PeterpmAffiliation") ||
      normalizedId
  ).trim();
  if (!deletedId) {
    throw new Error("Unable to delete property contact.");
  }
  return deletedId;
}
