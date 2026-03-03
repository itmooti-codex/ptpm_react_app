function toText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      subscription = result.subscribe({
        next: (value) => {
          if (settled) return;
          settled = true;
          resolve(value);
          subscription?.unsubscribe?.();
        },
        error: (error) => {
          if (settled) return;
          settled = true;
          reject(error);
        },
      });
    });
    promise.cancel = () => subscription?.unsubscribe?.();
    return promise;
  }
  return Promise.resolve(result);
}

function extractRows(payload) {
  if (!payload) return [];
  if (Array.isArray(payload?.resp)) return payload.resp;
  if (Array.isArray(payload?.data)) return payload.data;
  if (payload?.data && typeof payload.data === "object") {
    const firstArray = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const firstArray = Object.values(payload.payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray)) return firstArray;
  }
  return [];
}

function readField(record, keys = []) {
  if (!record) return "";
  for (const key of keys) {
    if (record[key] != null) return record[key];
    if (record?.data?.[key] != null) return record.data[key];
    if (record?._data?.[key] != null) return record._data[key];
  }
  return "";
}

function firstRecord(payload) {
  const rows = extractRows(payload);
  return Array.isArray(rows) && rows.length ? rows[0] : null;
}

async function fetchJobContextById(plugin, jobId) {
  const normalizedId = normalizeId(jobId);
  if (!normalizedId || !plugin?.switchTo) return null;

  try {
    const query = plugin
      .switchTo("PeterpmJob")
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id", "unique_id", "primary_service_provider_id", "inquiry_record_id"])
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const row = firstRecord(result);
    if (!row) return null;

    return {
      id: toText(readField(row, ["id", "ID"])),
      uniqueId: toText(readField(row, ["unique_id", "Unique_ID"])),
      serviceProviderId: toText(
        readField(row, ["primary_service_provider_id", "Primary_Service_Provider_ID"])
      ),
      inquiryId: toText(readField(row, ["inquiry_record_id", "Inquiry_Record_ID"])),
    };
  } catch {
    return null;
  }
}

async function fetchInquiryContextById(plugin, inquiryId) {
  const normalizedId = normalizeId(inquiryId);
  if (!normalizedId || !plugin?.switchTo) return null;

  try {
    const query = plugin
      .switchTo("PeterpmDeal")
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select([
        "id",
        "unique_id",
        "service_provider_id",
        "quote_record_id",
        "inquiry_for_job_id",
      ])
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const row = firstRecord(result);
    if (!row) return null;

    return {
      id: toText(readField(row, ["id", "ID"])),
      uniqueId: toText(readField(row, ["unique_id", "Unique_ID"])),
      serviceProviderId: toText(readField(row, ["service_provider_id", "Service_Provider_ID"])),
      quoteJobId: toText(readField(row, ["quote_record_id", "Quote_Record_ID", "Quote_record_ID"])),
      inquiryForJobId: toText(
        readField(row, ["inquiry_for_job_id", "Inquiry_For_Job_ID", "Inquiry_for_Job_ID"])
      ),
    };
  } catch {
    return null;
  }
}

async function fetchServiceProviderContactIdByProviderId(plugin, serviceProviderId) {
  const normalizedId = normalizeId(serviceProviderId);
  if (!normalizedId || !plugin?.switchTo) return "";

  try {
    const query = plugin.switchTo("PeterpmServiceProvider").query().fromGraphql(`
      query calcServiceProviders($id: PeterpmServiceProviderID!) {
        calcServiceProviders(query: [{ where: { id: $id } }]) {
          Contact_Information_ID: field(arg: ["contact_information_id"])
        }
      }
    `);
    const result = await toPromiseLike(query.fetchDirect({ variables: { id: normalizedId } }));
    const row = firstRecord(result);
    const contactId = toText(readField(row, ["contact_information_id", "Contact_Information_ID"]));
    if (contactId) return contactId;
  } catch {
    // fallback below
  }

  try {
    const fallback = plugin
      .switchTo("PeterpmServiceProvider")
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id", "contact_information_id"])
      .include("Contact_Information", (contactQuery) => contactQuery.deSelectAll().select(["id"]))
      .limit(1)
      .noDestroy();
    fallback.getOrInitQueryCalc?.();
    const result = await toPromiseLike(fallback.fetchDirect());
    const row = firstRecord(result);

    return toText(
      readField(row, [
        "contact_information_id",
        "Contact_Information_ID",
        "Contact_Information.id",
      ]) || row?.Contact_Information?.id || row?.Contact_Information?.ID
    );
  } catch {
    return "";
  }
}

export async function resolveAnnouncementRecipientContext({
  plugin,
  serviceProviderId = "",
  jobId = "",
  inquiryId = "",
  quoteJobId = "",
} = {}) {
  if (!plugin?.switchTo) {
    return {
      notifiedContactId: "",
      serviceProviderId: "",
      jobId: "",
      inquiryId: "",
      jobUid: "",
      inquiryUid: "",
    };
  }

  let resolvedJobId = toText(quoteJobId || jobId);
  let resolvedInquiryId = toText(inquiryId);
  let resolvedProviderId = toText(serviceProviderId);
  let jobUid = "";
  let inquiryUid = "";

  if (resolvedJobId) {
    const jobContext = await fetchJobContextById(plugin, resolvedJobId);
    if (jobContext) {
      resolvedJobId = toText(jobContext.id || resolvedJobId);
      jobUid = toText(jobContext.uniqueId);
      if (!resolvedProviderId) resolvedProviderId = toText(jobContext.serviceProviderId);
      if (!resolvedInquiryId) resolvedInquiryId = toText(jobContext.inquiryId);
    }
  }

  if (resolvedInquiryId) {
    const inquiryContext = await fetchInquiryContextById(plugin, resolvedInquiryId);
    if (inquiryContext) {
      resolvedInquiryId = toText(inquiryContext.id || resolvedInquiryId);
      inquiryUid = toText(inquiryContext.uniqueId);
      if (!resolvedProviderId) resolvedProviderId = toText(inquiryContext.serviceProviderId);
      if (!resolvedJobId) {
        resolvedJobId = toText(inquiryContext.quoteJobId || inquiryContext.inquiryForJobId);
      }
    }
  }

  if (!jobUid && resolvedJobId) {
    const jobContext = await fetchJobContextById(plugin, resolvedJobId);
    if (jobContext) {
      jobUid = toText(jobContext.uniqueId);
      if (!resolvedInquiryId) resolvedInquiryId = toText(jobContext.inquiryId);
      if (!resolvedProviderId) resolvedProviderId = toText(jobContext.serviceProviderId);
    }
  }

  if (!inquiryUid && resolvedInquiryId) {
    const inquiryContext = await fetchInquiryContextById(plugin, resolvedInquiryId);
    if (inquiryContext) {
      inquiryUid = toText(inquiryContext.uniqueId);
      if (!resolvedProviderId) resolvedProviderId = toText(inquiryContext.serviceProviderId);
    }
  }

  const notifiedContactId = await fetchServiceProviderContactIdByProviderId(plugin, resolvedProviderId);

  return {
    notifiedContactId: toText(notifiedContactId),
    serviceProviderId: toText(resolvedProviderId),
    jobId: toText(resolvedJobId),
    inquiryId: toText(resolvedInquiryId),
    jobUid: toText(jobUid),
    inquiryUid: toText(inquiryUid),
  };
}
