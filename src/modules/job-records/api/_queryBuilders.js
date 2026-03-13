import { normalizeId } from "./_helpers.js";
import { toText } from "@shared/utils/formatters.js";

export function mapInquiryRecord(raw = null) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    id: normalizeId(raw.id || raw.ID),
    unique_id: toText(raw.unique_id || raw.Unique_ID),
    inquiry_status: toText(raw.inquiry_status || raw.Inquiry_Status),
    account_type: toText(raw.account_type || raw.Account_Type),
    inquiry_source: toText(raw.inquiry_source || raw.Inquiry_Source),
    type: toText(raw.type || raw.Type),
    how_did_you_hear: toText(raw.how_did_you_hear || raw.How_did_you_hear),
    how_can_we_help: toText(raw.how_can_we_help || raw.How_can_we_help),
    other: toText(raw.other || raw.Other),
    admin_notes: toText(raw.admin_notes || raw.Admin_Notes),
    client_notes: toText(raw.client_notes || raw.Client_Notes),
    deal_name: toText(raw.deal_name || raw.Deal_Name),
    deal_value: toText(raw.deal_value || raw.Deal_Value),
    sales_stage: toText(raw.sales_stage || raw.Sales_Stage),
    expected_win: toText(raw.expected_win || raw.Expected_Win),
    expected_close_date: toText(raw.expected_close_date || raw.Expected_Close_Date),
    actual_close_date: toText(raw.actual_close_date || raw.Actual_Close_Date),
    weighted_value: toText(raw.weighted_value || raw.Weighted_Value),
    service_inquiry_id: toText(raw.service_inquiry_id || raw.Service_Inquiry_ID),
    service_provider_id: normalizeId(raw.service_provider_id || raw.Service_Provider_ID),
    company_id: normalizeId(raw.company_id || raw.Company_ID),
    primary_contact_id: normalizeId(raw.primary_contact_id || raw.Primary_Contact_ID),
    noise_signs_options_as_text: toText(
      raw.noise_signs_options_as_text || raw.Noise_Signs_Options_As_Text
    ),
    pest_active_times_options_as_text: toText(
      raw.pest_active_times_options_as_text || raw.Pest_Active_Times_Options_As_Text
    ),
    pest_location_options_as_text: toText(
      raw.pest_location_options_as_text || raw.Pest_Location_Options_As_Text
    ),
    renovations: toText(raw.renovations || raw.Renovations),
    resident_availability: toText(raw.resident_availability || raw.Resident_Availability),
    date_job_required_by: toText(raw.date_job_required_by || raw.Date_Job_Required_By),
    recommendations: toText(raw.recommendations || raw.Recommendations),
    quote_record_id: normalizeId(
      raw.quote_record_id || raw.Quote_Record_ID || raw.Quote_record_ID
    ),
    inquiry_for_job_id: normalizeId(
      raw.inquiry_for_job_id || raw.Inquiry_For_Job_ID || raw.Inquiry_for_Job_ID
    ),
    property_id: normalizeId(raw.property_id || raw.Property_ID),
  };
}

export function mapJobRecord(raw = null) {
  if (!raw || typeof raw !== "object") return null;
  const accountsContact = raw?.Accounts_Contact?.Contact || {};
  return {
    ...raw,
    id: normalizeId(raw.id || raw.ID),
    unique_id: toText(raw.unique_id || raw.Unique_ID),
    inquiry_record_id: normalizeId(raw.inquiry_record_id || raw.Inquiry_Record_ID),
    primary_service_provider_id: normalizeId(
      raw.primary_service_provider_id ||
        raw.Primary_Service_Provider_ID ||
        raw?.Primary_Service_Provider?.id ||
        raw?.Primary_Service_Provider?.ID
    ),
    client_individual_id: normalizeId(raw.client_individual_id || raw.Client_Individual_ID),
    client_entity_id: normalizeId(raw.client_entity_id || raw.Client_Entity_ID),
    accounts_contact_id: normalizeId(raw.accounts_contact_id || raw.Accounts_Contact_ID),
    property_id: normalizeId(raw.property_id || raw.Property_ID),
    job_status: toText(raw.job_status || raw.Job_Status),
    quote_status: toText(raw.quote_status || raw.Quote_Status),
    quote_date: toText(raw.quote_date || raw.Quote_Date),
    follow_up_date: raw?.follow_up_date ?? raw?.Follow_Up_Date ?? null,
    quote_valid_until: raw?.quote_valid_until ?? raw?.Quote_Valid_Until ?? null,
    date_quote_requested: raw?.date_quote_requested ?? raw?.Date_Quote_Requested ?? null,
    date_quote_sent: toText(raw.date_quote_sent || raw.Date_Quote_Sent),
    date_quoted_accepted: toText(raw.date_quoted_accepted || raw.Date_Quoted_Accepted),
    payment_status: toText(raw.payment_status || raw.Payment_Status),
    priority: toText(raw.priority || raw.Priority),
    admin_recommendation: toText(raw.admin_recommendation || raw.Admin_Recommendation),
    invoice_number: toText(raw.invoice_number || raw.Invoice_Number),
    invoice_total: toText(raw.invoice_total || raw.Invoice_Total),
    xero_invoice_status: toText(raw.xero_invoice_status || raw.Xero_Invoice_Status),
    xero_bill_status: toText(raw.xero_bill_status || raw.Xero_Bill_Status),
    accounts_contact_contact_id: normalizeId(
      raw?.accounts_contact_contact_id ||
        raw?.Accounts_Contact_Contact_ID ||
        accountsContact?.id ||
        accountsContact?.ID
    ),
    accounts_contact_contact_first_name: toText(
      raw?.accounts_contact_contact_first_name ||
        raw?.Accounts_Contact_Contact_First_Name ||
        accountsContact?.first_name ||
        accountsContact?.First_Name
    ),
    accounts_contact_contact_last_name: toText(
      raw?.accounts_contact_contact_last_name ||
        raw?.Accounts_Contact_Contact_Last_Name ||
        accountsContact?.last_name ||
        accountsContact?.Last_Name
    ),
    accounts_contact_contact_email: toText(
      raw?.accounts_contact_contact_email ||
        raw?.Accounts_Contact_Contact_Email ||
        accountsContact?.email ||
        accountsContact?.Email
    ),
    bill_approved_admin:
      raw.bill_approved_admin === true ||
      toText(raw.bill_approved_admin || raw.Bill_Approved_Admin).toLowerCase() === "true",
  };
}

export function buildInquiryBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmDeal")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "created_at",
      "property_id",
      "account_type",
      "primary_contact_id",
      "company_id",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "how_can_we_help",
      "other",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "renovations",
      "resident_availability",
      "date_job_required_by",
      "recommendations",
      "admin_notes",
      "client_notes",
      "deal_name",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "service_inquiry_id",
      "service_provider_id",
      "quote_record_id",
      "inquiry_for_job_id",
    ])
    .include("Primary_Contact", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "address",
          "city",
          "state",
          "zip_code",
          "popup_comment",
        ])
    )
    .include("Company", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "name",
          "type",
          "description",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
          "industry",
          "annual_revenue",
          "number_of_employees",
          "account_type",
          "popup_comment",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
            .deSelectAll()
            .select([
              "id",
              "name",
              "type",
              "description",
              "phone",
              "address",
              "city",
              "state",
              "postal_code",
              "industry",
              "annual_revenue",
              "number_of_employees",
            ])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "suburb_town",
          "state",
          "postal_code",
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
        ])
        .include("Building_Features", (featureQuery) =>
          featureQuery.deSelectAll().select(["id"])
        )
    )
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
        )
    );
}

export function buildJobBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmJob")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_record_id",
      "primary_service_provider_id",
      "client_individual_id",
      "client_entity_id",
      "accounts_contact_id",
      "property_id",
      "job_status",
      "quote_status",
      "quote_date",
      "follow_up_date",
      "quote_valid_until",
      "date_quote_requested",
      "date_quote_sent",
      "date_quoted_accepted",
      "payment_status",
      "priority",
      "admin_recommendation",
      "created_at",
      "date_started",
      "date_booked",
      "date_job_required_by",
      "account_type",
      "invoice_number",
      "invoice_total",
      "invoice_date",
      "due_date",
      "xero_invoice_status",
      "xero_bill_status",
      "bill_date",
      "bill_due_date",
      "bill_approved_admin",
    ])
    .include("Client_Individual", (sq) =>
      sq.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number", "xero_contact_id"])
    )
    .include("Client_Entity", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "name", "phone", "account_type", "xero_contact_id"])
        .include("Primary_Person", (personQuery) =>
          personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "suburb_town",
          "state",
          "postal_code",
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
        ])
        .include("Building_Features", (featureQuery) =>
          featureQuery.deSelectAll().select(["id"])
        )
    )
    .include("Primary_Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "job_rate_percentage"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name", "email"])
        )
    )
    .include("Accounts_Contact", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact", (sq2) =>
          sq2.deSelectAll().select(["id", "first_name", "last_name", "email"])
        )
    )
    .include("Inquiry_Record", (sq) =>
      sq.deSelectAll().select(["id", "unique_id", "inquiry_status", "deal_name", "inquiry_source"])
    );
}
