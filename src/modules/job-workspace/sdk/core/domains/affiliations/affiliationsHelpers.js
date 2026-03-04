import { parseBooleanValue } from "../shared/sharedHelpers.js";

export const AFFILIATION_RECORD_SELECT_FIELDS = [
  "id",
  "role",
  "property_id",
  "contact_id",
  "company_id",
  "company_as_accounts_contact_id",
  "primary_owner_contact",
  "primary_resident_contact",
  "primary_property_manager_contact",
];

export function normalizeAffiliationRecord(rawAffiliation = {}) {
  const contactFirstName = String(
    rawAffiliation?.contact_first_name ||
      rawAffiliation?.Contact_First_Name ||
      rawAffiliation?.Contact?.first_name ||
      rawAffiliation?.Contact?.First_Name ||
      ""
  ).trim();
  const contactLastName = String(
    rawAffiliation?.contact_last_name ||
      rawAffiliation?.Contact_Last_Name ||
      rawAffiliation?.Contact?.last_name ||
      rawAffiliation?.Contact?.Last_Name ||
      ""
  ).trim();
  const companyName = String(
    rawAffiliation?.company_name ||
      rawAffiliation?.CompanyName ||
      rawAffiliation?.Company?.name ||
      rawAffiliation?.Company?.Name ||
      ""
  ).trim();
  const accountsCompanyName = String(
    rawAffiliation?.company_as_accounts_contact_name ||
      rawAffiliation?.Company_as_Accounts_Contact_Name ||
      rawAffiliation?.Company_as_Accounts_Contact?.name ||
      rawAffiliation?.Company_as_Accounts_Contact?.Name ||
      ""
  ).trim();

  return {
    id: String(rawAffiliation?.id || rawAffiliation?.ID || "").trim(),
    role: String(rawAffiliation?.role || rawAffiliation?.Role || "").trim(),
    property_id: String(rawAffiliation?.property_id || rawAffiliation?.Property_ID || "").trim(),
    contact_id: String(rawAffiliation?.contact_id || rawAffiliation?.Contact_ID || "").trim(),
    company_id: String(rawAffiliation?.company_id || rawAffiliation?.Company_ID || "").trim(),
    company_as_accounts_contact_id: String(
      rawAffiliation?.company_as_accounts_contact_id ||
        rawAffiliation?.Company_as_Accounts_Contact_ID ||
        ""
    ).trim(),
    primary_owner_contact: parseBooleanValue(
      rawAffiliation?.primary_owner_contact || rawAffiliation?.Primary_Owner_Contact
    ),
    primary_resident_contact: parseBooleanValue(
      rawAffiliation?.primary_resident_contact || rawAffiliation?.Primary_Resident_Contact
    ),
    primary_property_manager_contact: parseBooleanValue(
      rawAffiliation?.primary_property_manager_contact ||
        rawAffiliation?.Primary_Property_Manager_Contact
    ),
    contact_first_name: contactFirstName,
    contact_last_name: contactLastName,
    contact_email: String(
      rawAffiliation?.contact_email ||
        rawAffiliation?.ContactEmail ||
        rawAffiliation?.Contact?.email ||
        rawAffiliation?.Contact?.Email ||
        ""
    ).trim(),
    contact_sms_number: String(
      rawAffiliation?.contact_sms_number ||
        rawAffiliation?.Contact_SMS_Number ||
        rawAffiliation?.Contact?.sms_number ||
        rawAffiliation?.Contact?.SMS_Number ||
        ""
    ).trim(),
    company_name: companyName,
    company_phone: String(
      rawAffiliation?.company_phone ||
        rawAffiliation?.CompanyPhone ||
        rawAffiliation?.Company?.phone ||
        rawAffiliation?.Company?.Phone ||
        ""
    ).trim(),
    company_as_accounts_contact_name: accountsCompanyName,
  };
}

export function dedupeAffiliations(affiliations = []) {
  const seen = new Set();
  return affiliations.filter((item) => {
    const key = String(item?.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
