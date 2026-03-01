export const BASIC_OPTIONS = {
  status: [
    { value: "new", label: "New" },
    { value: "scheduled", label: "Scheduled" },
    { value: "completed", label: "Completed" },
  ],
  type: [
    { value: "inspection", label: "Inspection" },
    { value: "repair", label: "Repair" },
    { value: "quote", label: "Quote" },
  ],
  priority: [
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
  ],
  paymentStatus: [
    { value: "pending", label: "Pending" },
    { value: "invoiced", label: "Invoiced" },
    { value: "paid", label: "Paid" },
  ],
  jobStatus: [
    { value: "open", label: "Open" },
    { value: "in-progress", label: "In Progress" },
    { value: "closed", label: "Closed" },
  ],
};

export const JOB_TYPE_OPTIONS = [
  { value: "334", label: "PPI" },
  { value: "333", label: "Quote" },
  { value: "332", label: "Inspection" },
  { value: "331", label: "Barrier Treatment" },
  { value: "330", label: "MB Inquiry" },
  { value: "329", label: "Reticulation" },
  { value: "328", label: "Borer Treatment" },
  { value: "327", label: "Drywood Termites" },
  { value: "326", label: "Followup Inquiry - DW" },
  { value: "325", label: "Notes only" },
  { value: "324", label: "Invoice Cancelled" },
  { value: "323", label: "General Pest" },
  { value: "322", label: "Baiting System" },
  { value: "321", label: "42 Day Check" },
  { value: "320", label: "Stump/Tree Treatment" },
  { value: "319", label: "Inspection & General Pest" },
  { value: "318", label: "Nest Treatment" },
  { value: "317", label: "Warranty ReTreatment" },
  { value: "316", label: "Administration" },
  { value: "315", label: "Annual Maintenance" },
];

export const JOB_STATUS_OPTIONS = [
  { value: "579", label: "Quote", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  { value: "133", label: "On Hold", color: "#9e9e9e", backgroundColor: "#ececec" },
  { value: "130", label: "Booked", color: "#1e88e5", backgroundColor: "#d2e7fa" },
  { value: "677", label: "Call Back", color: "#1e88e5", backgroundColor: "#d2e7fa" },
  { value: "129", label: "Scheduled", color: "#00acc1", backgroundColor: "#cceef3" },
  { value: "507", label: "Reschedule", color: "#ef6c00", backgroundColor: "#fce2cc" },
  { value: "663", label: "In Progress", color: "#00acc1", backgroundColor: "#cceef3" },
  {
    value: "128",
    label: "Waiting For Payment",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  { value: "127", label: "Completed", color: "#43a047", backgroundColor: "#d9ecda" },
  { value: "126", label: "Cancelled", color: "#757575", backgroundColor: "#e3e3e3" },
];

export const PRIORITY_OPTIONS = [
  { value: "125", label: "Low", color: "#0097a7", backgroundColor: "#cceaed" },
  { value: "124", label: "Medium", color: "#f57c00", backgroundColor: "#fde5cc" },
  { value: "123", label: "High", color: "#d84315", backgroundColor: "#f7d9d0" },
];

export const APPOINTMENT_STATUS_OPTIONS = [
  { value: "New", label: "New", code: "640", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  {
    value: "To Be Scheduled",
    label: "To Be Scheduled",
    code: "639",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  {
    value: "Scheduled",
    label: "Scheduled",
    code: "638",
    color: "#0288d1",
    backgroundColor: "#cce7f6",
  },
  {
    value: "Completed",
    label: "Completed",
    code: "637",
    color: "#43a047",
    backgroundColor: "#d9ecda",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
    code: "636",
    color: "#9e9e9e",
    backgroundColor: "#ececec",
  },
];

export const APPOINTMENT_TYPE_OPTIONS = [
  { value: "select none", label: "select none" },
  { value: "Inquiry", label: "Inquiry" },
  { value: "Job", label: "Job" },
];

export const APPOINTMENT_EVENT_COLOR_OPTIONS = [
  { value: "1", label: "1", code: "631", color: "#a4bdfc", backgroundColor: "#edf2fe" },
  { value: "2", label: "2", code: "630", color: "#7ae7bf", backgroundColor: "#e4faf2" },
  { value: "3", label: "3", code: "629", color: "#dbadff", backgroundColor: "#f8efff" },
  { value: "4", label: "4", code: "628", color: "#ff887c", backgroundColor: "#ffe7e5" },
  { value: "5", label: "5", code: "627", color: "#fbd75b", backgroundColor: "#fef7de" },
  { value: "6", label: "6", code: "626", color: "#ffb878", backgroundColor: "#fff1e4" },
  { value: "7", label: "7", code: "625", color: "#46d6db", backgroundColor: "#daf7f8" },
  { value: "8", label: "8", code: "624", color: "#e1e1e1", backgroundColor: "#f9f9f9" },
  { value: "9", label: "9", code: "623", color: "#5484ed", backgroundColor: "#dde6fb" },
  { value: "10", label: "10", code: "622", color: "#51b749", backgroundColor: "#dcf1db" },
  { value: "11", label: "11", code: "621", color: "#dc2127", backgroundColor: "#f8d3d4" },
];

export const APPOINTMENT_DURATION_HOURS_OPTIONS = [
  { value: "0", label: "0" },
  { value: "1", label: "1" },
  { value: "2", label: "2" },
  { value: "3", label: "3" },
  { value: "4", label: "4" },
  { value: "5", label: "5" },
];

export const APPOINTMENT_DURATION_MINUTES_OPTIONS = [
  { value: "0", label: "0" },
  { value: "15", label: "15" },
  { value: "30", label: "30" },
  { value: "45", label: "45" },
];

export const ACTIVITY_TASK_OPTIONS = [
  { value: "Job 1", label: "Job 1" },
  { value: "Job 2", label: "Job 2" },
  { value: "Job 3", label: "Job 3" },
  { value: "Job 4", label: "Job 4" },
  { value: "Job 5", label: "Job 5" },
];

export const ACTIVITY_OPTION_OPTIONS = [
  { value: "Option 1", label: "Option 1" },
  { value: "Option 2", label: "Option 2" },
  { value: "Option 3", label: "Option 3" },
  { value: "Option 4", label: "Option 4" },
  { value: "Option 5", label: "Option 5" },
];

export const ACTIVITY_STATUS_OPTIONS = [
  { value: "Quoted", label: "Quoted", code: "584", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  {
    value: "To Be Scheduled",
    label: "To Be Scheduled",
    code: "585",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  { value: "Reschedule", label: "Reschedule", code: "606", color: "#ff5722", backgroundColor: "#ffddd3" },
  { value: "Scheduled", label: "Scheduled", code: "166", color: "#00acc1", backgroundColor: "#cceef3" },
  { value: "Completed", label: "Completed", code: "165", color: "#43a047", backgroundColor: "#d9ecda" },
  { value: "Cancelled", label: "Cancelled", code: "583", color: "#000000", backgroundColor: "#cccccc" },
];

export const MATERIAL_TRANSACTION_TYPE_OPTIONS = [
  { value: "Reimburse", label: "Reimburse" },
  { value: "Deduct", label: "Deduct" },
];

export const MATERIAL_TAX_OPTIONS = [
  { value: "Exemptexpenses", label: "Exemptexpenses" },
  { value: "Input", label: "Input" },
];

export const MATERIAL_STATUS_OPTIONS = [
  { value: "New", label: "New", color: "#0369A1", backgroundColor: "#E0F2FE" },
  { value: "In Progress", label: "In Progress", color: "#0E7490", backgroundColor: "#CFFAFE" },
  {
    value: "Pending Payment",
    label: "Pending Payment",
    color: "#B45309",
    backgroundColor: "#FEF3C7",
  },
  {
    value: "Assigned to Job",
    label: "Assigned to Job",
    color: "#166534",
    backgroundColor: "#DCFCE7",
  },
  { value: "Paid", label: "Paid", color: "#475569", backgroundColor: "#E2E8F0" },
];

export const XERO_INVOICE_STATUS_OPTIONS = [
  { value: "Create Invoice", label: "Create Invoice", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  { value: "Update Invoice", label: "Update Invoice", color: "#8e24aa", backgroundColor: "#e8d3ee" },
  { value: "Awaiting payment", label: "Awaiting payment", color: "#fb8c00", backgroundColor: "#fee8cc" },
  { value: "Paid", label: "Paid", color: "#43a047", backgroundColor: "#d9ecda" },
  { value: "Failed", label: "Failed", color: "#000000", backgroundColor: "#cccccc" },
];

export const PAYMENT_STATUS_OPTIONS = [
  {
    value: "Invoice Required",
    label: "Invoice Required",
    color: "#8e24aa",
    backgroundColor: "#e8d3ee",
  },
  {
    value: "Invoice Sent",
    label: "Invoice Sent",
    color: "#3949ab",
    backgroundColor: "#d7dbee",
  },
  {
    value: "Paid",
    label: "Paid",
    color: "#43a047",
    backgroundColor: "#d9ecda",
  },
  {
    value: "Overdue",
    label: "Overdue",
    color: "#f4511e",
    backgroundColor: "#fddcd2",
  },
  {
    value: "Written Off",
    label: "Written Off",
    color: "#fb8c00",
    backgroundColor: "#fee8cc",
  },
  {
    value: "Cancelled",
    label: "Cancelled",
    color: "#616161",
    backgroundColor: "#dfdfdf",
  },
];

export const XERO_BILL_STATUS_OPTIONS = [
  {
    value: "Create Bill Line Item",
    label: "Create Bill Line Item",
    color: "#8e24aa",
    backgroundColor: "#e8d3ee",
  },
  {
    value: "Update Bill Line Item",
    label: "Update Bill Line Item",
    color: "#8e24aa",
    backgroundColor: "#e8d3ee",
  },
  { value: "Waiting Approval", label: "Waiting Approval", color: "#039be5", backgroundColor: "#cdebfa" },
  { value: "Awaiting Payment", label: "Awaiting Payment", color: "#f4511e", backgroundColor: "#fddcd2" },
  { value: "Paid", label: "Paid", color: "#43a047", backgroundColor: "#d9ecda" },
  { value: "Failed", label: "Failed", color: "#000000", backgroundColor: "#cccccc" },
  { value: "Not Synced", label: "Not Synced", color: "#475569", backgroundColor: "#f1f5f9" },
  { value: "Pending", label: "Pending", color: "#1e88e5", backgroundColor: "#d2e7fa" },
];
