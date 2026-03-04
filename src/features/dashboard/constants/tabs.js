export const TAB_IDS = {
  INQUIRY: "inquiry",
  QUOTE: "quote",
  JOBS: "jobs",
  PAYMENT: "payment",
  ACTIVE_JOBS: "active-jobs",
  URGENT_CALLS: "urgent-calls",
  OPEN_TASKS: "open-tasks",
};

export const TAB_LABELS = {
  [TAB_IDS.INQUIRY]: "Inquiries",
  [TAB_IDS.QUOTE]: "Quotes",
  [TAB_IDS.JOBS]: "Jobs",
  [TAB_IDS.PAYMENT]: "Payments",
  [TAB_IDS.ACTIVE_JOBS]: "Active Jobs",
  [TAB_IDS.URGENT_CALLS]: "Urgent Calls",
  [TAB_IDS.OPEN_TASKS]: "Open Tasks",
};

export const TAB_LIST = [
  TAB_IDS.INQUIRY,
  TAB_IDS.QUOTE,
  TAB_IDS.JOBS,
  TAB_IDS.PAYMENT,
  TAB_IDS.ACTIVE_JOBS,
  TAB_IDS.OPEN_TASKS,
  TAB_IDS.URGENT_CALLS,
];

export const TAB_STATUS_OPTIONS = {
  [TAB_IDS.INQUIRY]: [
    "New Inquiry",
    "Not Allocated",
    "Contact Client",
    "Contact For Site Visit",
    "Site Visit Scheduled",
    "Site Visit to be Re-Scheduled",
    "Generate Quote",
    "Quote Created",
    "Completed",
  ],
  [TAB_IDS.QUOTE]: [
    "New",
    "Requested",
    "Sent",
    "Declined",
  ],
  [TAB_IDS.JOBS]: [
    "On Hold",
    "Booked",
    "Call Back",
    "Scheduled",
    "Reschedule",
    "Accepted",
  ],
  [TAB_IDS.PAYMENT]: [
    "Invoice Required",
    "Invoice Sent",
    "Paid",
    "Overdue",
    "Written Off",
  ],
  [TAB_IDS.ACTIVE_JOBS]: ["In Progress"],
  [TAB_IDS.URGENT_CALLS]: [
    "On Hold",
    "Booked",
    "Call Back",
    "Scheduled",
    "Reschedule",
    "Accepted",
  ],
  [TAB_IDS.OPEN_TASKS]: [
    "On Hold",
    "Booked",
    "Call Back",
    "Scheduled",
    "Reschedule",
    "Accepted",
  ],
};

export const ACCOUNT_TYPE_OPTIONS = ["Individual", "Entity"];

export const SOURCE_OPTIONS = ["Web Form", "Phone Call", "Email", "SMS"];

export const PAYMENT_ONLY_TABS = new Set([TAB_IDS.PAYMENT, TAB_IDS.ACTIVE_JOBS]);
export const CALENDAR_TABS = new Set([
  TAB_IDS.INQUIRY,
  TAB_IDS.QUOTE,
  TAB_IDS.JOBS,
  TAB_IDS.PAYMENT,
  TAB_IDS.ACTIVE_JOBS,
  TAB_IDS.URGENT_CALLS,
  TAB_IDS.OPEN_TASKS,
]);
