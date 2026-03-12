import { toText } from "@shared/utils/formatters.js";

export const QUICK_INQUIRY_EMPTY_INDIVIDUAL_FORM = {
  email: "",
  first_name: "",
  last_name: "",
  sms_number: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "AU",
};

export const QUICK_INQUIRY_EMPTY_COMPANY_FORM = {
  company_name: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_postal_code: "",
  company_account_type: "",
  primary_first_name: "",
  primary_last_name: "",
  primary_email: "",
  primary_sms_number: "",
};

export const QUICK_INQUIRY_EMPTY_DETAILS_FORM = {
  inquiry_source: "",
  type: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  how_did_you_hear: "",
  other: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
  property_lot_number: "",
  property_unit_number: "",
  property_lookup: "",
  property_name: "",
  property_address_1: "",
  property_suburb_town: "",
  property_state: "",
  property_postal_code: "",
  property_country: "AU",
  admin_notes: "",
  client_notes: "",
};

export function normalizeComparablePropertyName(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[\s,]+/g, " ")
    .trim();
}

export function normalizeComparableText(value) {
  return toText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveLookupRecordId(record = null, accountType = "Contact") {
  if (!record || typeof record !== "object") return "";
  const candidates =
    String(accountType || "").toLowerCase() === "company"
      ? [
          record?.id,
          record?.ID,
          record?.company_id,
          record?.Company_ID,
          record?.CompanyID,
        ]
      : [
          record?.id,
          record?.ID,
          record?.contact_id,
          record?.Contact_ID,
          record?.ContactID,
          record?.primary_contact_id,
          record?.Primary_Contact_ID,
        ];
  for (const candidate of candidates) {
    const normalized = toText(candidate);
    if (normalized) return normalized;
  }
  return "";
}

export function buildStandardPropertyName({
  lot_number = "",
  unit_number = "",
  address_1 = "",
  suburb_town = "",
  state = "",
  postal_code = "",
  country = "",
} = {}) {
  const lotUnit = [toText(lot_number), toText(unit_number)].filter(Boolean).join(" ");
  const suburbStatePostcode = [toText(suburb_town), toText(state), toText(postal_code)]
    .filter(Boolean)
    .join(" ");
  return [lotUnit, toText(address_1), suburbStatePostcode, toText(country)]
    .filter(Boolean)
    .join(", ");
}
