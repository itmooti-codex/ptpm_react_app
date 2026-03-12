import { buildLookupDisplayLabel } from "../../../../../shared/utils/lookupLabel.js";

const INQUIRY_LINK_BASE = String(import.meta.env.VITE_INQUIRY_LINK_BASE || "").trim();

export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function getFirstFilledValue(source, keys = []) {
  if (!source || !Array.isArray(keys) || !keys.length) return "";
  for (const key of keys) {
    const value = source?.[key];
    if (value === null || value === undefined) continue;
    if (typeof value === "string" && !value.trim()) continue;
    return value;
  }
  return "";
}

export function resolveContactTypeFromJob(jobData) {
  const accountType = normalizeText(
    getFirstFilledValue(jobData, [
      "account_type",
      "Account_Type",
      "contact_type",
      "Contact_Type",
    ])
  );
  if (accountType.includes("entity") || accountType.includes("company")) {
    return "entity";
  }
  return "individual";
}

export function getJobIndividualSelection(jobData) {
  const id = String(
    getFirstFilledValue(jobData, ["client_individual_id", "Client_Individual_ID"]) ||
      jobData?.Client_Individual?.id ||
      ""
  );
  const first =
    getFirstFilledValue(jobData, ["Client_Individual_First_Name"]) ||
    jobData?.Client_Individual?.first_name ||
    "";
  const last =
    getFirstFilledValue(jobData, ["Client_Individual_Last_Name"]) ||
    jobData?.Client_Individual?.last_name ||
    "";
  const email =
    getFirstFilledValue(jobData, ["Client_Individual_Email"]) ||
    jobData?.Client_Individual?.email ||
    "";
  const sms =
    getFirstFilledValue(jobData, ["Client_Individual_SMS_Number"]) ||
    jobData?.Client_Individual?.sms_number ||
    "";
  const fullName = [first, last].filter(Boolean).join(" ").trim();
  const label = buildLookupDisplayLabel(fullName, email, sms, id);
  return { id, label };
}

export function getJobEntitySelection(jobData) {
  const id = String(
    getFirstFilledValue(jobData, ["client_entity_id", "Client_Entity_ID", "Client_Entity_ID1"]) ||
      jobData?.Client_Entity?.id ||
      ""
  );
  const name =
    getFirstFilledValue(jobData, ["Client_Entity_Name"]) ||
    jobData?.Client_Entity?.name ||
    "";
  const primaryId = String(
    getFirstFilledValue(jobData, ["contact_id", "Contact_Contact_ID"]) ||
      jobData?.Client_Entity?.Primary_Person?.id ||
      ""
  );
  const primaryEmail = String(
    getFirstFilledValue(jobData, ["Contact_Contact_Email", "Client_Entity_Primary_Person_Email"]) ||
      jobData?.Client_Entity?.Primary_Person?.email ||
      ""
  ).trim();
  const primaryMobile = String(
    getFirstFilledValue(jobData, ["Contact_Contact_SMS_Number", "Client_Entity_Primary_Person_SMS_Number"]) ||
      jobData?.Client_Entity?.Primary_Person?.sms_number ||
      ""
  ).trim();
  return { id, name, primaryId, primaryEmail, primaryMobile };
}

export function getJobRelatedInquiry(jobData) {
  const id = String(
    getFirstFilledValue(jobData, [
      "inquiry_record_id",
      "Inquiry_Record_ID",
      "inquiry_id",
      "Inquiry_ID",
    ]) ||
      jobData?.Inquiry_Record?.id ||
      ""
  ).trim();

  const uniqueId = String(
    getFirstFilledValue(jobData, [
      "Inquiry_Record_Unique_ID",
      "inquiry_record_unique_id",
    ]) ||
      jobData?.Inquiry_Record?.unique_id ||
      ""
  ).trim();

  const dealName = String(
    getFirstFilledValue(jobData, [
      "Inquiry_Record_Deal_Name",
      "inquiry_record_deal_name",
    ]) ||
      jobData?.Inquiry_Record?.deal_name ||
      ""
  ).trim();

  if (!id && !uniqueId && !dealName) return null;
  return { id, unique_id: uniqueId, deal_name: dealName };
}

export function getJobRelatedProperty(jobData) {
  const id = String(
    getFirstFilledValue(jobData, ["property_id", "Property_ID"]) || jobData?.Property?.id || ""
  ).trim();
  const uniqueId = String(
    getFirstFilledValue(jobData, ["Property_Unique_ID", "property_unique_id"]) ||
      jobData?.Property?.unique_id ||
      ""
  ).trim();
  const propertyName = String(
    getFirstFilledValue(jobData, ["Property_Property_Name", "property_property_name"]) ||
      jobData?.Property?.property_name ||
      ""
  ).trim();

  const propertyRecord = {
    ...(jobData?.Property || {}),
    id,
    unique_id: uniqueId,
    property_name: propertyName,
    lot_number: String(
      getFirstFilledValue(jobData, ["Property_Lot_Number", "property_lot_number"]) ||
        jobData?.Property?.lot_number ||
        ""
    ).trim(),
    unit_number: String(
      getFirstFilledValue(jobData, ["Property_Unit_Number", "property_unit_number"]) ||
        jobData?.Property?.unit_number ||
        ""
    ).trim(),
    address_1: String(
      getFirstFilledValue(jobData, ["Property_Address_1", "property_address_1"]) ||
        jobData?.Property?.address_1 ||
        ""
    ).trim(),
    address_2: String(
      getFirstFilledValue(jobData, ["Property_Address_2", "property_address_2"]) ||
        jobData?.Property?.address_2 ||
        ""
    ).trim(),
    address: String(
      getFirstFilledValue(jobData, ["Property_Address", "property_address"]) ||
        jobData?.Property?.address ||
        ""
    ).trim(),
    city: String(
      getFirstFilledValue(jobData, ["Property_City", "property_city"]) || jobData?.Property?.city || ""
    ).trim(),
    suburb_town: String(
      getFirstFilledValue(jobData, ["Property_Suburb_Town", "property_suburb_town"]) ||
        jobData?.Property?.suburb_town ||
        ""
    ).trim(),
    state: String(
      getFirstFilledValue(jobData, ["Property_State", "property_state"]) || jobData?.Property?.state || ""
    ).trim(),
    postal_code: String(
      getFirstFilledValue(jobData, ["Property_Postal_Code", "property_postal_code"]) ||
        jobData?.Property?.postal_code ||
        jobData?.Property?.zip_code ||
        ""
    ).trim(),
    country: String(
      getFirstFilledValue(jobData, ["Property_Country", "property_country"]) ||
        jobData?.Property?.country ||
        ""
    ).trim(),
    property_type: String(
      getFirstFilledValue(jobData, ["Property_Property_Type", "property_property_type"]) ||
        jobData?.Property?.property_type ||
        ""
    ).trim(),
    building_type: String(
      getFirstFilledValue(jobData, ["Property_Building_Type", "property_building_type"]) ||
        jobData?.Property?.building_type ||
        ""
    ).trim(),
    building_type_other: String(
      getFirstFilledValue(jobData, [
        "Property_Building_Type_Other",
        "property_building_type_other",
      ]) || jobData?.Property?.building_type_other || ""
    ).trim(),
    foundation_type: String(
      getFirstFilledValue(jobData, ["Property_Foundation_Type", "property_foundation_type"]) ||
        jobData?.Property?.foundation_type ||
        ""
    ).trim(),
    bedrooms: String(
      getFirstFilledValue(jobData, ["Property_Bedrooms", "property_bedrooms"]) ||
        jobData?.Property?.bedrooms ||
        ""
    ).trim(),
    manhole:
      jobData?.Property?.manhole === true ||
      normalizeText(
        getFirstFilledValue(jobData, ["Property_Manhole", "property_manhole"]) ||
          jobData?.Property?.manhole
      ) === "true",
    stories: String(
      getFirstFilledValue(jobData, ["Property_Stories", "property_stories"]) ||
        jobData?.Property?.stories ||
        ""
    ).trim(),
    building_age: String(
      getFirstFilledValue(jobData, ["Property_Building_Age", "property_building_age"]) ||
        jobData?.Property?.building_age ||
        ""
    ).trim(),
    building_features:
      jobData?.Property?.building_features ||
      getFirstFilledValue(jobData, ["Property_Building_Features", "property_building_features"]) ||
      "",
    building_features_options_as_text:
      jobData?.Property?.building_features_options_as_text ||
      getFirstFilledValue(jobData, [
        "Property_Building_Features_Options_As_Text",
        "property_building_features_options_as_text",
      ]) ||
      "",
  };

  if (!id && !uniqueId && !propertyName) return null;
  return propertyRecord;
}

export function getJobPrimaryServiceProviderId(jobData) {
  return String(
    getFirstFilledValue(jobData, ["primary_service_provider_id", "Primary_Service_Provider_ID"]) ||
      jobData?.Primary_Service_Provider?.id ||
      ""
  ).trim();
}

export function getJobPrimaryServiceProviderDetails(jobData) {
  const id = getJobPrimaryServiceProviderId(jobData);
  const firstName = String(
    getFirstFilledValue(jobData, ["Primary_Service_Provider_Contact_First_Name"]) ||
      jobData?.Primary_Service_Provider?.Contact_Information?.first_name ||
      ""
  ).trim();
  const lastName = String(
    getFirstFilledValue(jobData, ["Primary_Service_Provider_Contact_Last_Name"]) ||
      jobData?.Primary_Service_Provider?.Contact_Information?.last_name ||
      ""
  ).trim();
  const email = String(
    getFirstFilledValue(jobData, ["Primary_Service_Provider_Contact_Email"]) ||
      jobData?.Primary_Service_Provider?.Contact_Information?.email ||
      ""
  ).trim();
  const smsNumber = String(
    getFirstFilledValue(jobData, ["Primary_Service_Provider_Contact_SMS_Number"]) ||
      jobData?.Primary_Service_Provider?.Contact_Information?.sms_number ||
      ""
  ).trim();

  const label = buildLookupDisplayLabel(
    [firstName, lastName].filter(Boolean).join(" ").trim(),
    email,
    smsNumber,
    id
  );
  return { id, first_name: firstName, last_name: lastName, email, sms_number: smsNumber, label };
}

export function resolveOptionDefault(options = [], rawValue = "") {
  const current = normalizeText(rawValue);
  if (!current) return "";

  const directMatch = options.find((option) => normalizeText(option.value) === current);
  if (directMatch) return String(directMatch.value);

  const labelMatch = options.find((option) => normalizeText(option.label) === current);
  if (labelMatch) return String(labelMatch.value);

  return "";
}

export function buildInquiryLink(uniqueId = "") {
  const uid = String(uniqueId || "").trim();
  if (!uid) return "";

  if (INQUIRY_LINK_BASE) {
    if (INQUIRY_LINK_BASE.includes("{uid}")) {
      return INQUIRY_LINK_BASE.replace("{uid}", encodeURIComponent(uid));
    }
    const separator = INQUIRY_LINK_BASE.includes("?") ? "&" : "?";
    return `${INQUIRY_LINK_BASE}${separator}inquiryuid=${encodeURIComponent(uid)}`;
  }

  return `${window.location.origin}${window.location.pathname}?inquiryuid=${encodeURIComponent(uid)}`;
}

export function buildPropertyMapLink(property = {}) {
  const query = [
    property?.property_name,
    property?.address_1,
    property?.address_2,
    property?.address,
    property?.suburb_town,
    property?.city,
    property?.state,
    property?.postal_code,
    property?.country,
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(", ");

  if (!query) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

export function getLinkedRecordsCacheKey(accountType, accountId) {
  const normalizedType = String(accountType || "").trim().toLowerCase();
  const normalizedId = String(accountId || "").trim();
  if (!normalizedType || !normalizedId) return "";
  return `${normalizedType}:${normalizedId}`;
}

const PROPERTY_FEATURE_LABEL_BY_VALUE = {
  713: "Brick",
  712: "Concrete",
  711: "Flat Roof",
  710: "Highset",
  709: "Iron Roof",
  708: "Lowset",
  707: "PostWar",
  706: "Queenslander",
  705: "Raked Ceiling",
  704: "Sloping Block",
  703: "Super 6 / Fibro roof",
  702: "Tile Roof",
  701: "Town house",
  700: "Unit Block",
  699: "Warehouse",
  698: "Wood",
  697: "Wood & Brick",
};

const PROPERTY_FEATURE_VALUE_BY_LABEL = Object.fromEntries(
  Object.entries(PROPERTY_FEATURE_LABEL_BY_VALUE).map(([value, label]) => [
    String(label).trim().toLowerCase(),
    String(value),
  ])
);

function normalizePropertyFeatureLabel(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (PROPERTY_FEATURE_LABEL_BY_VALUE[text]) return PROPERTY_FEATURE_LABEL_BY_VALUE[text];
  const idMatch = text.match(/\d+/);
  if (idMatch && PROPERTY_FEATURE_LABEL_BY_VALUE[idMatch[0]]) {
    return PROPERTY_FEATURE_LABEL_BY_VALUE[idMatch[0]];
  }
  const mappedValue = PROPERTY_FEATURE_VALUE_BY_LABEL[text.toLowerCase()];
  if (mappedValue && PROPERTY_FEATURE_LABEL_BY_VALUE[mappedValue]) {
    return PROPERTY_FEATURE_LABEL_BY_VALUE[mappedValue];
  }
  return text;
}

function extractPropertyFeatureTokens(value) {
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

export function getPropertyFeatureText(property = {}) {
  const fromRelation = Array.isArray(property?.Building_Features)
    ? property.Building_Features
        .flatMap((item) => extractPropertyFeatureTokens(item?.id || item?.value || item))
        .map((item) => normalizePropertyFeatureLabel(item))
    : [];

  if (fromRelation.length) {
    return Array.from(new Set(fromRelation.filter(Boolean))).join(", ");
  }

  const fromArray = Array.isArray(property?.building_features)
    ? property.building_features
        .flatMap((item) => extractPropertyFeatureTokens(item))
        .map((item) => normalizePropertyFeatureLabel(item))
    : [];
  if (fromArray.length) {
    return Array.from(new Set(fromArray.filter(Boolean))).join(", ");
  }

  const fromText = String(
    property?.building_features_options_as_text || property?.building_features || ""
  ).trim();
  if (!fromText) return "";

  return Array.from(
    new Set(
      extractPropertyFeatureTokens(fromText)
        .map((item) => normalizePropertyFeatureLabel(item))
        .filter(Boolean)
    )
  ).join(", ");
}

export function formatPropertyValue(value) {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  const text = String(value).trim();
  return text || "-";
}

export function formatFileSize(size) {
  const value = Number(size);
  if (!Number.isFinite(value) || value <= 0) return "-";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function dedupeById(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((record, index) => {
    const key = String(record?.id || record?.ID || `record-${index}`).trim();
    if (!key || map.has(key)) return;
    map.set(key, record);
  });
  return Array.from(map.values());
}

export function dedupeUploadRecords(records = []) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((item, index) => {
    const key = String(item?.id || item?.url || `upload-${index}`).trim();
    if (!key || map.has(key)) return;
    map.set(key, item);
  });
  return Array.from(map.values());
}

export function getAffiliationContactName(record = {}) {
  const fullName = [record.contact_first_name, record.contact_last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return fullName || "-";
}

export function getAffiliationCompanyName(record = {}) {
  return String(record.company_name || "").trim() || "-";
}

export function isPrimaryAffiliation(record = {}) {
  return Boolean(
    record.primary_owner_contact ||
      record.primary_resident_contact ||
      record.primary_property_manager_contact
  );
}

export function normalizeInquiryId(value) {
  return String(value || "").trim();
}

export function normalizePropertyId(value) {
  return String(value || "").trim();
}
