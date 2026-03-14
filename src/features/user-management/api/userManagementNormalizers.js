// Normalizes VitalStats SDK / GraphQL responses for User, Role, and ServiceProvider records.

function toText(value) {
  if (value == null || value === "") return "";
  return String(value).trim();
}

function readField(record, keys) {
  if (!record) return "";
  for (const key of keys) {
    if (record?.[key] != null) return record[key];
    if (record?.data?.[key] != null) return record.data[key];
    if (record?._data?.[key] != null) return record._data[key];
  }
  return "";
}

export function normalizeUserRecord(raw) {
  if (!raw) return null;
  const id = toText(readField(raw, ["id", "ID"]));
  if (!id) return null;

  const firstName = toText(readField(raw, ["first_name", "First_Name"]));
  const lastName = toText(readField(raw, ["last_name", "Last_Name"]));

  // Role can come from nested include or flat field
  const role = raw?.Role ?? raw?.role ?? null;
  const roleName = toText(role?.role || readField(raw, ["role_role", "Role_Role"]));
  const roleId = toText(readField(raw, ["role_id", "Role_ID", "Role_Id"]));

  return {
    id,
    firstName,
    lastName,
    fullName: [firstName, lastName].filter(Boolean).join(" "),
    email: toText(readField(raw, ["email", "Email"])),
    login: toText(readField(raw, ["login", "Login"])),
    status: toText(readField(raw, ["status", "Status"])),
    profileImage: toText(readField(raw, ["profile_image", "Profile_Image"])),
    image: toText(readField(raw, ["image", "Image"])),
    cellPhone: toText(readField(raw, ["cell_phone", "Cell_Phone"])),
    telephone: toText(readField(raw, ["telephone", "Telephone"])),
    fax: toText(readField(raw, ["fax", "Fax"])),
    businessName: toText(readField(raw, ["business_name", "Business_Name"])),
    businessAddress: toText(readField(raw, ["business_address", "Business_Address"])),
    businessCity: toText(readField(raw, ["business_city", "Business_City"])),
    businessState: toText(readField(raw, ["business_state", "Business_State"])),
    businessCountry: toText(readField(raw, ["business_country", "Business_Country"])),
    businessZip: toText(readField(raw, ["business_zip_postal", "Business_Zip_Postal"])),
    language: toText(readField(raw, ["language", "Language"])),
    timezone: toText(readField(raw, ["timezone", "Timezone"])),
    lastLogin: readField(raw, ["last_login", "Last_Login"]),
    lastActivity: readField(raw, ["last_activity", "Last_Activity"]),
    emailFromName: toText(readField(raw, ["email_from_name", "Email_From_Name"])),
    replyToEmail: toText(readField(raw, ["reply_to_email", "Reply_To_Email"])),
    roleId,
    roleName,
    managerId: toText(readField(raw, ["manager_id", "Manager_Id", "Manager_ID"])),
    uniqueId: toText(readField(raw, ["unique_id", "Unique_ID"])),
  };
}

export function normalizeRoleRecord(raw) {
  if (!raw) return null;
  const id = toText(readField(raw, ["id", "ID"]));
  if (!id) return null;
  return {
    id,
    role: toText(readField(raw, ["role", "Role"])),
    roleManagerId: toText(readField(raw, ["role_manager_id", "Role_Manager_Id"])),
  };
}

export function normalizeServiceProviderRecord(raw) {
  if (!raw) return null;
  const id = toText(readField(raw, ["id", "ID"]));
  if (!id) return null;

  const contactInfo = raw?.Contact_Information ?? raw?.contact_information ?? {};

  return {
    id,
    status: toText(readField(raw, ["status", "Status"])),
    type: toText(readField(raw, ["type", "Type"])),
    workEmail: toText(readField(raw, ["work_email", "Work_Email"])),
    mobileNumber: toText(readField(raw, ["mobile_number", "Mobile_Number"])),
    workloadCapacity: toText(readField(raw, ["workload_capacity", "Workload_Capacity"])),
    contactFirstName: toText(
      contactInfo?.first_name || readField(raw, ["contact_information_first_name", "Contact_Information_First_Name"])
    ),
    contactLastName: toText(
      contactInfo?.last_name || readField(raw, ["contact_information_last_name", "Contact_Information_Last_Name"])
    ),
    profileImage: toText(
      contactInfo?.profile_image || readField(raw, ["contact_information_profile_image", "Contact_Information_Profile_Image"])
    ),
  };
}
