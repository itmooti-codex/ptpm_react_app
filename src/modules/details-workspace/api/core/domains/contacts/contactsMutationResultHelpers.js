import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensureContactMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

function findContactMutationData(result, operation) {
  return (
    findMutationData(result, `${operation}Contact`) ??
    findMutationData(result, `${operation}Contacts`) ??
    findMutationDataByMatcher(result, (key) => new RegExp(`^${operation}`, "i").test(key) && /contact/i.test(key))
  );
}

export function parseContactCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Contact create was cancelled.");
  }

  ensureContactMutationStatusOrThrow(result, "Unable to create contact.");
  const created = findMutationData(result, "createContact");
  if (created === null) {
    throw new Error("Unable to create contact.");
  }

  const mutationId = extractCreatedRecordId(result, "PeterpmContact");
  const resolvedId = String(
    created?.id || created?.ID || created?.Contact_ID || mutationId || ""
  ).trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Contact was not confirmed by server. Please try again.");
  }

  return {
    record: created,
    id: resolvedId,
  };
}

export function parseContactUpdateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Contact update was cancelled.");
  }

  ensureContactMutationStatusOrThrow(result, "Unable to update contact.");
  const updated = findContactMutationData(result, "update");
  const mutationId = extractCreatedRecordId(result, "PeterpmContact");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;

  return {
    record: updatedRecord,
    mutationId,
  };
}

export function parseCompanyCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Company create was cancelled.");
  }

  ensureContactMutationStatusOrThrow(result, "Unable to create company.");
  const created = findMutationData(result, "createCompany");
  if (created === null) {
    throw new Error("Unable to create company.");
  }

  const mutationId = extractCreatedRecordId(result, "PeterpmCompany");
  const resolvedId = String(created?.id || created?.ID || mutationId || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Company was not confirmed by server. Please try again.");
  }

  return {
    record: created,
    id: resolvedId,
  };
}
