const EMPTY_ARRAY = Object.freeze([]);

export const selectJobDirectState = (state) => state;
export const selectJobUid = (state) => state?.jobUid || null;
export const selectEntities = (state) => state?.entities || {};
export const selectRelations = (state) => state?.relations || {};
export const selectDrafts = (state) => state?.drafts || {};
export const selectSync = (state) => state?.sync || {};

const denormalizedCache = new WeakMap();

function denormalizeCollection(value) {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  const ids = Array.isArray(value.ids) ? value.ids : [];
  const byId = value.byId && typeof value.byId === "object" ? value.byId : null;
  if (!byId) return [];
  const cached = denormalizedCache.get(value);
  if (cached) return cached;
  const records = ids.map((id) => byId[id]).filter(Boolean);
  denormalizedCache.set(value, records);
  return records;
}

export const selectJobEntity = (state) => state?.entities?.job || null;
export const selectContacts = (state) => state?.entities?.contacts || [];
export const selectCompanies = (state) => state?.entities?.companies || [];
export const selectProperties = (state) => state?.entities?.properties || [];
export const selectServiceProviders = (state) =>
  state?.entities?.serviceProviders || [];
export const selectActivities = (state) => denormalizeCollection(state?.entities?.activities);
export const selectMaterials = (state) => denormalizeCollection(state?.entities?.materials);
export const selectTasks = (state) => denormalizeCollection(state?.entities?.tasks);
export const selectAppointments = (state) => denormalizeCollection(state?.entities?.appointments);
export const selectJobUploads = (state) => denormalizeCollection(state?.entities?.jobUploads);

export const selectLinkedInquiriesByAccountKey = (state, key) =>
  state?.relations?.linkedInquiriesByAccount?.[String(key || "").trim()] ?? EMPTY_ARRAY;

export const selectLinkedPropertiesByAccountKey = (state, key) =>
  state?.relations?.linkedPropertiesByAccount?.[String(key || "").trim()] ?? EMPTY_ARRAY;

export const selectPropertyAffiliationsByPropertyKey = (state, key) =>
  state?.relations?.propertyAffiliationsByProperty?.[String(key || "").trim()] ?? EMPTY_ARRAY;

export const selectPropertyUploadsByPropertyKey = (state, key) =>
  state?.relations?.propertyUploadsByProperty?.[String(key || "").trim()] ?? EMPTY_ARRAY;

export const selectOverviewDraft = (state) => state?.drafts?.overview || {};
export const selectInvoiceDraft = (state) => state?.drafts?.invoice || {};
export const selectBillDraft = (state) => state?.drafts?.bill || {};

export const selectHasDraftChanges = (state) =>
  Object.values(state?.drafts || {}).some((draft) => Boolean(draft?.dirty));
