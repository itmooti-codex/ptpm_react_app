import { toText } from "@shared/utils/formatters.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import { normalizePropertyRecord } from "./propertyHelpers.js";

/**
 * Normalizes a property record from any source (API responses, subscriptions,
 * lookup results). Spreads the raw record first so all original fields are
 * preserved, then overlays normalized values for key address/identity fields.
 */
export function normalizePropertyLookupRecord(record = {}) {
  const normalized = normalizePropertyRecord(record);
  const address1 = normalized.address_1 || toText(record?.address || record?.Address);
  return {
    ...record,
    ...normalized,
    address: address1 || normalized.address_2,
    city: normalized.suburb_town || normalized.city,
    property_name: normalized.property_name || address1 || normalized.unique_id,
  };
}

export function getPropertyLookupKey(record = {}) {
  const id = normalizeIdentifier(record?.id || record?.ID || record?.Property_ID);
  if (id) return `property-id:${id}`;
  return [
    "property",
    toText(record?.unique_id || record?.Unique_ID),
    toText(record?.property_name || record?.Property_Name),
    toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address),
    toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City),
  ].join("|");
}

function hasMeaningfulValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim() !== "";
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function mergePreferMeaningfulValues(base = {}, incoming = {}) {
  const merged = { ...base };
  Object.entries(incoming || {}).forEach(([key, value]) => {
    if (!(key in merged) || hasMeaningfulValue(value)) {
      merged[key] = value;
    }
  });
  return merged;
}

export function dedupePropertyLookupRecords(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const normalized = normalizePropertyLookupRecord(record);
    const key = getPropertyLookupKey(normalized);
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, normalized);
      return;
    }
    map.set(key, mergePreferMeaningfulValues(map.get(key), normalized));
  });
  return Array.from(map.values());
}

export function mergePropertyLookupRecords(...collections) {
  return dedupePropertyLookupRecords(collections.flatMap((collection) => collection || []));
}

export function getPropertyRecordSignature(record = {}) {
  return [
    normalizeIdentifier(record?.id || record?.ID || record?.Property_ID),
    toText(record?.unique_id || record?.Unique_ID),
    toText(record?.property_name || record?.Property_Name),
    toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address),
    toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City),
    toText(record?.state || record?.State),
    toText(record?.postal_code || record?.Postal_Code || record?.zip_code || record?.Zip_Code),
    toText(record?.country || record?.Country),
    toText(record?.property_type || record?.Property_Type),
    toText(record?.building_type || record?.Building_Type),
    toText(record?.building_type_other || record?.Building_Type_Other),
    toText(record?.foundation_type || record?.Foundation_Type),
    toText(record?.bedrooms || record?.Bedrooms),
    toText(record?.stories || record?.Stories),
    toText(record?.building_age || record?.Building_Age),
    toText(record?.building_features_options_as_text || record?.building_features),
    String(Boolean(record?.manhole ?? record?.Manhole)),
  ].join("::");
}

export function arePropertyRecordCollectionsEqual(left = [], right = []) {
  const leftList = dedupePropertyLookupRecords(left || []);
  const rightList = dedupePropertyLookupRecords(right || []);
  if (leftList.length !== rightList.length) return false;
  const rightMap = new Map(
    rightList.map((record) => [getPropertyLookupKey(record), getPropertyRecordSignature(record)])
  );
  for (const record of leftList) {
    const key = getPropertyLookupKey(record);
    const signature = getPropertyRecordSignature(record);
    if (!rightMap.has(key)) return false;
    if (rightMap.get(key) !== signature) return false;
  }
  return true;
}

export function mergePropertyCollectionsIfChanged(previous = [], ...collections) {
  const merged = mergePropertyLookupRecords(previous, ...collections);
  if (arePropertyRecordCollectionsEqual(previous, merged)) {
    return previous;
  }
  return merged;
}

export function resolvePropertyLookupLabel(record = {}) {
  return toText(
    record?.property_name ||
      record?.Property_Name ||
      record?.address_1 ||
      record?.Address_1 ||
      record?.address ||
      record?.Address ||
      record?.unique_id ||
      record?.Unique_ID
  );
}

export function normalizeAddressText(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

export function buildComparablePropertyAddress(record = {}) {
  const street = toText(record?.address_1 || record?.Address_1 || record?.address || record?.Address);
  const suburb = toText(record?.suburb_town || record?.Suburb_Town || record?.city || record?.City);
  const state = toText(record?.state || record?.State);
  const postal = toText(record?.postal_code || record?.Postal_Code || record?.zip_code || record?.Zip_Code);
  return normalizeAddressText([street, suburb, state, postal].filter(Boolean).join(" "));
}
