import { buildLookupDisplayLabel } from "../../../../shared/utils/lookupLabel.js";
import {
  EMPTY_FORM,
  HOW_DID_YOU_HEAR_OPTIONS,
  INQUIRY_SOURCE_OPTIONS,
  INQUIRY_STATUS_OPTIONS,
  INQUIRY_TYPE_OPTIONS,
  NOISE_SIGN_OPTIONS,
  PEST_ACTIVE_TIME_OPTIONS,
  PEST_LOCATION_OPTIONS,
  RECENT_ACTIVITY_OPTIONS,
  SALES_STAGE_OPTIONS,
} from "./inquiryInformationConstants.js";

export function buildContactItems(list = []) {
  return (list || []).map((item) => {
    const fullName = [item.first_name, item.last_name].filter(Boolean).join(" ").trim();
    return {
      id: item.id,
      label: buildLookupDisplayLabel(
        fullName,
        item.email,
        item.sms_number,
        `Contact #${item.id}`
      ),
      meta: [item.email, item.sms_number, item.id].filter(Boolean).join(" | "),
    };
  });
}

export function buildCompanyItems(list = []) {
  return (list || []).map((item) => ({
    id: item.id,
    label: buildLookupDisplayLabel(
      item.name,
      item.primary?.email,
      item.primary?.sms_number,
      `Company #${item.id}`
    ),
    meta: [item.account_type, item.primary?.email, item.id].filter(Boolean).join(" | "),
  }));
}

export function toText(value) {
  return String(value || "").trim();
}

export function formatPropertyPrefillDetails({ selectedProperty = null, activeProperty = null } = {}) {
  const selectedLabel = toText(selectedProperty?.label);
  const selectedMeta = toText(selectedProperty?.meta);
  if (selectedLabel) {
    const selectedUid = toText(selectedMeta.split("|")[0]);
    if (selectedUid && !selectedLabel.toLowerCase().includes(selectedUid.toLowerCase())) {
      return `${selectedLabel} | ${selectedUid}`;
    }
    return selectedLabel;
  }
  if (selectedMeta) {
    const selectedUid = toText(selectedMeta.split("|")[0]);
    if (selectedUid) return selectedUid;
  }

  const propertyName = toText(
    activeProperty?.property_name ||
      activeProperty?.Property_Name ||
      activeProperty?.name ||
      activeProperty?.Name
  );
  const propertyUid = toText(activeProperty?.unique_id || activeProperty?.Unique_ID);
  const addressLine = toText(
    activeProperty?.address_1 ||
      activeProperty?.Address_1 ||
      activeProperty?.address ||
      activeProperty?.Address
  );
  const locality = toText(
    activeProperty?.suburb_town ||
      activeProperty?.Suburb_Town ||
      activeProperty?.city ||
      activeProperty?.City
  );
  const state = toText(activeProperty?.state || activeProperty?.State);
  const postcode = toText(
    activeProperty?.postal_code ||
      activeProperty?.Postal_Code ||
      activeProperty?.zip_code ||
      activeProperty?.Zip_Code
  );
  const address = [addressLine, locality, state, postcode].filter(Boolean).join(", ");

  return [propertyName, propertyUid, address].filter(Boolean).join(" | ");
}

export function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

export function normalizeOptionValue(rawValue, options = []) {
  const text = toText(rawValue);
  if (!text) return "";
  const target = text.toLowerCase();
  const matchedOption = options.find((option) => {
    const values = [option?.value, option?.label, option?.code].map((item) =>
      toText(item).toLowerCase()
    );
    return values.includes(target);
  });
  return matchedOption ? toText(matchedOption.value) : text;
}

export function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    return new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
  }
  return Promise.resolve(result);
}

export function normalizeLinkedJobRecord(record = {}) {
  return {
    id: toText(
      record?.id ||
        record?.ID ||
        record?.JobsID ||
        record?.Jobs_As_Client_IndividualID
    ),
    unique_id: toText(
      record?.unique_id ||
        record?.Unique_ID ||
        record?.Jobs_Unique_ID ||
        record?.Jobs_As_Client_Individual_Unique_ID
    ),
    property_name: toText(
      record?.property_name ||
        record?.Property_Name ||
        record?.Property?.property_name ||
        record?.Property?.Property_Name ||
        record?.Property_Property_Name
    ),
  };
}

export function parseListSelectionValue(value, options = []) {
  const text = toText(value);
  if (!text) return [];
  const normalizedTokens = text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => toText(item).toLowerCase())
    .filter(Boolean);
  if (!normalizedTokens.length) return [];

  const selected = [];
  normalizedTokens.forEach((token) => {
    const option = options.find((item) => {
      const candidates = [item?.code, item?.value, item?.label].map((candidate) =>
        toText(candidate).toLowerCase()
      );
      return candidates.includes(token);
    });
    if (!option) return;
    const optionKey = toText(option.code || option.value);
    if (!optionKey) return;
    if (selected.includes(optionKey)) return;
    selected.push(optionKey);
  });
  return selected;
}

export function serializeListSelectionValue(selection = []) {
  const normalized = Array.from(
    new Set(
      (selection || [])
        .map((item) => toText(item))
        .filter(Boolean)
    )
  );
  if (!normalized.length) return "";
  return normalized.map((item) => `*/*${item}*/*`).join("");
}

export function normalizeInitialForm(values = null) {
  if (!values || typeof values !== "object") {
    return { ...EMPTY_FORM };
  }
  const next = { ...EMPTY_FORM };
  Object.keys(EMPTY_FORM).forEach((key) => {
    next[key] = toText(values[key]);
  });
  next.sales_stage = normalizeOptionValue(next.sales_stage, SALES_STAGE_OPTIONS);
  next.recent_activity = normalizeOptionValue(next.recent_activity, RECENT_ACTIVITY_OPTIONS);
  next.inquiry_status = normalizeOptionValue(next.inquiry_status, INQUIRY_STATUS_OPTIONS);
  next.inquiry_source = normalizeOptionValue(next.inquiry_source, INQUIRY_SOURCE_OPTIONS);
  next.type = normalizeOptionValue(next.type, INQUIRY_TYPE_OPTIONS);
  next.how_did_you_hear = normalizeOptionValue(next.how_did_you_hear, HOW_DID_YOU_HEAR_OPTIONS);
  next.service_inquiry_id = normalizeServiceInquiryId(next.service_inquiry_id);
  next.renovations = toText(next.renovations);
  next.resident_availability = toText(next.resident_availability);
  next.noise_signs_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.noise_signs_options_as_text, NOISE_SIGN_OPTIONS)
  );
  next.pest_active_times_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.pest_active_times_options_as_text, PEST_ACTIVE_TIME_OPTIONS)
  );
  next.pest_location_options_as_text = serializeListSelectionValue(
    parseListSelectionValue(next.pest_location_options_as_text, PEST_LOCATION_OPTIONS)
  );
  return next;
}
