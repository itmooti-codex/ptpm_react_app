function toNormalizedMessage(errorValue) {
  if (!errorValue) return "";
  const raw =
    (typeof errorValue === "string" ? errorValue : errorValue?.message || "") || "";
  return String(raw).trim().toLowerCase();
}

const TEMP_UNAVAILABLE_PATTERNS = [
  "vitalstats plugin not available after init",
  "sdk initialization failed",
  "failed to fetch",
  "net::err_failed",
  "cors",
  "query request timed out",
  "websocket",
  "networkerror",
];

export function isTemporaryServiceIssue(errorValue) {
  const message = toNormalizedMessage(errorValue);
  if (!message) return false;
  return TEMP_UNAVAILABLE_PATTERNS.some((pattern) => message.includes(pattern));
}

export function getFriendlyServiceMessage(errorValue) {
  if (isTemporaryServiceIssue(errorValue)) {
    return "Temporary maintenance. We will be back in a bit.";
  }
  return "";
}

