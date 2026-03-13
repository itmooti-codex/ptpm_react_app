import {
  extractFirstRecord,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/details-workspace/exports/api.js";
import { toPromiseLike } from "@modules/details-workspace/exports/api.js";
import { toText } from "@shared/utils/formatters.js";
import { normalizeServiceInquiryId } from "../shared/inquiryDetailsFormatting.js";

export function normalizeMutationIdentifier(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function extractCreatedDealId(result) {
  const managed = result?.mutations?.PeterpmDeal?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }

  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }

  return "";
}

export function buildInquiryLiteBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmDeal")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "account_type",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "how_can_we_help",
      "other",
      "admin_notes",
      "client_notes",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "service_inquiry_id",
      "service_provider_id",
      "Inquiry_Taken_By_id",
      "company_id",
      "primary_contact_id",
      "property_id",
      "quote_record_id",
      "Quote_Record_ID",
      "Quote_record_ID",
      "inquiry_for_job_id",
      "Inquiry_For_Job_ID",
      "Inquiry_for_Job_ID",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "renovations",
      "resident_availability",
      "date_job_required_by",
      "CompanyID",
      "CompanyName",
      "CompanyType",
      "CompanyPhone",
      "CompanyAddress",
      "CompanyCity",
      "CompanyState",
      "Company_Postal_Code",
      "Contact_Contact_ID",
      "Contact_First_Name",
      "Contact_Last_Name",
      "ContactEmail",
      "Contact_SMS_Number",
      "Company_Account_Type",
      "CompanyID1",
      "CompanyName1",
      "CompanyType1",
      "CompanyPhone1",
      "CompanyAddress1",
      "CompanyCity1",
      "CompanyState1",
      "Company_Postal_Code1",
    ])
    .include("Primary_Contact", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "address",
          "city",
          "state",
          "zip_code",
        ])
    )
    .include("Company", (sq) =>
      sq
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
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number"])
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
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "address_1",
          "address_2",
          "suburb_town",
          "city",
          "state",
          "postal_code",
          "country",
        ])
    )
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "work_email", "mobile_number"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name"])
        )
    );
}

export async function createInquiryRecordFromPayload({ plugin, payload = null } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.mutation) {
    throw new Error("Deal model is unavailable.");
  }

  const mutation = await dealModel.mutation();
  mutation.createOne(payload || {});
  const result = await toPromiseLike(mutation.execute(true));
  if (!result || result?.isCancelling) {
    throw new Error("Inquiry create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create inquiry."
    );
  }

  const createdId = extractCreatedDealId(result);
  if (!isPersistedId(createdId)) {
    throw new Error("Inquiry create did not return an ID.");
  }

  const query = buildInquiryLiteBaseQuery(plugin)
    .where("id", normalizeMutationIdentifier(createdId))
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();

  const detailResult = await toPromiseLike(query.fetchDirect());
  const createdRecord = extractFirstRecord(detailResult);
  const createdUid = toText(createdRecord?.unique_id || createdRecord?.Unique_ID);
  if (!createdUid) {
    throw new Error("Inquiry was created but unique ID was not returned.");
  }

  return {
    id: toText(createdRecord?.id || createdRecord?.ID || createdId),
    unique_id: createdUid,
    raw: createdRecord || null,
  };
}

export async function fetchInquiryLiteByUid({ plugin, uid }) {
  const uniqueId = toText(uid);
  if (!plugin?.switchTo || !uniqueId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("unique_id", uniqueId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export async function fetchInquiryLiteById({ plugin, id }) {
  const inquiryId = toText(id);
  if (!plugin?.switchTo || !inquiryId) return null;
  const query = buildInquiryLiteBaseQuery(plugin)
    .where("id", inquiryId)
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export async function fetchServiceNameById({ plugin, serviceId }) {
  const normalizedId = normalizeServiceInquiryId(serviceId);
  if (!plugin?.switchTo || !normalizedId) return "";
  const query = plugin
    .switchTo("PeterpmService")
    .query()
    .where("id", /^\d+$/.test(normalizedId) ? Number.parseInt(normalizedId, 10) : normalizedId)
    .deSelectAll()
    .select(["id", "service_name"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.service_name || record?.Service_Name);
}
