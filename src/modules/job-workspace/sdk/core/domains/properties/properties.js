import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout } from "../../transport.js";
import { extractFirstRecord } from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import {
  PROPERTY_RECORD_SELECT_FIELDS,
  BUILDING_FEATURE_ID_SELECT_FIELDS,
  PROPERTY_FEATURE_LABEL_BY_VALUE,
  normalizePropertyFeatureValue,
  extractPropertyFeatureTokens,
  serializePropertyFeatureTokens,
  normalizePropertyRecord,
} from "../properties/propertyHelpers.js";
import {
  parsePropertyCreateMutationResult,
  parsePropertyUpdateMutationResult,
} from "./propertiesMutationResultHelpers.js";

function preparePropertyMutationPayload(payload = {}) {
  const valueOrEmpty = (value) => String(value || "").trim();
  const rawFeatureValues = Array.isArray(payload?.building_features)
    ? payload.building_features
    : Array.isArray(payload?.Building_Features)
      ? payload.Building_Features
      : extractPropertyFeatureTokens(
          valueOrEmpty(payload?.building_features) ||
            valueOrEmpty(payload?.building_features_options_as_text)
        );
  const features = rawFeatureValues
    .flatMap((item) => extractPropertyFeatureTokens(item))
    .map((item) => normalizePropertyFeatureValue(item))
    .filter(Boolean);
  const uniqueFeatures = Array.from(new Set(features));
  const featuresText = uniqueFeatures
    .map((featureId) => PROPERTY_FEATURE_LABEL_BY_VALUE[featureId] || featureId)
    .join(", ");
  const featureOptionsText = serializePropertyFeatureTokens(uniqueFeatures);
  const buildingFeaturesRelation = uniqueFeatures.map((featureId) => ({
    id: /^\d+$/.test(String(featureId)) ? Number.parseInt(featureId, 10) : featureId,
  }));

  return {
    property_name: valueOrEmpty(payload?.property_name),
    lot_number: valueOrEmpty(payload?.lot_number),
    unit_number: valueOrEmpty(payload?.unit_number),
    address_1: valueOrEmpty(payload?.address_1),
    address_2: valueOrEmpty(payload?.address_2),
    suburb_town: valueOrEmpty(payload?.suburb_town),
    postal_code: valueOrEmpty(payload?.postal_code),
    state: valueOrEmpty(payload?.state),
    country: valueOrEmpty(payload?.country),
    property_type: valueOrEmpty(payload?.property_type),
    building_type: valueOrEmpty(payload?.building_type),
    building_type_other: valueOrEmpty(payload?.building_type_other),
    foundation_type: valueOrEmpty(payload?.foundation_type),
    bedrooms: valueOrEmpty(payload?.bedrooms),
    manhole: Boolean(payload?.manhole),
    stories: valueOrEmpty(payload?.stories),
    building_age: valueOrEmpty(payload?.building_age),
    building_features: featuresText,
    building_features_options_as_text: featureOptionsText,
    Building_Features: buildingFeaturesRelation,
  };
}

export async function createPropertyRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.mutation) {
    throw new Error("Property model is unavailable.");
  }

  const mutation = await propertyModel.mutation();
  mutation.createOne(preparePropertyMutationPayload(payload || {}));
  const result = await mutation.execute(true).toPromise();
  const { record: createdRecord, id: resolvedId } = parsePropertyCreateMutationResult(result);

  return {
    ...(payload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  };
}

export async function updatePropertyRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Property ID is missing.");
  }

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.mutation) {
    throw new Error("Property model is unavailable.");
  }

  const mutation = await propertyModel.mutation();
  mutation.update((query) =>
    query.where("id", normalizedId).set(preparePropertyMutationPayload(payload || {}))
  );
  const result = await mutation.execute(true).toPromise();
  const {
    record: updatedRecord,
    id: resolvedId,
    mutationId: createdId,
  } = parsePropertyUpdateMutationResult(result, { normalizedId });

  if (updatedRecord === null || (!updatedRecord && !createdId)) {
    console.warn(
      "[JobDirect] Property update returned no updated record. Treating as success.",
      result
    );
  }

  return {
    ...(payload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: normalizeIdentifier(resolvedId),
  };
}

export async function fetchPropertyRecordById({ plugin, propertyId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(propertyId);
  if (!normalizedId) return null;

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.query) {
    throw new Error("Property model is unavailable.");
  }

  const query = propertyModel
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select(PROPERTY_RECORD_SELECT_FIELDS)
    .include("Building_Features", (featureQuery) =>
      featureQuery.deSelectAll().select(BUILDING_FEATURE_ID_SELECT_FIELDS)
    );

  query.getOrInitQueryCalc?.();
  const response = await fetchDirectWithTimeout(query);
  const record = extractFirstRecord(response);
  if (!record) return null;
  return normalizePropertyRecord(record);
}

export async function fetchPropertyRecordByUniqueId({ plugin, uniqueId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedUid = String(uniqueId || "").trim();
  if (!normalizedUid) return null;

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.query) {
    throw new Error("Property model is unavailable.");
  }

  const query = propertyModel
    .query()
    .where("unique_id", normalizedUid)
    .deSelectAll()
    .select(PROPERTY_RECORD_SELECT_FIELDS)
    .include("Building_Features", (featureQuery) =>
      featureQuery.deSelectAll().select(BUILDING_FEATURE_ID_SELECT_FIELDS)
    );

  query.getOrInitQueryCalc?.();
  const response = await fetchDirectWithTimeout(query);
  const record = extractFirstRecord(response);
  if (!record) return null;
  return normalizePropertyRecord(record);
}
