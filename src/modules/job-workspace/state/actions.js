export const JOB_DIRECT_ACTION_TYPES = {
  SET_JOB_UID: "jobDirect/setJobUid",
  HYDRATE_BOOTSTRAP: "jobDirect/hydrateBootstrap",
  PATCH_JOB_ENTITY: "jobDirect/patchJobEntity",
  REPLACE_ENTITY_COLLECTION: "jobDirect/replaceEntityCollection",
  UPSERT_ENTITY_RECORD: "jobDirect/upsertEntityRecord",
  REPLACE_RELATION_COLLECTION: "jobDirect/replaceRelationCollection",
  SET_DRAFT: "jobDirect/setDraft",
  MERGE_DRAFT: "jobDirect/mergeDraft",
  MARK_DRAFT_DIRTY: "jobDirect/markDraftDirty",
  MARK_DRAFT_CLEAN: "jobDirect/markDraftClean",
  SET_SYNC_STATE: "jobDirect/setSyncState",
  SET_SYNC_ERROR: "jobDirect/setSyncError",
  CLEAR_SYNC_ERROR: "jobDirect/clearSyncError",
};

export function setJobUid(jobUid) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.SET_JOB_UID,
    payload: { jobUid: jobUid || null },
  };
}

export function hydrateBootstrapState({ jobUid = null, jobData = null, lookupData = null } = {}) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.HYDRATE_BOOTSTRAP,
    payload: { jobUid, jobData, lookupData },
  };
}

export function patchJobEntity(patch) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.PATCH_JOB_ENTITY,
    payload: { patch: patch || {} },
  };
}

export function replaceEntityCollection(entityKey, records = []) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.REPLACE_ENTITY_COLLECTION,
    payload: { entityKey, records },
  };
}

export function upsertEntityRecord(entityKey, record, { idField = "id" } = {}) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.UPSERT_ENTITY_RECORD,
    payload: { entityKey, record, idField },
  };
}

export function replaceRelationCollection(relationKey, relationId, records = []) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.REPLACE_RELATION_COLLECTION,
    payload: { relationKey, relationId, records },
  };
}

export function setDraft(draftKey, value) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.SET_DRAFT,
    payload: { draftKey, value },
  };
}

export function mergeDraft(draftKey, patch) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.MERGE_DRAFT,
    payload: { draftKey, patch: patch || {} },
  };
}

export function markDraftDirty(draftKey) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.MARK_DRAFT_DIRTY,
    payload: { draftKey },
  };
}

export function markDraftClean(draftKey) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.MARK_DRAFT_CLEAN,
    payload: { draftKey },
  };
}

export function setSyncState({
  status = "idle",
  message = "",
  mutationType = null,
  timestamp = Date.now(),
} = {}) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.SET_SYNC_STATE,
    payload: { status, message, mutationType, timestamp },
  };
}

export function setSyncError(error, { timestamp = Date.now() } = {}) {
  return {
    type: JOB_DIRECT_ACTION_TYPES.SET_SYNC_ERROR,
    payload: {
      error: error || null,
      timestamp,
    },
  };
}

export function clearSyncError() {
  return {
    type: JOB_DIRECT_ACTION_TYPES.CLEAR_SYNC_ERROR,
  };
}

export function bindJobDirectActions(dispatch) {
  return {
    setJobUid: (jobUid) => dispatch(setJobUid(jobUid)),
    hydrateBootstrap: (payload) => dispatch(hydrateBootstrapState(payload)),
    patchJobEntity: (patch) => dispatch(patchJobEntity(patch)),
    replaceEntityCollection: (entityKey, records) =>
      dispatch(replaceEntityCollection(entityKey, records)),
    upsertEntityRecord: (entityKey, record, options) =>
      dispatch(upsertEntityRecord(entityKey, record, options)),
    replaceRelationCollection: (relationKey, relationId, records) =>
      dispatch(replaceRelationCollection(relationKey, relationId, records)),
    setDraft: (draftKey, value) => dispatch(setDraft(draftKey, value)),
    mergeDraft: (draftKey, patch) => dispatch(mergeDraft(draftKey, patch)),
    markDraftDirty: (draftKey) => dispatch(markDraftDirty(draftKey)),
    markDraftClean: (draftKey) => dispatch(markDraftClean(draftKey)),
    setSyncState: (syncState) => dispatch(setSyncState(syncState)),
    setSyncError: (error, options) => dispatch(setSyncError(error, options)),
    clearSyncError: () => dispatch(clearSyncError()),
  };
}
