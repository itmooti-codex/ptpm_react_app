const CORE_PEST_TERMS = [
  "pest",
  "rodent",
  "termite",
  "cockroach",
  "ant",
  "spider",
  "wasp",
  "bee",
  "flea",
];

const WILDLIFE_TERMS = [
  "bird",
  "pigeon",
  "possum",
  "turkey",
  "dead animal",
  "wildlife",
];

const CONTROL_ACTION_TERMS = ["control", "removal", "relocation", "treatment", "proofing"];

const EXPLICIT_PEST_PATTERNS = [
  /\bbird\s+proofing\b/,
  /\bpigeon\s+control\b/,
  /\bsolar\s+panel\s+bird\s+proofing\b/,
  /\bdead\s+animal\s+removal\b/,
];

function normalizeServiceLabel(value = "") {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ");
}

export function isPestServiceFlow(serviceLabel = "") {
  const normalized = normalizeServiceLabel(serviceLabel);
  if (!normalized) return false;

  if (EXPLICIT_PEST_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return true;
  }

  if (CORE_PEST_TERMS.some((term) => normalized.includes(term))) {
    return true;
  }

  const hasWildlifeTerm = WILDLIFE_TERMS.some((term) => normalized.includes(term));
  const hasControlAction = CONTROL_ACTION_TERMS.some((term) => normalized.includes(term));
  return hasWildlifeTerm && hasControlAction;
}
