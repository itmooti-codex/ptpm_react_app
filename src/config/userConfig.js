function toText(value) {
  return String(value ?? "").trim();
}

const DEMO_USER_STORAGE_KEY = "ptpm_demo_user_id";

function resolveWindowUserId() {
  if (typeof window === "undefined") return "";

  const candidates = [
    window.__PTPM_CURRENT_USER_ID,
    window.__ptpmCurrentUserId,
    window.__PTPM_USER_ID,
    window.__ptpmUserId,
  ];

  for (const candidate of candidates) {
    const normalized = toText(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function resolveStoredDemoUserId() {
  if (typeof window === "undefined") return "";
  try {
    return toText(window.localStorage?.getItem(DEMO_USER_STORAGE_KEY));
  } catch (_) {
    return "";
  }
}

function resolveEnvUserId() {
  return toText(import.meta.env.VITE_APP_USER_ID);
}

function applyWindowUserId(value) {
  if (typeof window === "undefined") return;
  const normalized = toText(value);
  window.__PTPM_CURRENT_USER_ID = normalized;
  window.__ptpmCurrentUserId = normalized;
}

export function getConfiguredDemoUserIds() {
  const raw = toText(import.meta.env.VITE_DEMO_USER_IDS);
  if (!raw) return [];

  const seen = new Set();
  return raw
    .split(",")
    .map((value) => toText(value))
    .filter((value) => {
      if (!value || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
}

export function isDemoUserSelectionEnabled() {
  return getConfiguredDemoUserIds().length > 0;
}

export function getSelectedDemoUserId() {
  return resolveWindowUserId() || resolveStoredDemoUserId();
}

export function setSelectedDemoUserId(userId) {
  const normalized = toText(userId);
  applyWindowUserId(normalized);
  if (typeof window === "undefined") return normalized;

  try {
    if (normalized) {
      window.localStorage?.setItem(DEMO_USER_STORAGE_KEY, normalized);
    } else {
      window.localStorage?.removeItem(DEMO_USER_STORAGE_KEY);
    }
  } catch (_) {}

  return normalized;
}

export function clearSelectedDemoUserId() {
  applyWindowUserId("");
  if (typeof window === "undefined") return;
  try {
    window.localStorage?.removeItem(DEMO_USER_STORAGE_KEY);
  } catch (_) {}
}

export function getCurrentUserId() {
  return resolveWindowUserId() || resolveStoredDemoUserId() || resolveEnvUserId();
}

export const APP_USER = Object.freeze({
  get id() {
    return getCurrentUserId();
  },
});
