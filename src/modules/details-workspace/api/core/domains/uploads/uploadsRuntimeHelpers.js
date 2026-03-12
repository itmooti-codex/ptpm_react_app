import { VITAL_STATS_CONFIG } from "@platform/vitalstats/config.js";
import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, isTimeoutError, subscribeToQueryStream } from "../../transport.js";
import {
  extractRecords,
  sanitizeUploadPath,
} from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  UPLOAD_RECORD_SELECT_FIELDS,
  normalizeUploadRecord,
  buildUploadsByFieldFallbackQuery,
  buildUploadPayloadFromSignedFile,
} from "./uploadsHelpers.js";
import {
  parseUploadCreateMutationResult,
  parseUploadUpdateMutationResult,
  parseUploadDeleteMutationResult,
} from "./uploadsMutationResultHelpers.js";

export async function requestSignedUpload({ file, uploadPath = "uploads" } = {}) {
  const apiKey = String(VITAL_STATS_CONFIG.apiKey || "").trim();
  const slug = String(VITAL_STATS_CONFIG.slug || "").trim().toLowerCase();
  const uploadEndpoint = String(
    import.meta.env.VITE_VITALSTATS_UPLOAD_ENDPOINT ||
      (slug ? `https://${slug}.vitalstats.app/api/v1/rest/upload` : "")
  ).trim();

  if (!apiKey || !uploadEndpoint) {
    throw new Error("Upload endpoint config is missing.");
  }

  const safePath = sanitizeUploadPath(uploadPath || "uploads");
  const baseName = String(file?.name || "upload").trim() || "upload";
  const scopedName = safePath ? `${safePath}/${baseName}` : baseName;

  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify([
      {
        type: file?.type || "application/octet-stream",
        name: scopedName,
        generateName: true,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error("Unable to request upload URL.");
  }

  const payload = await response.json().catch(() => null);
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (Number(result?.statusCode || 200) >= 400) {
    throw new Error("Upload endpoint rejected the request.");
  }

  const data = result?.data || result || {};
  if (!data?.uploadUrl || !data?.url) {
    throw new Error("Invalid upload response.");
  }
  return data;
}

export async function uploadToSignedUrl({ uploadUrl, file } = {}) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file?.type || "application/octet-stream",
    },
  });
  if (!response.ok) {
    throw new Error("Failed to upload file.");
  }
}

export async function fetchUploadsByField({
  plugin,
  fieldName,
  variableName,
  variableType,
  idValue,
  fetchErrorLabel = "uploads",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) return [];

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.query) return [];

  try {
    const customQuery = uploadModel.query().fromGraphql(
      buildUploadsByFieldFallbackQuery({
        fieldName,
        variableName,
        variableType,
      })
    );
    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { [variableName]: normalizedId },
    }, 20000);
    return extractRecords(response).map((item) => normalizeUploadRecord(item));
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.warn(
        `[JobDirect] Custom ${fetchErrorLabel} query failed, using model fallback`,
        error
      );
    }
  }

  try {
    const query = uploadModel
      .query()
      .where(fieldName, normalizedId)
      .deSelectAll()
      .select(UPLOAD_RECORD_SELECT_FIELDS)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, 20000);
    return extractRecords(response).map((item) => normalizeUploadRecord(item));
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.error(`[JobDirect] Failed to fetch ${fetchErrorLabel}`, error);
    }
    return [];
  }
}

export function subscribeUploadsByField({
  plugin,
  fieldName,
  idValue,
  onChange,
  onError,
  logLabel = "uploads",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) return () => {};

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.query) return () => {};

  const query = uploadModel
    .query()
    .where(fieldName, normalizedId)
    .deSelectAll()
    .select(UPLOAD_RECORD_SELECT_FIELDS)
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeUploadRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error(`[JobDirect] ${logLabel} subscription failed`, error);
      onError?.(error);
    },
  });
}

export async function createUploadFromFileByField({
  plugin,
  fieldName,
  idValue,
  missingIdMessage,
  file,
  uploadPath,
  additionalPayload,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) {
    throw new Error(missingIdMessage || "Record ID is missing.");
  }
  if (!file) {
    throw new Error("No file selected.");
  }

  const signed = await requestSignedUpload({
    file,
    uploadPath,
  });
  await uploadToSignedUrl({ uploadUrl: signed.uploadUrl, file });

  const payload = buildUploadPayloadFromSignedFile({
    fieldName,
    normalizedId,
    file,
    signed,
    additionalPayload,
  });

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const mutation = await uploadModel.mutation();
  mutation.createOne(payload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: createdId } = parseUploadCreateMutationResult(result);

  return normalizeUploadRecord({
    ...payload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: createdId,
  });
}

export async function createUploadRecordByField({
  plugin,
  fieldName,
  idValue,
  missingIdMessage,
  payload,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) {
    throw new Error(missingIdMessage || "Record ID is missing.");
  }

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const safePayload = payload && typeof payload === "object" ? payload : {};
  const mutationPayload = {
    ...safePayload,
    [fieldName]: normalizedId,
  };

  const mutation = await uploadModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: createdId } = parseUploadCreateMutationResult(result);

  return normalizeUploadRecord({
    ...mutationPayload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: createdId,
  });
}

export async function updateUploadRecordById({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Upload ID is missing.");
  }

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const safePayload = payload && typeof payload === "object" ? payload : {};
  const mutation = await uploadModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(safePayload));
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, id: updatedId } = parseUploadUpdateMutationResult(result, {
    normalizedId,
  });

  return normalizeUploadRecord({
    ...safePayload,
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: updatedId || normalizedId,
  });
}

export async function uploadFileToStorage({ file, uploadPath = "uploads" } = {}) {
  if (!file) {
    throw new Error("No file selected.");
  }

  const signed = await requestSignedUpload({
    file,
    uploadPath,
  });
  await uploadToSignedUrl({ uploadUrl: signed.uploadUrl, file });
  const url = String(signed?.url || "").trim();

  return {
    url,
    fileObject: {
      link: url,
      name: String(file?.name || "").trim(),
      size: file?.size || "",
      type: String(file?.type || "").trim(),
      s3_id: String(signed?.key || "").trim(),
    },
  };
}

export async function deleteUploadRecordById({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Upload ID is missing.");
  }

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const mutation = await uploadModel.mutation();
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  return parseUploadDeleteMutationResult(result);
}
