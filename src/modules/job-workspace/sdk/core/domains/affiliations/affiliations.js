import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, isTimeoutError, subscribeToQueryStream } from "../../transport.js";
import {
  extractRecords,
} from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  AFFILIATION_RECORD_SELECT_FIELDS,
  normalizeAffiliationRecord,
  dedupeAffiliations,
} from "./affiliationsHelpers.js";
import {
  parseAffiliationCreateMutationResult,
  parseAffiliationUpdateMutationResult,
  parseAffiliationDeleteMutationResult,
} from "./affiliationsMutationResultHelpers.js";

export async function fetchPropertyAffiliationsByPropertyId({ plugin, propertyId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedPropertyId = normalizeIdentifier(propertyId);
  if (!normalizedPropertyId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmAffiliation")
      .query()
      .where("property_id", normalizedPropertyId)
      .deSelectAll()
      .select(AFFILIATION_RECORD_SELECT_FIELDS)
      .include("Contact", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
      )
      .include("Company", (companyQuery) =>
        companyQuery.deSelectAll().select(["name", "phone"])
      )
      .include("Company_as_Accounts_Contact", (companyQuery) =>
        companyQuery.deSelectAll().select(["name", "phone"])
      )
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, 20000);
    const records = extractRecords(response).map((item) => normalizeAffiliationRecord(item));
    return dedupeAffiliations(records);
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.error("[JobDirect] Failed to fetch property affiliations", error);
    }
    return [];
  }
}

export function subscribePropertyAffiliationsByPropertyId({
  plugin,
  propertyId,
  onChange,
  onError,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedPropertyId = normalizeIdentifier(propertyId);
  if (!normalizedPropertyId) return () => {};

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.query) return () => {};

  const query = model
    .query()
    .where("property_id", normalizedPropertyId)
    .deSelectAll()
    .select(AFFILIATION_RECORD_SELECT_FIELDS)
    .include("Contact", (contactQuery) =>
      contactQuery.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
    )
    .include("Company", (companyQuery) => companyQuery.deSelectAll().select(["name", "phone"]))
    .include("Company_as_Accounts_Contact", (companyQuery) =>
      companyQuery.deSelectAll().select(["name", "phone"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((item) => normalizeAffiliationRecord(item));
      onChange?.(dedupeAffiliations(records));
    },
    onError: (error) => {
      console.error("[JobDirect] Property affiliations subscription failed", error);
      onError?.(error);
    },
  });
}

export async function createAffiliationRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parseAffiliationCreateMutationResult(result);

  return normalizeAffiliationRecord({
    ...(payload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateAffiliationRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Affiliation ID is missing.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: updatedRecord, id: resolvedId } = parseAffiliationUpdateMutationResult(result, {
    normalizedId,
  });
  if (updatedRecord === null || !updatedRecord) {
    console.warn(
      "[JobDirect] Affiliation update returned no updated record. Treating as success.",
      result
    );
    return normalizeAffiliationRecord({
      ...(payload || {}),
      id: normalizedId,
    });
  }
  return normalizeAffiliationRecord({
    ...(payload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId,
  });
}

export async function deleteAffiliationRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Affiliation ID is missing.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Affiliation delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  return parseAffiliationDeleteMutationResult(result, { normalizedId });
}
