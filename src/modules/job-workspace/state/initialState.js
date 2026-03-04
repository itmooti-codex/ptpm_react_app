const JOB_DIRECT_STATE_VERSION = 2;

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function createNormalizedCollection(records = []) {
  const list = toArray(records);
  const ids = [];
  const byId = {};
  list.forEach((record) => {
    const id = String(record?.id ?? record?.ID ?? "").trim();
    if (!id) return;
    if (!Object.prototype.hasOwnProperty.call(byId, id)) {
      ids.push(id);
    }
    byId[id] = record;
  });
  return { ids, byId };
}

export function createJobDirectInitialState({ jobUid = null } = {}) {
  return {
    version: JOB_DIRECT_STATE_VERSION,
    jobUid: jobUid || null,
    entities: {
      job: null,
      contacts: [],
      companies: [],
      properties: [],
      serviceProviders: [],
      activities: createNormalizedCollection(),
      materials: createNormalizedCollection(),
      tasks: createNormalizedCollection(),
      appointments: createNormalizedCollection(),
      inquiries: [],
      jobUploads: createNormalizedCollection(),
    },
    relations: {
      linkedInquiriesByAccount: {},
      linkedPropertiesByAccount: {},
      propertyAffiliationsByProperty: {},
      propertyUploadsByProperty: {},
    },
    drafts: {
      overview: {},
      invoice: {
        selectedActivityIds: [],
        invoiceDate: null,
        dueDate: null,
        dirty: false,
      },
      bill: {
        billDate: null,
        billDueDate: null,
        dirty: false,
      },
      activities: {
        dirty: false,
      },
      materials: {
        dirty: false,
      },
      tasks: {
        dirty: false,
      },
    },
    sync: {
      status: "idle",
      message: "",
      lastMutationAt: null,
      lastMutationType: null,
      lastError: null,
    },
    meta: {
      hydrated: false,
      hydratedAt: null,
      lastSource: "init",
    },
  };
}

export function normalizeLookupData(lookupData) {
  return {
    contacts: toArray(lookupData?.contacts),
    companies: toArray(lookupData?.companies),
    properties: toArray(lookupData?.properties),
    serviceProviders: toArray(lookupData?.serviceProviders),
  };
}
