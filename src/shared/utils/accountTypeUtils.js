/**
 * Account type classification helpers used across features.
 */

import { toText } from "./formatters.js";

export function normalizeAccountType(accountType = "") {
  const normalized = toText(accountType).toLowerCase();
  return normalized === "company" || normalized === "entity" ? "Company" : "Contact";
}

export function isCompanyAccountType(value) {
  const normalized = toText(value).toLowerCase();
  return normalized === "company" || normalized === "entity";
}

export function isContactAccountType(value) {
  const normalized = toText(value).toLowerCase();
  return normalized === "contact" || normalized === "individual";
}

export function isBodyCorpCompanyAccountType(value) {
  const normalized = toText(value).toLowerCase();
  if (!normalized) return false;
  const collapsed = normalized.replace(/[^a-z0-9]+/g, "");
  return (
    normalized.includes("body corp") ||
    normalized.includes("body corporate") ||
    collapsed.includes("bodycorp")
  );
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
