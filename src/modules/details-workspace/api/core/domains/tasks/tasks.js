import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import {
  extractRecords,
} from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  TASK_RECORD_SELECT_FIELDS,
  normalizeTaskMutationPayload,
  normalizeTaskRecord,
  hasMeaningfulTaskContent,
  buildTaskCalcQuery,
} from "./tasksHelpers.js";
import {
  parseTaskCreateMutationResult,
  parseTaskUpdateMutationResult,
  parseTaskDeleteMutationResult,
} from "./tasksMutationResultHelpers.js";

export function subscribeTasksByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const taskModel = resolvedPlugin.switchTo?.("PeterpmTask");
  if (!taskModel?.query) return () => {};

  const query = taskModel
    .query()
    .where("Job_id", normalizedJobId)
    .deSelectAll()
    .select(TASK_RECORD_SELECT_FIELDS)
    .include("Assignee", (assigneeQuery) =>
      assigneeQuery.deSelectAll().select(["first_name", "last_name", "email"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeTaskRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Tasks subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchTasksByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const taskModel = resolvedPlugin.switchTo("PeterpmTask");
    const customQuery = taskModel
      .query()
      .fromGraphql(
        buildTaskCalcQuery({
          variableName: "Job_id",
          variableType: "PeterpmJobID",
          relationField: "Job_id",
        })
      );

    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { Job_id: normalizedJobId },
    });
    return extractRecords(response)
      .map((record) => normalizeTaskRecord(record))
      .filter((task) => hasMeaningfulTaskContent(task));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch tasks", error);
    return [];
  }
}

export async function fetchTasksByDealId({ plugin, dealId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedDealId = normalizeIdentifier(dealId);
  if (!normalizedDealId) return [];

  try {
    const taskModel = resolvedPlugin.switchTo("PeterpmTask");
    const customQuery = taskModel
      .query()
      .fromGraphql(
        buildTaskCalcQuery({
          variableName: "Deal_id",
          variableType: "PeterpmDealID",
          relationField: "Deal_id",
        })
      );

    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { Deal_id: normalizedDealId },
    });
    return extractRecords(response)
      .map((record) => normalizeTaskRecord(record))
      .filter((task) => hasMeaningfulTaskContent(task));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch deal tasks", error);
    return [];
  }
}

export async function createTaskRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutationPayload = normalizeTaskMutationPayload(payload, { forCreate: true });
  if (!mutationPayload?.Job_id && !mutationPayload?.Deal_id) {
    throw new Error("Task create is missing Job_id or Deal_id.");
  }

  const mutation = await taskModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseTaskCreateMutationResult(result);

  return normalizeTaskRecord({
    ...(mutationPayload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateTaskRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Task ID is missing.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutationPayload = normalizeTaskMutationPayload(payload, { forCreate: false });
  const mutation = await taskModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, id: resolvedId } = parseTaskUpdateMutationResult(result, {
    normalizedId,
  });

  return normalizeTaskRecord({
    ...(mutationPayload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId,
  });
}

export async function deleteTaskRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Task ID is missing.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutation = await taskModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Task delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  return parseTaskDeleteMutationResult(result, { normalizedId });
}
