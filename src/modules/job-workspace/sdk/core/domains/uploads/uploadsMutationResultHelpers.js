import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
} from "../../../utils/sdkResponseUtils.js";

function ensureUploadMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

function findUploadMutationData(result, operation) {
  return (
    findMutationData(result, `${operation}Upload`) ??
    findMutationData(result, `${operation}Uploads`) ??
    findMutationDataByMatcher(result, (key) => new RegExp(`^${operation}`, "i").test(key) && /upload/i.test(key))
  );
}

export function parseUploadCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Upload create was cancelled.");
  }

  ensureUploadMutationStatusOrThrow(result, "Unable to save upload.");
  const created = findUploadMutationData(result, "create");
  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmUpload");

  return {
    record: createdRecord,
    id: createdRecord?.id || createdRecord?.ID || createdId || "",
  };
}

export function parseUploadDeleteMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Upload delete was cancelled.");
  }

  ensureUploadMutationStatusOrThrow(result, "Unable to delete upload.");
  return true;
}
