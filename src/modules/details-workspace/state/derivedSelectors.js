import { selectActivities, selectMaterials } from "./selectors.js";
import { toText } from "../../../shared/utils/formatters.js";

function toNumber(value) {
  const numeric = Number(String(value ?? "").replace(/[^0-9.-]+/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function round2(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.round(numeric * 100) / 100;
}

function normalizeStatus(value = "") {
  return toText(value).toLowerCase();
}

function isTrue(value) {
  if (typeof value === "boolean") return value;
  const normalized = normalizeStatus(value);
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export const selectDefaultInvoiceActivityIds = (() => {
  let previousActivities = null;
  let previousResult = [];

  return (state) => {
    const activities = selectActivities(state);
    if (activities === previousActivities) return previousResult;

    const nextResult = (Array.isArray(activities) ? activities : [])
      .filter((record) => isTrue(record?.invoice_to_client || record?.Invoice_to_Client))
      .map((record) => toText(record?.id || record?.ID))
      .filter(Boolean);

    previousActivities = activities;
    previousResult = nextResult;
    return nextResult;
  };
})();

export const selectBillMaterialSummary = (() => {
  let previousMaterials = null;
  let previousResult = { reimburse: 0, deduct: 0, net: 0 };

  return (state) => {
    const materials = selectMaterials(state);
    if (materials === previousMaterials) return previousResult;

    const summary = (Array.isArray(materials) ? materials : []).reduce(
      (acc, item) => {
        const total = toNumber(item?.total || item?.Total);
        const transactionType = normalizeStatus(item?.transaction_type || item?.Transaction_Type);
        if (transactionType === "reimburse") acc.reimburse += total;
        if (transactionType === "deduct") acc.deduct += total;
        return acc;
      },
      { reimburse: 0, deduct: 0 }
    );

    const nextResult = {
      reimburse: round2(summary.reimburse),
      deduct: round2(summary.deduct),
      net: round2(summary.reimburse - summary.deduct),
    };

    previousMaterials = materials;
    previousResult = nextResult;
    return nextResult;
  };
})();
