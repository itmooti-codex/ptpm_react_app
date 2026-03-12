import {
  ensureGooglePlacesLoaded,
  parseGoogleAddressComponents,
} from "@shared/lib/googlePlaces.js";
import { toText } from "@shared/utils/formatters.js";
import { parseListSelectionValue } from "./inquiryInformationHelpers.js";

export function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

export async function resolveAddressFromGoogleLookup(addressText) {
  const query = toText(addressText);
  if (!query) return null;

  try {
    await ensureGooglePlacesLoaded();
    if (!window.google?.maps?.Geocoder) return null;

    const geocoder = new window.google.maps.Geocoder();
    const results = await new Promise((resolve, reject) => {
      geocoder.geocode(
        {
          address: query,
          componentRestrictions: { country: "AU" },
        },
        (response, status) => {
          if (status === "OK" && Array.isArray(response) && response.length) {
            resolve(response);
            return;
          }
          reject(new Error(`Google geocode failed with status: ${status || "UNKNOWN"}`));
        }
      );
    });

    const firstResult = Array.isArray(results) ? results[0] : null;
    if (!firstResult) return null;
    return parseGoogleAddressComponents(firstResult);
  } catch (error) {
    console.warn("[InquiryDetails] Google address resolution failed", error);
    return null;
  }
}

export function toDateInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (!Number.isFinite(num)) return "";
    const seconds = num > 4102444800 ? Math.floor(num / 1000) : num;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function toUnixSeconds(dateInput) {
  const value = toText(dateInput);
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

export function toNullableText(value) {
  const text = toText(value);
  return text || null;
}

export function buildListSelectionTagItems(value, options = []) {
  const raw = toText(value);
  if (!raw) return [];
  const selectedCodes = parseListSelectionValue(raw, options);
  if (!selectedCodes.length) {
    return [
      {
        key: raw,
        code: "",
        label: raw,
      },
    ];
  }

  const optionLabelByCode = new Map(
    (Array.isArray(options) ? options : []).map((item) => [
      toText(item?.code || item?.value),
      toText(item?.label || item?.value || item?.code),
    ])
  );

  return selectedCodes
    .map((code) => {
      const normalizedCode = toText(code);
      if (!normalizedCode) return null;
      return {
        key: normalizedCode,
        code: normalizedCode,
        label: optionLabelByCode.get(normalizedCode) || normalizedCode,
      };
    })
    .filter(Boolean);
}
