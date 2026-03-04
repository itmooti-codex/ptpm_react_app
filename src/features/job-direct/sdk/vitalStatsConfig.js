function toConfigValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

export const VITAL_STATS_CONFIG = Object.freeze({
  slug: toConfigValue(import.meta.env.VITE_VITALSTATS_SLUG),
  apiKey: toConfigValue(import.meta.env.VITE_VITALSTATS_API_KEY),
});
