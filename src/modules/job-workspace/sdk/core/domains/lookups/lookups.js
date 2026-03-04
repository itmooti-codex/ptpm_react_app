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
    const contacts = await fetchContactsForSearch({ plugin: resolvedPlugin });
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
    const detailResponse = await fetchDirectWithTimeout(detailQuery, null, 10000);
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
    const properties = await fetchPropertiesForSearch({ plugin: resolvedPlugin });
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
