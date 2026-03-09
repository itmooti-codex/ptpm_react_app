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
    inquiry_status: String(
      rawDeal?.inquiry_status || rawDeal?.Inquiry_Status || rawDeal?.Deals_Inquiry_Status || ""
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
    property_unique_id: String(
      rawJob?.property_unique_id ||
        rawJob?.Property_Unique_ID ||
        rawJob?.Property?.unique_id ||
        rawJob?.Property?.Unique_ID ||
        ""
    ).trim(),
    property_address_1: String(
      rawJob?.property_address_1 ||
        rawJob?.Property_Address_1 ||
        rawJob?.Property?.address_1 ||
        rawJob?.Property?.Address_1 ||
        ""
    ).trim(),
    property_suburb_town: String(
      rawJob?.property_suburb_town ||
        rawJob?.Property_Suburb_Town ||
        rawJob?.Property?.suburb_town ||
        rawJob?.Property?.Suburb_Town ||
        ""
    ).trim(),
    property_state: String(
      rawJob?.property_state ||
        rawJob?.Property_State ||
        rawJob?.Property?.state ||
        rawJob?.Property?.State ||
        ""
    ).trim(),
    job_status: String(
      rawJob?.job_status ||
        rawJob?.Job_Status ||
        rawJob?.Jobs_Job_Status ||
        rawJob?.Jobs_As_Client_Individual_Job_Status ||
        ""
    ).trim(),
    quote_status: String(
      rawJob?.quote_status ||
        rawJob?.Quote_Status ||
        rawJob?.Jobs_Quote_Status ||
        rawJob?.Jobs_As_Client_Individual_Quote_Status ||
        ""
    ).trim(),
  };
}

function normalizeDealsFromFlatFields(record = {}) {
  const ids = record?.DealsID;
  const uniqueIds = record?.Deals_Unique_ID;
  const names = record?.Deals_Deal_Name;
  const statuses = record?.Deals_Inquiry_Status;

  if (
    Array.isArray(ids) ||
    Array.isArray(uniqueIds) ||
    Array.isArray(names) ||
    Array.isArray(statuses)
  ) {
    const maxLength = Math.max(
      ids?.length || 0,
      uniqueIds?.length || 0,
      names?.length || 0,
      statuses?.length || 0
    );
    const deals = [];
    for (let index = 0; index < maxLength; index += 1) {
      deals.push(
        normalizeDealRecord({
          DealsID: ids?.[index],
          Deals_Unique_ID: uniqueIds?.[index],
          Deals_Deal_Name: names?.[index],
          Deals_Inquiry_Status: statuses?.[index],
        })
      );
    }
    return deals.filter(
      (deal) => deal.id || deal.unique_id || deal.deal_name || deal.inquiry_status
    );
  }

  const single = normalizeDealRecord(record);
  if (!single.id && !single.unique_id && !single.deal_name && !single.inquiry_status) return [];
  return [single];
}

export function extractDealsFromAccountRecord(record) {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Deals)) {
    return record.Deals.map((item) => normalizeDealRecord(item)).filter(
      (deal) => deal.id || deal.unique_id || deal.deal_name || deal.inquiry_status
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
  const jobStatuses = isCompany
    ? record?.Jobs_Job_Status
    : record?.Jobs_As_Client_Individual_Job_Status;
  const quoteStatuses = isCompany
    ? record?.Jobs_Quote_Status
    : record?.Jobs_As_Client_Individual_Quote_Status;
  const propertyNames = record?.Property_Property_Name;
  const propertyUniqueIds = record?.Property_Unique_ID;
  const propertyAddresses = record?.Property_Address_1;
  const propertySuburbs = record?.Property_Suburb_Town;
  const propertyStates = record?.Property_State;

  if (
    Array.isArray(ids) ||
    Array.isArray(uniqueIds) ||
    Array.isArray(propertyNames) ||
    Array.isArray(jobStatuses) ||
    Array.isArray(quoteStatuses)
  ) {
    const maxLength = Math.max(
      ids?.length || 0,
      uniqueIds?.length || 0,
      propertyNames?.length || 0,
      propertyUniqueIds?.length || 0,
      propertyAddresses?.length || 0,
      propertySuburbs?.length || 0,
      propertyStates?.length || 0,
      jobStatuses?.length || 0,
      quoteStatuses?.length || 0
    );
    const jobs = [];
    for (let index = 0; index < maxLength; index += 1) {
      jobs.push(
        normalizeLinkedJobRecord({
          id: ids?.[index],
          unique_id: uniqueIds?.[index],
          property_name: propertyNames?.[index],
          property_unique_id: propertyUniqueIds?.[index],
          property_address_1: propertyAddresses?.[index],
          property_suburb_town: propertySuburbs?.[index],
          property_state: propertyStates?.[index],
          job_status: jobStatuses?.[index],
          quote_status: quoteStatuses?.[index],
        })
      );
    }
    return jobs.filter(
      (job) => job.unique_id || job.property_name || job.job_status || job.quote_status
    );
  }

  const single = normalizeLinkedJobRecord(record);
  if (!single.unique_id && !single.property_name && !single.job_status && !single.quote_status) {
    return [];
  }
  return [single];
}

export function extractLinkedJobsFromAccountRecord(record, accountType = "Contact") {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Jobs)) {
    return record.Jobs.map((item) => normalizeLinkedJobRecord(item)).filter(
      (job) => job.unique_id || job.property_name || job.job_status || job.quote_status
    );
  }

  if (Array.isArray(record?.Jobs_As_Client_Individual)) {
    return record.Jobs_As_Client_Individual.map((item) => normalizeLinkedJobRecord(item)).filter(
      (job) => job.unique_id || job.property_name || job.job_status || job.quote_status
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
