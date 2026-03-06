import { resolvePlugin } from "../../plugin.js";
import { fetchDirectWithTimeout, isTimeoutError } from "../../transport.js";
import { extractRecords } from "../../../utils/sdkResponseUtils.js";
import { normalizeIdentifier } from "../shared/sharedHelpers.js";
import { PROPERTY_RECORD_SELECT_FIELDS } from "../properties/propertyHelpers.js";
import {
  resolveLinkedAccountType,
  resolveLinkedAccountModelName,
  LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS,
  LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS,
  buildLinkedDealsFallbackQuery,
  buildLinkedJobsFallbackQuery,
  buildLinkedPropertiesFallbackQuery,
} from "./linkedAccountsQueryHelpers.js";
import {
  extractDealsFromAccountRecord,
  dedupeDeals,
  extractLinkedJobsFromAccountRecord,
  dedupeLinkedJobs,
  extractPropertiesFromAccountRecord,
  dedupeProperties,
} from "./linkedAccountsNormalizationHelpers.js";

async function fetchDealsByAccountId({ plugin, accountType, accountId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = resolveLinkedAccountModelName(accountType);
  const resolvedId = normalizeIdentifier(accountId);
  if (!resolvedId) return [];

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("id", resolvedId)
      .deSelectAll()
      .select(["id"])
      .include("Deals", (dealQuery) =>
        dealQuery.deSelectAll().select(["id", "unique_id", "deal_name"])
      );

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS);
    const accountRecords = extractRecords(response);
    const dealsFromAllRows = accountRecords.flatMap((record) =>
      extractDealsFromAccountRecord(record)
    );
    return dedupeDeals(dealsFromAllRows);
  } catch (includeError) {
    if (!isTimeoutError(includeError)) {
      console.warn(
        "[JobDirect] Include-based linked deals query failed, trying calc fallback",
        includeError
      );
    }
  }

  try {
    const resolvedType = resolveLinkedAccountType(accountType);
    const customDealQuery = buildLinkedDealsFallbackQuery(resolvedType);

    const customQuery = resolvedPlugin.switchTo(modelName).query().fromGraphql(customDealQuery);
    const customResponse = await fetchDirectWithTimeout(
      customQuery,
      { variables: { id: resolvedId } },
      LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS
    );
    const customRecords = extractRecords(customResponse);
    const customDeals = dedupeDeals(
      customRecords.flatMap((record) => extractDealsFromAccountRecord(record))
    );
    return customDeals;
  } catch (customError) {
    if (!isTimeoutError(customError)) {
      console.error("[JobDirect] Failed to fetch linked deals", {
        accountType,
        accountId,
        customError,
      });
    }
    return [];
  }
}

async function fetchJobsByAccountId({ plugin, accountType, accountId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = resolveLinkedAccountModelName(accountType);
  const resolvedId = normalizeIdentifier(accountId);
  if (!resolvedId) return [];

  try {
    const resolvedType = resolveLinkedAccountType(accountType);
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("id", resolvedId)
      .deSelectAll()
      .select(["id"])
      .include(
        resolvedType === "Company" ? "Jobs" : "Jobs_As_Client_Individual",
        (jobQuery) =>
          jobQuery
            .deSelectAll()
            .select(["id", "unique_id"])
            .include("Property", (propertyQuery) =>
              propertyQuery.deSelectAll().select(["property_name"])
            )
      );

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS);
    const accountRecords = extractRecords(response);
    const jobs = dedupeLinkedJobs(
      accountRecords.flatMap((record) =>
        extractLinkedJobsFromAccountRecord(record, resolvedType)
      )
    );
    return jobs;
  } catch (includeError) {
    if (!isTimeoutError(includeError)) {
      console.warn(
        "[JobDirect] Include-based linked jobs query failed, trying calc fallback",
        includeError
      );
    }
  }

  try {
    const resolvedType = resolveLinkedAccountType(accountType);
    const customJobsQuery = buildLinkedJobsFallbackQuery(resolvedType);

    const customQuery = resolvedPlugin.switchTo(modelName).query().fromGraphql(customJobsQuery);
    const customResponse = await fetchDirectWithTimeout(
      customQuery,
      { variables: { id: resolvedId } },
      LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS
    );
    const customRecords = extractRecords(customResponse);
    const customJobs = dedupeLinkedJobs(
      customRecords.flatMap((record) =>
        extractLinkedJobsFromAccountRecord(record, resolvedType)
      )
    );
    return customJobs;
  } catch (customError) {
    if (!isTimeoutError(customError)) {
      console.error("[JobDirect] Failed to fetch linked jobs", {
        accountType,
        accountId,
        customError,
      });
    }
    return [];
  }
}

export async function fetchLinkedDealsByAccount({ plugin, accountType, accountId } = {}) {
  return fetchDealsByAccountId({
    plugin,
    accountType: resolveLinkedAccountType(accountType),
    accountId,
  });
}

export async function fetchLinkedJobsByAccount({ plugin, accountType, accountId } = {}) {
  return fetchJobsByAccountId({
    plugin,
    accountType: resolveLinkedAccountType(accountType),
    accountId,
  });
}

export async function fetchLinkedPropertiesByAccount({ plugin, accountType, accountId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const resolvedType = resolveLinkedAccountType(accountType);
  const modelName = resolveLinkedAccountModelName(resolvedType);
  const normalizedId = normalizeIdentifier(accountId);
  if (!normalizedId) return [];

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id"])
      .include("Properties", (propertyQuery) =>
        propertyQuery.deSelectAll().select(PROPERTY_RECORD_SELECT_FIELDS)
      );

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query, null, LINKED_ACCOUNT_INCLUDE_TIMEOUT_MS);
    const accountRecords = extractRecords(response);
    const propertiesFromAllRows = accountRecords.flatMap((record) =>
      extractPropertiesFromAccountRecord(record)
    );
    return dedupeProperties(propertiesFromAllRows);
  } catch (includeError) {
    if (!isTimeoutError(includeError)) {
      console.warn(
        "[JobDirect] Include-based linked properties query failed, trying custom fallback",
        includeError
      );
    }
  }

  try {
    const customPropertyQuery = buildLinkedPropertiesFallbackQuery(resolvedType);

    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(customPropertyQuery);
    const customResponse = await fetchDirectWithTimeout(
      customQuery,
      { variables: { id: normalizedId } },
      LINKED_ACCOUNT_CUSTOM_FALLBACK_TIMEOUT_MS
    );
    const customRecords = extractRecords(customResponse);
    const customProperties = dedupeProperties(
      customRecords.flatMap((record) => extractPropertiesFromAccountRecord(record))
    );
    return customProperties;
  } catch (customError) {
    if (!isTimeoutError(customError)) {
      console.error("[JobDirect] Failed to fetch linked properties", {
        accountType: resolvedType,
        accountId: normalizedId,
        customError,
      });
    }
    return [];
  }
}
