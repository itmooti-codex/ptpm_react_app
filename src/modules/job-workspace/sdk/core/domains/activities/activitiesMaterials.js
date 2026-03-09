import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import {
  extractRecords,
} from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  ACTIVITY_RECORD_SELECT_FIELDS,
  MATERIAL_RECORD_SELECT_FIELDS,
  ACTIVITY_SERVICE_SELECT_FIELDS,
  applyActivityServiceInclude,
  applyMaterialProviderInclude,
} from "./activitiesMaterialsQueryHelpers.js";
import {
  normalizeActivityRecord,
  normalizeActivityMutationPayload,
  normalizeMaterialRecord,
  normalizeMaterialMutationPayload,
} from "./activitiesMaterialsPayloadHelpers.js";
import {
  parseActivityCreateMutationResult,
  parseActivityUpdateMutationResult,
  parseActivityDeleteMutationResult,
  parseMaterialCreateMutationResult,
  parseMaterialUpdateMutationResult,
  parseMaterialDeleteMutationResult,
} from "./activitiesMaterialsMutationResultHelpers.js";

export function subscribeActivitiesByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const activityModel = resolvedPlugin.switchTo?.("PeterpmActivity");
  if (!activityModel?.query) return () => {};

  const query = activityModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select(ACTIVITY_RECORD_SELECT_FIELDS);
  applyActivityServiceInclude(query);
  query.noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeActivityRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Activities subscription failed", error);
      onError?.(error);
    },
  });
}

export function subscribeMaterialsByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const materialModel = resolvedPlugin.switchTo?.("PeterpmMaterial");
  if (!materialModel?.query) return () => {};

  const query = materialModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select(MATERIAL_RECORD_SELECT_FIELDS);
  applyMaterialProviderInclude(query);
  query.noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeMaterialRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Materials subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchServicesForActivities({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmService")
      .query()
      .deSelectAll()
      .select(ACTIVITY_SERVICE_SELECT_FIELDS)
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch services for activities", error);
    return [];
  }
}

export async function fetchActivitiesByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmActivity")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select(ACTIVITY_RECORD_SELECT_FIELDS);
    applyActivityServiceInclude(query);
    query.noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map((record) => normalizeActivityRecord(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch activities", error);
    return [];
  }
}

export async function createActivityRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutationPayload = normalizeActivityMutationPayload(payload, { forCreate: true });
  const mutation = await activityModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseActivityCreateMutationResult(result);

  const safeCreatedRecord = createdRecord && typeof createdRecord === "object" ? createdRecord : {};
  const ACTIVITY_BOOL_FIELDS = ["include_in_quote", "include_in_quote_subtotal", "invoice_to_client"];
  const filteredCreatedRecord = Object.fromEntries(
    Object.entries(safeCreatedRecord).filter(
      ([key, val]) => !ACTIVITY_BOOL_FIELDS.includes(key) || (val !== null && val !== undefined)
    )
  );
  return normalizeActivityRecord({
    ...(mutationPayload || {}),
    ...filteredCreatedRecord,
    id: resolvedId,
  });
}

export async function updateActivityRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Activity ID is missing.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutationPayload = normalizeActivityMutationPayload(payload, { forCreate: false });
  const mutation = await activityModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  const {
    record: updatedRecord,
    id: resolvedId,
    mutationId: updatedId,
  } = parseActivityUpdateMutationResult(result, { normalizedId });

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Activity update returned no updated record. Treating as success.",
      result
    );
  }

  const safeUpdatedRecord = updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {};
  const ACTIVITY_BOOL_FIELDS = ["include_in_quote", "include_in_quote_subtotal", "invoice_to_client"];
  const filteredUpdatedRecord = Object.fromEntries(
    Object.entries(safeUpdatedRecord).filter(
      ([key, val]) => !ACTIVITY_BOOL_FIELDS.includes(key) || (val !== null && val !== undefined)
    )
  );
  return normalizeActivityRecord({
    ...(mutationPayload || {}),
    ...filteredUpdatedRecord,
    id: resolvedId || normalizedId,
  });
}

export async function deleteActivityRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Activity ID is missing.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutation = await activityModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Activity delete operation is unavailable.");
  }

  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  const deletedId = parseActivityDeleteMutationResult(result, { normalizedId });
  return deletedId;
}

export async function fetchMaterialsByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmMaterial")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select(MATERIAL_RECORD_SELECT_FIELDS);
    applyMaterialProviderInclude(query);
    query.noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map((record) => normalizeMaterialRecord(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch materials", error);
    return [];
  }
}

export async function createMaterialRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutationPayload = normalizeMaterialMutationPayload(payload, { forCreate: true });
  const mutation = await materialModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseMaterialCreateMutationResult(result);

  return normalizeMaterialRecord({
    ...(mutationPayload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateMaterialRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Material ID is missing.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutationPayload = normalizeMaterialMutationPayload(payload, { forCreate: false });
  const mutation = await materialModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  const {
    record: updatedRecord,
    id: resolvedId,
    mutationId: updatedId,
  } = parseMaterialUpdateMutationResult(result, { normalizedId });

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Material update returned no updated record. Treating as success.",
      result
    );
  }

  return normalizeMaterialRecord({
    ...(mutationPayload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId || normalizedId,
  });
}

export async function deleteMaterialRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Material ID is missing.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutation = await materialModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Material delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  const deletedId = parseMaterialDeleteMutationResult(result, { normalizedId });
  return deletedId;
}
