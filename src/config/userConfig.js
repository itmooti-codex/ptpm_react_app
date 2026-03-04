function toText(value) {
  return String(value ?? "").trim();
}

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

function resolveEnvUserId() {
  return toText(import.meta.env.VITE_APP_USER_ID);
}

export function getCurrentUserId() {
  return resolveWindowUserId() || resolveEnvUserId();
}

export const APP_USER = Object.freeze({
  get id() {
    return getCurrentUserId();
  },
});
