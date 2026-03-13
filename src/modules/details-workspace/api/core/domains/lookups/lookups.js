import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, isTimeoutError, subscribeToQueryStream } from "../../transport.js";
import { extractFirstRecord, extractRecords } from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import { PROPERTY_RECORD_SELECT_FIELDS } from "../properties/propertyHelpers.js";
import {
  CONTACT_LOOKUP_SELECT_FIELDS,
  CONTACT_DUPLICATE_LOOKUP_SELECT_FIELDS,
  COMPANY_LOOKUP_SELECT_FIELDS,
  normalizeSearchEmail,
  normalizeSearchName,
  applyCompanyLookupIncludes,
} from "./lookupsHelpers.js";

const LOOKUP_SEARCH_LIMIT = 50;

function resolveSearchLimit(limit, fallback = LOOKUP_SEARCH_LIMIT) {
  const numeric = Number(limit);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.max(1, Math.min(200, Math.floor(numeric)));
}

function toLikeValue(value) {
  return `%${String(value || "").trim()}%`;
}

export async function fetchContactsForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmContact")
      .query()
      .deSelectAll()
      .select(CONTACT_LOOKUP_SELECT_FIELDS)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, 30000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Contact search request timed out.");
    } else {
      console.error("[JobDirect] Failed to fetch contact search data", error);
    }
    return [];
  }
}

export async function searchContactsForLookup({ plugin, query = "", limit = LOOKUP_SEARCH_LIMIT } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedQuery = normalizeSearchName(query);
  if (!normalizedQuery) return [];

  try {
    const likeValue = toLikeValue(normalizedQuery);
    const queryModel = resolvedPlugin
      .switchTo("PeterpmContact")
      .query()
      .deSelectAll()
      .select(CONTACT_LOOKUP_SELECT_FIELDS)
      .andWhere((scope) => {
        scope
          .where("first_name", "like", likeValue)
          .orWhere("last_name", "like", likeValue)
          .orWhere("email", "like", likeValue)
          .orWhere("sms_number", "like", likeValue)
          .orWhere("office_phone", "like", likeValue)
          .orWhere("address", "like", likeValue);
      })
      .limit(resolveSearchLimit(limit))
      .noDestroy();
    queryModel.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(queryModel, null, 12000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Contact lookup search timed out.");
    } else {
      console.error("[JobDirect] Contact lookup search failed", error);
    }
    return [];
  }
}

export function subscribeContactsForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmContact")
    .query()
    .deSelectAll()
    .select(CONTACT_LOOKUP_SELECT_FIELDS)
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Contacts subscription failed", error);
      onError?.(error);
    },
  });
}

export async function findContactByEmail({ plugin, email } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;

  const rawEmail = String(email || "").trim();
  const targetEmail = normalizeSearchEmail(rawEmail);
  if (!targetEmail) return null;

  try {
    const directQuery = resolvedPlugin
      .switchTo("PeterpmContact")
      .query()
      .where("email", rawEmail)
      .deSelectAll()
      .select(CONTACT_DUPLICATE_LOOKUP_SELECT_FIELDS)
      .limit(1)
      .noDestroy();
    directQuery.getOrInitQueryCalc?.();
    const directResponse = await fetchDirectWithTimeout(directQuery, null, 10000);
    const directRecord = extractFirstRecord(directResponse);
    if (directRecord) return directRecord;
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.warn("[JobDirect] Direct email lookup failed; falling back to cached search", error);
    }
  }

  try {
    const contacts = await searchContactsForLookup({
      plugin: resolvedPlugin,
      query: targetEmail,
      limit: 80,
    });
    const match = (Array.isArray(contacts) ? contacts : []).find(
      (item) => normalizeSearchEmail(item?.email || item?.Email) === targetEmail
    );
    if (!match) return null;
    const matchedId = normalizeIdentifier(match?.id || match?.ID || match?.Contact_ID);
    if (!matchedId) return match;

    const detailQuery = resolvedPlugin
      .switchTo("PeterpmContact")
      .query()
      .where("id", matchedId)
      .deSelectAll()
      .select(CONTACT_DUPLICATE_LOOKUP_SELECT_FIELDS)
      .limit(1)
      .noDestroy();
    detailQuery.getOrInitQueryCalc?.();
    const detailResponse = await fetchDirectWithTimeout(detailQuery, null, 15000);
    return extractFirstRecord(detailResponse) || match;
  } catch (error) {
    console.error("[JobDirect] Contact duplicate lookup failed", error);
    return null;
  }
}

export async function fetchCompaniesForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmCompany")
      .query()
      .deSelectAll()
      .select(COMPANY_LOOKUP_SELECT_FIELDS);

    applyCompanyLookupIncludes(query);
    query.noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, 30000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Company search request timed out.");
    } else {
      console.error("[JobDirect] Failed to fetch company search data", error);
    }
    return [];
  }
}

export async function searchCompaniesForLookup({
  plugin,
  query = "",
  limit = LOOKUP_SEARCH_LIMIT,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedQuery = normalizeSearchName(query);
  if (!normalizedQuery) return [];

  try {
    const likeValue = toLikeValue(normalizedQuery);
    const queryModel = resolvedPlugin
      .switchTo("PeterpmCompany")
      .query()
      .deSelectAll()
      .select(COMPANY_LOOKUP_SELECT_FIELDS)
      .andWhere((scope) => {
        scope
          .where("name", "like", likeValue)
          .orWhere("account_type", "like", likeValue)
          .orWhere("address", "like", likeValue)
          .orWhere("phone", "like", likeValue)
          .orWhere("Primary_Person", (personScope) => {
            personScope
              .where("first_name", "like", likeValue)
              .orWhere("last_name", "like", likeValue)
              .orWhere("email", "like", likeValue)
              .orWhere("sms_number", "like", likeValue)
              .orWhere("office_phone", "like", likeValue);
          });
      })
      .limit(resolveSearchLimit(limit));

    applyCompanyLookupIncludes(queryModel);
    queryModel.noDestroy();
    queryModel.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(queryModel, null, 12000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Company lookup search timed out.");
    } else {
      console.error("[JobDirect] Company lookup search failed", error);
    }
    return [];
  }
}

export function subscribeCompaniesForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmCompany")
    .query()
    .deSelectAll()
    .select(COMPANY_LOOKUP_SELECT_FIELDS);
  applyCompanyLookupIncludes(query);
  query.noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Companies subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchPropertiesForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmProperty")
      .query()
      .deSelectAll()
      .select(PROPERTY_RECORD_SELECT_FIELDS);

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, 30000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Property search request timed out.");
    } else {
      console.error("[JobDirect] Failed to fetch property search data", error);
    }
    return [];
  }
}

export async function searchPropertiesForLookup({
  plugin,
  query = "",
  limit = LOOKUP_SEARCH_LIMIT,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedQuery = normalizeSearchName(query);
  if (!normalizedQuery) return [];

  try {
    const likeValue = toLikeValue(normalizedQuery);
    const queryModel = resolvedPlugin
      .switchTo("PeterpmProperty")
      .query()
      .deSelectAll()
      .select(PROPERTY_RECORD_SELECT_FIELDS)
      .andWhere((scope) => {
        scope
          .where("property_name", "like", likeValue)
          .orWhere("unique_id", "like", likeValue)
          .orWhere("address_1", "like", likeValue)
          .orWhere("address_2", "like", likeValue)
          .orWhere("suburb_town", "like", likeValue)
          .orWhere("state", "like", likeValue)
          .orWhere("postal_code", "like", likeValue);
      })
      .limit(resolveSearchLimit(limit));

    queryModel.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(queryModel, null, 12000);
    return extractRecords(response);
  } catch (error) {
    if (isTimeoutError(error)) {
      console.warn("[JobDirect] Property lookup search timed out.");
    } else {
      console.error("[JobDirect] Property lookup search failed", error);
    }
    return [];
  }
}

export function subscribePropertiesForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmProperty")
    .query()
    .deSelectAll()
    .select(PROPERTY_RECORD_SELECT_FIELDS)
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Properties subscription failed", error);
      onError?.(error);
    },
  });
}

export async function findPropertyByName({ plugin, propertyName } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;

  const rawName = String(propertyName || "").trim();
  const targetName = normalizeSearchName(rawName);
  if (!targetName) return null;

  try {
    const directQuery = resolvedPlugin
      .switchTo("PeterpmProperty")
      .query()
      .where("property_name", rawName)
      .deSelectAll()
      .select(PROPERTY_RECORD_SELECT_FIELDS)
      .limit(1)
      .noDestroy();
    directQuery.getOrInitQueryCalc?.();
    const directResponse = await fetchDirectWithTimeout(directQuery, null, 10000);
    const directRecord = extractFirstRecord(directResponse);
    if (directRecord) return directRecord;
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.warn("[JobDirect] Direct property-name lookup failed; falling back to cached search", error);
    }
  }

  try {
    const properties = await searchPropertiesForLookup({
      plugin: resolvedPlugin,
      query: targetName,
      limit: 80,
    });
    const match = (Array.isArray(properties) ? properties : []).find((item) => {
      const candidates = [
        item?.property_name,
        item?.Property_Name,
        item?.Property_Property_Name,
      ];
      return candidates.some((candidate) => normalizeSearchName(candidate) === targetName);
    });
    return match || null;
  } catch (error) {
    console.error("[JobDirect] Property duplicate lookup failed", error);
    return null;
  }
}
