export const CONTACT_LOOKUP_SELECT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "sms_number",
  "office_phone",
];

export const CONTACT_DUPLICATE_LOOKUP_SELECT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "sms_number",
  "office_phone",
  "lot_number",
  "unit_number",
  "address",
  "city",
  "state",
  "zip_code",
  "country",
  "postal_address",
  "postal_city",
  "postal_state",
  "postal_country",
  "postal_code",
];

export const COMPANY_LOOKUP_SELECT_FIELDS = ["id", "account_type", "name"];

export const COMPANY_PRIMARY_PERSON_SELECT_FIELDS = [
  "id",
  "first_name",
  "last_name",
  "email",
  "sms_number",
  "office_phone",
];

export function normalizeSearchEmail(value) {
  return String(value || "").trim().toLowerCase();
}

export function normalizeSearchName(value) {
  return String(value || "").trim().toLowerCase();
}

export function applyCompanyLookupIncludes(query) {
  return query.include("Primary_Person", (personQuery) =>
    personQuery.deSelectAll().select(COMPANY_PRIMARY_PERSON_SELECT_FIELDS)
  );
}
