import {
  createJobUploadFromFile,
  deleteUploadRecord,
  fetchJobUploads,
} from "@modules/details-workspace/exports/api.js";
import { normalizeId } from "./_helpers.js";

export async function fetchUploadsForDetails({ plugin, jobId } = {}) {
  if (!normalizeId(jobId)) return [];
  return fetchJobUploads({ plugin, jobId: normalizeId(jobId) });
}

export async function createUploadForDetails({
  plugin,
  file,
  jobId,
  inquiryId,
  uploadPath = "",
} = {}) {
  const normalizedJobId = normalizeId(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is required to upload files.");
  }

  const created = await createJobUploadFromFile({
    plugin,
    jobId: normalizedJobId,
    file,
    uploadPath: uploadPath || `job-uploads/${normalizedJobId}`,
    additionalPayload: normalizeId(inquiryId)
      ? {
          inquiry_id: normalizeId(inquiryId),
        }
      : null,
  });
  const createdUploadId = normalizeId(created?.id || created?.ID);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (createdUploadId && normalizedInquiryId) {
    try {
      const mutation = await plugin.switchTo("PeterpmUpload").mutation();
      mutation.update((query) =>
        query.where("id", createdUploadId).set({
          inquiry_id: normalizedInquiryId,
        })
      );
      await mutation.execute(true).toPromise();
    } catch (linkError) {
      console.warn("[jobDetailsSdk] Upload created but inquiry link update failed", linkError);
    }
  }
  return created;
}

export async function deleteUploadForDetails({ plugin, uploadId } = {}) {
  return deleteUploadRecord({ plugin, id: uploadId });
}
