import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensurePropertyMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

export function parsePropertyCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Property create was cancelled.");
  }

  ensurePropertyMutationStatusOrThrow(result, "Unable to create property.");
  const created = findMutationData(result, "createProperty");
  if (created === null) {
    throw new Error("Unable to create property.");
  }

  const mutationId = extractCreatedRecordId(result, "PeterpmProperty");
  const resolvedId = String(
    created?.id || created?.ID || created?.Property_ID || mutationId || ""
  ).trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Property was not confirmed by server. Please try again.");
  }

  return {
    record: created,
    id: resolvedId,
  };
}

export function parsePropertyUpdateMutationResult(result, { normalizedId } = {}) {
  if (!result || result?.isCancelling) {
    throw new Error("Property update was cancelled.");
  }

  ensurePropertyMutationStatusOrThrow(result, "Unable to update property.");
  const updated =
    findMutationData(result, "updateProperty") ??
    findMutationData(result, "updateProperties") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /property/i.test(key));
  const mutationId = extractCreatedRecordId(result, "PeterpmProperty");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;

  return {
    record: updatedRecord,
    id: updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId,
    mutationId,
  };
}
