export function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export function tokenizeQuery(value) {
  return normalizeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function matchesSearchQuery(searchText = "", query = "") {
  const normalizedSearchText = normalizeText(searchText);
  const queryTokens = tokenizeQuery(query);
  if (!queryTokens.length) return true;
  return queryTokens.every((token) => normalizedSearchText.includes(token));
}

export function buildContactLabel(contact = {}) {
  const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
  return fullName || contact.email || contact.sms_number || contact.id || "";
}

export function createContactRecordKey(contact = {}) {
  const id = String(contact?.id || contact?.ID || "").trim();
  if (id) return `contact:${id}`;
  return [
    "contact",
    normalizeText(contact?.first_name),
    normalizeText(contact?.last_name),
    normalizeText(contact?.email),
    normalizeText(contact?.sms_number),
    normalizeText(contact?.label),
  ].join("|");
}

export function createCompanyRecordKey(company = {}) {
  const id = String(company?.id || company?.ID || "").trim();
  if (id) return `company:${id}`;
  return [
    "company",
    normalizeText(company?.name),
    normalizeText(company?.account_type),
    normalizeText(company?.label),
  ].join("|");
}

export function dedupeLookupRecords(records = [], createKey) {
  const map = new Map();
  (Array.isArray(records) ? records : []).forEach((record) => {
    const key = createKey(record);
    if (!key || map.has(key)) return;
    map.set(key, record);
  });
  return Array.from(map.values());
}

export function extractRoleFlags(role = "") {
  const normalizedRole = normalizeText(role);
  return {
    primary_owner_contact: normalizedRole.includes("owner"),
    primary_resident_contact: normalizedRole.includes("resident"),
    primary_property_manager_contact:
      normalizedRole.includes("manager") || normalizedRole.includes("property manager"),
  };
}

export function isPersistedRecordId(value) {
  return /^\d+$/.test(String(value || "").trim());
}

export function mapInitialForm(initialData = null) {
  if (!initialData) {
    return {
      id: "",
      role: "",
      is_primary: false,
      contact_id: "",
      contact_label: "",
      company_id: "",
      company_label: "",
      same_as_company: false,
      company_as_accounts_contact_id: "",
      company_as_accounts_contact_label: "",
    };
  }

  const contactLabel = [
    initialData.contact_first_name || initialData.Contact_First_Name || "",
    initialData.contact_last_name || initialData.Contact_Last_Name || "",
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  const companyLabel = String(
    initialData.company_name || initialData.CompanyName || ""
  ).trim();

  const accountsCompanyLabel = String(
    initialData.company_as_accounts_contact_name ||
      initialData.Company_as_Accounts_Contact_Name ||
      ""
  ).trim();

  const companyId = String(initialData.company_id || initialData.Company_ID || "").trim();
  const accountsCompanyId = String(
    initialData.company_as_accounts_contact_id ||
      initialData.Company_as_Accounts_Contact_ID ||
      ""
  ).trim();
  const sameAsCompany = Boolean(companyId && accountsCompanyId && companyId === accountsCompanyId);
  const isPrimary = Boolean(
    initialData.primary_owner_contact ||
      initialData.Primary_Owner_Contact ||
      initialData.primary_resident_contact ||
      initialData.Primary_Resident_Contact ||
      initialData.primary_property_manager_contact ||
      initialData.Primary_Property_Manager_Contact
  );

  return {
    id: String(initialData.id || initialData.ID || "").trim(),
    role: String(initialData.role || initialData.Role || "").trim(),
    is_primary: isPrimary,
    contact_id: String(initialData.contact_id || initialData.Contact_ID || "").trim(),
    contact_label: contactLabel || String(initialData.contact_email || initialData.ContactEmail || "").trim(),
    company_id: companyId,
    company_label: companyLabel,
    same_as_company: sameAsCompany,
    company_as_accounts_contact_id: accountsCompanyId,
    company_as_accounts_contact_label:
      accountsCompanyLabel || (sameAsCompany ? companyLabel : ""),
  };
}
