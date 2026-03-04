import { JOB_DIRECT_ACTION_TYPES } from "./actions.js";
import { createJobDirectInitialState, normalizeLookupData } from "./initialState.js";

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeId(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  return raw;
}

const NORMALIZED_ENTITY_KEYS = new Set([
  "activities",
  "materials",
  "tasks",
  "appointments",
  "jobUploads",
]);

function isNormalizedEntityKey(entityKey) {
  return NORMALIZED_ENTITY_KEYS.has(String(entityKey || ""));
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNormalizedCollection(value) {
  return (
    isObject(value) &&
    Array.isArray(value.ids) &&
    isObject(value.byId)
  );
}

function resolveRecordId(record, idField = "id") {
  if (!isObject(record)) return "";
  return normalizeId(
    record?.[idField] ??
      record?.id ??
      record?.ID
  );
}

function createNormalizedCollection(records = [], { idField = "id" } = {}) {
  const ids = [];
  const byId = {};
  toArray(records).forEach((record) => {
    if (!isObject(record)) return;
    const recordId = resolveRecordId(record, idField);
    if (!recordId) return;
    if (!Object.prototype.hasOwnProperty.call(byId, recordId)) {
      ids.push(recordId);
    }
    byId[recordId] = record;
  });
  return { ids, byId };
}

function ensureNormalizedCollection(value, { idField = "id" } = {}) {
  if (isNormalizedCollection(value)) return value;
  return createNormalizedCollection(value, { idField });
}

function shallowEqualRecord(a, b) {
  if (Object.is(a, b)) return true;
  if (!isObject(a) || !isObject(b)) return false;
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  for (const key of aKeys) {
    if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

function areNormalizedCollectionsEqual(a, b) {
  if (Object.is(a, b)) return true;
  if (!isNormalizedCollection(a) || !isNormalizedCollection(b)) return false;
  if (a.ids.length !== b.ids.length) return false;
  for (let index = 0; index < a.ids.length; index += 1) {
    const id = a.ids[index];
    if (id !== b.ids[index]) return false;
    if (!shallowEqualRecord(a.byId[id], b.byId[id])) return false;
  }
  return true;
}

function areRecordArraysEqual(current, next) {
  const left = toArray(current);
  const right = toArray(next);
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (!shallowEqualRecord(left[index], right[index])) return false;
  }
  return true;
}

function createSyntheticId(record) {
  const raw = JSON.stringify(record || {});
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash << 5) - hash + raw.charCodeAt(index);
    hash |= 0;
  }
  const normalized = Math.abs(hash || 1);
  return `__temp_${normalized}`;
}

export function jobDirectReducer(state, action) {
  switch (action.type) {
    case JOB_DIRECT_ACTION_TYPES.SET_JOB_UID: {
      const nextJobUid = action.payload?.jobUid || null;
      if (state.jobUid === nextJobUid) return state;
      return {
        ...state,
        jobUid: nextJobUid,
      };
    }

    case JOB_DIRECT_ACTION_TYPES.HYDRATE_BOOTSTRAP: {
      const payload = action.payload || {};
      const normalizedLookupData = normalizeLookupData(payload.lookupData);
      const hasActivities = Array.isArray(payload?.jobData?.activities);
      const hasMaterials = Array.isArray(payload?.jobData?.materials);

      return {
        ...state,
        jobUid: payload.jobUid || state.jobUid,
        entities: {
          ...state.entities,
          job: payload.jobData || state.entities.job,
          contacts: normalizedLookupData.contacts,
          companies: normalizedLookupData.companies,
          properties: normalizedLookupData.properties,
          serviceProviders: normalizedLookupData.serviceProviders,
          activities: hasActivities
            ? createNormalizedCollection(payload?.jobData?.activities, { idField: "id" })
            : state.entities.activities,
          materials: hasMaterials
            ? createNormalizedCollection(payload?.jobData?.materials, { idField: "id" })
            : state.entities.materials,
        },
        meta: {
          ...state.meta,
          hydrated: Boolean(payload.jobData),
          hydratedAt: Date.now(),
          lastSource: "bootstrap",
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.PATCH_JOB_ENTITY: {
      const patch = action.payload?.patch || {};
      return {
        ...state,
        entities: {
          ...state.entities,
          job: {
            ...(state.entities.job || {}),
            ...patch,
          },
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.REPLACE_ENTITY_COLLECTION: {
      const entityKey = action.payload?.entityKey;
      if (!entityKey || !(entityKey in state.entities)) return state;
      const isNormalized = isNormalizedEntityKey(entityKey);
      if (isNormalized) {
        const currentCollection = ensureNormalizedCollection(state.entities[entityKey], {
          idField: "id",
        });
        const nextCollection = createNormalizedCollection(action.payload?.records, {
          idField: "id",
        });
        if (areNormalizedCollectionsEqual(currentCollection, nextCollection)) {
          return state;
        }
        return {
          ...state,
          entities: {
            ...state.entities,
            [entityKey]: nextCollection,
          },
        };
      }
      const nextRecords = toArray(action.payload?.records);
      if (areRecordArraysEqual(state.entities[entityKey], nextRecords)) return state;
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityKey]: nextRecords,
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.UPSERT_ENTITY_RECORD: {
      const entityKey = action.payload?.entityKey;
      if (!entityKey || !(entityKey in state.entities)) return state;
      const record = action.payload?.record;
      if (!record || typeof record !== "object") return state;

      const idField = String(action.payload?.idField || "id");
      const isNormalized = isNormalizedEntityKey(entityKey);
      if (isNormalized) {
        const currentCollection = ensureNormalizedCollection(state.entities[entityKey], {
          idField,
        });
        const nextId = resolveRecordId(record, idField) || createSyntheticId(record);
        const existingRecord = currentCollection.byId[nextId] || null;
        const mergedRecord = existingRecord
          ? { ...existingRecord, ...record }
          : record;
        if (existingRecord && shallowEqualRecord(existingRecord, mergedRecord)) {
          return state;
        }
        const nextById = {
          ...currentCollection.byId,
          [nextId]: mergedRecord,
        };
        const hasId = currentCollection.ids.includes(nextId);
        const nextIds = hasId ? currentCollection.ids : [...currentCollection.ids, nextId];
        return {
          ...state,
          entities: {
            ...state.entities,
            [entityKey]: {
              ids: nextIds,
              byId: nextById,
            },
          },
        };
      }

      const nextId = normalizeId(record[idField]);
      if (!nextId) {
        return {
          ...state,
          entities: {
            ...state.entities,
            [entityKey]: [...toArray(state.entities[entityKey]), record],
          },
        };
      }

      const currentCollection = toArray(state.entities[entityKey]);
      const currentIndex = currentCollection.findIndex(
        (item) => normalizeId(item?.[idField]) === nextId
      );

      if (currentIndex === -1) {
        return {
          ...state,
          entities: {
            ...state.entities,
            [entityKey]: [...currentCollection, record],
          },
        };
      }

      const nextCollection = [...currentCollection];
      nextCollection[currentIndex] = {
        ...currentCollection[currentIndex],
        ...record,
      };
      return {
        ...state,
        entities: {
          ...state.entities,
          [entityKey]: nextCollection,
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.REPLACE_RELATION_COLLECTION: {
      const relationKey = action.payload?.relationKey;
      const relationId = normalizeId(action.payload?.relationId);
      const relations = state.relations || {};
      if (!relationKey || !(relationKey in relations) || !relationId) return state;
      const currentRecords = relations?.[relationKey]?.[relationId] || [];
      const nextRecords = toArray(action.payload?.records);
      if (areRecordArraysEqual(currentRecords, nextRecords)) return state;

      return {
        ...state,
        relations: {
          ...relations,
          [relationKey]: {
            ...(relations?.[relationKey] || {}),
            [relationId]: nextRecords,
          },
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.SET_DRAFT: {
      const draftKey = action.payload?.draftKey;
      if (!draftKey || !(draftKey in state.drafts)) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draftKey]: action.payload?.value,
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.MERGE_DRAFT: {
      const draftKey = action.payload?.draftKey;
      if (!draftKey || !(draftKey in state.drafts)) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draftKey]: {
            ...(state.drafts[draftKey] || {}),
            ...(action.payload?.patch || {}),
          },
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.MARK_DRAFT_DIRTY: {
      const draftKey = action.payload?.draftKey;
      if (!draftKey || !(draftKey in state.drafts)) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draftKey]: {
            ...(state.drafts[draftKey] || {}),
            dirty: true,
          },
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.MARK_DRAFT_CLEAN: {
      const draftKey = action.payload?.draftKey;
      if (!draftKey || !(draftKey in state.drafts)) return state;
      return {
        ...state,
        drafts: {
          ...state.drafts,
          [draftKey]: {
            ...(state.drafts[draftKey] || {}),
            dirty: false,
          },
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.SET_SYNC_STATE: {
      const payload = action.payload || {};
      return {
        ...state,
        sync: {
          ...state.sync,
          status: payload.status || "idle",
          message: payload.message || "",
          lastMutationAt: payload.timestamp || Date.now(),
          lastMutationType: payload.mutationType || null,
          lastError: null,
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.SET_SYNC_ERROR: {
      const payload = action.payload || {};
      return {
        ...state,
        sync: {
          ...state.sync,
          status: "error",
          lastMutationAt: payload.timestamp || Date.now(),
          lastError: payload.error || null,
        },
      };
    }

    case JOB_DIRECT_ACTION_TYPES.CLEAR_SYNC_ERROR: {
      return {
        ...state,
        sync: {
          ...state.sync,
          lastError: null,
          status: state.sync.status === "error" ? "idle" : state.sync.status,
        },
      };
    }

    default:
      return state;
  }
}

export function createJobDirectReducerInitialState(jobUid = null) {
  return createJobDirectInitialState({ jobUid });
}
