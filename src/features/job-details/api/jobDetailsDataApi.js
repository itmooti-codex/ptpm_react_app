import {
  extractFirstRecord,
  normalizePropertyLookupRecord,
  toPromiseLike,
} from "@modules/details-workspace/exports/api.js";
import { toText } from "@shared/utils/formatters.js";
import { JOB_TAKEN_BY_FIELD_ALIASES } from "../shared/jobDetailsConstants.js";

function normalizeJobWhereValue(field, value) {
  const normalizedValue = toText(value);
  if (!normalizedValue) return "";
  if (field === "id" && /^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }
  return normalizedValue;
}

export async function fetchSingleJobRecord({ jobModel, field, value, selectFields = [] } = {}) {
  const whereValue = normalizeJobWhereValue(field, value);
  if (!jobModel?.query || whereValue === "" || whereValue == null) return null;
  const uniqueSelectFields = Array.from(
    new Set(
      ["id", ...(Array.isArray(selectFields) ? selectFields : [])]
        .map((item) => toText(item))
        .filter(Boolean)
    )
  );
  const query = jobModel
    .query()
    .where(field, whereValue)
    .deSelectAll()
    .select(uniqueSelectFields)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export async function fetchDetailedJobRecord({ plugin, field = "id", value } = {}) {
  const normalizedValue = normalizeJobWhereValue(field, value);
  if (!plugin?.switchTo || normalizedValue === "" || normalizedValue == null) return null;
  const jobModel = plugin.switchTo("PeterpmJob");
  if (!jobModel?.query) return null;

  const query = jobModel
    .query()
    .where(field, normalizedValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "account_type",
      "client_entity_id",
      "client_individual_id",
      "property_id",
      "inquiry_record_id",
    ])
    .include("Inquiry_Record", (inquiryQuery) =>
      inquiryQuery.deSelectAll().select(["id", "unique_id", "deal_name"])
    )
    .include("Client_Individual", (contactQuery) =>
      contactQuery.deSelectAll().select([
        "id",
        "first_name",
        "last_name",
        "email",
        "sms_number",
        "address",
        "city",
        "state",
        "zip_code",
        "xero_contact_id",
      ])
    )
    .include("Client_Entity", (companyQuery) =>
      companyQuery
        .deSelectAll()
        .select([
          "id",
          "name",
          "type",
          "description",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
          "industry",
          "annual_revenue",
          "number_of_employees",
          "account_type",
          "popup_comment",
          "xero_contact_id",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
            .deSelectAll()
            .select([
              "id",
              "name",
              "type",
              "description",
              "phone",
              "address",
              "city",
              "state",
              "postal_code",
              "industry",
              "annual_revenue",
              "number_of_employees",
            ])
        )
    )
    .include("Property", (propertyQuery) =>
      propertyQuery
        .deSelectAll()
        .select([
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
    )
    .limit(1)
    .noDestroy();

  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export async function fetchPropertyRecordById({ plugin, propertyId } = {}) {
  const normalizedPropertyId = toText(propertyId);
  if (!plugin?.switchTo || !normalizedPropertyId) return null;
  const whereValue = /^\d+$/.test(normalizedPropertyId)
    ? Number.parseInt(normalizedPropertyId, 10)
    : normalizedPropertyId;
  const query = plugin
    .switchTo("PeterpmProperty")
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
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
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return normalizePropertyLookupRecord(extractFirstRecord(result) || {});
}

export async function fetchJobTakenByValue({ jobModel, jobId } = {}) {
  const normalizedJobId = toText(jobId);
  if (!jobModel?.query || !normalizedJobId) {
    return { value: "", field: "", resolved: false };
  }

  for (const fieldName of JOB_TAKEN_BY_FIELD_ALIASES) {
    try {
      const record = await fetchSingleJobRecord({
        jobModel,
        field: "id",
        value: normalizedJobId,
        selectFields: [fieldName],
      });
      if (!record || typeof record !== "object") continue;
      const value = toText(record?.[fieldName]);
      if (value) return { value, field: fieldName, resolved: true };
      if (Object.prototype.hasOwnProperty.call(record, fieldName)) {
        return { value: "", field: fieldName, resolved: true };
      }
    } catch (_) {
      // ignore unsupported alias and continue with fallback aliases
    }
  }

  return { value: "", field: "", resolved: false };
}

export async function fetchInquiryUidById({ plugin, inquiryId } = {}) {
  const normalizedInquiryId = toText(inquiryId);
  if (!plugin?.switchTo || !normalizedInquiryId) return "";
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) return "";

  const whereValue = /^\d+$/.test(normalizedInquiryId)
    ? Number.parseInt(normalizedInquiryId, 10)
    : normalizedInquiryId;

  const query = dealModel
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.unique_id || record?.Unique_ID);
}

export function normalizeInquiryCompanyRecord(inquiry = {}) {
  const nested = inquiry?.Company || inquiry?.company || {};
  const nestedPrimaryPerson = nested?.Primary_Person || nested?.primary_person || {};
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
      id: toText(nestedPrimaryPerson?.id || nestedPrimaryPerson?.ID || inquiry?.Contact_Contact_ID),
      first_name: toText(
        nestedPrimaryPerson?.first_name ||
          nestedPrimaryPerson?.First_Name ||
          inquiry?.Contact_First_Name
      ),
      last_name: toText(
        nestedPrimaryPerson?.last_name ||
          nestedPrimaryPerson?.Last_Name ||
          inquiry?.Contact_Last_Name
      ),
      email: toText(
        nestedPrimaryPerson?.email || nestedPrimaryPerson?.Email || inquiry?.ContactEmail
      ),
      sms_number: toText(
        nestedPrimaryPerson?.sms_number ||
          nestedPrimaryPerson?.SMS_Number ||
          inquiry?.Contact_SMS_Number
      ),
    },
    Body_Corporate_Company: nested?.Body_Corporate_Company || nested?.body_corporate_company || {
      id: toText(inquiry?.CompanyID1 || inquiry?.Company_ID1),
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

export async function fetchInquiryAccountContextById({ plugin, inquiryId } = {}) {
  const normalizedInquiryId = toText(inquiryId);
  if (!plugin?.switchTo || !normalizedInquiryId) return null;
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) return null;

  const whereValue = /^\d+$/.test(normalizedInquiryId)
    ? Number.parseInt(normalizedInquiryId, 10)
    : normalizedInquiryId;

  const query = dealModel
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "deal_name",
      "how_can_we_help",
      "renovations",
      "resident_availability",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "recommendations",
      "account_type",
      "Account_Type",
      "CompanyID",
      "CompanyName",
      "CompanyType",
      "CompanyDescription",
      "CompanyPhone",
      "CompanyAddress",
      "CompanyCity",
      "CompanyState",
      "Company_Postal_Code",
      "CompanyIndustry",
      "Company_Annual_Revenue",
      "Company_Number_Of_Employees",
      "Company_Account_Type",
      "Company_Popup_Comment",
      "Contact_Contact_ID",
      "Contact_First_Name",
      "Contact_Last_Name",
      "ContactEmail",
      "Contact_SMS_Number",
      "CompanyID1",
      "Company_ID1",
      "CompanyName1",
      "CompanyType1",
      "CompanyDescription1",
      "CompanyPhone1",
      "CompanyAddress1",
      "CompanyCity1",
      "CompanyState1",
      "Company_Postal_Code1",
      "CompanyIndustry1",
      "Company_Annual_Revenue1",
      "Company_Number_Of_Employees1",
    ])
    .include("Company", (companyQuery) =>
      companyQuery
        .deSelectAll()
        .select([
          "id",
          "name",
          "type",
          "description",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
          "industry",
          "annual_revenue",
          "number_of_employees",
          "account_type",
          "popup_comment",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
            .deSelectAll()
            .select([
              "id",
              "name",
              "type",
              "description",
              "phone",
              "address",
              "city",
              "state",
              "postal_code",
              "industry",
              "annual_revenue",
              "number_of_employees",
            ])
        )
    )
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}
