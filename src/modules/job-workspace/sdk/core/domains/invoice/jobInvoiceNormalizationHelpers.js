export function normalizeEpochSeconds(value) {
  if (value === null || value === undefined) return null;
  const asText = String(value).trim();
  if (!asText) return null;

  if (/^\d+$/.test(asText)) {
    const numeric = Number.parseInt(asText, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const normalizedDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(asText)
    ? `${asText}T00:00:00`
    : asText;
  const parsed = new Date(normalizedDateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

export function getFirstNonEmptyText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

export function normalizeStatusText(value) {
  return String(value || "").trim().toLowerCase();
}

export function extractInvoiceApiResponseSnapshot(record = {}) {
  return {
    xero_api_response: getFirstNonEmptyText(
      record?.xero_api_response,
      record?.Xero_API_Response
    ),
    invoice_url_admin: getFirstNonEmptyText(
      record?.invoice_url_admin,
      record?.Invoice_URL_Admin
    ),
    invoice_url_client: getFirstNonEmptyText(
      record?.invoice_url_client,
      record?.Invoice_URL_Client
    ),
    xero_invoice_status: getFirstNonEmptyText(
      record?.xero_invoice_status,
      record?.Xero_Invoice_Status
    ),
    xero_invoice_pdf: getFirstNonEmptyText(
      record?.xero_invoice_pdf,
      record?.Xero_Invoice_PDF
    ),
    invoice_number: getFirstNonEmptyText(record?.invoice_number, record?.Invoice_Number),
  };
}

export function normalizeJobRecord(rawJob) {
  if (!rawJob || typeof rawJob !== "object") return rawJob;

  const serviceProvider = rawJob?.Primary_Service_Provider;
  const serviceProviderContact = serviceProvider?.Contact_Information;

  const providerId = getFirstNonEmptyText(
    rawJob?.primary_service_provider_id,
    rawJob?.Primary_Service_Provider_ID,
    serviceProvider?.id,
    serviceProvider?.ID
  );
  const contactFirstName = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_First_Name,
    rawJob?.Contact_First_Name1,
    serviceProviderContact?.first_name,
    serviceProviderContact?.First_Name
  );
  const contactLastName = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_Last_Name,
    rawJob?.Contact_Last_Name1,
    serviceProviderContact?.last_name,
    serviceProviderContact?.Last_Name
  );
  const contactEmail = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_Email,
    rawJob?.ContactEmail1,
    serviceProviderContact?.email,
    serviceProviderContact?.Email
  );
  const contactSmsNumber = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_SMS_Number,
    rawJob?.Contact_SMS_Number1,
    serviceProviderContact?.sms_number,
    serviceProviderContact?.SMS_Number
  );

  const next = {
    ...rawJob,
    Primary_Service_Provider_ID: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_ID,
      providerId
    ),
    Primary_Service_Provider_Contact_First_Name: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_First_Name,
      contactFirstName
    ),
    Primary_Service_Provider_Contact_Last_Name: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_Last_Name,
      contactLastName
    ),
    Primary_Service_Provider_Contact_Email: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_Email,
      contactEmail
    ),
    Primary_Service_Provider_Contact_SMS_Number: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_SMS_Number,
      contactSmsNumber
    ),
  };

  if (!next.primary_service_provider_id && providerId) {
    next.primary_service_provider_id = providerId;
  }

  if (!next.Primary_Service_Provider && providerId) {
    next.Primary_Service_Provider = {
      id: providerId,
      Contact_Information:
        contactFirstName || contactLastName || contactEmail || contactSmsNumber
          ? {
              first_name: contactFirstName,
              last_name: contactLastName,
              email: contactEmail,
              sms_number: contactSmsNumber,
            }
          : null,
    };
  }

  return next;
}

export function normalizeInvoiceBillContextRecord(rawJob) {
  const normalized = normalizeJobRecord(rawJob || {});
  if (!normalized || typeof normalized !== "object") return normalized;

  const contactXeroId = getFirstNonEmptyText(
    normalized?.Client_Individual?.xero_contact_id,
    normalized?.Client_Individual?.Xero_Contact_ID,
    normalized?.Client_Individual_Xero_Contact_ID
  );
  const companyXeroId = getFirstNonEmptyText(
    normalized?.Client_Entity?.xero_contact_id,
    normalized?.Client_Entity?.Xero_Contact_ID,
    normalized?.Client_Entity_Xero_Contact_ID
  );

  const providerRateRaw = getFirstNonEmptyText(
    normalized?.Primary_Service_Provider_Job_Rate_Percentage,
    normalized?.Primary_Service_Provider?.job_rate_percentage,
    normalized?.Primary_Service_Provider?.Job_Rate_Percentage
  );
  const providerRate = Number.parseFloat(providerRateRaw);

  const accountsContact = normalized?.Accounts_Contact?.Contact || null;
  const accountsContactFirstName = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_First_Name,
    normalized?.Contact_First_Name,
    normalized?.Contact_First_Name1,
    accountsContact?.first_name,
    accountsContact?.First_Name
  );
  const accountsContactLastName = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_Last_Name,
    normalized?.Contact_Last_Name,
    normalized?.Contact_Last_Name1,
    accountsContact?.last_name,
    accountsContact?.Last_Name
  );
  const accountsContactEmail = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_Email,
    normalized?.ContactEmail,
    normalized?.ContactEmail1,
    accountsContact?.email,
    accountsContact?.Email
  );
  const accountsContactContactId = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_ID,
    normalized?.Contact_Contact_ID,
    normalized?.Contact_Contact_ID1,
    accountsContact?.id,
    accountsContact?.ID
  );

  return {
    ...normalized,
    client_individual_xero_contact_id: contactXeroId,
    client_entity_xero_contact_id: companyXeroId,
    accounts_contact_contact_id: accountsContactContactId,
    accounts_contact_contact_first_name: accountsContactFirstName,
    accounts_contact_contact_last_name: accountsContactLastName,
    accounts_contact_contact_email: accountsContactEmail,
    primary_service_provider_job_rate_percentage: Number.isFinite(providerRate)
      ? providerRate
      : 0,
  };
}
