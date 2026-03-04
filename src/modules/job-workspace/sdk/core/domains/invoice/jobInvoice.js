import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import {
  extractFirstRecord,
  extractOperationRecord,
} from "../../../utils/sdkResponseUtils.js";
import {
  fetchActivitiesByJobId,
  fetchMaterialsByJobId,
} from "../activities/activitiesMaterials.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  fetchJobDirectDataByUidWithRetries,
  executeJobUpdateMutation,
  watchJobInvoiceApiResponseChange,
  persistInvoiceActivitySelectionUpdates,
} from "./jobInvoiceRuntimeHelpers.js";
import {
  normalizeEpochSeconds,
  getFirstNonEmptyText,
  normalizeStatusText,
  normalizeInvoiceBillContextRecord,
} from "./jobInvoiceNormalizationHelpers.js";
import {
  buildJobByFieldQuery,
  buildInvoiceJobSnapshotQuery,
} from "./jobInvoiceQueryHelpers.js";

export async function fetchInvoiceJobSnapshotById({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return null;

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmJob")
      .query()
      .fromGraphql(buildInvoiceJobSnapshotQuery());

    const response = await fetchDirectWithTimeout(query, {
      variables: { id: normalizedJobId },
    });
    const record = extractOperationRecord(response, "getJob");
    if (!record || typeof record !== "object") return null;
    return normalizeInvoiceBillContextRecord(record);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch invoice job snapshot", { jobId: normalizedJobId, error });
    return null;
  }
}

export async function fetchJobDirectDataByUid({ jobUid, plugin } = {}) {
  const normalizedUid = String(jobUid || "").trim();
  if (!normalizedUid) return null;

  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin) {
    console.warn("[JobDirect] SDK plugin not found on window. Job fetch skipped.");
    return null;
  }

  const jobModel = resolvedPlugin.switchTo?.("PeterpmJob");
  if (!jobModel) return null;

  try {
    return await fetchJobDirectDataByUidWithRetries(jobModel, normalizedUid);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch job by jobuid", normalizedUid, error);
  }

  return null;
}

export function subscribeJobById({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const jobModel = resolvedPlugin.switchTo?.("PeterpmJob");
  if (!jobModel?.query) return () => {};

  const query = buildJobByFieldQuery(jobModel, "id", normalizedJobId).noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const record = normalizeInvoiceBillContextRecord(extractFirstRecord(payload));
      if (record && typeof record === "object") {
        onChange?.(record);
      }
    },
    onError: (error) => {
      console.error("[JobDirect] Job subscription failed", error);
      onError?.(error);
    },
  });
}

export async function updateJobRecordByUid({ plugin, uniqueId, payload } = {}) {
  const normalizedUid = String(uniqueId || "").trim();
  if (!normalizedUid) {
    throw new Error("Job UID is missing.");
  }

  const { updatedRecord, id } = await executeJobUpdateMutation({
    plugin,
    whereField: "unique_id",
    whereValue: normalizedUid,
    payload,
  });

  return {
    unique_id: normalizedUid,
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || ""),
  };
}

export async function updateJobRecordById({ plugin, id, payload } = {}) {
  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Job ID is missing.");
  }

  const { updatedRecord, id: mutationId } = await executeJobUpdateMutation({
    plugin,
    whereField: "id",
    whereValue: normalizedId,
    payload,
  });

  return {
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
  };
}

export async function fetchInvoiceBillContextByJobUid({ plugin, jobUid } = {}) {
  const job = await fetchJobDirectDataByUid({ plugin, jobUid });
  if (!job) return null;

  const jobId = normalizeIdentifier(job?.id || job?.ID);
  const [activities, materials] = await Promise.all([
    fetchActivitiesByJobId({ plugin, jobId }),
    fetchMaterialsByJobId({ plugin, jobId }),
  ]);

  return {
    job: normalizeInvoiceBillContextRecord(job),
    activities: Array.isArray(activities) ? activities : [],
    materials: Array.isArray(materials) ? materials : [],
  };
}

export async function updateInvoiceTriggerByJobId({ plugin, jobId, payload } = {}) {
  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }

  const normalizedInvoiceDate = normalizeEpochSeconds(payload?.invoice_date);
  const normalizedDueDate = normalizeEpochSeconds(payload?.due_date);
  if (normalizedInvoiceDate === null || normalizedDueDate === null) {
    throw new Error("Invoice Date and Due Date are required.");
  }

  const triggerPayload = {
    invoice_date: normalizedInvoiceDate,
    due_date: normalizedDueDate,
    xero_invoice_status:
      getFirstNonEmptyText(payload?.xero_invoice_status) || "Create Invoice",
  };

  let updatedRecord = null;
  let id = normalizedJobId;
  try {
    const updateResult = await executeJobUpdateMutation({
      plugin,
      whereField: "id",
      whereValue: normalizedJobId,
      payload: triggerPayload,
    });
    updatedRecord = updateResult?.updatedRecord || null;
    id = updateResult?.id || normalizedJobId;
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const canRecoverWithSnapshot =
      message.includes("cancelled") || message.includes("no updated record");
    if (!canRecoverWithSnapshot) {
      throw error;
    }

    const snapshot = await fetchInvoiceJobSnapshotById({
      plugin,
      jobId: normalizedJobId,
    });

    if (snapshot && typeof snapshot === "object") {
      const snapshotInvoiceDate = normalizeEpochSeconds(
        snapshot?.invoice_date ?? snapshot?.Invoice_Date
      );
      const snapshotDueDate = normalizeEpochSeconds(snapshot?.due_date ?? snapshot?.Due_Date);
      const snapshotStatus = getFirstNonEmptyText(
        snapshot?.xero_invoice_status,
        snapshot?.Xero_Invoice_Status
      );
      const applied =
        snapshotInvoiceDate === normalizedInvoiceDate &&
        snapshotDueDate === normalizedDueDate &&
        normalizeStatusText(snapshotStatus) ===
          normalizeStatusText(triggerPayload.xero_invoice_status);

      if (applied) {
        updatedRecord = snapshot;
        id = normalizeIdentifier(snapshot?.id || snapshot?.ID || normalizedJobId);
      }
    }

    if (!updatedRecord) {
      // SDK occasionally reports cancelled despite dispatching the update mutation.
      // Return optimistic payload and let subsequent query/subscription confirm backend state.
      updatedRecord = {
        id: normalizedJobId,
        invoice_date: normalizedInvoiceDate,
        due_date: normalizedDueDate,
        xero_invoice_status: triggerPayload.xero_invoice_status,
      };
      id = normalizedJobId;
    }
  }

  return {
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || normalizedJobId),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
  };
}

export async function updateBillTriggerByJobId({ plugin, jobId, payload } = {}) {
  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }
  return updateJobRecordById({
    plugin,
    id: normalizedJobId,
    payload,
  });
}

export async function waitForJobInvoiceApiResponseChange({
  plugin,
  jobId,
  previous = null,
  timeoutMs = 45000,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }

  const jobModel = resolvedPlugin.switchTo("PeterpmJob");
  if (!jobModel?.query) {
    throw new Error("Job model is unavailable.");
  }

  return watchJobInvoiceApiResponseChange({
    jobModel,
    normalizedJobId,
    previous,
    timeoutMs,
  });
}

export async function persistInvoiceActivitySelection({ plugin, activityUpdates = [] } = {}) {
  return persistInvoiceActivitySelectionUpdates({
    plugin,
    activityUpdates,
  });
}
