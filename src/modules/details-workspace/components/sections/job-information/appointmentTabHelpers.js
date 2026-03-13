import { toText } from "../../../../../shared/utils/formatters.js";

function normalizeText(value) {
  return toText(value).toLowerCase();
}

export function isLikelyEmailValue(value) {
  const text = toText(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
}

export function isLikelyPhoneValue(value) {
  const text = toText(value);
  if (!text) return false;
  const digits = text.replace(/\D+/g, "");
  return digits.length >= 6;
}

export function toTelHref(value) {
  const text = toText(value);
  if (!text) return "";
  const normalized = text.replace(/[^\d+]+/g, "");
  return normalized ? `tel:${normalized}` : "";
}

export function splitMetaTokens(value) {
  return toText(value)
    .split("|")
    .map((item) => toText(item))
    .filter(Boolean);
}

export function parseLookupIdentity(label = "", meta = "") {
  const labelText = toText(label);
  const labelTokens = splitMetaTokens(labelText);
  const metaTokens = splitMetaTokens(meta);
  const primaryToken = labelTokens[0] || "";
  const emailMatch = primaryToken.match(/<([^>]+)>/);
  const emailFromLabel = toText(emailMatch?.[1]);
  const nameFromLabel = toText(primaryToken.replace(/\s*<[^>]+>\s*$/, ""));
  const emailFromMeta = toText(metaTokens.find((item) => isLikelyEmailValue(item)));
  const phoneFromLabel = toText(labelTokens.slice(1).find((item) => isLikelyPhoneValue(item)));
  const phoneFromMeta = toText(metaTokens.find((item) => isLikelyPhoneValue(item)));

  return {
    name: nameFromLabel || emailFromLabel || emailFromMeta,
    email: emailFromLabel || emailFromMeta,
    phone: phoneFromLabel || phoneFromMeta,
  };
}

export function buildGoogleMapSearchUrl(query = "") {
  const text = toText(query);
  if (!text || text === "-") return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(text)}`;
}

export function buildLocationMapQuery(locationName = "", locationMeta = "") {
  const metaTokens = splitMetaTokens(locationMeta);
  const addressTokens = metaTokens.slice(1).filter(Boolean);
  if (addressTokens.length) return addressTokens.join(", ");
  return toText(locationName);
}

export function normalizeAppointmentValue(value) {
  return normalizeText(value);
}

export function resolveAppointmentMappedOption(options = [], rawValue = "") {
  const target = normalizeAppointmentValue(rawValue);
  if (!target) return null;

  return (
    options.find((option) => normalizeAppointmentValue(option.value) === target) ||
    options.find((option) => normalizeAppointmentValue(option.label) === target) ||
    options.find((option) => normalizeAppointmentValue(option.code) === target) ||
    null
  );
}

export function getAppointmentEventColorValue(record = {}) {
  const candidates = [
    record?.event_color,
    record?.Event_Color,
    record?.event_colour,
    record?.Event_Colour,
    record?.google_calendar_event_color,
    record?.Google_Calendar_Event_Color,
    record?.google_calendar_color,
    record?.Google_Calendar_Color,
  ];
  for (const value of candidates) {
    const text = toText(value);
    if (text) return text;
  }
  return "";
}

export function parseAppointmentDateInputToUnix(value = "") {
  const text = toText(value);
  if (!text) return null;

  const isoLocal = text.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (isoLocal) {
    const year = Number.parseInt(isoLocal[1], 10);
    const month = Number.parseInt(isoLocal[2], 10);
    const day = Number.parseInt(isoLocal[3], 10);
    const hour = Number.parseInt(isoLocal[4], 10);
    const minute = Number.parseInt(isoLocal[5], 10);
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) return null;
    return Math.floor(date.getTime() / 1000);
  }

  const withTime = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/
  );
  if (!withTime) return null;

  const day = Number.parseInt(withTime[1], 10);
  const month = Number.parseInt(withTime[2], 10);
  const year = Number.parseInt(withTime[3], 10);
  const hour = Number.parseInt(withTime[4] || "0", 10);
  const minute = Number.parseInt(withTime[5] || "0", 10);

  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor(date.getTime() / 1000);
}

export function formatAppointmentUnix(value = "") {
  if (value === null || value === undefined || value === "") return "-";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    const text = toText(value);
    return text || "-";
  }

  const asMs = String(Math.trunc(Math.abs(numeric))).length <= 10 ? numeric * 1000 : numeric;
  const date = new Date(asMs);
  if (Number.isNaN(date.getTime())) return "-";

  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yy} ${hh}:${mi}`;
}

export function formatAppointmentDuration(hours = "", minutes = "") {
  const hh = toText(hours || "0");
  const mm = toText(minutes || "0");
  if (!hh && !mm) return "-";
  return `${hh || "0"}h ${mm || "0"}m`;
}
