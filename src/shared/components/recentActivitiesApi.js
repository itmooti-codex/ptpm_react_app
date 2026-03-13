import { toText } from "@shared/utils/formatters.js";
import {
  normalizeId,
  toPromiseLike,
  extractFirstRecord,
  extractStatusFailure,
  normalizeRecords,
  parseServerRecentActivityRecords,
  resolvePageType,
  resolvePageName,
  normalizeActivityRecord,
} from "./recentActivitiesUtils.js";
import { ANNOUNCEMENT_ACTIVITY_ACTIONS } from "./recentActivitiesConstants.js";

export function mapAnnouncementEventToActivityRecord(detail = {}, fallbackPath = "") {
  const eventKey = toText(detail?.eventKey);
  if (!eventKey) return null;
  const action = toText(detail?.action || ANNOUNCEMENT_ACTIVITY_ACTIONS[eventKey]);
  if (!action) return null;
  const resolvedPath = toText(detail?.path || fallbackPath);
  const pageType = resolvePageType(resolvedPath);
  const inquiryId = toText(detail?.inquiryId || detail?.inquiry_id);
  const inquiryUid = toText(detail?.inquiryUid || detail?.inquiry_uid);
  const metadata = {
    announcement_id: toText(detail?.announcementId),
    event_key: eventKey,
    quote_job_id: toText(detail?.quoteJobId || detail?.quote_job_id),
    focus_kind: toText(detail?.focusKind || detail?.focus_kind),
    focus_id: toText(detail?.focusId || detail?.focus_id),
    tab: toText(detail?.tab),
  };
  if (inquiryId) metadata.inquiry_id = inquiryId;
  if (inquiryUid) metadata.inquiry_uid = inquiryUid;
  const timestamp = Number(detail?.timestamp);
  const normalizedTimestamp = Number.isFinite(timestamp) ? timestamp : Date.now();
  return normalizeActivityRecord({
    id: `announcement-${eventKey}-${normalizedTimestamp}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: normalizedTimestamp,
    action,
    page_type: pageType,
    page_name: resolvePageName(pageType),
    path: resolvedPath,
    inquiry_id: inquiryId,
    inquiry_uid: inquiryUid,
    metadata,
  });
}

export async function fetchServiceProviderRecentActivityRecordsFromServer({
  plugin,
  serviceProviderId,
} = {}) {
  const normalizedProviderId = toText(serviceProviderId);
  if (!plugin?.switchTo || !normalizedProviderId) return [];
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.query) return [];

  const providerLookupId = /^\d+$/.test(normalizedProviderId)
    ? Number.parseInt(normalizedProviderId, 10)
    : normalizedProviderId;
  const query = providerModel.query().fromGraphql(`
    query calcServiceProviders($id: PeterpmServiceProviderID!) {
      calcServiceProviders(query: [{ where: { id: $id } }]) {
        Recent_Activity_Json_Data: field(arg: ["Recent_Activity_Json_Data"])
      }
    }
  `);
  const result = await toPromiseLike(
    query.fetchDirect({
      variables: {
        id: providerLookupId,
      },
    })
  );
  const record = extractFirstRecord(result);
  const rawPayload = toText(record?.Recent_Activity_Json_Data || record?._data?.Recent_Activity_Json_Data);
  return parseServerRecentActivityRecords(rawPayload);
}

export async function updateServiceProviderRecentActivityJsonData({
  plugin,
  serviceProviderId,
  jsonPayload,
} = {}) {
  const providerId = toText(serviceProviderId);
  if (!plugin?.switchTo || !providerId) {
    throw new Error("Service provider context is not ready.");
  }
  const normalizedPayload = toText(jsonPayload);
  if (!normalizedPayload) {
    throw new Error("Recent activities JSON payload is missing.");
  }
  const model = plugin.switchTo("PeterpmServiceProvider");
  if (!model?.mutation) {
    throw new Error("Service provider model is unavailable.");
  }
  const normalizedProviderLookupId = /^\d+$/.test(providerId)
    ? Number.parseInt(providerId, 10)
    : providerId;
  const whereCandidates = [
    ["id", normalizedProviderLookupId],
    ["id", providerId],
    ["unique_id", providerId],
    ["unique_id", normalizedProviderLookupId],
  ];
  const wherePairs = [];
  const seenWherePairs = new Set();
  for (const [whereField, whereValue] of whereCandidates) {
    const normalizedWhereValue = toText(whereValue);
    if (!normalizedWhereValue) continue;
    const key = `${whereField}:${normalizedWhereValue}`;
    if (seenWherePairs.has(key)) continue;
    seenWherePairs.add(key);
    wherePairs.push([whereField, whereValue]);
  }
  const payloadFields = [
    "recent_activity_json_data",
    "Recent_Activity_Json_Data",
    "recent_activity",
    "Recent_Activity",
  ];
  const normalizePayloadForCompare = (value) => {
    const text = toText(value);
    if (!text) return "";
    try {
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
    }
  };
  const expectedPayloadNormalized = normalizePayloadForCompare(normalizedPayload);
  const wasPayloadPersisted = async (whereField, whereValue, payloadField) => {
    if (!model?.query) return false;
    try {
      const query = model
        .query()
        .where(whereField, whereValue)
        .deSelectAll()
        .select(["id", "unique_id", payloadField])
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const result = await toPromiseLike(query.fetchDirect());
      const record = extractFirstRecord(result);
      if (!record) return false;
      const persistedPayload = normalizePayloadForCompare(
        record?.[payloadField] ?? record?._data?.[payloadField]
      );
      return persistedPayload === expectedPayloadNormalized;
    } catch {
      return false;
    }
  };

  const executeUpdate = async (whereField, whereValue, payloadField) => {
    const mutation = await model.mutation();
    mutation.update((query) =>
      query.where(whereField, whereValue).set({
        [payloadField]: normalizedPayload,
      })
    );
    const result = await toPromiseLike(mutation.execute(true));
    if (!result || result?.isCancelling) {
      throw new Error("Recent activities update was cancelled.");
    }
    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        failure.statusMessage || `Recent activities update failed with status ${failure.statusCode}.`
      );
    }
    return true;
  };
  let lastError = null;
  for (const [whereField, whereValue] of wherePairs) {
    for (const payloadField of payloadFields) {
      try {
        await executeUpdate(whereField, whereValue, payloadField);
        const didPersist = await wasPayloadPersisted(whereField, whereValue, payloadField);
        if (didPersist) {
          return true;
        }
        lastError = new Error(
          `Recent activity payload was not persisted for ${whereField} (${toText(whereValue)}) using ${payloadField}.`
        );
      } catch (updateError) {
        lastError = updateError;
      }
    }
  }
  if (lastError) throw lastError;
  return false;
}

export async function resolveServiceProviderIdByContact({ plugin, contactId }) {
  const normalizedContactId = normalizeId(contactId);
  if (!plugin?.switchTo || !normalizedContactId) return "";
  const providerModel = plugin.switchTo("PeterpmServiceProvider");
  if (!providerModel?.query) return "";

  const runQuery = async (restrictToAdminType = false) => {
    let query = providerModel
      .query()
      .where("contact_information_id", normalizedContactId)
      .deSelectAll()
      .select(["id", "unique_id", "contact_information_id", "type", "status"])
      .limit(1)
      .noDestroy();
    if (restrictToAdminType) {
      query = query.andWhere("type", "Admin");
    }
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const record = extractFirstRecord(result);
    return toText(record?.id || record?.ID);
  };

  const adminRecordId = await runQuery(true);
  if (adminRecordId) return adminRecordId;

  const anyRecordId = await runQuery(false);
  if (anyRecordId) return anyRecordId;
  return "";
}

export async function resolveAdminServiceProviderId({
  plugin,
  configuredProviderId = "",
  currentUserContactId = "",
} = {}) {
  const configuredId = toText(configuredProviderId);
  if (configuredId) {
    return configuredId;
  }

  const contactResolvedId = await resolveServiceProviderIdByContact({
    plugin,
    contactId: currentUserContactId,
  });
  if (contactResolvedId) return contactResolvedId;

  return "";
}
