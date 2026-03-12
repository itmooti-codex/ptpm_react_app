import { extractCreatedRecordId } from "../shared/sharedHelpers.js";
import {
  extractMutationErrorMessage,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
} from "../../../utils/sdkResponseUtils.js";

function ensureAppointmentMutationStatusOrThrow(result, fallbackMessage) {
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(extractMutationErrorMessage(failure.statusMessage) || fallbackMessage);
  }
}

function findAppointmentMutationData(result, operation) {
  return (
    findMutationData(result, `${operation}Appointment`) ??
    findMutationData(result, `${operation}Appointments`) ??
    findMutationDataByMatcher(
      result,
      (key) => new RegExp(`^${operation}`, "i").test(key) && /appointment/i.test(key)
    )
  );
}

export function parseAppointmentCreateMutationResult(result) {
  if (!result || result?.isCancelling) {
    throw new Error("Appointment create was cancelled.");
  }

  ensureAppointmentMutationStatusOrThrow(result, "Unable to create appointment.");
  const created = findAppointmentMutationData(result, "create");
  if (created === null) {
    throw new Error("Unable to create appointment.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmAppointment");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Appointment was not confirmed by server. Please try again.");
  }

  return {
    record: createdRecord,
    id: resolvedId,
  };
}

export function parseAppointmentUpdateMutationResult(result, { normalizedId } = {}) {
  if (!result || result?.isCancelling) {
    throw new Error("Appointment update was cancelled.");
  }

  ensureAppointmentMutationStatusOrThrow(result, "Unable to update appointment.");
  const updated = findAppointmentMutationData(result, "update");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const mutationId = extractCreatedRecordId(result, "PeterpmAppointment");

  return {
    record: updatedRecord,
    id: updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId,
    mutationId,
  };
}

export function parseAppointmentDeleteMutationResult(result, { normalizedId } = {}) {
  if (!result || result?.isCancelling) {
    throw new Error("Appointment delete was cancelled.");
  }

  ensureAppointmentMutationStatusOrThrow(result, "Unable to delete appointment.");
  const deleted = findAppointmentMutationData(result, "delete");
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, "PeterpmAppointment") ||
      normalizedId
  ).trim();
  if (!deletedId) {
    throw new Error("Unable to delete appointment.");
  }

  return deletedId;
}
