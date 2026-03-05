import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import { extractRecords } from "../../../utils/sdkResponseUtils.js";

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeServiceProviderRecord(rawProvider = {}) {
  const firstName = normalizeText(
    rawProvider?.contact_information_first_name ||
      rawProvider?.Contact_Information_First_Name ||
      rawProvider?.Contact_Information?.first_name ||
      rawProvider?.Contact_Information?.First_Name ||
      ""
  );
  const lastName = normalizeText(
    rawProvider?.contact_information_last_name ||
      rawProvider?.Contact_Information_Last_Name ||
      rawProvider?.Contact_Information?.last_name ||
      rawProvider?.Contact_Information?.Last_Name ||
      ""
  );
  const workEmail = normalizeText(rawProvider?.work_email || rawProvider?.Work_Email || "");
  const mobileNumber = normalizeText(rawProvider?.mobile_number || rawProvider?.Mobile_Number || "");

  return {
    id: normalizeText(rawProvider?.id || rawProvider?.ID || ""),
    unique_id: normalizeText(rawProvider?.unique_id || rawProvider?.Unique_ID || ""),
    type: normalizeText(rawProvider?.type || rawProvider?.Type || ""),
    status: normalizeText(rawProvider?.status || rawProvider?.Status || ""),
    first_name: firstName,
    last_name: lastName,
    work_email: workEmail,
    mobile_number: mobileNumber,
    email: workEmail,
    sms_number: mobileNumber,
    profile_image: normalizeText(
      rawProvider?.contact_information_profile_image ||
        rawProvider?.Contact_Information_Profile_Image ||
        rawProvider?.Contact_Information?.profile_image ||
        rawProvider?.Contact_Information?.Profile_Image ||
        ""
    ),
  };
}

function matchesServiceProviderFilters(
  record = {},
  { providerType = "Service Provider", status = "Active" } = {}
) {
  const recordType = normalizeText(record?.type).toLowerCase();
  const recordStatus = normalizeText(record?.status).toLowerCase();
  const expectedType = normalizeText(providerType).toLowerCase();
  const expectedStatus = normalizeText(status).toLowerCase();
  if (expectedType && recordType !== expectedType) return false;
  if (expectedStatus && recordStatus !== expectedStatus) return false;
  return true;
}

function buildServiceProvidersGraphql({ providerType, status }) {
  const typeLiteral = JSON.stringify(normalizeText(providerType || "Service Provider"));
  const statusValue = normalizeText(status);
  const statusFilter = statusValue
    ? `\n              { andWhere: { status: ${JSON.stringify(statusValue)} } }`
    : "";
  return `
        query calcServiceProviders {
          calcServiceProviders(
            query: [
              { where: { type: ${typeLiteral} } }${statusFilter}
            ]
          ) {
            ID: field(arg: ["id"])
            Unique_ID: field(arg: ["unique_id"])
            Type: field(arg: ["type"])
            Status: field(arg: ["status"])
            Work_Email: field(arg: ["work_email"])
            Mobile_Number: field(arg: ["mobile_number"])
            Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
            Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
            Contact_Information_Email: field(arg: ["Contact_Information", "email"])
            Contact_Information_SMS_Number: field(arg: ["Contact_Information", "sms_number"])
            Contact_Information_Profile_Image: field(arg: ["Contact_Information", "profile_image"])
          }
        }
      `;
}

export async function fetchServiceProvidersForSearch({
  plugin,
  providerType = "Service Provider",
  status = "Active",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = "PeterpmServiceProvider";
  const typeValue = normalizeText(providerType || "Service Provider");
  const statusValue = normalizeText(status);

  try {
    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(buildServiceProvidersGraphql({ providerType: typeValue, status: statusValue }));
    const response = await fetchDirectWithTimeout(customQuery);
    const records = extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) =>
        matchesServiceProviderFilters(record, { providerType: typeValue, status: statusValue })
      );
    if (records.length) return records;
  } catch (error) {
    console.warn("[JobDirect] Custom service provider query failed, using include fallback", error);
  }

  try {
    let query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("type", typeValue)
      .deSelectAll()
      .select(["id", "unique_id", "type", "status", "work_email", "mobile_number"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery
          .deSelectAll()
          .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
      )
      .noDestroy();
    if (statusValue) {
      query = query.andWhere("status", statusValue);
    }

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) =>
        matchesServiceProviderFilters(record, { providerType: typeValue, status: statusValue })
      );
  } catch (error) {
    console.error("[JobDirect] Failed to fetch service providers", error);
    return [];
  }
}

export function subscribeServiceProvidersForSearch({
  plugin,
  onChange,
  onError,
  providerType = "Service Provider",
  status = "Active",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const modelName = "PeterpmServiceProvider";
  const typeValue = normalizeText(providerType || "Service Provider");
  const statusValue = normalizeText(status);
  let query = resolvedPlugin
    .switchTo(modelName)
    .query()
    .where("type", typeValue)
    .deSelectAll()
    .select(["id", "unique_id", "type", "status", "work_email", "mobile_number"])
    .include("Contact_Information", (contactQuery) =>
      contactQuery
        .deSelectAll()
        .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
    )
    .noDestroy();
  if (statusValue) {
    query = query.andWhere("status", statusValue);
  }

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload)
        .map((record) => normalizeServiceProviderRecord(record))
        .filter((record) => record.id)
        .filter((record) =>
          matchesServiceProviderFilters(record, { providerType: typeValue, status: statusValue })
        );
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Service provider subscription failed", error);
      onError?.(error);
    },
  });
}
