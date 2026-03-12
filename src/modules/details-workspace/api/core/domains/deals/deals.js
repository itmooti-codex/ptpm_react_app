import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout } from "../../transport.js";
import { extractFirstRecord } from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import { parseDealUpdateMutationResult } from "./dealsMutationResultHelpers.js";

function normalizeDealDetailRecord(rawDeal = {}) {
  return {
    id: String(rawDeal?.id || rawDeal?.ID || rawDeal?.DealsID || "").trim(),
    deal_name: String(rawDeal?.deal_name || rawDeal?.Deal_Name || "").trim(),
    deal_value: String(rawDeal?.deal_value || rawDeal?.Deal_Value || "").trim(),
    sales_stage: String(rawDeal?.sales_stage || rawDeal?.Sales_Stage || "").trim(),
    expected_win: String(rawDeal?.expected_win || rawDeal?.Expected_Win || "").trim(),
    expected_close_date: rawDeal?.expected_close_date || rawDeal?.Expected_Close_Date || "",
    actual_close_date: rawDeal?.actual_close_date || rawDeal?.Actual_Close_Date || "",
    weighted_value: String(rawDeal?.weighted_value || rawDeal?.Weighted_Value || "").trim(),
    recent_activity: String(rawDeal?.recent_activity || rawDeal?.Recent_Activity || "").trim(),
  };
}

export async function fetchDealRecordById({ plugin, dealId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(dealId);
  if (!normalizedId) {
    throw new Error("Deal ID is missing.");
  }

  const dealModel = resolvedPlugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) {
    throw new Error("Deal model is unavailable.");
  }

  const query = dealModel
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select([
      "id",
      "deal_name",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "recent_activity",
    ]);

  query.getOrInitQueryCalc?.();
  const result = await fetchDirectWithTimeout(query);
  const deal = extractFirstRecord(result);
  if (!deal) return null;
  return normalizeDealDetailRecord(deal);
}

export async function updateDealRecordById({ plugin, dealId, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(dealId);
  if (!normalizedId) {
    throw new Error("Deal ID is missing.");
  }

  const dealModel = resolvedPlugin.switchTo("PeterpmDeal");
  if (!dealModel?.mutation) {
    throw new Error("Deal model is unavailable.");
  }

  const mutation = await dealModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, mutationId: id } = parseDealUpdateMutationResult(result);
  if (updatedRecord === null || (!updatedRecord && !id)) {
    console.warn(
      "[JobDirect] Deal update returned no updated record. Treating as success.",
      result
    );
  }

  return {
    ...(updatedRecord && typeof updatedRecord === "object"
      ? normalizeDealDetailRecord(updatedRecord)
      : normalizeDealDetailRecord(payload || {})),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || normalizedId),
  };
}
