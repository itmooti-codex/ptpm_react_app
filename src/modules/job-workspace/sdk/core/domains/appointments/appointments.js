import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import {
  extractRecords,
} from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  APPOINTMENT_JOB_SELECT_FIELDS,
  APPOINTMENT_INQUIRY_SELECT_FIELDS,
  applyAppointmentIncludes,
  buildInquiryAppointmentsFallbackQuery,
} from "./appointmentsQueryHelpers.js";
import {
  normalizeAppointmentRecord,
  normalizeAppointmentMutationPayload,
} from "./appointmentsPayloadHelpers.js";
import {
  parseAppointmentCreateMutationResult,
  parseAppointmentUpdateMutationResult,
  parseAppointmentDeleteMutationResult,
} from "./appointmentsMutationResultHelpers.js";

export function subscribeAppointmentsByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const appointmentModel = resolvedPlugin.switchTo?.("PeterpmAppointment");
  if (!appointmentModel?.query) return () => {};

  const query = appointmentModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select(APPOINTMENT_JOB_SELECT_FIELDS);
  applyAppointmentIncludes(query);
  query
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload)
        .map((record) => normalizeAppointmentRecord(record))
        .filter((record) => record.id);
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Appointments subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchAppointmentsByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmAppointment")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select(APPOINTMENT_JOB_SELECT_FIELDS);

    applyAppointmentIncludes(query);
    query.noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeAppointmentRecord(record))
      .filter((record) => record.id);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch appointments", error);
    return [];
  }
}

export async function fetchAppointmentsByInquiryUid({ plugin, inquiryUid } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedInquiryUid = String(inquiryUid || "").trim();
  if (!normalizedInquiryUid) return [];

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.query) return [];

  try {
    const customQuery = appointmentModel
      .query()
      .fromGraphql(buildInquiryAppointmentsFallbackQuery());

    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { unique_id: normalizedInquiryUid },
    });
    const records = extractRecords(response)
      .map((record) => normalizeAppointmentRecord(record))
      .filter((record) => record.id);
    if (records.length) return records;
  } catch (error) {
    console.warn(
      "[JobDirect] Custom inquiry appointments query failed, using model fallback",
      error
    );
  }

  try {
    const query = appointmentModel
      .query()
      .where("Inquiry", (inquiryQuery) =>
        inquiryQuery.where("unique_id", normalizedInquiryUid)
      )
      .deSelectAll()
      .select(APPOINTMENT_INQUIRY_SELECT_FIELDS);

    applyAppointmentIncludes(query);
    query.noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeAppointmentRecord(record))
      .filter((record) => record.id);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch inquiry appointments", error);
    return [];
  }
}

export async function createAppointmentRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  const normalizedPayload = normalizeAppointmentMutationPayload(payload || {});
  mutation.createOne(normalizedPayload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseAppointmentCreateMutationResult(result);

  return normalizeAppointmentRecord({
    ...normalizedPayload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateAppointmentRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Appointment ID is missing.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  const normalizedPayload = normalizeAppointmentMutationPayload(payload || {});
  mutation.update((query) => query.where("id", normalizedId).set(normalizedPayload));
  const result = await mutation.execute(true).toPromise();
  const {
    record: updatedRecord,
    id: resolvedId,
    mutationId: updatedId,
  } = parseAppointmentUpdateMutationResult(result, { normalizedId });

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Appointment update returned no updated record. Treating as success.",
      result
    );
  }

  return normalizeAppointmentRecord({
    ...normalizedPayload,
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId,
  });
}

export async function deleteAppointmentRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Appointment ID is missing.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Appointment delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  return parseAppointmentDeleteMutationResult(result, { normalizedId });
}
