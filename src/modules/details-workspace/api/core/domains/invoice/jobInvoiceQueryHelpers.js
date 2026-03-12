export const JOB_INVOICE_API_RESPONSE_SELECT_FIELDS = [
  "id",
  "xero_api_response",
  "invoice_url_admin",
  "invoice_url_client",
  "xero_invoice_status",
  "xero_invoice_pdf",
  "invoice_number",
];

export function buildInvoiceJobSnapshotQuery() {
  return `
    query getJob($id: PeterpmJobID!) {
      getJob(query: [{ where: { id: $id } }]) {
        ID: id
        Unique_ID: unique_id
        Xero_Invoice_Status: xero_invoice_status
        Invoice_Number: invoice_number
        Account_Type: account_type
        Invoice_Date: invoice_date
        Due_Date: due_date
        Invoice_URL_Admin: invoice_url_admin
        Invoice_URL_Client: invoice_url_client
        Send_to_Contact: send_to_contact
        Invoice_Total: invoice_total
        Xero_Invoice_PDF: xero_invoice_pdf
        Payment_Status: payment_status
        xero_api_response
        Invoice_ID: invoice_id
        Bill_Date: bill_date
        Bill_Due_Date: bill_due_date
        Bill_Total: bill_total
        Bill_GST: bill_gst
        Bill_Xero_ID: bill_xero_id
        Xero_Bill_Status: xero_bill_status
        Bill_Batch_ID: bill_batch_id
        Bill_Batch_Date: bill_batch_date
        Bill_Batch_Week: bill_batch_week
        Bill_Approved_Admin: bill_approved_admin
        Bill_Approval_Time: bill_approval_time
        Bill_Approved_Service_Provider: bill_approved_service_provider
        Materials_Total: materials_total
        Reimburse_Total: reimburse_total
        Deduct_Total: deduct_total
        Primary_Service_Provider_ID: primary_service_provider_id
        Client_Entity_ID: client_entity_id
        Client_Individual_ID: client_individual_id
        Accounts_Contact_ID: accounts_contact_id
        Contact_ID: contact_id
        Client_Entity {
          id
          name
          account_type
          xero_contact_id
        }
        Client_Individual {
          id
          first_name
          last_name
          email
          sms_number
          xero_contact_id
        }
        Accounts_Contact {
          id
          Contact {
            id
            first_name
            last_name
            email
          }
        }
        Primary_Service_Provider {
          id
          unique_id
          status
          job_rate_percentage
          Contact_Information {
            first_name
            last_name
            email
          }
        }
      }
    }
  `;
}

export function buildJobByFieldQuery(jobModel, field, value) {
  return jobModel
    .query()
    .where(field, value)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "job_status",
      "job_type",
      "account_type",
      "contact_type",
      "client_individual_id",
      "client_entity_id",
      "inquiry_record_id",
      "contact_id",
      "priority",
      "property_id",
      "primary_service_provider_id",
      "date_started",
      "date_booked",
      "date_job_required_by",
      "payment_status",
      "job_total",
      "invoice_date",
      "due_date",
      "invoice_number",
      "invoice_id",
      "invoice_total",
      "xero_invoice_status",
      "xero_api_response",
      "xero_invoice_pdf",
      "invoice_url_admin",
      "invoice_url_client",
      "accounts_contact_id",
      "send_to_contact",
      "bill_date",
      "bill_due_date",
      "bill_total",
      "bill_gst",
      "bill_xero_id",
      "xero_bill_status",
      "bill_batch_id",
      "bill_batch_date",
      "bill_batch_week",
      "bill_approved_admin",
      "bill_approval_time",
      "bill_approved_service_provider",
      "materials_total",
      "reimburse_total",
      "deduct_total",
    ])
    .include("Client_Individual", (q) =>
      q
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "xero_contact_id",
        ])
    )
    .include("Client_Entity", (q) =>
      q
        .deSelectAll()
        .select(["id", "name", "account_type", "xero_contact_id"])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
        )
    )
    .include("Inquiry_Record", (q) =>
      q.deSelectAll().select(["id", "unique_id", "deal_name"])
    )
    .include("Accounts_Contact", (q) =>
      q
        .deSelectAll()
        .select(["id"])
        .include("Contact", (contactQuery) =>
          contactQuery.deSelectAll().select(["id", "first_name", "last_name", "email"])
        )
    )
    .include("Primary_Service_Provider", (providerQuery) =>
      providerQuery
        .deSelectAll()
        .select(["id", "unique_id", "status", "job_rate_percentage"])
        .include("Contact_Information", (contactQuery) =>
          contactQuery.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
        )
    )
    .include("Property", (q) =>
      q.deSelectAll().select([
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
      ])
    );
}
