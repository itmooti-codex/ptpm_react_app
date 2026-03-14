// Normalizes VitalStats ServiceProvider records.
// Express API returns clean JSON — no normalization needed for admin_users.

function toText(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

export function normalizeServiceProviderRecord(raw) {
  if (!raw) return null;
  const id = toText(raw?.id ?? raw?.ID);
  if (!id) return null;

  const contactInfo = raw?.Contact_Information ?? raw?.contact_information ?? {};

  return {
    id,
    status: toText(raw?.status ?? raw?.Status),
    type: toText(raw?.type ?? raw?.Type),
    workEmail: toText(raw?.work_email ?? raw?.Work_Email),
    mobileNumber: toText(raw?.mobile_number ?? raw?.Mobile_Number),
    workloadCapacity: toText(raw?.workload_capacity ?? raw?.Workload_Capacity),
    contactFirstName: toText(
      contactInfo?.first_name ||
        raw?.contact_information_first_name ||
        raw?.Contact_Information_First_Name
    ),
    contactLastName: toText(
      contactInfo?.last_name ||
        raw?.contact_information_last_name ||
        raw?.Contact_Information_Last_Name
    ),
    profileImage: toText(
      contactInfo?.profile_image ||
        raw?.contact_information_profile_image ||
        raw?.Contact_Information_Profile_Image
    ),
  };
}
