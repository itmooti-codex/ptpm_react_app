import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
} from "../../../utils/sdkResponseUtils.js";

function ensureDealMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

export function parseDealUpdateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Deal update was cancelled.");
  }

  ensureDealMutationStatusOrThrow(result, "Unable to update deal.");
  const updated =
    findMutationData(result, "updateDeal") ??
    findMutationData(result, "updateDeals") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /deal/i.test(key));
  const mutationId = extractCreatedRecordId(result, "PeterpmDeal");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;

  return {
    record: updatedRecord,
    mutationId,
  };
}
