import { normalizePropertyRecord } from "../properties/propertyHelpers.js";

function normalizeDealRecord(rawDeal = {}) {
  return {
    id: String(rawDeal?.id || rawDeal?.ID || rawDeal?.DealsID || "").trim(),
    unique_id: String(
      rawDeal?.unique_id || rawDeal?.Unique_ID || rawDeal?.Deals_Unique_ID || ""
    ).trim(),
    deal_name: String(
      rawDeal?.deal_name || rawDeal?.Deal_Name || rawDeal?.Deals_Deal_Name || ""
    ).trim(),
  };
}

function normalizeLinkedJobRecord(rawJob = {}) {
  return {
    id: String(
      rawJob?.id || rawJob?.ID || rawJob?.JobsID || rawJob?.Jobs_As_Client_IndividualID || ""
    ).trim(),
    unique_id: String(
      rawJob?.unique_id ||
        rawJob?.Unique_ID ||
        rawJob?.Jobs_Unique_ID ||
        rawJob?.Jobs_As_Client_Individual_Unique_ID ||
        ""
    ).trim(),
    property_name: String(
      rawJob?.property_name ||
        rawJob?.Property_Name ||
        rawJob?.Property_Property_Name ||
        ""
    ).trim(),
  };
}

function normalizeDealsFromFlatFields(record = {}) {
  const ids = record?.DealsID;
  const uniqueIds = record?.Deals_Unique_ID;
  const names = record?.Deals_Deal_Name;

  if (Array.isArray(ids) || Array.isArray(uniqueIds) || Array.isArray(names)) {
    const maxLength = Math.max(ids?.length || 0, uniqueIds?.length || 0, names?.length || 0);
    const deals = [];
    for (let index = 0; index < maxLength; index += 1) {
      deals.push(
        normalizeDealRecord({
          DealsID: ids?.[index],
          Deals_Unique_ID: uniqueIds?.[index],
          Deals_Deal_Name: names?.[index],
        })
      );
    }
    return deals.filter((deal) => deal.id || deal.unique_id || deal.deal_name);
  }

  const single = normalizeDealRecord(record);
  if (!single.id && !single.unique_id && !single.deal_name) return [];
  return [single];
}

export function extractDealsFromAccountRecord(record) {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Deals)) {
    return record.Deals.map((item) => normalizeDealRecord(item)).filter(
      (deal) => deal.id || deal.unique_id || deal.deal_name
    );
  }

  return normalizeDealsFromFlatFields(record);
}

export function dedupeDeals(deals = []) {
  const seen = new Set();
  return deals.filter((deal) => {
    const key = String(deal.id || deal.unique_id || deal.deal_name || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeJobsFromFlatFields(record = {}, accountType = "Contact") {
  const isCompany = String(accountType || "").trim().toLowerCase() === "company";
  const ids = isCompany ? record?.JobsID : record?.Jobs_As_Client_IndividualID;
  const uniqueIds = isCompany
    ? record?.Jobs_Unique_ID
    : record?.Jobs_As_Client_Individual_Unique_ID;
  const propertyNames = record?.Property_Property_Name;

  if (Array.isArray(ids) || Array.isArray(uniqueIds) || Array.isArray(propertyNames)) {
    const maxLength = Math.max(
      ids?.length || 0,
      uniqueIds?.length || 0,
      propertyNames?.length || 0
    );
    const jobs = [];
    for (let index = 0; index < maxLength; index += 1) {
      jobs.push(
        normalizeLinkedJobRecord({
          id: ids?.[index],
          unique_id: uniqueIds?.[index],
          property_name: propertyNames?.[index],
        })
      );
    }
    return jobs.filter((job) => job.unique_id || job.property_name);
  }

  const single = normalizeLinkedJobRecord(record);
  if (!single.unique_id && !single.property_name) return [];
  return [single];
}

export function extractLinkedJobsFromAccountRecord(record, accountType = "Contact") {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Jobs)) {
    return record.Jobs.map((item) => normalizeLinkedJobRecord(item)).filter(
      (job) => job.unique_id || job.property_name
    );
  }

  if (Array.isArray(record?.Jobs_As_Client_Individual)) {
    return record.Jobs_As_Client_Individual.map((item) => normalizeLinkedJobRecord(item)).filter(
      (job) => job.unique_id || job.property_name
    );
  }

  return normalizeJobsFromFlatFields(record, accountType);
}

export function dedupeLinkedJobs(jobs = []) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = String(job.id || job.unique_id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePropertiesFromFlatFields(record = {}) {
  const ids = record?.PropertiesID || record?.Property_ID;
  const uniqueIds = record?.Properties_Unique_ID || record?.Property_Unique_ID;
  const names = record?.Properties_Property_Name || record?.Property_Property_Name;

  if (Array.isArray(ids) || Array.isArray(uniqueIds) || Array.isArray(names)) {
    const maxLength = Math.max(ids?.length || 0, uniqueIds?.length || 0, names?.length || 0);
    const properties = [];
    for (let index = 0; index < maxLength; index += 1) {
      properties.push(
        normalizePropertyRecord({
          PropertiesID: ids?.[index],
          Properties_Unique_ID: uniqueIds?.[index],
          Properties_Property_Name: names?.[index],
        })
      );
    }
    return properties.filter(
      (property) => property.id || property.unique_id || property.property_name
    );
  }

  const single = normalizePropertyRecord(record);
  if (!single.id && !single.unique_id && !single.property_name) return [];
  return [single];
}

export function extractPropertiesFromAccountRecord(record) {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Properties)) {
    return record.Properties.map((item) => normalizePropertyRecord(item)).filter(
      (property) => property.id || property.unique_id || property.property_name
    );
  }

  return normalizePropertiesFromFlatFields(record);
}

export function dedupeProperties(properties = []) {
  const seen = new Set();
  return properties.filter((property) => {
    const key = String(property.id || property.unique_id || property.property_name || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
