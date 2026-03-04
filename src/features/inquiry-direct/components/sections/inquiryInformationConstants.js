export const INQUIRY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "request", label: "Request Details" },
  { id: "pipeline", label: "Deal Pipeline" },
  { id: "notes", label: "Notes" },
  { id: "service-provider", label: "Service Provider" },
  { id: "appointments", label: "Appointment" },
];

export const ENQUIRING_AS_OPTIONS = [
  { id: "individual", label: "Individual" },
  { id: "business", label: "Business Entity" },
  { id: "government", label: "Government" },
];

export const INQUIRY_STATUS_OPTIONS = [
  { code: "209", value: "New Inquiry", label: "New Inquiry", color: "#d81b60", backgroundColor: "#f7d1df" },
  { code: "801", value: "Not Allocated", label: "Not Allocated", color: "#d81b60", backgroundColor: "#f7d1df" },
  { code: "609", value: "Contact Client", label: "Contact Client", color: "#ab47bc", backgroundColor: "#eedaf2" },
  { code: "208", value: "Contact For Site Visit", label: "Contact For Site Visit", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  { code: "207", value: "Site Visit Scheduled", label: "Site Visit Scheduled", color: "#ffb300", backgroundColor: "#fff0cc" },
  {
    code: "206",
    value: "Site Visit to be Re-Scheduled",
    label: "Site Visit to be Re-Scheduled",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  { code: "205", value: "Generate Quote", label: "Generate Quote", color: "#00acc1", backgroundColor: "#cceef3" },
  { code: "204", value: "Quote Created", label: "Quote Created", color: "#43a047", backgroundColor: "#d9ecda" },
  { code: "506", value: "Completed", label: "Completed", color: "#43a047", backgroundColor: "#d9ecda" },
  { code: "505", value: "Cancelled", label: "Cancelled", color: "#000000", backgroundColor: "#cccccc" },
  { code: "696", value: "Expired", label: "Expired", color: "#757575", backgroundColor: "#e3e3e3" },
];

export const INQUIRY_SOURCE_OPTIONS = [
  { code: "191", value: "Web Form", label: "Web Form" },
  { code: "190", value: "Phone Call", label: "Phone Call" },
  { code: "189", value: "Email", label: "Email" },
  { code: "188", value: "SMS", label: "SMS" },
];

export const INQUIRY_TYPE_OPTIONS = [
  { code: "223", value: "General Inquiry", label: "General Inquiry" },
  { code: "222", value: "Service Request or Quote", label: "Service Request or Quote" },
  { code: "221", value: "Product or Service Information", label: "Product or Service Information" },
  { code: "220", value: "Customer Support or Technical Assistance", label: "Customer Support or Technical Assistance" },
  { code: "219", value: "Billing and Payment", label: "Billing and Payment" },
  { code: "218", value: "Appointment Scheduling or Rescheduling", label: "Appointment Scheduling or Rescheduling" },
  { code: "217", value: "Feedback or Suggestions", label: "Feedback or Suggestions" },
  { code: "214", value: "Complaint or Issue Reporting", label: "Complaint or Issue Reporting" },
  { code: "216", value: "Partnership or Collaboration Inquiry", label: "Partnership or Collaboration Inquiry" },
  { code: "215", value: "Job Application or Career Opportunities", label: "Job Application or Career Opportunities" },
  { code: "213", value: "Media or Press Inquiry", label: "Media or Press Inquiry" },
];

export const HOW_DID_YOU_HEAR_OPTIONS = [
  { code: "187", value: "Google", label: "Google" },
  { code: "186", value: "Bing", label: "Bing" },
  { code: "185", value: "Facebook", label: "Facebook" },
  { code: "184", value: "Yellow Pages", label: "Yellow Pages" },
  { code: "183", value: "Referral", label: "Referral" },
  { code: "182", value: "Car Signage", label: "Car Signage" },
  { code: "181", value: "Returning Customers", label: "Returning Customers" },
  { code: "180", value: "Other", label: "Other" },
];

export const SALES_STAGE_OPTIONS = [
  { code: "11", value: "New Lead", label: "New Lead" },
  { code: "12", value: "Qualified Prospect", label: "Qualified Prospect" },
  { code: "13", value: "Visit Scheduled", label: "Visit Scheduled" },
  { code: "14", value: "Consideration", label: "Consideration" },
  { code: "15", value: "Committed", label: "Committed" },
  { code: "16", value: "Closed - Won", label: "Closed - Won" },
  { code: "17", value: "Closed - Lost", label: "Closed - Lost" },
];

export const RECENT_ACTIVITY_OPTIONS = [
  {
    code: "20",
    value: "Active more than a month ago",
    label: "Active more than a month ago",
    color: "#e64a19",
    backgroundColor: "#fadbd1",
  },
  {
    code: "19",
    value: "Active in the last month",
    label: "Active in the last month",
    color: "#fdd835",
    backgroundColor: "#fff7d7",
  },
  {
    code: "18",
    value: "Active in the last week",
    label: "Active in the last week",
    color: "#689f38",
    backgroundColor: "#e1ecd7",
  },
];

export const NOISE_SIGN_OPTIONS = [
  { code: "768", value: "Fighting", label: "Fighting" },
  { code: "767", value: "Walking", label: "Walking" },
  { code: "766", value: "Heavy", label: "Heavy" },
  { code: "765", value: "Footsteps", label: "Footsteps" },
  { code: "764", value: "Running", label: "Running" },
  { code: "763", value: "Scurrying", label: "Scurrying" },
  { code: "762", value: "Thumping", label: "Thumping" },
  { code: "761", value: "Hissing", label: "Hissing" },
  { code: "760", value: "Shuffle", label: "Shuffle" },
  { code: "759", value: "Scratching", label: "Scratching" },
  { code: "758", value: "Can hear coming & going", label: "Can hear coming & going" },
  { code: "757", value: "Movement", label: "Movement" },
  { code: "756", value: "Gnawing", label: "Gnawing" },
  { code: "755", value: "Rolling", label: "Rolling" },
  { code: "754", value: "Dragging", label: "Dragging" },
  { code: "753", value: "Squeaking", label: "Squeaking" },
  { code: "752", value: "Galloping", label: "Galloping" },
  { code: "751", value: "Poss Pee", label: "Poss Pee" },
  { code: "750", value: "Fast", label: "Fast" },
  { code: "749", value: "Slow", label: "Slow" },
  { code: "748", value: "Bad Smell", label: "Bad Smell" },
];

export const PEST_LOCATION_OPTIONS = [
  { code: "735", value: "Upper Ceiling", label: "Upper Ceiling" },
  { code: "734", value: "Between floors", label: "Between floors" },
  { code: "733", value: "In Walls", label: "In Walls" },
  { code: "732", value: "In House", label: "In House" },
  { code: "731", value: "Chimney", label: "Chimney" },
  { code: "730", value: "Garage", label: "Garage" },
  { code: "729", value: "Kitchen", label: "Kitchen" },
  { code: "728", value: "Hand Catch", label: "Hand Catch" },
  { code: "727", value: "On roof", label: "On roof" },
  { code: "726", value: "Underneath House", label: "Underneath House" },
  { code: "725", value: "Under Solar Panels", label: "Under Solar Panels" },
];

export const PEST_ACTIVE_TIME_OPTIONS = [
  { code: "747", value: "Dawn", label: "Dawn" },
  { code: "746", value: "Dusk", label: "Dusk" },
  { code: "745", value: "Dusk & Dawn", label: "Dusk & Dawn" },
  { code: "744", value: "During Day", label: "During Day" },
  { code: "743", value: "Middle of night", label: "Middle of night" },
  { code: "742", value: "Night", label: "Night" },
  { code: "741", value: "Early morning", label: "Early morning" },
  { code: "740", value: "Evening", label: "Evening" },
  { code: "739", value: "1-2 am", label: "1-2 am" },
  { code: "738", value: "3-4 am", label: "3-4 am" },
  { code: "737", value: "7 - 8 pm", label: "7 - 8 pm" },
  { code: "736", value: "7.30-10 pm", label: "7.30-10 pm" },
];

export const EMPTY_FORM = {
  sales_stage: "",
  deal_value: "",
  expected_win: "",
  expected_close_date: "",
  actual_close_date: "",
  weighted_value: "",
  recent_activity: "",
  account_type: "Contact",
  client_id: "",
  company_id: "",
  service_provider_id: "",
  client_notes: "",
  property_id: "",
  inquiry_for_job_id: "",
  inquiry_status: "New Inquiry",
  inquiry_source: "",
  type: "",
  how_did_you_hear: "",
  other: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  admin_notes: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
  renovations: "",
  resident_availability: "",
  date_job_required_by: "",
};
