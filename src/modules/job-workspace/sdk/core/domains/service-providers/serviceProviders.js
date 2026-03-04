import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, subscribeToQueryStream } from "../../transport.js";
import { extractRecords } from "../../../utils/sdkResponseUtils.js";

function normalizeServiceProviderRecord(rawProvider = {}) {
  const firstName = String(
    rawProvider?.contact_information_first_name ||
      rawProvider?.Contact_Information_First_Name ||
      rawProvider?.Contact_Information?.first_name ||
      rawProvider?.Contact_Information?.First_Name ||
      ""
  ).trim();
  const lastName = String(
    rawProvider?.contact_information_last_name ||
      rawProvider?.Contact_Information_Last_Name ||
      rawProvider?.Contact_Information?.last_name ||
      rawProvider?.Contact_Information?.Last_Name ||
      ""
  ).trim();

  return {
    id: String(rawProvider?.id || rawProvider?.ID || "").trim(),
    unique_id: String(rawProvider?.unique_id || rawProvider?.Unique_ID || "").trim(),
    type: String(rawProvider?.type || rawProvider?.Type || "").trim(),
    status: String(rawProvider?.status || rawProvider?.Status || "").trim(),
    first_name: firstName,
    last_name: lastName,
    email: String(
      rawProvider?.contact_information_email ||
        rawProvider?.Contact_Information_Email ||
        rawProvider?.Contact_Information?.email ||
        rawProvider?.Contact_Information?.Email ||
        ""
    ).trim(),
    sms_number: String(
      rawProvider?.contact_information_sms_number ||
        rawProvider?.Contact_Information_SMS_Number ||
        rawProvider?.Contact_Information?.sms_number ||
        rawProvider?.Contact_Information?.SMS_Number ||
        ""
    ).trim(),
    profile_image: String(
      rawProvider?.contact_information_profile_image ||
        rawProvider?.Contact_Information_Profile_Image ||
        rawProvider?.Contact_Information?.profile_image ||
        rawProvider?.Contact_Information?.Profile_Image ||
        ""
    ).trim(),
  };
}

function isActiveServiceProvider(record = {}) {
  const type = String(record?.type || "").trim().toLowerCase();
  const status = String(record?.status || "").trim().toLowerCase();
  return type === "service provider" && status === "active";
}

export async function fetchServiceProvidersForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = "PeterpmServiceProvider";

  try {
    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(`
        query calcServiceProviders {
          calcServiceProviders(
            query: [
              { where: { type: "Service Provider" } }
              { andWhere: { status: "Active" } }
            ]
          ) {
            ID: field(arg: ["id"])
            Unique_ID: field(arg: ["unique_id"])
            Type: field(arg: ["type"])
            Status: field(arg: ["status"])
            Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
            Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
            Contact_Information_Email: field(arg: ["Contact_Information", "email"])
            Contact_Information_SMS_Number: field(arg: ["Contact_Information", "sms_number"])
            Contact_Information_Profile_Image: field(arg: ["Contact_Information", "profile_image"])
          }
        }
      `);
    const response = await fetchDirectWithTimeout(customQuery);
    const records = extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) => isActiveServiceProvider(record));
    if (records.length) return records;
  } catch (error) {
    console.warn("[JobDirect] Custom service provider query failed, using include fallback", error);
  }

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("type", "Service Provider")
      .andWhere("status", "Active")
      .deSelectAll()
      .select(["id", "unique_id", "type", "status"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery
          .deSelectAll()
          .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
      )
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) => isActiveServiceProvider(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch service providers", error);
    return [];
  }
}

export function subscribeServiceProvidersForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const modelName = "PeterpmServiceProvider";
  const query = resolvedPlugin
    .switchTo(modelName)
    .query()
    .where("type", "Service Provider")
    .andWhere("status", "Active")
    .deSelectAll()
    .select(["id", "unique_id", "type", "status"])
    .include("Contact_Information", (contactQuery) =>
      contactQuery
        .deSelectAll()
        .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
    )
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload)
        .map((record) => normalizeServiceProviderRecord(record))
        .filter((record) => record.id)
        .filter((record) => isActiveServiceProvider(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Service provider subscription failed", error);
      onError?.(error);
    },
  });
}
