import {
  fetchUploadsByField,
  subscribeUploadsByField,
  createUploadFromFileByField,
  createUploadRecordByField,
  updateUploadRecordById,
  uploadFileToStorage,
  deleteUploadRecordById,
} from "./uploadsRuntimeHelpers.js";

export async function fetchPropertyUploads({ plugin, propertyId } = {}) {
  return fetchUploadsByField({
    plugin,
    fieldName: "property_name_id",
    variableName: "property_name_id",
    variableType: "PeterpmPropertyID",
    idValue: propertyId,
    fetchErrorLabel: "property uploads",
  });
}

export async function createPropertyUploadFromFile({
  plugin,
  propertyId,
  file,
  uploadPath = "property-uploads",
  additionalPayload,
} = {}) {
  return createUploadFromFileByField({
    plugin,
    fieldName: "property_name_id",
    idValue: propertyId,
    missingIdMessage: "Property ID is missing.",
    file,
    uploadPath,
    additionalPayload,
  });
}

export function subscribePropertyUploadsByPropertyId({
  plugin,
  propertyId,
  onChange,
  onError,
} = {}) {
  return subscribeUploadsByField({
    plugin,
    fieldName: "property_name_id",
    idValue: propertyId,
    onChange,
    onError,
    logLabel: "Property uploads",
  });
}

export async function fetchJobUploads({ plugin, jobId } = {}) {
  return fetchUploadsByField({
    plugin,
    fieldName: "job_id",
    variableName: "jobid",
    variableType: "PeterpmJobID",
    idValue: jobId,
    fetchErrorLabel: "job uploads",
  });
}

export async function fetchInquiryUploads({ plugin, inquiryId } = {}) {
  return fetchUploadsByField({
    plugin,
    fieldName: "inquiry_id",
    variableName: "inquiryid",
    variableType: "PeterpmDealID",
    idValue: inquiryId,
    fetchErrorLabel: "inquiry uploads",
  });
}

export async function createJobUploadFromFile({
  plugin,
  jobId,
  file,
  uploadPath = "job-uploads",
  additionalPayload,
} = {}) {
  return createUploadFromFileByField({
    plugin,
    fieldName: "job_id",
    idValue: jobId,
    missingIdMessage: "Job ID is missing.",
    file,
    uploadPath,
    additionalPayload,
  });
}

export async function createInquiryUploadFromFile({
  plugin,
  inquiryId,
  file,
  uploadPath = "inquiry-uploads",
  additionalPayload,
} = {}) {
  return createUploadFromFileByField({
    plugin,
    fieldName: "inquiry_id",
    idValue: inquiryId,
    missingIdMessage: "Inquiry ID is missing.",
    file,
    uploadPath,
    additionalPayload,
  });
}

export async function createJobUploadRecord({ plugin, jobId, payload } = {}) {
  return createUploadRecordByField({
    plugin,
    fieldName: "job_id",
    idValue: jobId,
    missingIdMessage: "Job ID is missing.",
    payload,
  });
}

export async function createInquiryUploadRecord({ plugin, inquiryId, payload } = {}) {
  return createUploadRecordByField({
    plugin,
    fieldName: "inquiry_id",
    idValue: inquiryId,
    missingIdMessage: "Inquiry ID is missing.",
    payload,
  });
}

export async function updateUploadRecordFields({ plugin, id, payload } = {}) {
  return updateUploadRecordById({ plugin, id, payload });
}

export function subscribeJobUploadsByJobId({ plugin, jobId, onChange, onError } = {}) {
  return subscribeUploadsByField({
    plugin,
    fieldName: "job_id",
    idValue: jobId,
    onChange,
    onError,
    logLabel: "Job uploads",
  });
}

export function subscribeInquiryUploadsByInquiryId({
  plugin,
  inquiryId,
  onChange,
  onError,
} = {}) {
  return subscribeUploadsByField({
    plugin,
    fieldName: "inquiry_id",
    idValue: inquiryId,
    onChange,
    onError,
    logLabel: "Inquiry uploads",
  });
}

export async function uploadMaterialFile({ file, uploadPath = "materials/receipts" } = {}) {
  return uploadFileToStorage({ file, uploadPath });
}

export async function deleteUploadRecord({ plugin, id } = {}) {
  return deleteUploadRecordById({ plugin, id });
}
