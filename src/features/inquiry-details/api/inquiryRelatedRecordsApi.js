import { extractFirstRecord } from "@modules/details-workspace/exports/api.js";
import {
  toPromiseLike,
  fetchLinkedDealsByAccount,
  fetchLinkedJobsByAccount,
} from "@modules/details-workspace/exports/api.js";
import { toText } from "@shared/utils/formatters.js";
import { normalizeRelationRecord } from "../shared/inquiryDetailsRecordHelpers.js";
import { normalizeServiceInquiryId } from "../shared/inquiryDetailsFormatting.js";
import { normalizeMutationIdentifier } from "./inquiryCoreApi.js";

export function getRelatedJobRecordKey(record = {}, index = 0) {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  if (uid) return `uid:${uid}`;
  const id = toText(record?.id || record?.ID);
  if (id) return `id:${id}`;
  return `job:${index}`;
}

function getRelatedRecordIdentity(record = {}, index = 0, fallbackPrefix = "record") {
  const uid = toText(record?.unique_id || record?.Unique_ID);
  const id = toText(record?.id || record?.ID);
  return {
    uid,
    id,
    fallbackKey: `${fallbackPrefix}:${index}`,
  };
}

export function mergeRelatedRecordCollections(baseRecords = [], contextualRecords = [], getKey) {
  const list = Array.isArray(baseRecords) ? baseRecords : [];
  const contextual = Array.isArray(contextualRecords) ? contextualRecords : [];
  const merged = [];
  const indexByKey = new Map();

  [...list, ...contextual].forEach((record, index) => {
    if (!record || typeof record !== "object") return;
    const { uid, id, fallbackKey } = getRelatedRecordIdentity(
      record,
      index,
      typeof getKey === "function" ? getKey(record, index).split(":")[0] : "record"
    );
    const candidateKeys = [uid ? `uid:${uid}` : "", id ? `id:${id}` : ""].filter(Boolean);
    const existingIndex = candidateKeys.reduce((foundIndex, key) => {
      if (foundIndex != null) return foundIndex;
      return indexByKey.has(key) ? indexByKey.get(key) : null;
    }, null);

    if (existingIndex == null && !candidateKeys.length) {
      merged.push(record);
      return;
    }

    if (existingIndex == null) {
      candidateKeys.forEach((key) => indexByKey.set(key, merged.length));
      if (!candidateKeys.length) {
        indexByKey.set(fallbackKey, merged.length);
      }
      merged.push(record);
      return;
    }

    merged[existingIndex] = {
      ...merged[existingIndex],
      ...record,
    };

    const mergedRecord = merged[existingIndex];
    const mergedUid = toText(mergedRecord?.unique_id || mergedRecord?.Unique_ID);
    const mergedId = toText(mergedRecord?.id || mergedRecord?.ID);
    if (mergedUid) indexByKey.set(`uid:${mergedUid}`, existingIndex);
    if (mergedId) indexByKey.set(`id:${mergedId}`, existingIndex);
  });

  return merged;
}

function extractRecordsFromPayload(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value)) return value;
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value)) return value;
    }
  }
  return [];
}

function toSortableTimestamp(value) {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return numeric;
  const parsed = Date.parse(toText(value));
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeQuickDealRowsFromCalc(records = []) {
  const rows = [];
  const sourceRows = Array.isArray(records) ? records : [];

  sourceRows.forEach((record) => {
    const idValues = record?.DealsID;
    const uidValues = record?.Deals_Unique_ID;
    const nameValues = record?.Deals_Deal_Name;
    const typeValues = record?.DealsType;
    const createdValues = record?.Deals_Created_At;
    const serviceIdValues = record?.Service_Inquiry_ID;
    const serviceNameValues = record?.Service_Service_Name;

    const maxLength = Math.max(
      Array.isArray(idValues) ? idValues.length : 0,
      Array.isArray(uidValues) ? uidValues.length : 0,
      Array.isArray(nameValues) ? nameValues.length : 0,
      Array.isArray(typeValues) ? typeValues.length : 0,
      Array.isArray(createdValues) ? createdValues.length : 0,
      Array.isArray(serviceIdValues) ? serviceIdValues.length : 0,
      Array.isArray(serviceNameValues) ? serviceNameValues.length : 0,
      1
    );

    for (let index = 0; index < maxLength; index += 1) {
      const pick = (value) => (Array.isArray(value) ? value[index] : value);
      rows.push({
        id: toText(pick(idValues)),
        unique_id: toText(pick(uidValues)),
        deal_name: toText(pick(nameValues)),
        type: toText(pick(typeValues)),
        created_at: pick(createdValues) ?? null,
        service_inquiry_id: normalizeServiceInquiryId(pick(serviceIdValues)),
        service_name: toText(pick(serviceNameValues)),
      });
    }
  });

  const dedupedByKey = new Map();
  rows.forEach((row) => {
    const key = toText(row?.id || row?.unique_id || row?.deal_name);
    if (!key) return;
    if (!dedupedByKey.has(key)) {
      dedupedByKey.set(key, row);
      return;
    }
    const existing = dedupedByKey.get(key) || {};
    dedupedByKey.set(key, {
      ...existing,
      ...row,
      id: toText(existing?.id || row?.id),
      unique_id: toText(existing?.unique_id || row?.unique_id),
      deal_name: toText(existing?.deal_name || row?.deal_name),
      type: toText(existing?.type || row?.type),
      created_at: existing?.created_at || row?.created_at || null,
      service_inquiry_id: toText(existing?.service_inquiry_id || row?.service_inquiry_id),
      service_name: toText(existing?.service_name || row?.service_name),
    });
  });

  return Array.from(dedupedByKey.values()).sort(
    (left, right) => toSortableTimestamp(right?.created_at) - toSortableTimestamp(left?.created_at)
  );
}

export async function fetchQuickRelatedInquiriesByAccount({
  plugin,
  accountType = "Contact",
  accountId = "",
} = {}) {
  const normalizedAccountId = toText(accountId);
  if (!plugin?.switchTo || !normalizedAccountId) return [];

  const normalizedType = String(accountType || "").trim().toLowerCase();
  const isCompanyAccount = normalizedType === "company" || normalizedType === "entity";
  const modelName = isCompanyAccount ? "PeterpmCompany" : "PeterpmContact";
  const operationName = isCompanyAccount ? "calcCompanies" : "calcContacts";
  const variableType = isCompanyAccount ? "PeterpmCompanyID!" : "PeterpmContactID!";
  const richQuery = `
    query ${operationName}($id: ${variableType}) {
      ${operationName}(query: [{ where: { id: $id } }]) {
        DealsID: field(arg: ["Deals", "id"])
        Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
        Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
        DealsType: field(arg: ["Deals", "type"])
        Deals_Created_At: field(arg: ["Deals", "created_at"])
        Service_Inquiry_ID: field(arg: ["Deals", "service_inquiry_id"])
        Service_Service_Name: field(arg: ["Deals", "Service_Inquiry", "service_name"])
      }
    }
  `;

  try {
    const query = plugin.switchTo(modelName).query().fromGraphql(richQuery);
    const response = await toPromiseLike(
      query.fetchDirect({
        variables: { id: normalizeMutationIdentifier(normalizedAccountId) },
      })
    );
    const normalizedRows = normalizeQuickDealRowsFromCalc(extractRecordsFromPayload(response));
    if (normalizedRows.length) {
      return normalizedRows;
    }
  } catch (queryError) {
    console.warn("[QuickInquiry] Rich related inquiry query failed. Falling back.", queryError);
  }

  const fallbackRows = await fetchLinkedDealsByAccount({
    plugin,
    accountType,
    accountId: normalizedAccountId,
  }).catch(() => []);
  return (Array.isArray(fallbackRows) ? fallbackRows : [])
    .map((row) => ({
      id: toText(row?.id || row?.ID),
      unique_id: toText(row?.unique_id || row?.Unique_ID),
      deal_name: toText(row?.deal_name || row?.Deal_Name),
      created_at: row?.created_at || row?.Created_At || row?.Date_Added || null,
      type: toText(row?.type || row?.Type),
      service_inquiry_id: normalizeServiceInquiryId(
        row?.service_inquiry_id || row?.Service_Inquiry_ID
      ),
      service_name: toText(row?.service_name || row?.Service_Service_Name),
    }))
    .sort(
      (left, right) => toSortableTimestamp(right?.created_at) - toSortableTimestamp(left?.created_at)
    );
}

export async function fetchQuickRelatedJobsByAccount({
  plugin,
  accountType = "Contact",
  accountId = "",
} = {}) {
  const normalizedAccountId = toText(accountId);
  if (!plugin?.switchTo || !normalizedAccountId) return [];
  const rows = await fetchLinkedJobsByAccount({
    plugin,
    accountType,
    accountId: normalizedAccountId,
  }).catch(() => []);
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      id: toText(row?.id || row?.ID),
      unique_id: toText(row?.unique_id || row?.Unique_ID),
      property_name: toText(
        row?.property_name || row?.Property_Name || row?.property || row?.Property
      ),
      created_at: row?.created_at || row?.Created_At || null,
    }))
    .sort((left, right) => Number(right?.created_at || 0) - Number(left?.created_at || 0));
}

export async function fetchJobIdByUniqueId({ plugin, uniqueId }) {
  const normalizedUniqueId = toText(uniqueId);
  if (!plugin?.switchTo || !normalizedUniqueId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("unique_id", normalizedUniqueId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.id || record?.ID);
}

export async function fetchJobUniqueIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "unique_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.unique_id || record?.Unique_ID);
}

export async function fetchJobInquiryRecordIdById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "inquiry_record_id"])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  return toText(record?.inquiry_record_id || record?.Inquiry_Record_ID);
}

export async function fetchRelatedJobSummaryById({ plugin, jobId }) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return null;
  const query = plugin
    .switchTo("PeterpmJob")
    .query()
    .where("id", /^\d+$/.test(normalizedJobId) ? Number.parseInt(normalizedJobId, 10) : normalizedJobId)
    .deSelectAll()
    .select(["id", "unique_id", "job_status", "quote_status"])
    .include("Property", (propertyQuery) =>
      propertyQuery.deSelectAll().select(["id", "property_name"])
    )
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  const propertyRecord = normalizeRelationRecord(record?.Property || record?.property);
  if (!record) return null;
  return {
    id: toText(record?.id || record?.ID),
    unique_id: toText(record?.unique_id || record?.Unique_ID),
    job_status: toText(record?.job_status || record?.Job_Status),
    quote_status: toText(record?.quote_status || record?.Quote_Status),
    property_name: toText(
      record?.property_name ||
        record?.Property_Name ||
        propertyRecord?.property_name ||
        propertyRecord?.Property_Name
    ),
  };
}
