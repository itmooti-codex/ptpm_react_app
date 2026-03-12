import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout } from "../../transport.js";
import { extractFirstRecord } from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  buildJobByFieldQuery,
  JOB_INVOICE_API_RESPONSE_SELECT_FIELDS,
} from "./jobInvoiceQueryHelpers.js";
import {
  normalizeInvoiceBillContextRecord,
  extractInvoiceApiResponseSnapshot,
} from "./jobInvoiceNormalizationHelpers.js";
import {
  assertInvoiceActivitySelectionMutationResult,
  parseJobUpdateMutationResult,
} from "./jobInvoiceMutationResultHelpers.js";

export async function fetchFirstByField(jobModel, field, value, { timeoutMs = 10000 } = {}) {
  const query = buildJobByFieldQuery(jobModel, field, value).noDestroy();

  query.getOrInitQueryCalc?.();
  const result = await fetchDirectWithTimeout(query, null, timeoutMs);
  return normalizeInvoiceBillContextRecord(extractFirstRecord(result));
}

export async function fetchJobDirectDataByUidWithRetries(jobModel, normalizedUid) {
  const retryTimeouts = [10000, 15000, 20000];
  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  for (let attempt = 0; attempt < retryTimeouts.length; attempt += 1) {
    const timeoutMs = retryTimeouts[attempt];
    const byUniqueId = await fetchFirstByField(jobModel, "unique_id", normalizedUid, {
      timeoutMs,
    });
    if (byUniqueId) return byUniqueId;

    if (/^\d+$/.test(normalizedUid)) {
      const byId = await fetchFirstByField(jobModel, "id", Number.parseInt(normalizedUid, 10), {
        timeoutMs,
      });
      if (byId) return byId;
    }

    if (attempt < retryTimeouts.length - 1) {
      await wait(400 * (attempt + 1));
    }
  }

  return null;
}

export async function executeJobUpdateMutation({
  plugin,
  whereField,
  whereValue,
  payload,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const jobModel = resolvedPlugin.switchTo("PeterpmJob");
  if (!jobModel?.mutation) {
    throw new Error("Job model is unavailable.");
  }

  const mutation = await jobModel.mutation();
  mutation.update((query) => query.where(whereField, whereValue).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, id: resolvedId } = parseJobUpdateMutationResult(result, {
    whereField,
    whereValue,
  });

  if (updatedRecord === null || (!updatedRecord && !resolvedId)) {
    // SDK occasionally reports no updated record even when mutation is persisted.
    // Avoid false-negative failures for caller flows that only need mutation dispatch.
    console.warn("[JobDirect] Job update returned no updated record. Treating as success.", result);
  }

  return { updatedRecord, id: resolvedId };
}

export async function watchJobInvoiceApiResponseChange({
  jobModel,
  normalizedJobId,
  previous = null,
  timeoutMs = 45000,
} = {}) {
  if (!jobModel?.query) {
    throw new Error("Job model is unavailable.");
  }

  const previousSnapshot = extractInvoiceApiResponseSnapshot(previous || {});
  const query = jobModel
    .query()
    .where("id", normalizedJobId)
    .deSelectAll()
    .select(JOB_INVOICE_API_RESPONSE_SELECT_FIELDS)
    .noDestroy();

  return await new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    let sub = null;

    const finish = (value) => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      try {
        sub?.unsubscribe?.();
      } catch (_) {}
      try {
        query?.destroy?.();
      } catch (_) {}
      resolve(value || null);
    };

    const handlePayload = (payload) => {
      const firstRecord = extractFirstRecord(payload);
      if (!firstRecord || typeof firstRecord !== "object") return;
      const snapshot = extractInvoiceApiResponseSnapshot(firstRecord);

      const changed =
        snapshot.xero_api_response !== previousSnapshot.xero_api_response ||
        snapshot.invoice_url_admin !== previousSnapshot.invoice_url_admin ||
        snapshot.invoice_url_client !== previousSnapshot.invoice_url_client ||
        snapshot.xero_invoice_status !== previousSnapshot.xero_invoice_status ||
        snapshot.xero_invoice_pdf !== previousSnapshot.xero_invoice_pdf ||
        snapshot.invoice_number !== previousSnapshot.invoice_number;

      if (!changed) return;

      const hasSignal =
        snapshot.xero_api_response ||
        snapshot.invoice_url_admin ||
        snapshot.invoice_url_client ||
        snapshot.xero_invoice_pdf ||
        snapshot.invoice_number;

      if (!hasSignal) return;

      finish(snapshot);
    };

    timeoutId = setTimeout(() => finish(null), timeoutMs);

    try {
      let stream = null;
      if (typeof query.subscribe === "function") {
        stream = query.subscribe();
      }
      if (!stream && typeof query.localSubscribe === "function") {
        stream = query.localSubscribe();
      }
      if (!stream || typeof stream.subscribe !== "function") {
        finish(null);
        return;
      }

      if (
        typeof window !== "undefined" &&
        typeof window.toMainInstance === "function" &&
        typeof stream.pipe === "function"
      ) {
        stream = stream.pipe(window.toMainInstance(true));
      }

      sub = stream.subscribe({
        next: handlePayload,
        error: () => finish(null),
      });
    } catch (_) {
      finish(null);
    }
  });
}

export async function persistInvoiceActivitySelectionUpdates({
  plugin,
  activityUpdates = [],
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const updates = Array.isArray(activityUpdates) ? activityUpdates : [];
  if (!updates.length) return [];

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const settled = await Promise.allSettled(
    updates.map(async (item) => {
      const activityId = normalizeIdentifier(item?.id || item?.activity_id || "");
      if (!activityId) {
        throw new Error("Activity ID is missing.");
      }

      const mutation = await activityModel.mutation();
      mutation.update((query) =>
        query.where("id", activityId).set({
          invoice_to_client: Boolean(item?.invoice_to_client),
        })
      );
      const result = await mutation.execute(true).toPromise();
      assertInvoiceActivitySelectionMutationResult(result);

      return {
        id: activityId,
        invoice_to_client: Boolean(item?.invoice_to_client),
      };
    })
  );

  const failed = settled.filter((item) => item.status === "rejected");
  if (failed.length) {
    const firstReason = failed[0]?.reason;
    throw new Error(firstReason?.message || "Unable to save invoice activity selection.");
  }

  return settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value)
    .filter(Boolean);
}
