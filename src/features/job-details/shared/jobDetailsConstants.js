import { toText } from "@shared/utils/formatters.js";

export const JOB_TAKEN_BY_FIELD_ALIASES = [
  "Job_Taken_By_id",
  "job_taken_by_id",
  "Job_Taken_By_ID",
];

export const JOB_WORKSPACE_TABS = [
  { id: "related-data", label: "Related Data" },
  { id: "properties", label: "Properties" },
  { id: "uploads", label: "Uploads" },
  { id: "appointments", label: "Appointments" },
  { id: "activities", label: "Activities" },
  { id: "materials", label: "Materials" },
  { id: "invoice-payment", label: "Quote and Payment" },
];

export const JOB_INITIAL_SELECT_FIELDS = [
  "id",
  "unique_id",
  "job_status",
  "job_Status",
  "Job_Status",
  "primary_service_provider_id",
  "Primary_Service_Provider_ID",
  "inquiry_record_id",
  "Inquiry_Record_ID",
  "pca_done",
  "PCA_Done",
  "prestart_done",
  "Prestart_Done",
  "mark_complete",
  "Mark_Complete",
  "client_entity_id",
  "Client_Entity_ID",
  "client_individual_id",
  "Client_Individual_ID",
  "property_id",
  "Property_ID",
  "account_type",
  "Account_Type",
  "accounts_contact_id",
  "Accounts_Contact_ID",
  "quote_status",
  "Quote_Status",
  "payment_status",
  "Payment_Status",
  "quote_date",
  "Quote_Date",
  "follow_up_date",
  "Follow_Up_Date",
  "quote_valid_until",
  "Quote_Valid_Until",
  "date_quote_requested",
  "Date_Quote_Requested",
  "date_quote_sent",
  "Date_Quote_Sent",
  "date_quoted_accepted",
  "Date_Quoted_Accepted",
  "priority",
  "Priority",
  "admin_recommendation",
  "Admin_Recommendation",
];

export const EMPTY_QUOTE_PAYMENT_DETAILS = {
  quote_status: "",
  payment_status: "",
  quote_date: null,
  follow_up_date: null,
  quote_valid_until: null,
  date_quote_requested: null,
  date_quote_sent: null,
  date_quoted_accepted: null,
  priority: "",
  admin_recommendation: "",
};

export function buildQuotePaymentDetailsFromJob(job = {}) {
  return {
    quote_status: toText(job?.quote_status || job?.Quote_Status),
    payment_status: toText(job?.payment_status || job?.Payment_Status),
    quote_date: job?.quote_date ?? job?.Quote_Date ?? null,
    follow_up_date: job?.follow_up_date ?? job?.Follow_Up_Date ?? null,
    quote_valid_until: job?.quote_valid_until ?? job?.Quote_Valid_Until ?? null,
    date_quote_requested: job?.date_quote_requested ?? job?.Date_Quote_Requested ?? null,
    date_quote_sent: job?.date_quote_sent ?? job?.Date_Quote_Sent ?? null,
    date_quoted_accepted: job?.date_quoted_accepted ?? job?.Date_Quoted_Accepted ?? null,
    priority: toText(job?.priority || job?.Priority),
    admin_recommendation: toText(job?.admin_recommendation || job?.Admin_Recommendation),
  };
}
