import { formatUnixDate } from "@shared/api/dashboardCore.js";

// ─── Client / SP Name Helpers ─────────────────────────────────────────────────

export function clientName(contact) {
  if (!contact) return "";
  return [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim();
}

export function spName(sp) {
  if (!sp) return "";
  const info = sp.Contact_Information ?? sp;
  return [info.first_name, info.last_name].filter(Boolean).join(" ").trim();
}

// ─── Shared Job Includes ──────────────────────────────────────────────────────

export function applyJobIncludes(q) {
  return q
    .include("Client_Individual", (sq) =>
      sq.select(["id", "first_name", "last_name", "email", "sms_number", "address_1"])
    )
    .include("Property", (sq) => sq.deSelectAll().select(["id", "property_name"]))
    .include("Primary_Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    )
    .include("Client_Entity", (sq) =>
      sq.deSelectAll().select(["id", "name", "type", "account_type", "phone"])
    )
    .include("Inquiry_Record", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "unique_id", "inquiry_status", "type", "how_did_you_hear"])
        .include("Service_Inquiry", (sq2) => sq2.deSelectAll().select(["service_name"]))
    );
}

export function resolveClientDetails(rec) {
  const accountType = String(rec?.account_type ?? rec?.Account_Type ?? "").trim();
  const isCompany = accountType === "Company" || accountType === "Entity";

  // Try nested objects first (subscription), then flat fields (fetchDirect)
  const clientIndividual = rec?.Client_Individual ?? rec?.client_individual ?? {
    first_name: rec?.client_individual_first_name ?? rec?.Client_Individual_First_Name,
    last_name: rec?.client_individual_last_name ?? rec?.Client_Individual_Last_Name,
    sms_number: rec?.client_individual_sms_number ?? rec?.Client_Individual_Sms_Number,
    email: rec?.client_individual_email ?? rec?.Client_Individual_Email,
  };
  const clientEntity = rec?.Client_Entity ?? rec?.client_entity ?? {
    name: rec?.client_entity_name ?? rec?.Client_Entity_Name,
    phone: rec?.client_entity_phone ?? rec?.Client_Entity_Phone,
  };

  if (isCompany) {
    return {
      clientName: String(clientEntity?.name || "").trim(),
      phone: String(clientEntity?.phone || "").trim(),
      email: "",
    };
  }

  return {
    clientName: clientName(clientIndividual),
    phone: String(clientIndividual?.sms_number || "").trim(),
    email: String(clientIndividual?.email || "").trim(),
  };
}

// ─── Row Normalizers ──────────────────────────────────────────────────────────

export function normalizeDeal(rec) {
  const accountType = (rec.account_type ?? rec.Account_Type ?? "").trim();
  const isCompany = accountType === "Company";

  const company = rec.Company ?? rec.company ?? {
    name: rec?.company_name ?? rec?.Company_Name,
    phone: rec?.company_phone ?? rec?.Company_Phone,
  };
  const primaryContact = rec.Primary_Contact ?? rec.primary_contact ?? {
    first_name: rec?.primary_contact_first_name ?? rec?.Primary_Contact_First_Name,
    last_name: rec?.primary_contact_last_name ?? rec?.Primary_Contact_Last_Name,
    sms_number: rec?.primary_contact_sms_number ?? rec?.Primary_Contact_Sms_Number,
    email: rec?.primary_contact_email ?? rec?.Primary_Contact_Email,
  };
  const property = rec.Property ?? rec.property ?? {
    property_name: rec?.property_property_name ?? rec?.Property_Property_Name,
  };
  const serviceProvider = rec.Service_Provider ?? rec.service_provider ?? {};

  const name = isCompany ? (company?.name ?? "") : clientName(primaryContact);
  const phone = isCompany ? (company?.phone ?? "") : (primaryContact?.sms_number ?? "");
  const email = isCompany ? "" : (primaryContact?.email ?? "");

  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.Date_Added),
    clientName: name,
    phone,
    email,
    address: property?.property_name ?? "",
    source: rec.inquiry_source ?? rec.how_did_you_hear ?? rec.How_did_you_hear ?? "",
    status: rec.inquiry_status ?? rec.Inquiry_Status ?? "",
    serviceProvider: spName(serviceProvider),
  };
}

export function normalizeQuote(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.quote_date ?? rec.Quote_Date),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    quoteNumber: rec.unique_id ?? rec.Unique_ID ?? "",
    amount: rec.quote_total ?? rec.Quote_Total ?? 0,
    status: rec.quote_status ?? rec.Quote_Status ?? rec.job_status ?? rec.Job_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider ?? rec.primary_service_provider),
  };
}

export function normalizeJob(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(
      rec.created_at ?? rec.date_started ?? rec.Date_Started ?? rec.date_booked ?? rec.Date_Booked
    ),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    jobNumber: rec.unique_id ?? rec.Unique_ID ?? "",
    status: rec.job_status ?? rec.Job_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider ?? rec.primary_service_provider),
  };
}

export function normalizePayment(rec) {
  const client = resolveClientDetails(rec);
  const isPaid = !!(rec.bill_time_paid ?? rec.Bill_Time_Paid);
  const total = rec.invoice_total ?? rec.Invoice_Total ?? 0;
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    date: formatUnixDate(rec.created_at ?? rec.invoice_date ?? rec.Invoice_Date),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    invoiceNumber: rec.invoice_number ?? rec.Invoice_Number ?? "",
    amount: total,
    paid: isPaid ? total : 0,
    balance: isPaid ? 0 : total,
    jobStatus: rec.job_status ?? rec.Job_Status ?? "",
    status: rec.payment_status ?? rec.Payment_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider ?? rec.primary_service_provider),
  };
}

export function normalizeActiveJob(rec) {
  const client = resolveClientDetails(rec);
  return {
    id: rec.id,
    uid: rec.unique_id ?? rec.Unique_ID ?? "",
    scheduledDate: formatUnixDate(rec.created_at ?? rec.date_booked ?? rec.Date_Booked),
    clientName: client.clientName,
    phone: client.phone,
    email: client.email,
    address: (rec.Property ?? rec.property)?.property_name ?? rec?.property_property_name ?? rec?.Property_Property_Name ?? "",
    status: rec.job_status ?? rec.Job_Status ?? "",
    serviceProvider: spName(rec.Primary_Service_Provider ?? rec.primary_service_provider),
    invoiceNumber: rec.invoice_number ?? "",
  };
}

// Typed normalizers for combined tabs (urgent calls / open tasks).
// Add recordType + _rawTs so the combined view can distinguish and sort rows.
export function normalizeJobTyped(rec) {
  return {
    ...normalizeJob(rec),
    recordType: "job",
    _rawTs: Number(rec.created_at ?? rec.date_started ?? rec.date_booked ?? 0),
  };
}

export function normalizeDealTyped(rec) {
  return {
    ...normalizeDeal(rec),
    recordType: "inquiry",
    _rawTs: Number(rec.created_at ?? rec.Date_Added ?? 0),
  };
}

export function applyDealIncludes(q) {
  return q
    .include("Company", (sq) => sq.deSelectAll().select(["id", "name", "phone"]))
    .include("Primary_Contact", (sq) =>
      sq.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .include("Property", (sq) => sq.deSelectAll().select(["id", "property_name"]))
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    );
}
