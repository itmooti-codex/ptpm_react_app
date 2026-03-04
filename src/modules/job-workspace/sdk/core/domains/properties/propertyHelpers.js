const PROPERTY_FEATURE_OPTIONS = [
  { value: "713", label: "Brick" },
  { value: "712", label: "Concrete" },
  { value: "711", label: "Flat Roof" },
  { value: "710", label: "Highset" },
  { value: "709", label: "Iron Roof" },
  { value: "708", label: "Lowset" },
  { value: "707", label: "PostWar" },
  { value: "706", label: "Queenslander" },
  { value: "705", label: "Raked Ceiling" },
  { value: "704", label: "Sloping Block" },
  { value: "703", label: "Super 6 / Fibro roof" },
  { value: "702", label: "Tile Roof" },
  { value: "701", label: "Town house" },
  { value: "700", label: "Unit Block" },
  { value: "699", label: "Warehouse" },
  { value: "698", label: "Wood" },
  { value: "697", label: "Wood & Brick" },
];

export const PROPERTY_RECORD_SELECT_FIELDS = [
  "id",
  "unique_id",
  "property_name",
  "lot_number",
  "unit_number",
  "address_1",
  "address_2",
  "address",
  "city",
  "suburb_town",
  "state",
  "postal_code",
  "zip_code",
  "country",
  "property_type",
  "building_type",
  "building_type_other",
  "foundation_type",
  "bedrooms",
  "manhole",
  "stories",
  "building_age",
  "building_features",
  "building_features_options_as_text",
];

export const BUILDING_FEATURE_ID_SELECT_FIELDS = ["id"];

export const PROPERTY_FEATURE_LABEL_BY_VALUE = Object.fromEntries(
  PROPERTY_FEATURE_OPTIONS.map((option) => [String(option.value), option.label])
);
const PROPERTY_FEATURE_VALUE_BY_LABEL = Object.fromEntries(
  PROPERTY_FEATURE_OPTIONS.map((option) => [
    String(option.label).trim().toLowerCase(),
    String(option.value),
  ])
);

export function normalizePropertyFeatureValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (PROPERTY_FEATURE_LABEL_BY_VALUE[raw]) return raw;
  const fromLabel = PROPERTY_FEATURE_VALUE_BY_LABEL[raw.toLowerCase()];
  if (fromLabel) return fromLabel;
  const idMatch = raw.match(/\d+/);
  if (idMatch && PROPERTY_FEATURE_LABEL_BY_VALUE[idMatch[0]]) return idMatch[0];
  return "";
}

export function extractPropertyFeatureTokens(value) {
  if (value === null || value === undefined) return [];

  const raw =
    typeof value === "object" && !Array.isArray(value)
      ? value.id || value.value || value.name || value.label || ""
      : value;
  const text = String(raw || "").trim();
  if (!text) return [];

  return text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

export function serializePropertyFeatureTokens(values = []) {
  const normalized = Array.from(
    new Set(
      (Array.isArray(values) ? values : [])
        .map((item) => normalizePropertyFeatureValue(item))
        .filter(Boolean)
    )
  );
  if (!normalized.length) return "";
  return normalized.map((item) => `*/*${item}*/*`).join("");
}

export function normalizePropertyRecord(rawProperty = {}) {
  const featureArray = Array.isArray(rawProperty?.Building_Features)
    ? rawProperty.Building_Features.map(
        (item) => item?.id || item?.value || item?.name || item?.label || item
      )
        .filter(Boolean)
        .map((item) => String(item).trim())
    : [];

  return {
    id: String(
      rawProperty?.id ||
        rawProperty?.ID ||
        rawProperty?.Property_ID ||
        rawProperty?.PropertiesID ||
        ""
    ).trim(),
    unique_id: String(
      rawProperty?.unique_id ||
        rawProperty?.Unique_ID ||
        rawProperty?.Property_Unique_ID ||
        rawProperty?.Properties_Unique_ID ||
        ""
    ).trim(),
    property_name: String(
      rawProperty?.property_name ||
        rawProperty?.Property_Name ||
        rawProperty?.Property_Property_Name ||
        rawProperty?.Properties_Property_Name ||
        ""
    ).trim(),
    lot_number: String(rawProperty?.lot_number || rawProperty?.Lot_Number || "").trim(),
    unit_number: String(rawProperty?.unit_number || rawProperty?.Unit_Number || "").trim(),
    address_1: String(rawProperty?.address_1 || rawProperty?.Address_1 || "").trim(),
    address_2: String(rawProperty?.address_2 || rawProperty?.Address_2 || "").trim(),
    address: String(rawProperty?.address || rawProperty?.Address || "").trim(),
    city: String(rawProperty?.city || rawProperty?.City || "").trim(),
    suburb_town: String(rawProperty?.suburb_town || rawProperty?.Suburb_Town || "").trim(),
    state: String(rawProperty?.state || rawProperty?.State || "").trim(),
    postal_code: String(
      rawProperty?.postal_code ||
        rawProperty?.Postal_Code ||
        rawProperty?.zip_code ||
        rawProperty?.Zip_Code ||
        ""
    ).trim(),
    zip_code: String(rawProperty?.zip_code || rawProperty?.Zip_Code || "").trim(),
    country: String(rawProperty?.country || rawProperty?.Country || "").trim(),
    property_type: String(rawProperty?.property_type || rawProperty?.Property_Type || "").trim(),
    building_type: String(rawProperty?.building_type || rawProperty?.Building_Type || "").trim(),
    building_type_other: String(
      rawProperty?.building_type_other || rawProperty?.Building_Type_Other || ""
    ).trim(),
    foundation_type: String(
      rawProperty?.foundation_type || rawProperty?.Foundation_Type || ""
    ).trim(),
    bedrooms: String(rawProperty?.bedrooms || rawProperty?.Bedrooms || "").trim(),
    manhole:
      rawProperty?.manhole === true ||
      String(rawProperty?.manhole || rawProperty?.Manhole || "").trim().toLowerCase() === "true",
    stories: String(rawProperty?.stories || rawProperty?.Stories || "").trim(),
    building_age: String(rawProperty?.building_age || rawProperty?.Building_Age || "").trim(),
    building_features:
      featureArray.length > 0
        ? featureArray
        : extractPropertyFeatureTokens(
            String(
              rawProperty?.building_features ||
                rawProperty?.Building_Features_Options_As_Text ||
                rawProperty?.building_features_options_as_text ||
                ""
            )
          )
            .map((item) => normalizePropertyFeatureValue(item) || String(item || "").trim())
            .filter(Boolean),
    building_features_options_as_text: String(
      rawProperty?.building_features_options_as_text ||
        rawProperty?.Building_Features_Options_As_Text ||
        rawProperty?.building_features ||
        ""
    ).trim(),
  };
}
