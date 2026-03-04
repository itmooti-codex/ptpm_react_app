import {
  extractFromPayload,
  fetchDirectWithTimeout,
} from "../../dashboard/sdk/dashboardCore.js";
import {
  createJobUploadFromFile,
  createPropertyRecord,
  createTaskRecord,
  deleteUploadRecord,
  fetchJobUploads,
  fetchPropertyAffiliationsByPropertyId,
  fetchTasksByDealId,
  fetchTasksByJobId,
  updatePropertyRecord,
  updateTaskRecord,
} from "@modules/job-workspace/sdk/core/runtime.js";
import {
  extractCancellationMessage,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/job-workspace/sdk/utils/sdkResponseUtils.js";

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeStatus(value) {
  return toText(value).toLowerCase();
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return "";
  if (text === "-" || text === "—") return "";
  return text;
}

function firstRecord(payload) {
  const rows = extractFromPayload(payload);
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows[0] || null;
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

function extractRowsFromPayload(payload, expectedKey = "") {
  if (!payload) return [];

  if (
    expectedKey &&
    Array.isArray(payload?.payload?.data?.[expectedKey])
  ) {
    return payload.payload.data[expectedKey];
  }
  if (expectedKey && Array.isArray(payload?.data?.[expectedKey])) {
    return payload.data[expectedKey];
  }

  const direct = extractFromPayload(payload);
  if (Array.isArray(direct) && direct.length) return direct;

  const candidates = [];
  if (Array.isArray(payload?.resp)) candidates.push(payload.resp);
  if (Array.isArray(payload?.data)) candidates.push(payload.data);
  if (payload?.data && typeof payload.data === "object") {
    for (const value of Object.values(payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    for (const value of Object.values(payload.payload.data)) {
      if (Array.isArray(value)) candidates.push(value);
    }
  }
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length) return candidate;
  }
  return [];
}

function extractCreatedRecordId(result, modelKey) {
  const managed = result?.mutations?.[modelKey]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || "";
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }

  const objects = normalizeObjectList(result);
  for (const item of objects) {
    const pkMap = item?.extensions?.pkMap || item?.pkMap;
    if (!pkMap || typeof pkMap !== "object") continue;
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  return "";
}

function mapInquiryRecord(raw = null) {
  if (!raw || typeof raw !== "object") return null;
  return {
    ...raw,
    id: normalizeId(raw.id || raw.ID),
    unique_id: toText(raw.unique_id || raw.Unique_ID),
    inquiry_status: toText(raw.inquiry_status || raw.Inquiry_Status),
    account_type: toText(raw.account_type || raw.Account_Type),
    inquiry_source: toText(raw.inquiry_source || raw.Inquiry_Source),
    type: toText(raw.type || raw.Type),
    how_did_you_hear: toText(raw.how_did_you_hear || raw.How_did_you_hear),
    how_can_we_help: toText(raw.how_can_we_help || raw.How_can_we_help),
    other: toText(raw.other || raw.Other),
    admin_notes: toText(raw.admin_notes || raw.Admin_Notes),
    client_notes: toText(raw.client_notes || raw.Client_Notes),
    deal_name: toText(raw.deal_name || raw.Deal_Name),
    deal_value: toText(raw.deal_value || raw.Deal_Value),
    service_provider_id: normalizeId(raw.service_provider_id || raw.Service_Provider_ID),
    quote_record_id: normalizeId(
      raw.quote_record_id || raw.Quote_Record_ID || raw.Quote_record_ID
    ),
    inquiry_for_job_id: normalizeId(
      raw.inquiry_for_job_id || raw.Inquiry_For_Job_ID || raw.Inquiry_for_Job_ID
    ),
    property_id: normalizeId(raw.property_id || raw.Property_ID),
  };
}

function mapJobRecord(raw = null) {
  if (!raw || typeof raw !== "object") return null;
  const accountsContact = raw?.Accounts_Contact?.Contact || {};
  return {
    ...raw,
    id: normalizeId(raw.id || raw.ID),
    unique_id: toText(raw.unique_id || raw.Unique_ID),
    inquiry_record_id: normalizeId(raw.inquiry_record_id || raw.Inquiry_Record_ID),
    primary_service_provider_id: normalizeId(
      raw.primary_service_provider_id ||
        raw.Primary_Service_Provider_ID ||
        raw?.Primary_Service_Provider?.id ||
        raw?.Primary_Service_Provider?.ID
    ),
    client_individual_id: normalizeId(raw.client_individual_id || raw.Client_Individual_ID),
    client_entity_id: normalizeId(raw.client_entity_id || raw.Client_Entity_ID),
    accounts_contact_id: normalizeId(raw.accounts_contact_id || raw.Accounts_Contact_ID),
    property_id: normalizeId(raw.property_id || raw.Property_ID),
    job_status: toText(raw.job_status || raw.Job_Status),
    quote_status: toText(raw.quote_status || raw.Quote_Status),
    quote_date: toText(raw.quote_date || raw.Quote_Date),
    date_quote_sent: toText(raw.date_quote_sent || raw.Date_Quote_Sent),
    date_quoted_accepted: toText(raw.date_quoted_accepted || raw.Date_Quoted_Accepted),
    payment_status: toText(raw.payment_status || raw.Payment_Status),
    invoice_number: toText(raw.invoice_number || raw.Invoice_Number),
    invoice_total: toText(raw.invoice_total || raw.Invoice_Total),
    xero_invoice_status: toText(raw.xero_invoice_status || raw.Xero_Invoice_Status),
    xero_bill_status: toText(raw.xero_bill_status || raw.Xero_Bill_Status),
    accounts_contact_contact_id: normalizeId(
      raw?.accounts_contact_contact_id ||
        raw?.Accounts_Contact_Contact_ID ||
        accountsContact?.id ||
        accountsContact?.ID
    ),
    accounts_contact_contact_first_name: toText(
      raw?.accounts_contact_contact_first_name ||
        raw?.Accounts_Contact_Contact_First_Name ||
        accountsContact?.first_name ||
        accountsContact?.First_Name
    ),
    accounts_contact_contact_last_name: toText(
      raw?.accounts_contact_contact_last_name ||
        raw?.Accounts_Contact_Contact_Last_Name ||
        accountsContact?.last_name ||
        accountsContact?.Last_Name
    ),
    accounts_contact_contact_email: toText(
      raw?.accounts_contact_contact_email ||
        raw?.Accounts_Contact_Contact_Email ||
        accountsContact?.email ||
        accountsContact?.Email
    ),
    bill_approved_admin:
      raw.bill_approved_admin === true ||
      toText(raw.bill_approved_admin || raw.Bill_Approved_Admin).toLowerCase() === "true",
  };
}

function buildInquiryBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmDeal")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_status",
      "created_at",
      "property_id",
      "account_type",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "how_can_we_help",
      "other",
      "admin_notes",
      "client_notes",
      "deal_name",
      "deal_value",
      "service_provider_id",
      "quote_record_id",
      "inquiry_for_job_id",
    ])
    .include("Primary_Contact", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "address",
          "city",
          "state",
          "zip_code",
          "popup_comment",
        ])
    )
    .include("Company", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "name",
          "type",
          "description",
          "phone",
          "address",
          "city",
          "state",
          "postal_code",
          "industry",
          "annual_revenue",
          "number_of_employees",
          "account_type",
          "popup_comment",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number"])
        )
        .include("Body_Corporate_Company", (bodyCorpQuery) =>
          bodyCorpQuery
            .deSelectAll()
            .select([
              "id",
              "name",
              "type",
              "description",
              "phone",
              "address",
              "city",
              "state",
              "postal_code",
              "industry",
              "annual_revenue",
              "number_of_employees",
            ])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "suburb_town",
          "state",
          "postal_code",
          "country",
          "property_type",
          "building_type",
          "building_type_other",
          "foundation_type",
          "bedrooms",
          "manhole",
          "stories",
          "building_age",
          "building_features",
          "building_features_options_as_text",
        ])
        .include("Building_Features", (featureQuery) =>
          featureQuery.deSelectAll().select(["id"])
        )
    )
    .include("Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name", "email"])
        )
    );
}

function buildJobBaseQuery(plugin) {
  return plugin
    .switchTo("PeterpmJob")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "inquiry_record_id",
      "primary_service_provider_id",
      "client_individual_id",
      "client_entity_id",
      "accounts_contact_id",
      "property_id",
      "job_status",
      "quote_status",
      "quote_date",
      "date_quote_sent",
      "date_quoted_accepted",
      "payment_status",
      "created_at",
      "date_started",
      "date_booked",
      "date_job_required_by",
      "account_type",
      "invoice_number",
      "invoice_total",
      "invoice_date",
      "due_date",
      "xero_invoice_status",
      "xero_bill_status",
      "bill_date",
      "bill_due_date",
      "bill_approved_admin",
    ])
    .include("Client_Individual", (sq) =>
      sq.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number", "xero_contact_id"])
    )
    .include("Client_Entity", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "name", "phone", "account_type", "xero_contact_id"])
        .include("Primary_Person", (personQuery) =>
          personQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
        )
    )
    .include("Property", (sq) =>
      sq
        .deSelectAll()
        .select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "suburb_town",
          "state",
          "postal_code",
          "country",
          "property_type",
          "building_type",
          "building_type_other",
          "foundation_type",
          "bedrooms",
          "manhole",
          "stories",
          "building_age",
          "building_features",
          "building_features_options_as_text",
        ])
        .include("Building_Features", (featureQuery) =>
          featureQuery.deSelectAll().select(["id"])
        )
    )
    .include("Primary_Service_Provider", (sq) =>
      sq
        .deSelectAll()
        .select(["id", "job_rate_percentage"])
        .include("Contact_Information", (sq2) =>
          sq2.deSelectAll().select(["first_name", "last_name", "email"])
        )
    )
    .include("Accounts_Contact", (sq) =>
      sq
        .deSelectAll()
        .select(["id"])
        .include("Contact", (sq2) =>
          sq2.deSelectAll().select(["id", "first_name", "last_name", "email"])
        )
    )
    .include("Inquiry_Record", (sq) =>
      sq.deSelectAll().select(["id", "unique_id", "inquiry_status", "deal_name", "inquiry_source"])
    );
}

export async function fetchInquiryByUid({ plugin, uid } = {}) {
  if (!plugin?.switchTo) return null;
  const uniqueId = toText(uid);
  if (!uniqueId) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where("unique_id", uniqueId).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchInquiryByUid failed", error);
    return null;
  }
}

export async function fetchJobByUid({ plugin, uid } = {}) {
  if (!plugin?.switchTo) return null;
  const uniqueId = toText(uid);
  if (!uniqueId) return null;
  try {
    const query = buildJobBaseQuery(plugin).where("unique_id", uniqueId).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchJobByUid failed", error);
    return null;
  }
}

async function fetchInquiryById({ plugin, inquiryId } = {}) {
  const id = normalizeId(inquiryId);
  if (!id) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where("id", id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchInquiryById failed", error);
    return null;
  }
}

async function fetchJobById({ plugin, jobId } = {}) {
  const id = normalizeId(jobId);
  if (!id) return null;
  try {
    const query = buildJobBaseQuery(plugin).where("id", id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchJobById failed", error);
    return null;
  }
}

async function fetchDealByJobLinkField({ plugin, field, jobId } = {}) {
  const id = normalizeId(jobId);
  if (!id) return null;
  try {
    const query = buildInquiryBaseQuery(plugin).where(field, id).limit(1).noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 15000);
    return mapInquiryRecord(firstRecord(payload));
  } catch (error) {
    return null;
  }
}

export async function fetchLinkedJobForInquiry({ plugin, inquiry } = {}) {
  if (!plugin?.switchTo || !inquiry) return null;
  const directJobId =
    normalizeId(inquiry.quote_record_id) || normalizeId(inquiry.inquiry_for_job_id);
  if (directJobId) {
    const directJob = await fetchJobById({ plugin, jobId: directJobId });
    if (directJob) return directJob;
  }

  const inquiryId = normalizeId(inquiry.id);
  if (!inquiryId) return null;

  try {
    const query = buildJobBaseQuery(plugin)
      .where("inquiry_record_id", inquiryId)
      .orderBy("created_at", "desc")
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    return mapJobRecord(firstRecord(payload));
  } catch (error) {
    console.error("[jobDetailsSdk] fetchLinkedJobForInquiry failed", error);
    return null;
  }
}

export async function fetchLinkedInquiryForJob({ plugin, job } = {}) {
  if (!plugin?.switchTo || !job) return null;

  const inquiryId = normalizeId(job.inquiry_record_id);
  if (inquiryId) {
    const linked = await fetchInquiryById({ plugin, inquiryId });
    if (linked) return linked;
  }

  const jobId = normalizeId(job.id);
  if (!jobId) return null;

  const byInquiryForJob = await fetchDealByJobLinkField({
    plugin,
    field: "inquiry_for_job_id",
    jobId,
  });
  if (byInquiryForJob) return byInquiryForJob;

  const byQuoteRecord = await fetchDealByJobLinkField({
    plugin,
    field: "quote_record_id",
    jobId,
  });
  if (byQuoteRecord) return byQuoteRecord;

  return null;
}

export async function resolveJobDetailsContext({
  plugin,
  uid,
  sourceTab = "",
} = {}) {
  const normalizedUid = toText(uid);
  const normalizedSource = toText(sourceTab).toLowerCase();
  const inquiryFirst = normalizedSource === "inquiry";

  let inquiry = null;
  let job = null;

  if (inquiryFirst) {
    inquiry = await fetchInquiryByUid({ plugin, uid: normalizedUid });
    job = await fetchJobByUid({ plugin, uid: normalizedUid });
  } else {
    job = await fetchJobByUid({ plugin, uid: normalizedUid });
    inquiry = await fetchInquiryByUid({ plugin, uid: normalizedUid });
  }

  if (inquiry && !job) {
    job = await fetchLinkedJobForInquiry({ plugin, inquiry });
  }

  if (job && !inquiry) {
    inquiry = await fetchLinkedInquiryForJob({ plugin, job });
  }

  const found = Boolean(inquiry || job);
  const primaryType =
    inquiryFirst && inquiry
      ? "inquiry"
      : !inquiryFirst && job
        ? "job"
        : inquiry
          ? "inquiry"
          : job
            ? "job"
            : "";

  return {
    found,
    primaryType,
    inquiry: inquiry || null,
    job: job || null,
  };
}

export async function allocateServiceProviderForInquiry({
  plugin,
  inquiryId,
  serviceProviderId,
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedInquiryId = normalizeId(inquiryId);
  const normalizedProviderId = normalizeId(serviceProviderId);
  if (!normalizedInquiryId) {
    throw new Error("Inquiry ID is missing.");
  }
  if (!normalizedProviderId) {
    throw new Error("Service provider is required.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const mutation = await dealModel.mutation();
  mutation.update((query) =>
    query.where("id", normalizedInquiryId).set({
      service_provider_id: normalizedProviderId,
    })
  );
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(
      extractCancellationMessage(result, "Service provider allocation was cancelled.")
    );
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) ||
        "Unable to allocate service provider."
    );
  }
  return { inquiryId: normalizedInquiryId, serviceProviderId: normalizedProviderId };
}

export async function createLinkedJobForInquiry({
  plugin,
  inquiry,
  serviceProviderId,
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  if (!inquiry || typeof inquiry !== "object") {
    throw new Error("Inquiry details are missing.");
  }

  const inquiryId = normalizeId(inquiry.id || inquiry.ID);
  if (!inquiryId) {
    throw new Error("Inquiry ID is missing.");
  }

  const providerId =
    normalizeId(serviceProviderId) ||
    normalizeId(inquiry.service_provider_id || inquiry.Service_Provider_ID);
  if (!providerId) {
    throw new Error("Allocate a service provider before creating a job.");
  }

  const accountType = toText(inquiry.account_type || inquiry.Account_Type);
  const normalizedAccountType = normalizeStatus(accountType);
  const isContactAccount =
    normalizedAccountType === "contact" || normalizedAccountType === "individual";
  const isBodyCorpAccount = normalizedAccountType.includes("body corp");
  const isCompanyAccount =
    !isContactAccount &&
    (normalizedAccountType === "company" ||
      normalizedAccountType === "entity" ||
      normalizedAccountType.includes("company") ||
      isBodyCorpAccount);
  const propertyId = normalizeId(inquiry?.Property?.id || inquiry?.PropertyID || inquiry?.property_id);
  const contactId = normalizeId(
    inquiry?.Primary_Contact?.id ||
      inquiry?.Primary_Contact?.ID ||
      inquiry?.Primary_Contact_ID ||
      inquiry?.Primary_Contact_Contact_ID ||
      inquiry?.Contact_Contact_ID
  );
  const companyId = normalizeId(
    inquiry?.Company?.id ||
      inquiry?.Company?.ID ||
      inquiry?.company_id ||
      inquiry?.Company_ID ||
      inquiry?.CompanyID
  );
  const bodyCorpCompanyId = normalizeId(
    inquiry?.Company?.Body_Corporate_Company?.id ||
      inquiry?.Company?.Body_Corporate_Company?.ID ||
      inquiry?.CompanyID1 ||
      inquiry?.Company_ID1
  );
  const resolvedCompanyId = isBodyCorpAccount
    ? bodyCorpCompanyId || companyId
    : companyId;
  const useCompanyClient = isCompanyAccount
    ? Boolean(resolvedCompanyId)
    : !isContactAccount && Boolean(resolvedCompanyId) && !contactId;
  const resolvedClientEntityId = useCompanyClient ? resolvedCompanyId : "";
  const resolvedClientIndividualId = useCompanyClient ? "" : contactId;
  if (!resolvedClientEntityId && !resolvedClientIndividualId) {
    throw new Error("Unable to resolve client entity/contact for quote creation.");
  }
  const nowIso = new Date().toISOString();

  const payload = {
    inquiry_record_id: inquiryId,
    job_status: "Quote",
    quote_date: nowIso,
    quote_status: "New",
    primary_service_provider_id: providerId,
    property_id: propertyId || null,
    account_type: accountType || null,
    client_individual_id: resolvedClientIndividualId || null,
    client_entity_id: resolvedClientEntityId || null,
  };

  const jobModel = plugin.switchTo("PeterpmJob");
  const createMutation = await jobModel.mutation();
  createMutation.createOne(payload);
  const createResult = await createMutation.execute(true).toPromise();
  if (!createResult || createResult?.isCancelling) {
    throw new Error(extractCancellationMessage(createResult, "Job create was cancelled."));
  }
  const createFailure = extractStatusFailure(createResult);
  if (createFailure) {
    throw new Error(
      extractMutationErrorMessage(createFailure.statusMessage) || "Unable to create job."
    );
  }

  const createdJobId = extractCreatedRecordId(createResult, "PeterpmJob");
  if (!isPersistedId(createdJobId)) {
    throw new Error("Job created but no persisted ID was returned.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const linkMutation = await dealModel.mutation();
  linkMutation.update((query) =>
    query.where("id", inquiryId).set({
      inquiry_status: "Quote Created",
      quote_record_id: createdJobId,
      inquiry_for_job_id: createdJobId,
    })
  );
  const linkResult = await linkMutation.execute(true).toPromise();
  if (!linkResult || linkResult?.isCancelling) {
    throw new Error(extractCancellationMessage(linkResult, "Deal link update was cancelled."));
  }
  const linkFailure = extractStatusFailure(linkResult);
  if (linkFailure) {
    throw new Error(
      extractMutationErrorMessage(linkFailure.statusMessage) ||
        "Job created but failed to link inquiry."
    );
  }

  const createdJob = await fetchJobById({ plugin, jobId: createdJobId });
  if (!createdJob) {
    throw new Error("Job created but failed to load job details.");
  }
  return createdJob;
}

export async function updateJobFieldsById({ plugin, jobId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedJobId = normalizeId(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const jobModel = plugin.switchTo("PeterpmJob");
  const mutation = await jobModel.mutation();
  mutation.update((query) => query.where("id", normalizedJobId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Job update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update job."
    );
  }
  return { id: normalizedJobId, payload };
}

export async function updateInquiryFieldsById({ plugin, inquiryId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedInquiryId = normalizeId(inquiryId);
  if (!normalizedInquiryId) {
    throw new Error("Inquiry ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const dealModel = plugin.switchTo("PeterpmDeal");
  const mutation = await dealModel.mutation();
  mutation.update((query) => query.where("id", normalizedInquiryId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Inquiry update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update inquiry."
    );
  }
  return { id: normalizedInquiryId, payload };
}

export async function updateContactFieldsById({ plugin, contactId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedContactId = normalizeId(contactId);
  if (!normalizedContactId) {
    throw new Error("Contact ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const contactModel = plugin.switchTo("PeterpmContact");
  const mutation = await contactModel.mutation();
  mutation.update((query) => query.where("id", normalizedContactId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Contact update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update contact."
    );
  }
  return { id: normalizedContactId, payload };
}

export async function updateCompanyFieldsById({ plugin, companyId, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const normalizedCompanyId = normalizeId(companyId);
  if (!normalizedCompanyId) {
    throw new Error("Company ID is missing.");
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Update payload is missing.");
  }

  const companyModel = plugin.switchTo("PeterpmCompany");
  const mutation = await companyModel.mutation();
  mutation.update((query) => query.where("id", normalizedCompanyId).set(payload));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Company update was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update company."
    );
  }
  return { id: normalizedCompanyId, payload };
}

export async function fetchContactsForLookup({ plugin } = {}) {
  if (!plugin?.switchTo) return [];

  try {
    const query = plugin
      .switchTo("PeterpmContact")
      .query()
      .deSelectAll()
      .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    const rows = extractFromPayload(payload);
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.error("[jobDetailsSdk] fetchContactsForLookup failed", error);
    return [];
  }
}

function dedupeById(records = []) {
  const seen = new Set();
  return (Array.isArray(records) ? records : []).filter((record, index) => {
    const key = normalizeId(record?.id || record?.ID || "") || `idx-${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasVisibleTaskContent(task = {}) {
  return Boolean(
    toText(task?.subject || task?.Subject) ||
      toText(task?.status || task?.Status) ||
      toText(task?.date_due || task?.Date_Due) ||
      toText(task?.assignee_first_name || task?.Assignee_First_Name) ||
      toText(task?.assignee_last_name || task?.Assignee_Last_Name) ||
      toText(task?.assignee_email || task?.AssigneeEmail)
  );
}

export async function fetchPropertyAffiliationsForDetails({ plugin, propertyId } = {}) {
  return fetchPropertyAffiliationsByPropertyId({ plugin, propertyId });
}

export async function savePropertyForDetails({
  plugin,
  propertyId,
  propertyPayload,
  inquiryId,
  jobId,
} = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const payload = propertyPayload && typeof propertyPayload === "object" ? propertyPayload : {};
  let resolvedPropertyId = normalizeId(propertyId) || normalizeId(payload?.id || payload?.ID);

  if (resolvedPropertyId) {
    await updatePropertyRecord({
      plugin,
      id: resolvedPropertyId,
      payload,
    });
  } else {
    const created = await createPropertyRecord({
      plugin,
      payload,
    });
    resolvedPropertyId = normalizeId(created?.id || created?.ID);
    if (!resolvedPropertyId) {
      throw new Error("Property saved but no ID was returned.");
    }
  }

  if (normalizeId(inquiryId)) {
    await updateInquiryFieldsById({
      plugin,
      inquiryId,
      payload: { property_id: resolvedPropertyId },
    });
  }

  if (normalizeId(jobId)) {
    await updateJobFieldsById({
      plugin,
      jobId,
      payload: { property_id: resolvedPropertyId },
    });
  }

  return resolvedPropertyId;
}

export async function fetchTasksForDetails({ plugin, jobId, inquiryId } = {}) {
  const [jobTasks, inquiryTasks] = await Promise.all([
    normalizeId(jobId) ? fetchTasksByJobId({ plugin, jobId }) : Promise.resolve([]),
    normalizeId(inquiryId)
      ? fetchTasksByDealId({ plugin, dealId: inquiryId })
      : Promise.resolve([]),
  ]);

  return dedupeById([
    ...(Array.isArray(jobTasks) ? jobTasks : []),
    ...(Array.isArray(inquiryTasks) ? inquiryTasks : []),
  ]).filter((task) => hasVisibleTaskContent(task));
}

export async function createTaskForDetails({ plugin, payload, jobId, inquiryId } = {}) {
  const mergedPayload = {
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  const normalizedJobId = normalizeId(jobId);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (normalizedJobId) {
    mergedPayload.job_id = normalizedJobId;
    mergedPayload.Job_id = normalizedJobId;
  }
  if (normalizedInquiryId) {
    mergedPayload.deal_id = normalizedInquiryId;
    mergedPayload.Deal_id = normalizedInquiryId;
  }
  return createTaskRecord({ plugin, payload: mergedPayload });
}

export async function updateTaskForDetails({
  plugin,
  taskId,
  payload,
  jobId,
  inquiryId,
} = {}) {
  const mergedPayload = {
    ...(payload && typeof payload === "object" ? payload : {}),
  };
  const normalizedJobId = normalizeId(jobId);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (normalizedJobId) {
    mergedPayload.job_id = normalizedJobId;
    mergedPayload.Job_id = normalizedJobId;
  }
  if (normalizedInquiryId) {
    mergedPayload.deal_id = normalizedInquiryId;
    mergedPayload.Deal_id = normalizedInquiryId;
  }
  return updateTaskRecord({ plugin, id: taskId, payload: mergedPayload });
}

export async function fetchUploadsForDetails({ plugin, jobId } = {}) {
  if (!normalizeId(jobId)) return [];
  return fetchJobUploads({ plugin, jobId: normalizeId(jobId) });
}

export async function createUploadForDetails({
  plugin,
  file,
  jobId,
  inquiryId,
  uploadPath = "",
} = {}) {
  const normalizedJobId = normalizeId(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is required to upload files.");
  }

  const created = await createJobUploadFromFile({
    plugin,
    jobId: normalizedJobId,
    file,
    uploadPath: uploadPath || `job-uploads/${normalizedJobId}`,
    additionalPayload: normalizeId(inquiryId)
      ? {
          inquiry_id: normalizeId(inquiryId),
        }
      : null,
  });
  const createdUploadId = normalizeId(created?.id || created?.ID);
  const normalizedInquiryId = normalizeId(inquiryId);
  if (createdUploadId && normalizedInquiryId) {
    try {
      const mutation = await plugin.switchTo("PeterpmUpload").mutation();
      mutation.update((query) =>
        query.where("id", createdUploadId).set({
          inquiry_id: normalizedInquiryId,
        })
      );
      await mutation.execute(true).toPromise();
    } catch (linkError) {
      console.warn("[jobDetailsSdk] Upload created but inquiry link update failed", linkError);
    }
  }
  return created;
}

export async function deleteUploadForDetails({ plugin, uploadId } = {}) {
  return deleteUploadRecord({ plugin, id: uploadId });
}

function mapForumCommentRecord(raw = {}, index = 0, postId = "") {
  const author = raw?.Author || {};
  return {
    id: normalizeId(raw?.id || raw?.ID) || `reply-${postId || "post"}-${index}`,
    author_id: normalizeId(raw?.author_id || raw?.Author_ID || author?.id || author?.ID),
    comment: toText(
      raw?.comment ||
        raw?.Comment ||
        raw?.post_copy ||
        raw?.Post_Copy ||
        raw?.text ||
        raw?.Text ||
        raw?.content ||
        raw?.Content
    ),
    comment_status: toText(raw?.comment_status || raw?.Comment_Status),
    created_at: raw?.created_at ?? raw?.Date_Added ?? null,
    Author: {
      id: normalizeId(author?.id || author?.ID),
      first_name: toText(author?.first_name || author?.First_Name),
      last_name: toText(author?.last_name || author?.Last_Name),
      display_name: toText(author?.display_name || author?.Display_Name),
      profile_image: toText(author?.profile_image || author?.Profile_Image),
    },
  };
}

function mapForumPostRecord(raw = {}, index = 0) {
  const author = raw?.Author || {};
  const postId = normalizeId(raw?.id || raw?.ID) || `post-${index}`;
  const comments = Array.isArray(raw?.ForumComments)
    ? raw.ForumComments
    : Array.isArray(raw?.forum_comments)
      ? raw.forum_comments
      : [];
  const dedupedComments = [];
  const seenCommentIds = new Set();
  comments.forEach((comment, commentIndex) => {
    const mapped = mapForumCommentRecord(comment, commentIndex, postId);
    const commentId = normalizeId(mapped?.id);
    const key = commentId || `comment-${postId}-${commentIndex}`;
    if (seenCommentIds.has(key)) return;
    seenCommentIds.add(key);
    dedupedComments.push(mapped);
  });

  return {
    id: postId,
    unique_id: toText(raw?.unique_id || raw?.Unique_ID),
    author_id: normalizeId(raw?.author_id || raw?.Author_ID || author?.id || author?.ID),
    related_inquiry_id: normalizeId(raw?.related_inquiry_id || raw?.Related_Inquiry_ID),
    related_job_id: normalizeId(raw?.related_job_id || raw?.Related_Job_ID),
    created_at: raw?.created_at ?? raw?.Date_Added ?? null,
    post_copy: toText(
      raw?.post_copy ||
        raw?.Post_Copy ||
        raw?.comment ||
        raw?.Comment ||
        raw?.text ||
        raw?.Text ||
        raw?.content ||
        raw?.Content
    ),
    file: raw?.file ?? raw?.File ?? "",
    post_status: toText(raw?.post_status || raw?.Post_Status),
    Author: {
      id: normalizeId(author?.id || author?.ID),
      first_name: toText(author?.first_name || author?.First_Name),
      last_name: toText(author?.last_name || author?.Last_Name),
      display_name: toText(author?.display_name || author?.Display_Name),
      profile_image: toText(author?.profile_image || author?.Profile_Image),
    },
    ForumComments: dedupedComments,
  };
}

function normalizeForumPosts(records = []) {
  const mapped = (Array.isArray(records) ? records : [])
    .map((row, index) => mapForumPostRecord(row, index))
    .filter(Boolean);
  const deduped = [];
  const seenPostIds = new Set();
  mapped.forEach((post, index) => {
    const postId = normalizeId(post?.id || post?.ID);
    const key = postId || `post-${index}`;
    if (seenPostIds.has(key)) return;
    seenPostIds.add(key);
    deduped.push(post);
  });
  return deduped
    .sort((left, right) => {
      const leftTs = Number(left?.created_at || 0);
      const rightTs = Number(right?.created_at || 0);
      return leftTs - rightTs;
    });
}

async function fetchForumCommentsByPostId({ plugin, postId } = {}) {
  const normalizedPostId = normalizeId(postId);
  if (!plugin?.switchTo || !normalizedPostId) return [];
  try {
    const query = plugin
      .switchTo("PeterpmForumComment")
      .query()
      .where("forum_post_id", normalizedPostId)
      .deSelectAll()
      .select(["id", "author_id", "comment", "comment_status", "created_at", "forum_post_id"])
      .include("Author", (authorQuery) =>
        authorQuery
          .deSelectAll()
          .select(["id", "first_name", "last_name", "display_name", "profile_image"])
      )
      .orderBy("created_at", "asc")
      .limit(200)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const payload = await fetchDirectWithTimeout(query, null, 20000);
    const rows = extractRowsFromPayload(payload, "calcForumComments");
    return (Array.isArray(rows) ? rows : []).map((row, index) =>
      mapForumCommentRecord(row, index, normalizedPostId)
    );
  } catch (error) {
    console.warn("[jobDetailsSdk] fetchForumCommentsByPostId fallback failed", {
      postId: normalizedPostId,
      error,
    });
    return [];
  }
}

async function hydrateForumPostsWithComments({ plugin, posts = [] } = {}) {
  const list = Array.isArray(posts) ? posts : [];
  const postsMissingComments = list.filter((post) => {
    const comments = Array.isArray(post?.ForumComments) ? post.ForumComments : [];
    return comments.length === 0 && normalizeId(post?.id || post?.ID);
  });

  if (!postsMissingComments.length) return list;

  const commentEntries = await Promise.all(
    postsMissingComments.map(async (post) => {
      const postId = normalizeId(post?.id || post?.ID);
      const comments = await fetchForumCommentsByPostId({ plugin, postId });
      return [postId, comments];
    })
  );
  const commentMap = new Map(commentEntries);

  return list.map((post) => {
    const postId = normalizeId(post?.id || post?.ID);
    if (!postId) return post;
    const existingComments = Array.isArray(post?.ForumComments) ? post.ForumComments : [];
    if (existingComments.length) return post;
    return {
      ...post,
      ForumComments: commentMap.get(postId) || [],
    };
  });
}

function buildForumPostQuery(plugin, { inquiryId = "", jobId = "", limit = 80 } = {}) {
  const normalizedInquiryId = normalizeId(inquiryId);
  const normalizedJobId = normalizeId(jobId);

  if (!normalizedInquiryId && !normalizedJobId) {
    throw new Error("Either inquiryId or jobId is required for memos.");
  }

  const query = plugin
    .switchTo("PeterpmForumPost")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "author_id",
      "created_at",
      "post_copy",
      "post_status",
      "file",
      "related_inquiry_id",
      "related_job_id",
    ])
    .include("Author", (authorQuery) =>
      authorQuery
        .deSelectAll()
        .select(["id", "first_name", "last_name", "display_name", "profile_image"])
    )
    .include("ForumComments", (commentQuery) =>
      commentQuery
        .deSelectAll()
        .select(["id", "author_id", "comment", "comment_status", "created_at"])
        .include("Author", (authorQuery) =>
          authorQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "display_name", "profile_image"])
        )
    )
    .orderBy("created_at", "asc")
    .limit(limit)
    .noDestroy();

  if (normalizedInquiryId && normalizedJobId) {
    query.where("related_inquiry_id", normalizedInquiryId);
    query.orWhere("related_job_id", normalizedJobId);
  } else if (normalizedInquiryId) {
    query.where("related_inquiry_id", normalizedInquiryId);
  } else {
    query.where("related_job_id", normalizedJobId);
  }

  query.getOrInitQueryCalc?.();
  return query;
}

export async function fetchMemosForDetails({
  plugin,
  inquiryId = "",
  jobId = "",
  limit = 80,
} = {}) {
  if (!plugin?.switchTo) return [];
  try {
    const query = buildForumPostQuery(plugin, { inquiryId, jobId, limit });
    const payload = await fetchDirectWithTimeout(query, null, 30000);
    const rows = extractRowsFromPayload(payload, "calcForumPosts");
    const normalized = normalizeForumPosts(rows);
    return hydrateForumPostsWithComments({ plugin, posts: normalized });
  } catch (error) {
    console.error("[jobDetailsSdk] fetchMemosForDetails failed", error);
    return [];
  }
}

export function subscribeMemosForDetails({
  plugin,
  inquiryId = "",
  jobId = "",
  limit = 80,
  onChange,
  onError,
} = {}) {
  if (!plugin?.switchTo) return () => {};

  let query;
  try {
    query = buildForumPostQuery(plugin, { inquiryId, jobId, limit });
  } catch (error) {
    onError?.(error);
    return () => {};
  }

  const source =
    (typeof query.subscribe === "function" && query.subscribe()) ||
    (typeof query.localSubscribe === "function" && query.localSubscribe()) ||
    null;

  if (!source || typeof source.subscribe !== "function") {
    onError?.(new Error("Memo stream is unavailable."));
    return () => {};
  }

  let stream = source;
  if (
    typeof window !== "undefined" &&
    typeof window.toMainInstance === "function" &&
    typeof stream.pipe === "function"
  ) {
    stream = stream.pipe(window.toMainInstance(true));
  }

  const subscription = stream.subscribe({
    next: (payload) => {
      const rows = extractRowsFromPayload(payload, "subscribeToForumPosts");
      onChange?.(normalizeForumPosts(rows));
    },
    error: (error) => {
      console.error("[jobDetailsSdk] memo subscription failed", error);
      onError?.(error);
    },
  });

  return () => {
    try {
      subscription?.unsubscribe?.();
    } catch (_) {}
    try {
      query?.destroy?.();
    } catch (_) {}
  };
}

async function executeMutationWithOne(model, mutationBuilder, fallbackErrorMessage) {
  const mutation = await model.mutation();
  mutationBuilder(mutation);
  const result = await toPromiseLike(mutation.execute(true));
  if (!result || result?.isCancelling) {
    throw new Error(extractCancellationMessage(result, "Mutation was cancelled."));
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || fallbackErrorMessage
    );
  }
  return result;
}

export async function createMemoPostForDetails({ plugin, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const model = plugin.switchTo("PeterpmForumPost");
  if (!model?.mutation) {
    throw new Error("Memo post model is unavailable.");
  }
  const result = await executeMutationWithOne(
    model,
    (mutation) => mutation.createOne(payload || {}),
    "Unable to create memo post."
  );
  const createdId = extractCreatedRecordId(result, "PeterpmForumPost");
  return {
    id: normalizeId(createdId),
    ...(payload && typeof payload === "object" ? payload : {}),
  };
}

export async function createMemoCommentForDetails({ plugin, payload } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const model = plugin.switchTo("PeterpmForumComment");
  if (!model?.mutation) {
    throw new Error("Memo comment model is unavailable.");
  }
  const result = await executeMutationWithOne(
    model,
    (mutation) => mutation.createOne(payload || {}),
    "Unable to create memo comment."
  );
  const createdId = extractCreatedRecordId(result, "PeterpmForumComment");
  return {
    id: normalizeId(createdId),
    ...(payload && typeof payload === "object" ? payload : {}),
  };
}

export async function deleteMemoPostForDetails({ plugin, postId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const id = normalizeId(postId);
  if (!id) throw new Error("Memo post ID is required.");
  const model = plugin.switchTo("PeterpmForumPost");
  if (!model?.mutation) {
    throw new Error("Memo post model is unavailable.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.delete((query) => query.where("id", id)),
    "Unable to delete memo post."
  );
  return id;
}

export async function deleteMemoCommentForDetails({ plugin, commentId } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const id = normalizeId(commentId);
  if (!id) throw new Error("Memo comment ID is required.");
  const model = plugin.switchTo("PeterpmForumComment");
  if (!model?.mutation) {
    throw new Error("Memo comment model is unavailable.");
  }
  await executeMutationWithOne(
    model,
    (mutation) => mutation.delete((query) => query.where("id", id)),
    "Unable to delete memo comment."
  );
  return id;
}
