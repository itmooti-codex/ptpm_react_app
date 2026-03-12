import { normalizePropertyLookupRecord } from "@modules/details-workspace/exports/api.js";
import { normalizePropertyId } from "@modules/details-workspace/exports/components.js";
import { toText } from "@shared/utils/formatters.js";

export function buildInquiryPropertyRecord({ inquiry, inquiryPropertyRelationRecord, inquiryPropertyId }) {
  return normalizePropertyLookupRecord({
    ...inquiryPropertyRelationRecord,
    id:
      inquiryPropertyId ||
      inquiryPropertyRelationRecord?.id ||
      inquiryPropertyRelationRecord?.ID,
    unique_id: inquiryPropertyRelationRecord?.unique_id || inquiry?.Property_Unique_ID,
    property_name:
      inquiryPropertyRelationRecord?.property_name || inquiry?.Property_Property_Name,
    address_1: inquiryPropertyRelationRecord?.address_1 || inquiry?.Property_Address_1,
    address_2: inquiryPropertyRelationRecord?.address_2 || inquiry?.Property_Address_2,
    suburb_town: inquiryPropertyRelationRecord?.suburb_town || inquiry?.Property_Suburb_Town,
    state: inquiryPropertyRelationRecord?.state || inquiry?.PropertyState || inquiry?.Property_State,
    postal_code: inquiryPropertyRelationRecord?.postal_code || inquiry?.Property_Postal_Code,
    country:
      inquiryPropertyRelationRecord?.country || inquiry?.PropertyCountry || inquiry?.Property_Country,
    property_type:
      inquiryPropertyRelationRecord?.property_type || inquiry?.Property_Property_Type,
    building_type:
      inquiryPropertyRelationRecord?.building_type || inquiry?.Property_Building_Type,
    building_type_other:
      inquiryPropertyRelationRecord?.building_type_other || inquiry?.Property_Building_Type_Other,
    foundation_type:
      inquiryPropertyRelationRecord?.foundation_type || inquiry?.Property_Foundation_Type,
    bedrooms: inquiryPropertyRelationRecord?.bedrooms ?? inquiry?.PropertyBedrooms,
    manhole: inquiryPropertyRelationRecord?.manhole ?? inquiry?.PropertyManhole,
    stories: inquiryPropertyRelationRecord?.stories ?? inquiry?.PropertyStories,
    building_age: inquiryPropertyRelationRecord?.building_age || inquiry?.Property_Building_Age,
    lot_number: inquiryPropertyRelationRecord?.lot_number || inquiry?.Property_Lot_Number,
    unit_number: inquiryPropertyRelationRecord?.unit_number || inquiry?.Property_Unit_Number,
  });
}

export function buildInquiryPropertySearchItems(records, resolvePropertyLookupLabel) {
  return records
    .map((item) => ({
      id: normalizePropertyId(item?.id),
      label: resolvePropertyLookupLabel(item) || "Property",
      meta: [
        toText(item?.unique_id || item?.Unique_ID),
        toText(item?.address_1 || item?.Address_1 || item?.address || item?.Address),
        toText(item?.suburb_town || item?.Suburb_Town || item?.city || item?.City),
        toText(item?.state || item?.State),
        toText(item?.postal_code || item?.Postal_Code || item?.zip_code || item?.Zip_Code),
      ]
        .filter(Boolean)
        .join(" | "),
    }))
    .filter((item) => item.id || item.label);
}

export function buildInquiryWorkspaceLookupData({
  inquiryCompany,
  inquiryCompanyId,
  inquiryCompanyPrimaryPerson,
  inquiryContactId,
  inquiryPrimaryContact,
  inquiryTakenByLookup,
  serviceProviderLookup,
  workspacePropertiesSorted,
}) {
  const providers = [
    ...(Array.isArray(serviceProviderLookup) ? serviceProviderLookup : []),
    ...(Array.isArray(inquiryTakenByLookup) ? inquiryTakenByLookup : []),
  ];
  const dedupedProviderMap = new Map();
  providers.forEach((provider) => {
    const key = toText(provider?.id || provider?.ID);
    if (!key || dedupedProviderMap.has(key)) return;
    dedupedProviderMap.set(key, provider);
  });
  const contacts = [];
  if (inquiryContactId || inquiryPrimaryContact?.email || inquiryPrimaryContact?.sms_number) {
    contacts.push({
      id: inquiryContactId || inquiryPrimaryContact?.id || inquiryPrimaryContact?.ID || "",
      first_name: inquiryPrimaryContact?.first_name || inquiryPrimaryContact?.First_Name || "",
      last_name: inquiryPrimaryContact?.last_name || inquiryPrimaryContact?.Last_Name || "",
      email: inquiryPrimaryContact?.email || inquiryPrimaryContact?.Email || "",
      sms_number: inquiryPrimaryContact?.sms_number || inquiryPrimaryContact?.SMS_Number || "",
    });
  }
  const companies = [];
  if (inquiryCompanyId || inquiryCompany?.name || inquiryCompany?.Name) {
    companies.push({
      id: inquiryCompanyId || inquiryCompany?.id || inquiryCompany?.ID || "",
      name: inquiryCompany?.name || inquiryCompany?.Name || "",
      account_type: inquiryCompany?.account_type || inquiryCompany?.Account_Type || "",
      Primary_Person: {
        id: inquiryCompanyPrimaryPerson?.id || inquiryCompanyPrimaryPerson?.ID || "",
        first_name:
          inquiryCompanyPrimaryPerson?.first_name || inquiryCompanyPrimaryPerson?.First_Name || "",
        last_name:
          inquiryCompanyPrimaryPerson?.last_name || inquiryCompanyPrimaryPerson?.Last_Name || "",
        email: inquiryCompanyPrimaryPerson?.email || inquiryCompanyPrimaryPerson?.Email || "",
        sms_number:
          inquiryCompanyPrimaryPerson?.sms_number || inquiryCompanyPrimaryPerson?.SMS_Number || "",
      },
    });
  }
  return {
    contacts,
    companies,
    properties: workspacePropertiesSorted,
    serviceProviders: Array.from(dedupedProviderMap.values()),
  };
}
