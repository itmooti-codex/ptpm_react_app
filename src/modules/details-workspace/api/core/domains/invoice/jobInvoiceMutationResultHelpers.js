import { normalizeIdentifier, extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
} from "../../../utils/sdkResponseUtils.js";

function ensureMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

export function parseJobUpdateMutationResult(result, { whereField, whereValue } = {}) {
  if (!result) {
    throw new Error("Job update was cancelled.");
  }

  ensureMutationStatusOrThrow(result, "Unable to update job.");
  const updated =
    findMutationData(result, "updateJob") ??
    findMutationData(result, "updateJobs") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /job/i.test(key));
  const mutationId = extractCreatedRecordId(result, "PeterpmJob");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const fallbackIdFromWhere =
    String(whereField || "").trim() === "id" ? normalizeIdentifier(whereValue) : "";
  const resolvedId = normalizeIdentifier(
    updatedRecord?.id || updatedRecord?.ID || mutationId || fallbackIdFromWhere || ""
  );

  return {
    record: updatedRecord,
    id: resolvedId || mutationId,
  };
}

export function assertInvoiceActivitySelectionMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Activity invoice selection update was cancelled.");
  }

  ensureMutationStatusOrThrow(result, "Unable to save invoice activity selection.");
  return true;
}
