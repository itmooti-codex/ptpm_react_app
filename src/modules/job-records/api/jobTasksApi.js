import {
  createTaskRecord,
  fetchTasksByDealId,
  fetchTasksByJobId,
  updateTaskRecord,
} from "@modules/details-workspace/exports/api.js";
import { dedupeById, hasVisibleTaskContent, normalizeId } from "./_helpers.js";

export async function fetchTasksForDetails({ plugin, jobId, inquiryId } = {}) {
  const [jobTasks, inquiryTasks] = await Promise.all([
    normalizeId(jobId) ? fetchTasksByJobId({ plugin, jobId }) : Promise.resolve([]),
    normalizeId(inquiryId)
      ? fetchTasksByDealId({ plugin, dealId: inquiryId })
      : Promise.resolve([]),
  ]);

  return dedupeById([
    ...(Array.isArray(jobTasks) ? jobTasks : []),
    ...(Array.isArray(inquiryTasks) ? inquiryTasks : []),
  ]).filter((task) => hasVisibleTaskContent(task));
}

export async function createTaskForDetails({ plugin, payload, jobId, inquiryId } = {}) {
  const mergedPayload = {
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  const normalizedJobId = normalizeId(jobId);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (normalizedJobId) {
    mergedPayload.job_id = normalizedJobId;
    mergedPayload.Job_id = normalizedJobId;
  }
  if (normalizedInquiryId) {
    mergedPayload.deal_id = normalizedInquiryId;
    mergedPayload.Deal_id = normalizedInquiryId;
  }
  return createTaskRecord({ plugin, payload: mergedPayload });
}

export async function updateTaskForDetails({
  plugin,
  taskId,
  payload,
  jobId,
  inquiryId,
} = {}) {
  const mergedPayload = {
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  const normalizedJobId = normalizeId(jobId);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (normalizedJobId) {
    mergedPayload.job_id = normalizedJobId;
    mergedPayload.Job_id = normalizedJobId;
  }
  if (normalizedInquiryId) {
    mergedPayload.deal_id = normalizedInquiryId;
    mergedPayload.Deal_id = normalizedInquiryId;
  }
  return updateTaskRecord({ plugin, id: taskId, payload: mergedPayload });
}
