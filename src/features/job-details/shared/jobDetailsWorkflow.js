import {
  resolveStatusStyle,
} from "../../../shared/constants/statusStyles.js";
import { toText } from "@shared/utils/formatters.js";

export const LAST_ACTION_STATUSES = Object.freeze({
  QUEUED: "queued",
  SUCCEEDED: "succeeded",
});

const DEFAULT_STATUS_STYLE = { color: "#475569", backgroundColor: "#f1f5f9" };
const LAST_ACTION_SOURCE = "app";
const LAST_ACTION_RANDOM_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function isDefaultStatusStyle(style) {
  return (
    String(style?.color || "") === DEFAULT_STATUS_STYLE.color &&
    String(style?.backgroundColor || "") === DEFAULT_STATUS_STYLE.backgroundColor
  );
}

function createLastActionRequestId() {
  const timestamp = Date.now().toString(36);
  if (globalThis.crypto?.getRandomValues) {
    const bytes = new Uint8Array(6);
    globalThis.crypto.getRandomValues(bytes);
    const suffix = Array.from(
      bytes,
      (value) => LAST_ACTION_RANDOM_ALPHABET[value % LAST_ACTION_RANDOM_ALPHABET.length]
    ).join("");
    return `act_${timestamp}_${suffix}`;
  }

  return `act_${timestamp}_${Math.random().toString(36).slice(2, 8).padEnd(6, "0").slice(0, 6)}`;
}

function toActionToken(value) {
  return toText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function resolveStatusStyleNormalized(value) {
  const text = toText(value);
  if (!text) return DEFAULT_STATUS_STYLE;

  const direct = resolveStatusStyle(text);
  if (!isDefaultStatusStyle(direct)) return direct;

  const lowered = text.toLowerCase();
  const titleCased = text
    .split(/\s+/)
    .map((part) => (part ? `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}` : ""))
    .join(" ");

  const candidates = [
    titleCased,
    lowered,
    lowered === "in progress" ? "In Progress" : "",
    lowered === "waiting for payment" ? "Waiting For Payment" : "",
    lowered === "invoice required" ? "Invoice Required" : "",
    lowered === "invoice sent" ? "Invoice Sent" : "",
    lowered === "written off" ? "Written Off" : "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    const style = resolveStatusStyle(candidate);
    if (!isDefaultStatusStyle(style)) return style;
  }

  return direct;
}

export function buildJobLastActionPayload({
  type = "",
  message = "",
  status = LAST_ACTION_STATUSES.QUEUED,
} = {}) {
  const normalizedType = toText(type);
  if (!normalizedType) return {};
  return {
    PTPM_Last_Action_Status: status,
    PTPM_Last_Action_Message: toText(message),
    PTPM_Last_Action_Type: normalizedType,
    PTPM_Last_Action_Request_ID: createLastActionRequestId(),
    PTPM_Last_Action_At: Math.trunc(Date.now() / 1000),
    PTPM_Last_Action_Source: LAST_ACTION_SOURCE,
  };
}

export function buildEmailMenuLastAction({ groupKey = "", option = null, target = "button" } = {}) {
  if (target === "job") {
    return {
      type: "job.email.job-update",
      message: "Job update email requested.",
    };
  }

  const buttonName = toText(option?.button_name);
  const templateName = toText(option?.template_link_button);
  if (!buttonName) {
    return { type: "", message: "" };
  }

  if (target === "template") {
    return {
      type: [
        "job",
        "email",
        toActionToken(groupKey),
        toActionToken(buttonName),
        toActionToken(templateName),
      ]
        .filter(Boolean)
        .join("."),
      message: `${templateName || "Email template"} selected for ${buttonName}.`,
    };
  }

  return {
    type: ["job", "email", toActionToken(groupKey), toActionToken(buttonName)]
      .filter(Boolean)
      .join("."),
    message: `${buttonName} requested.`,
  };
}

export const EMAIL_OPTIONS_DATA = {
  general: {
    label: "General Emails",
    buttons: [
      { button_name: "Email Customer", template_link_button: "Job Email" },
      { button_name: "Email Tenant", template_link_button: "Job Email" },
      { button_name: "Request Review", template_link_button: "Job Email" },
    ],
  },
  quote: {
    label: "Quote Emails",
    buttons: [
      { button_name: "Email Manual Quote", template_link_button: "Job Email" },
      { button_name: "Email Electronic Quote", template_link_button: "Job Email" },
      { button_name: "Email RE Quote FU", template_link_button: "Job Email" },
      { button_name: "Email BC Quote FU", template_link_button: "Job Email" },
      { button_name: "Email O Quote FU", template_link_button: "Job Email" },
      { button_name: "Email 2nd Quote FU", template_link_button: "Job Email" },
    ],
  },
  invoice: {
    label: "Invoice Emails",
    buttons: [
      { button_name: "Email Invoice", template_link_button: "Account Email" },
      { button_name: "Email Invoice FU", template_link_button: "Account Email" },
      { button_name: "Email RE INV FU", template_link_button: "Account Email" },
    ],
  },
};
