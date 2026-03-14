// Language options from PeterpmUser schema (10 enum values)
export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "nl", label: "Dutch" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "hu", label: "Hungarian" },
  { value: "it", label: "Italian" },
  { value: "pl", label: "Polish" },
  { value: "pt", label: "Portuguese" },
  { value: "es", label: "Spanish" },
  { value: "tr", label: "Turkish" },
];

// Workload capacity options from PeterpmServiceProvider schema
export const WORKLOAD_OPTIONS = [
  { value: "OKAY", label: "Okay" },
  { value: "LOOKING", label: "Looking" },
  { value: "BUSY", label: "Busy" },
  { value: "ABSENT", label: "Absent" },
];

// Service Provider status options
export const SP_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Archived", label: "Archived" },
  { value: "Offline", label: "Offline" },
  { value: "On-Site", label: "On-Site" },
];

// Service Provider type options
export const SP_TYPE_OPTIONS = [
  { value: "Admin", label: "Admin" },
  { value: "Service Provider", label: "Service Provider" },
];

// Status badge color mapping
export const STATUS_COLORS = {
  Active: "bg-emerald-100 text-emerald-700",
  Archived: "bg-slate-100 text-slate-600",
  Offline: "bg-amber-100 text-amber-700",
  "On-Site": "bg-sky-100 text-sky-700",
};

export const WORKLOAD_COLORS = {
  OKAY: "bg-emerald-100 text-emerald-700",
  LOOKING: "bg-sky-100 text-sky-700",
  BUSY: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
};
