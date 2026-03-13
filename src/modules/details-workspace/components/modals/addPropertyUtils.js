import {
  BUILDING_FEATURE_LABEL_BY_VALUE,
  BUILDING_FEATURE_VALUE_BY_LABEL,
  INITIAL_FORM,
} from "./addPropertySchema.js";

export function trimValue(value) {
  return String(value || "").trim();
}

export function normalizeWholeNumber(value) {
  return trimValue(value).replace(/[^\d]/g, "");
}

function normalizeBuildingFeatureValue(value) {
  const raw = trimValue(value);
  if (!raw) return "";

  if (BUILDING_FEATURE_LABEL_BY_VALUE[raw]) return raw;

  const fromLabel = BUILDING_FEATURE_VALUE_BY_LABEL[raw.toLowerCase()];
  if (fromLabel) return fromLabel;

  const idMatch = raw.match(/\d+/);
  if (idMatch && BUILDING_FEATURE_LABEL_BY_VALUE[idMatch[0]]) return idMatch[0];

  return "";
}

function extractFeatureTokens(value) {
  if (value === null || value === undefined) return [];

  const raw =
    typeof value === "object" && !Array.isArray(value)
      ? value.id || value.value || value.name || value.label || ""
      : value;
  const text = trimValue(raw);
  if (!text) return [];

  return text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => trimValue(item))
    .filter(Boolean);
}

export function getBuildingFeatureLabel(value) {
  const normalizedValue = normalizeBuildingFeatureValue(value);
  if (!normalizedValue) return trimValue(value);
  return BUILDING_FEATURE_LABEL_BY_VALUE[normalizedValue] || normalizedValue;
}

function normalizeFeatures(features) {
  const tokens = Array.isArray(features)
    ? features.flatMap((item) => extractFeatureTokens(item))
    : typeof features === "string"
      ? extractFeatureTokens(features)
      : [];

  if (!tokens.length) return [];

  return Array.from(
    new Set(tokens.map((item) => normalizeBuildingFeatureValue(item)).filter(Boolean))
  );
}

function parseBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = trimValue(value).toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes";
}

export function mapInitialDataToForm(initialData = null) {
  if (!initialData || typeof initialData !== "object") return { ...INITIAL_FORM };

  return {
    ...INITIAL_FORM,
    id: trimValue(initialData.id || initialData.ID || ""),
    unique_id: trimValue(initialData.unique_id || initialData.Unique_ID || ""),
    property_name: trimValue(
      initialData.property_name ||
        initialData.Property_Name ||
        initialData.Property_Property_Name ||
        ""
    ),
    lot_number: trimValue(initialData.lot_number || initialData.Lot_Number || ""),
    unit_number: trimValue(initialData.unit_number || initialData.Unit_Number || ""),
    address_1: trimValue(initialData.address_1 || initialData.Address_1 || initialData.address || ""),
    address_2: trimValue(initialData.address_2 || initialData.Address_2 || ""),
    suburb_town: trimValue(
      initialData.suburb_town || initialData.Suburb_Town || initialData.city || initialData.City || ""
    ),
    postal_code: trimValue(
      initialData.postal_code || initialData.Postal_Code || initialData.zip_code || initialData.Zip_Code || ""
    ),
    state: trimValue(initialData.state || initialData.State || ""),
    country: trimValue(initialData.country || initialData.Country || "AU") || "AU",
    property_type: trimValue(initialData.property_type || initialData.Property_Type || ""),
    building_type: trimValue(initialData.building_type || initialData.Building_Type || ""),
    building_type_other: trimValue(
      initialData.building_type_other || initialData.Building_Type_Other || ""
    ),
    foundation_type: trimValue(initialData.foundation_type || initialData.Foundation_Type || ""),
    bedrooms: trimValue(initialData.bedrooms || initialData.Bedrooms || ""),
    manhole: parseBoolean(initialData.manhole || initialData.Manhole),
    stories: normalizeWholeNumber(initialData.stories || initialData.Stories || ""),
    building_age: trimValue(initialData.building_age || initialData.Building_Age || ""),
    building_features: normalizeFeatures(
      initialData.building_features ||
        initialData.Building_Features ||
        initialData.building_features_options_as_text ||
        initialData.Building_Features_Options_As_Text ||
        []
    ),
  };
}
