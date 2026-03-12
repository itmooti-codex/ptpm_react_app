import { toText } from "@shared/utils/formatters.js";

export function normalizeRelationRecord(value) {
  if (Array.isArray(value)) return value[0] || {};
  if (value && typeof value === "object") return value;
  return {};
}

export function normalizeServiceProviderContact(provider = {}) {
  const contactInfoRaw = provider?.Contact_Information || provider?.contact_information || {};
  const contactInfo = normalizeRelationRecord(contactInfoRaw);
  return {
    first_name: toText(
      provider?.first_name ||
        provider?.First_Name ||
        provider?.contact_information_first_name ||
        provider?.Contact_Information_First_Name ||
        contactInfo?.first_name ||
        contactInfo?.First_Name
    ),
    last_name: toText(
      provider?.last_name ||
        provider?.Last_Name ||
        provider?.contact_information_last_name ||
        provider?.Contact_Information_Last_Name ||
        contactInfo?.last_name ||
        contactInfo?.Last_Name
    ),
    email: toText(
      provider?.work_email || provider?.Work_Email || provider?.email || provider?.Email
    ),
    sms_number: toText(
      provider?.mobile_number ||
        provider?.Mobile_Number ||
        provider?.sms_number ||
        provider?.SMS_Number
    ),
  };
}

export function getInquiryPrimaryContact(inquiry = {}) {
  const nested = inquiry?.Primary_Contact || inquiry?.primary_contact || {};
  return {
    id: toText(
      nested?.id || nested?.ID || inquiry?.Primary_Contact_Contact_ID || inquiry?.Contact_Contact_ID
    ),
    first_name: toText(
      nested?.first_name ||
        nested?.First_Name ||
        inquiry?.Primary_Contact_First_Name ||
        inquiry?.Contact_First_Name
    ),
    last_name: toText(
      nested?.last_name ||
        nested?.Last_Name ||
        inquiry?.Primary_Contact_Last_Name ||
        inquiry?.Contact_Last_Name
    ),
    email: toText(
      nested?.email || nested?.Email || inquiry?.Primary_Contact_Email || inquiry?.ContactEmail
    ),
    sms_number: toText(
      nested?.sms_number || nested?.SMS_Number || inquiry?.Primary_Contact_SMS_Number
    ),
    address: toText(nested?.address || nested?.Address || inquiry?.Primary_Contact_Address),
    city: toText(nested?.city || nested?.City || inquiry?.Primary_Contact_City),
    state: toText(nested?.state || nested?.State || inquiry?.Primary_Contact_State),
    zip_code: toText(nested?.zip_code || nested?.Zip_Code || inquiry?.Primary_Contact_Zip_Code),
    popup_comment: toText(
      nested?.popup_comment ||
        nested?.Popup_Comment ||
        inquiry?.Primary_Contact_Popup_Comment
    ),
  };
}

export function getInquiryCompany(inquiry = {}) {
  const nested = inquiry?.Company || inquiry?.company || {};
  const nestedPrimaryPerson = nested?.Primary_Person || nested?.primary_person || {};
  const companyScopedPrimaryContact = {
    id: toText(inquiry?.Contact_Contact_ID || inquiry?.ContactID || inquiry?.Contact_ID),
    first_name: toText(inquiry?.Contact_First_Name || inquiry?.ContactFirstName),
    last_name: toText(inquiry?.Contact_Last_Name || inquiry?.ContactLastName),
    email: toText(inquiry?.ContactEmail || inquiry?.Contact_Email),
    sms_number: toText(inquiry?.Contact_SMS_Number || inquiry?.ContactSMSNumber),
  };

  return {
    id: toText(nested?.id || nested?.ID || inquiry?.CompanyID),
    name: toText(nested?.name || nested?.Name || inquiry?.CompanyName),
    type: toText(nested?.type || nested?.Type || inquiry?.CompanyType),
    description: toText(nested?.description || nested?.Description || inquiry?.CompanyDescription),
    phone: toText(nested?.phone || nested?.Phone || inquiry?.CompanyPhone),
    address: toText(nested?.address || nested?.Address || inquiry?.CompanyAddress),
    city: toText(nested?.city || nested?.City || inquiry?.CompanyCity),
    state: toText(nested?.state || nested?.State || inquiry?.CompanyState),
    postal_code: toText(nested?.postal_code || nested?.Postal_Code || inquiry?.Company_Postal_Code),
    industry: toText(nested?.industry || nested?.Industry || inquiry?.CompanyIndustry),
    annual_revenue: toText(
      nested?.annual_revenue || nested?.Annual_Revenue || inquiry?.Company_Annual_Revenue
    ),
    number_of_employees: toText(
      nested?.number_of_employees ||
        nested?.Number_of_Employees ||
        inquiry?.Company_Number_Of_Employees
    ),
    account_type: toText(
      nested?.account_type || nested?.Account_Type || inquiry?.Company_Account_Type
    ),
    popup_comment: toText(
      nested?.popup_comment || nested?.Popup_Comment || inquiry?.Company_Popup_Comment
    ),
    Primary_Person: {
      id: toText(
        nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || companyScopedPrimaryContact.id
      ),
      first_name: toText(
        nestedPrimaryPerson?.first_name ||
          nestedPrimaryPerson?.First_Name ||
          companyScopedPrimaryContact.first_name
      ),
      last_name: toText(
        nestedPrimaryPerson?.last_name ||
          nestedPrimaryPerson?.Last_Name ||
          companyScopedPrimaryContact.last_name
      ),
      email: toText(
        nestedPrimaryPerson?.email ||
          nestedPrimaryPerson?.Email ||
          companyScopedPrimaryContact.email
      ),
      sms_number: toText(
        nestedPrimaryPerson?.sms_number ||
          nestedPrimaryPerson?.SMS_Number ||
          companyScopedPrimaryContact.sms_number
      ),
    },
    Body_Corporate_Company: nested?.Body_Corporate_Company || nested?.body_corporate_company || {
      id: toText(inquiry?.CompanyID1),
      name: toText(inquiry?.CompanyName1),
      type: toText(inquiry?.CompanyType1),
      description: toText(inquiry?.CompanyDescription1),
      phone: toText(inquiry?.CompanyPhone1),
      address: toText(inquiry?.CompanyAddress1),
      city: toText(inquiry?.CompanyCity1),
      state: toText(inquiry?.CompanyState1),
      postal_code: toText(inquiry?.Company_Postal_Code1),
      industry: toText(inquiry?.CompanyIndustry1),
      annual_revenue: toText(inquiry?.Company_Annual_Revenue1),
      number_of_employees: toText(inquiry?.Company_Number_Of_Employees1),
    },
  };
}
