import { INITIAL_FORM } from "./contactDetailsSchema.js";

export function copyAddressIntoPostal(form) {
  return {
    ...form,
    postal_address: form.address || "",
    postal_city: form.city || "",
    postal_state: form.state || "",
    postal_country: form.country || "",
    postal_code: form.zip_code || "",
  };
}

export function trimValue(value) {
  return String(value || "").trim();
}

export function normalizeRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

export function normalizeLookupId(record = {}) {
  return trimValue(record?.id || record?.ID || record?.Contact_ID || record?.Company_ID);
}

export function mergeLookupRecords(currentRecords = [], incomingRecords = []) {
  const byId = new Map();
  [...(incomingRecords || []), ...(currentRecords || [])].forEach((record) => {
    const id = normalizeLookupId(record);
    if (!id) return;
    if (!byId.has(id)) {
      byId.set(id, record);
    }
  });
  return Array.from(byId.values());
}

export function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  return Promise.resolve(result);
}

export function compactStringFields(source = {}) {
  const output = {};
  Object.entries(source || {}).forEach(([key, value]) => {
    const trimmed = trimValue(value);
    if (trimmed) output[key] = trimmed;
  });
  return output;
}

export function formatDisplayName(firstName, lastName) {
  return [trimValue(firstName), trimValue(lastName)].filter(Boolean).join(" ");
}

export function buildContactSearchValue(source = {}) {
  const fullName = formatDisplayName(source?.first_name || source?.First_Name, source?.last_name || source?.Last_Name);
  if (fullName) return fullName;
  return trimValue(source?.email || source?.Email);
}

export function buildCompanySearchValue(source = {}) {
  return trimValue(source?.company_name || source?.name || source?.Name);
}

export function mapContactRecordToForm(record = {}, previous = INITIAL_FORM) {
  return {
    ...previous,
    id: trimValue(record?.id || record?.ID || record?.Contact_ID),
    first_name: trimValue(record?.first_name || record?.First_Name || previous.first_name),
    last_name: trimValue(record?.last_name || record?.Last_Name || previous.last_name),
    email: trimValue(record?.email || record?.Email || previous.email),
    sms_number: trimValue(
      record?.sms_number ||
        record?.SMS_Number ||
        record?.office_phone ||
        record?.Office_Phone ||
        previous.sms_number
    ),
    lot_number: trimValue(record?.lot_number || record?.Lot_Number || previous.lot_number),
    unit_number: trimValue(record?.unit_number || record?.Unit_Number || previous.unit_number),
    address: trimValue(record?.address || record?.Address || previous.address),
    city: trimValue(record?.city || record?.City || previous.city),
    state: trimValue(record?.state || record?.State || previous.state),
    zip_code: trimValue(record?.zip_code || record?.Zip_Code || previous.zip_code),
    country: trimValue(record?.country || record?.Country || previous.country || "AU") || "AU",
    postal_address: trimValue(
      record?.postal_address || record?.Postal_Address || previous.postal_address
    ),
    postal_city: trimValue(record?.postal_city || record?.Postal_City || previous.postal_city),
    postal_state: trimValue(
      record?.postal_state || record?.Postal_State || previous.postal_state
    ),
    postal_country: trimValue(
      record?.postal_country || record?.Postal_Country || previous.postal_country || "AU"
    ) || "AU",
    postal_code: trimValue(record?.postal_code || record?.Postal_Code || previous.postal_code),
  };
}

export function mapCompanyRecordToForm(record = {}, previous = INITIAL_FORM) {
  const primary = normalizeRelationRecord(
    record?.Primary_Person ||
      record?.primary_person ||
      record?.PrimaryPerson
  );
  return {
    ...previous,
    id: trimValue(record?.id || record?.ID || record?.Company_ID),
    company_name: trimValue(record?.name || record?.Name || previous.company_name),
    company_type: trimValue(record?.type || record?.Type || previous.company_type),
    company_description: trimValue(
      record?.description || record?.Description || previous.company_description
    ),
    company_phone: trimValue(record?.phone || record?.Phone || previous.company_phone),
    company_address: trimValue(record?.address || record?.Address || previous.company_address),
    company_city: trimValue(record?.city || record?.City || previous.company_city),
    company_state: trimValue(record?.state || record?.State || previous.company_state),
    company_postal_code: trimValue(
      record?.postal_code || record?.Postal_Code || previous.company_postal_code
    ),
    company_industry: trimValue(record?.industry || record?.Industry || previous.company_industry),
    company_annual_revenue: trimValue(
      record?.annual_revenue || record?.Annual_Revenue || previous.company_annual_revenue
    ),
    company_number_of_employees: trimValue(
      record?.number_of_employees ||
        record?.Number_of_Employees ||
        previous.company_number_of_employees
    ),
    company_account_type: trimValue(
      record?.account_type || record?.Account_Type || previous.company_account_type
    ),
    popup_comment: trimValue(record?.popup_comment || record?.Popup_Comment || previous.popup_comment),
    first_name: trimValue(
      primary?.first_name ||
        primary?.First_Name ||
        record?.Primary_Person_First_Name ||
        previous.first_name
    ),
    last_name: trimValue(
      primary?.last_name ||
        primary?.Last_Name ||
        record?.Primary_Person_Last_Name ||
        previous.last_name
    ),
    email: trimValue(
      primary?.email ||
        primary?.Email ||
        record?.Primary_Person_Email ||
        previous.email
    ),
    sms_number: trimValue(
      primary?.sms_number ||
        primary?.SMS_Number ||
        primary?.office_phone ||
        primary?.Office_Phone ||
        record?.Primary_Person_SMS_Number ||
        record?.Primary_Person_Office_Phone ||
        previous.sms_number
    ),
  };
}
