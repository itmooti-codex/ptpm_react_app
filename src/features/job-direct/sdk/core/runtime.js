import { VITAL_STATS_CONFIG } from "../vitalStatsConfig.js";
import { resolvePlugin } from "./plugin.js";
import {
  fetchDirectWithTimeout,
  isTimeoutError,
  subscribeToQueryStream,
} from "./transport.js";
import {
  extractCancellationMessage,
  extractFirstRecord,
  extractMutationErrorMessage,
  extractOperationRecord,
  extractRecords,
  extractStatusFailure,
  findMutationData,
  findMutationDataByMatcher,
  isPersistedId,
  normalizeObjectList,
  sanitizeUploadPath,
} from "../utils/sdkResponseUtils.js";

function normalizeTaskDateDue(value) {
  if (value === null || value === undefined) return null;
  const asText = String(value).trim();
  if (!asText) return null;

  if (/^\d+$/.test(asText)) {
    const numeric = Number.parseInt(asText, 10);
    if (!Number.isFinite(numeric)) return asText;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const parsed = new Date(asText);
  if (Number.isNaN(parsed.getTime())) return asText;
  return Math.floor(parsed.getTime() / 1000);
}

function normalizeEpochSeconds(value) {
  if (value === null || value === undefined) return null;
  const asText = String(value).trim();
  if (!asText) return null;

  if (/^\d+$/.test(asText)) {
    const numeric = Number.parseInt(asText, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const normalizedDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(asText)
    ? `${asText}T00:00:00`
    : asText;
  const parsed = new Date(normalizedDateOnly);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function normalizeTaskMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};

  const subject = String(source?.subject || source?.Subject || "").trim();
  const details = String(source?.details || source?.Details || "").trim();
  const status = String(source?.status || source?.Status || "").trim();
  const assigneeId = normalizeIdentifier(
    source?.assignee_id || source?.Assignee_ID || source?.assigneeId
  );
  const dateDue = normalizeTaskDateDue(source?.date_due ?? source?.Date_Due ?? source?.due_date);

  if (subject) next.subject = subject;
  if (details) next.details = details;
  if (status) next.status = status;
  if (assigneeId !== "" && assigneeId !== null && assigneeId !== undefined) {
    next.assignee_id = assigneeId;
  }
  if (dateDue !== undefined) {
    next.date_due = dateDue;
  }

  const jobId = normalizeIdentifier(
    source?.Job_id ?? source?.job_id ?? source?.JobID ?? source?.jobId
  );
  const dealId = normalizeIdentifier(
    source?.Deal_id ?? source?.deal_id ?? source?.DealID ?? source?.dealId
  );
  if (jobId !== "" && jobId !== null && jobId !== undefined) {
    next.Job_id = jobId;
  }
  if (dealId !== "" && dealId !== null && dealId !== undefined) {
    next.Deal_id = dealId;
  }

  return next;
}

function extractCreatedRecordId(payload, key) {
  const managed = payload?.mutations?.[key]?.managedData;
  if (managed && typeof managed === "object") {
    for (const [managedKey, managedValue] of Object.entries(managed)) {
      if (isPersistedId(managedKey)) return String(managedKey);
      const nestedId = managedValue?.id || managedValue?.ID || managedValue?.Contact_ID;
      if (isPersistedId(nestedId)) return String(nestedId);
    }
  }
  const pkMap = payload?.extensions?.pkMap || payload?.pkMap;
  if (pkMap && typeof pkMap === "object") {
    for (const value of Object.values(pkMap)) {
      if (isPersistedId(value)) return String(value);
    }
  }
  const respId = payload?.resp?.id;
  if (isPersistedId(respId)) {
    return String(respId);
  }

  const objects = normalizeObjectList(payload);
  for (const item of objects) {
    const itemPkMap = item?.extensions?.pkMap || item?.pkMap;
    if (itemPkMap && typeof itemPkMap === "object") {
      for (const value of Object.values(itemPkMap)) {
        if (isPersistedId(value)) return String(value);
      }
    }
  }
  return "";
}

function getFirstNonEmptyText(...values) {
  for (const value of values) {
    const text = String(value || "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeStatusText(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeJobRecord(rawJob) {
  if (!rawJob || typeof rawJob !== "object") return rawJob;

  const serviceProvider = rawJob?.Primary_Service_Provider;
  const serviceProviderContact = serviceProvider?.Contact_Information;

  const providerId = getFirstNonEmptyText(
    rawJob?.primary_service_provider_id,
    rawJob?.Primary_Service_Provider_ID,
    serviceProvider?.id,
    serviceProvider?.ID
  );
  const contactFirstName = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_First_Name,
    rawJob?.Contact_First_Name1,
    serviceProviderContact?.first_name,
    serviceProviderContact?.First_Name
  );
  const contactLastName = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_Last_Name,
    rawJob?.Contact_Last_Name1,
    serviceProviderContact?.last_name,
    serviceProviderContact?.Last_Name
  );
  const contactEmail = getFirstNonEmptyText(
    rawJob?.Primary_Service_Provider_Contact_Email,
    rawJob?.ContactEmail1,
    serviceProviderContact?.email,
    serviceProviderContact?.Email
  );

  const next = {
    ...rawJob,
    Primary_Service_Provider_ID: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_ID,
      providerId
    ),
    Primary_Service_Provider_Contact_First_Name: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_First_Name,
      contactFirstName
    ),
    Primary_Service_Provider_Contact_Last_Name: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_Last_Name,
      contactLastName
    ),
    Primary_Service_Provider_Contact_Email: getFirstNonEmptyText(
      rawJob?.Primary_Service_Provider_Contact_Email,
      contactEmail
    ),
  };

  if (!next.primary_service_provider_id && providerId) {
    next.primary_service_provider_id = providerId;
  }

  if (!next.Primary_Service_Provider && providerId) {
    next.Primary_Service_Provider = {
      id: providerId,
      Contact_Information:
        contactFirstName || contactLastName || contactEmail
          ? {
              first_name: contactFirstName,
              last_name: contactLastName,
              email: contactEmail,
            }
          : null,
    };
  }

  return next;
}

function normalizeInvoiceBillContextRecord(rawJob) {
  const normalized = normalizeJobRecord(rawJob || {});
  if (!normalized || typeof normalized !== "object") return normalized;

  const contactXeroId = getFirstNonEmptyText(
    normalized?.Client_Individual?.xero_contact_id,
    normalized?.Client_Individual?.Xero_Contact_ID,
    normalized?.Client_Individual_Xero_Contact_ID
  );
  const companyXeroId = getFirstNonEmptyText(
    normalized?.Client_Entity?.xero_contact_id,
    normalized?.Client_Entity?.Xero_Contact_ID,
    normalized?.Client_Entity_Xero_Contact_ID
  );

  const providerRateRaw = getFirstNonEmptyText(
    normalized?.Primary_Service_Provider_Job_Rate_Percentage,
    normalized?.Primary_Service_Provider?.job_rate_percentage,
    normalized?.Primary_Service_Provider?.Job_Rate_Percentage
  );
  const providerRate = Number.parseFloat(providerRateRaw);

  const accountsContact = normalized?.Accounts_Contact?.Contact || null;
  const accountsContactFirstName = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_First_Name,
    normalized?.Contact_First_Name,
    normalized?.Contact_First_Name1,
    accountsContact?.first_name,
    accountsContact?.First_Name
  );
  const accountsContactLastName = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_Last_Name,
    normalized?.Contact_Last_Name,
    normalized?.Contact_Last_Name1,
    accountsContact?.last_name,
    accountsContact?.Last_Name
  );
  const accountsContactEmail = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_Email,
    normalized?.ContactEmail,
    normalized?.ContactEmail1,
    accountsContact?.email,
    accountsContact?.Email
  );
  const accountsContactContactId = getFirstNonEmptyText(
    normalized?.Accounts_Contact_Contact_ID,
    normalized?.Contact_Contact_ID,
    normalized?.Contact_Contact_ID1,
    accountsContact?.id,
    accountsContact?.ID
  );

  return {
    ...normalized,
    client_individual_xero_contact_id: contactXeroId,
    client_entity_xero_contact_id: companyXeroId,
    accounts_contact_contact_id: accountsContactContactId,
    accounts_contact_contact_first_name: accountsContactFirstName,
    accounts_contact_contact_last_name: accountsContactLastName,
    accounts_contact_contact_email: accountsContactEmail,
    primary_service_provider_job_rate_percentage: Number.isFinite(providerRate)
      ? providerRate
      : 0,
  };
}

function buildJobByFieldQuery(jobModel, field, value) {
  return jobModel
    .query()
    .where(field, value)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "job_status",
      "job_type",
      "account_type",
      "contact_type",
      "client_individual_id",
      "client_entity_id",
      "inquiry_record_id",
      "contact_id",
      "priority",
      "property_id",
      "primary_service_provider_id",
      "date_started",
      "date_booked",
      "date_job_required_by",
      "payment_status",
      "job_total",
      "invoice_date",
      "due_date",
      "invoice_number",
      "invoice_id",
      "invoice_total",
      "xero_invoice_status",
      "xero_api_response",
      "xero_invoice_pdf",
      "invoice_url_admin",
      "invoice_url_client",
      "accounts_contact_id",
      "send_to_contact",
      "bill_date",
      "bill_due_date",
      "bill_total",
      "bill_gst",
      "bill_xero_id",
      "xero_bill_status",
      "bill_batch_id",
      "bill_batch_date",
      "bill_batch_week",
      "bill_approved_admin",
      "bill_approval_time",
      "bill_approved_service_provider",
      "materials_total",
      "reimburse_total",
      "deduct_total",
    ])
    .include("Client_Individual", (q) =>
      q
        .deSelectAll()
        .select([
          "id",
          "first_name",
          "last_name",
          "email",
          "sms_number",
          "xero_contact_id",
        ])
    )
    .include("Client_Entity", (q) =>
      q
        .deSelectAll()
        .select([
          "id",
          "name",
          "account_type",
          "xero_contact_id",
        ])
        .include("Primary_Person", (personQuery) =>
          personQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
        )
    )
    .include("Inquiry_Record", (q) =>
      q.deSelectAll().select(["id", "unique_id", "deal_name"])
    )
    .include("Accounts_Contact", (q) =>
      q
        .deSelectAll()
        .select(["id"])
        .include("Contact", (contactQuery) =>
          contactQuery
            .deSelectAll()
            .select(["id", "first_name", "last_name", "email"])
        )
    )
    .include("Primary_Service_Provider", (providerQuery) =>
      providerQuery
        .deSelectAll()
        .select(["id", "unique_id", "status", "job_rate_percentage"])
        .include("Contact_Information", (contactQuery) =>
          contactQuery.deSelectAll().select(["first_name", "last_name", "email"])
        )
    )
    .include("Property", (q) =>
      q.deSelectAll().select([
        "id",
        "unique_id",
        "property_name",
        "lot_number",
        "unit_number",
        "address_1",
        "address_2",
        "address",
        "city",
        "suburb_town",
        "state",
        "postal_code",
        "zip_code",
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
    );
}

async function fetchFirstByField(jobModel, field, value, { timeoutMs = 10000 } = {}) {
  const query = buildJobByFieldQuery(jobModel, field, value).noDestroy();

  query.getOrInitQueryCalc?.();
  const result = await fetchDirectWithTimeout(query, null, timeoutMs);
  return normalizeInvoiceBillContextRecord(extractFirstRecord(result));
}

export async function fetchInvoiceJobSnapshotById({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return null;

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return null;

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmJob")
      .query()
      .fromGraphql(`
        query getJob($id: PeterpmJobID!) {
          getJob(query: [{ where: { id: $id } }]) {
            ID: id
            Unique_ID: unique_id
            Xero_Invoice_Status: xero_invoice_status
            Invoice_Number: invoice_number
            Account_Type: account_type
            Invoice_Date: invoice_date
            Due_Date: due_date
            Invoice_URL_Admin: invoice_url_admin
            Invoice_URL_Client: invoice_url_client
            Send_to_Contact: send_to_contact
            Invoice_Total: invoice_total
            Xero_Invoice_PDF: xero_invoice_pdf
            Payment_Status: payment_status
            xero_api_response
            Invoice_ID: invoice_id
            Bill_Date: bill_date
            Bill_Due_Date: bill_due_date
            Bill_Total: bill_total
            Bill_GST: bill_gst
            Bill_Xero_ID: bill_xero_id
            Xero_Bill_Status: xero_bill_status
            Bill_Batch_ID: bill_batch_id
            Bill_Batch_Date: bill_batch_date
            Bill_Batch_Week: bill_batch_week
            Bill_Approved_Admin: bill_approved_admin
            Bill_Approval_Time: bill_approval_time
            Bill_Approved_Service_Provider: bill_approved_service_provider
            Materials_Total: materials_total
            Reimburse_Total: reimburse_total
            Deduct_Total: deduct_total
            Primary_Service_Provider_ID: primary_service_provider_id
            Client_Entity_ID: client_entity_id
            Client_Individual_ID: client_individual_id
            Accounts_Contact_ID: accounts_contact_id
            Contact_ID: contact_id
            Client_Entity {
              id
              name
              account_type
              xero_contact_id
            }
            Client_Individual {
              id
              first_name
              last_name
              email
              sms_number
              xero_contact_id
            }
            Accounts_Contact {
              id
              Contact {
                id
                first_name
                last_name
                email
              }
            }
            Primary_Service_Provider {
              id
              unique_id
              status
              job_rate_percentage
              Contact_Information {
                first_name
                last_name
                email
              }
            }
          }
        }
      `);

    const response = await fetchDirectWithTimeout(query, {
      variables: { id: normalizedJobId },
    });
    const record = extractOperationRecord(response, "getJob");
    if (!record || typeof record !== "object") return null;
    return normalizeInvoiceBillContextRecord(record);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch invoice job snapshot", { jobId: normalizedJobId, error });
    return null;
  }
}

export async function fetchJobDirectDataByUid({ jobUid, plugin } = {}) {
  const normalizedUid = String(jobUid || "").trim();
  if (!normalizedUid) return null;

  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin) {
    console.warn("[JobDirect] SDK plugin not found on window. Job fetch skipped.");
    return null;
  }

  const jobModel = resolvedPlugin.switchTo?.("PeterpmJob");
  if (!jobModel) return null;

  const retryTimeouts = [10000, 15000, 20000];
  const wait = (ms) =>
    new Promise((resolve) => {
      setTimeout(resolve, ms);
    });

  try {
    for (let attempt = 0; attempt < retryTimeouts.length; attempt += 1) {
      const timeoutMs = retryTimeouts[attempt];
      const byUniqueId = await fetchFirstByField(jobModel, "unique_id", normalizedUid, {
        timeoutMs,
      });
      if (byUniqueId) return byUniqueId;

      if (/^\d+$/.test(normalizedUid)) {
        const byId = await fetchFirstByField(
          jobModel,
          "id",
          Number.parseInt(normalizedUid, 10),
          { timeoutMs }
        );
        if (byId) return byId;
      }

      if (attempt < retryTimeouts.length - 1) {
        await wait(400 * (attempt + 1));
      }
    }
  } catch (error) {
    console.error("[JobDirect] Failed to fetch job by jobuid", normalizedUid, error);
  }

  return null;
}

export function subscribeJobById({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const jobModel = resolvedPlugin.switchTo?.("PeterpmJob");
  if (!jobModel?.query) return () => {};

  const query = buildJobByFieldQuery(jobModel, "id", normalizedJobId).noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const record = normalizeInvoiceBillContextRecord(extractFirstRecord(payload));
      if (record && typeof record === "object") {
        onChange?.(record);
      }
    },
    onError: (error) => {
      console.error("[JobDirect] Job subscription failed", error);
      onError?.(error);
    },
  });
}

export function subscribeActivitiesByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const activityModel = resolvedPlugin.switchTo?.("PeterpmActivity");
  if (!activityModel?.query) return () => {};

  const query = activityModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select([
      "id",
      "service_id",
      "task",
      "option",
      "quantity",
      "activity_price",
      "activity_text",
      "activity_status",
      "status",
      "date_required",
      "quoted_price",
      "quoted_text",
      "note",
      "warranty",
      "include_in_quote_subtotal",
      "include_in_quote",
      "invoice_to_client",
    ])
    .include("Service", (serviceQuery) =>
      serviceQuery.deSelectAll().select(["id", "service_name"])
    )
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeActivityRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Activities subscription failed", error);
      onError?.(error);
    },
  });
}

export function subscribeMaterialsByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const materialModel = resolvedPlugin.switchTo?.("PeterpmMaterial");
  if (!materialModel?.query) return () => {};

  const query = materialModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select([
      "id",
      "material_name",
      "status",
      "total",
      "tax",
      "description",
      "created_at",
      "transaction_type",
      "service_provider_id",
      "file",
      "receipt",
    ])
    .include("Service_Provider", (providerQuery) =>
      providerQuery
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (contactQuery) =>
          contactQuery.deSelectAll().select(["first_name", "last_name"])
        )
    )
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeMaterialRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Materials subscription failed", error);
      onError?.(error);
    },
  });
}

export function subscribeTasksByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const taskModel = resolvedPlugin.switchTo?.("PeterpmTask");
  if (!taskModel?.query) return () => {};

  const query = taskModel
    .query()
    .where("Job_id", normalizedJobId)
    .deSelectAll()
    .select(["id", "subject", "status", "assignee_id", "date_due", "details"])
    .include("Assignee", (assigneeQuery) =>
      assigneeQuery.deSelectAll().select(["first_name", "last_name", "email"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeTaskRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Tasks subscription failed", error);
      onError?.(error);
    },
  });
}

export function subscribeAppointmentsByJobId({ plugin, jobId, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return () => {};

  const appointmentModel = resolvedPlugin.switchTo?.("PeterpmAppointment");
  if (!appointmentModel?.query) return () => {};

  const query = appointmentModel
    .query()
    .where("job_id", normalizedJobId)
    .deSelectAll()
    .select([
      "id",
      "status",
      "type",
      "title",
      "description",
      "start_time",
      "end_time",
      "event_color",
      "google_calendar_event_color",
      "google_calendar_color",
      "duration_hours",
      "duration_minutes",
      "job_id",
      "location_id",
      "host_id",
      "primary_guest_contact_id",
      "primary_guest_id",
    ])
    .include("Location", (locationQuery) =>
      locationQuery.deSelectAll().select(["id", "property_name"])
    )
    .include("Host", (hostQuery) =>
      hostQuery
        .deSelectAll()
        .select(["id"])
        .include("Contact_Information", (contactQuery) =>
          contactQuery
            .deSelectAll()
            .select(["first_name", "last_name", "email", "sms_number"])
        )
    )
    .include("Primary_Guest", (guestQuery) =>
      guestQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload)
        .map((record) => normalizeAppointmentRecord(record))
        .filter((record) => record.id);
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Appointments subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchContactsForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmContact")
      .query()
      .deSelectAll()
      .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch contact search data", error);
    return [];
  }
}

export function subscribeContactsForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmContact")
    .query()
    .deSelectAll()
    .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Contacts subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchCompaniesForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmCompany")
      .query()
      .deSelectAll()
      .select(["id", "account_type", "name"])
      .include("Primary_Person", (personQuery) =>
        personQuery
          .deSelectAll()
          .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
      )
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch company search data", error);
    return [];
  }
}

export function subscribeCompaniesForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmCompany")
    .query()
    .deSelectAll()
    .select(["id", "account_type", "name"])
    .include("Primary_Person", (personQuery) =>
      personQuery
        .deSelectAll()
        .select(["id", "first_name", "last_name", "email", "sms_number", "office_phone"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Companies subscription failed", error);
      onError?.(error);
    },
  });
}

export async function fetchPropertiesForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmProperty")
      .query()
      .deSelectAll()
      .select([
        "id",
        "unique_id",
        "property_name",
        "lot_number",
        "unit_number",
        "address_1",
        "address_2",
        "address",
        "city",
        "suburb_town",
        "state",
        "postal_code",
        "zip_code",
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
      ]);

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch property search data", error);
    return [];
  }
}

export function subscribePropertiesForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const query = resolvedPlugin
    .switchTo("PeterpmProperty")
    .query()
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "property_name",
      "lot_number",
      "unit_number",
      "address_1",
      "address_2",
      "address",
      "city",
      "suburb_town",
      "state",
      "postal_code",
      "zip_code",
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
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      onChange?.(extractRecords(payload));
    },
    onError: (error) => {
      console.error("[JobDirect] Properties subscription failed", error);
      onError?.(error);
    },
  });
}

function normalizeServiceProviderRecord(rawProvider = {}) {
  const firstName = String(
    rawProvider?.contact_information_first_name ||
      rawProvider?.Contact_Information_First_Name ||
      rawProvider?.Contact_Information?.first_name ||
      rawProvider?.Contact_Information?.First_Name ||
      ""
  ).trim();
  const lastName = String(
    rawProvider?.contact_information_last_name ||
      rawProvider?.Contact_Information_Last_Name ||
      rawProvider?.Contact_Information?.last_name ||
      rawProvider?.Contact_Information?.Last_Name ||
      ""
  ).trim();

  return {
    id: String(rawProvider?.id || rawProvider?.ID || "").trim(),
    unique_id: String(rawProvider?.unique_id || rawProvider?.Unique_ID || "").trim(),
    type: String(rawProvider?.type || rawProvider?.Type || "").trim(),
    status: String(rawProvider?.status || rawProvider?.Status || "").trim(),
    first_name: firstName,
    last_name: lastName,
    email: String(
      rawProvider?.contact_information_email ||
        rawProvider?.Contact_Information_Email ||
        rawProvider?.Contact_Information?.email ||
        rawProvider?.Contact_Information?.Email ||
        ""
    ).trim(),
    sms_number: String(
      rawProvider?.contact_information_sms_number ||
        rawProvider?.Contact_Information_SMS_Number ||
        rawProvider?.Contact_Information?.sms_number ||
        rawProvider?.Contact_Information?.SMS_Number ||
        ""
    ).trim(),
    profile_image: String(
      rawProvider?.contact_information_profile_image ||
        rawProvider?.Contact_Information_Profile_Image ||
        rawProvider?.Contact_Information?.profile_image ||
        rawProvider?.Contact_Information?.Profile_Image ||
        ""
    ).trim(),
  };
}

function isActiveServiceProvider(record = {}) {
  const type = String(record?.type || "").trim().toLowerCase();
  const status = String(record?.status || "").trim().toLowerCase();
  return type === "service provider" && status === "active";
}

export async function fetchServiceProvidersForSearch({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = "PeterpmServiceProvider";

  try {
    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(`
        query calcServiceProviders {
          calcServiceProviders(
            query: [
              { where: { type: "Service Provider" } }
              { andWhere: { status: "Active" } }
            ]
          ) {
            ID: field(arg: ["id"])
            Unique_ID: field(arg: ["unique_id"])
            Type: field(arg: ["type"])
            Status: field(arg: ["status"])
            Contact_Information_First_Name: field(arg: ["Contact_Information", "first_name"])
            Contact_Information_Last_Name: field(arg: ["Contact_Information", "last_name"])
            Contact_Information_Email: field(arg: ["Contact_Information", "email"])
            Contact_Information_SMS_Number: field(arg: ["Contact_Information", "sms_number"])
            Contact_Information_Profile_Image: field(arg: ["Contact_Information", "profile_image"])
          }
        }
      `);
    const response = await fetchDirectWithTimeout(customQuery);
    const records = extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) => isActiveServiceProvider(record));
    if (records.length) return records;
  } catch (error) {
    console.warn("[JobDirect] Custom service provider query failed, using include fallback", error);
  }

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("type", "Service Provider")
      .andWhere("status", "Active")
      .deSelectAll()
      .select(["id", "unique_id", "type", "status"])
      .include("Contact_Information", (contactQuery) =>
        contactQuery
          .deSelectAll()
          .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
      )
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeServiceProviderRecord(record))
      .filter((record) => record.id)
      .filter((record) => isActiveServiceProvider(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch service providers", error);
    return [];
  }
}

export function subscribeServiceProvidersForSearch({ plugin, onChange, onError } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const modelName = "PeterpmServiceProvider";
  const query = resolvedPlugin
    .switchTo(modelName)
    .query()
    .where("type", "Service Provider")
    .andWhere("status", "Active")
    .deSelectAll()
    .select(["id", "unique_id", "type", "status"])
    .include("Contact_Information", (contactQuery) =>
      contactQuery
        .deSelectAll()
        .select(["first_name", "last_name", "email", "sms_number", "profile_image"])
    )
    .noDestroy();

  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload)
        .map((record) => normalizeServiceProviderRecord(record))
        .filter((record) => record.id)
        .filter((record) => isActiveServiceProvider(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error("[JobDirect] Service provider subscription failed", error);
      onError?.(error);
    },
  });
}

function normalizeTaskRecord(rawTask = {}) {
  return {
    id: String(rawTask?.id || rawTask?.ID || "").trim(),
    subject: String(rawTask?.subject || rawTask?.Subject || "").trim(),
    status: String(rawTask?.status || rawTask?.Status || "").trim(),
    assignee_id: String(rawTask?.assignee_id || rawTask?.Assignee_ID || "").trim(),
    date_due: rawTask?.date_due || rawTask?.Date_Due || "",
    details: String(rawTask?.details || rawTask?.Details || "").trim(),
    assignee_first_name: String(
      rawTask?.assignee_first_name || rawTask?.Assignee_First_Name || ""
    ).trim(),
    assignee_last_name: String(
      rawTask?.assignee_last_name || rawTask?.Assignee_Last_Name || ""
    ).trim(),
    assignee_email: String(rawTask?.assignee_email || rawTask?.AssigneeEmail || "").trim(),
  };
}

function hasMeaningfulTaskContent(task = {}) {
  return Boolean(
    String(task?.subject || "").trim() ||
      String(task?.status || "").trim() ||
      String(task?.date_due || "").trim() ||
      String(task?.details || "").trim() ||
      String(task?.assignee_id || "").trim() ||
      String(task?.assignee_first_name || "").trim() ||
      String(task?.assignee_last_name || "").trim() ||
      String(task?.assignee_email || "").trim()
  );
}

export async function fetchTasksByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const taskModel = resolvedPlugin.switchTo("PeterpmTask");
    const customQuery = taskModel
      .query()
      .fromGraphql(`
        query calcTasks($Job_id: PeterpmJobID!) {
          calcTasks(query: [{ where: { Job_id: $Job_id } }]) {
            ID: field(arg: ["id"])
            Status: field(arg: ["status"])
            Subject: field(arg: ["subject"])
            Assignee_ID: field(arg: ["assignee_id"])
            Date_Due: field(arg: ["date_due"])
            Details: field(arg: ["details"])
            Assignee_First_Name: field(arg: ["Assignee", "first_name"])
            Assignee_Last_Name: field(arg: ["Assignee", "last_name"])
            AssigneeEmail: field(arg: ["Assignee", "email"])
          }
        }
      `);

    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { Job_id: normalizedJobId },
    });
    return extractRecords(response)
      .map((record) => normalizeTaskRecord(record))
      .filter((task) => hasMeaningfulTaskContent(task));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch tasks", error);
    return [];
  }
}

export async function fetchTasksByDealId({ plugin, dealId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedDealId = normalizeIdentifier(dealId);
  if (!normalizedDealId) return [];

  try {
    const taskModel = resolvedPlugin.switchTo("PeterpmTask");
    const customQuery = taskModel
      .query()
      .fromGraphql(`
        query calcTasks($Deal_id: PeterpmDealID!) {
          calcTasks(query: [{ where: { Deal_id: $Deal_id } }]) {
            ID: field(arg: ["id"])
            Status: field(arg: ["status"])
            Subject: field(arg: ["subject"])
            Assignee_ID: field(arg: ["assignee_id"])
            Date_Due: field(arg: ["date_due"])
            Details: field(arg: ["details"])
            Assignee_First_Name: field(arg: ["Assignee", "first_name"])
            Assignee_Last_Name: field(arg: ["Assignee", "last_name"])
            AssigneeEmail: field(arg: ["Assignee", "email"])
          }
        }
      `);

    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { Deal_id: normalizedDealId },
    });
    return extractRecords(response)
      .map((record) => normalizeTaskRecord(record))
      .filter((task) => hasMeaningfulTaskContent(task));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch deal tasks", error);
    return [];
  }
}

export async function createTaskRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutationPayload = normalizeTaskMutationPayload(payload, { forCreate: true });
  if (!mutationPayload?.Job_id && !mutationPayload?.Deal_id) {
    throw new Error("Task create is missing Job_id or Deal_id.");
  }

  const mutation = await taskModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Task create was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create task."
    );
  }

  const created =
    findMutationData(result, "createTask") ??
    findMutationData(result, "createTasks") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /task/i.test(key));
  if (created === null) {
    throw new Error("Unable to create task.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmTask");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Task create was cancelled."));
  }

  if (!isPersistedId(resolvedId)) {
    throw new Error("Task was not confirmed by server. Please try again.");
  }

  return normalizeTaskRecord({
    ...(mutationPayload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateTaskRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Task ID is missing.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutationPayload = normalizeTaskMutationPayload(payload, { forCreate: false });
  const mutation = await taskModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Task update was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update task."
    );
  }

  const updated =
    findMutationData(result, "updateTask") ??
    findMutationData(result, "updateTasks") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /task/i.test(key));
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const updatedId = extractCreatedRecordId(result, "PeterpmTask");
  const resolvedId = String(
    updatedRecord?.id || updatedRecord?.ID || updatedId || normalizedId || ""
  ).trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Task update was cancelled."));
  }

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    throw new Error(extractCancellationMessage(result, "Unable to update task."));
  }

  return normalizeTaskRecord({
    ...(mutationPayload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId || normalizedId,
  });
}

export async function deleteTaskRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Task ID is missing.");
  }

  const taskModel = resolvedPlugin.switchTo("PeterpmTask");
  if (!taskModel?.mutation) {
    throw new Error("Task model is unavailable.");
  }

  const mutation = await taskModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Task delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Task delete was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete task."
    );
  }

  const deleted =
    findMutationData(result, "deleteTask") ??
    findMutationData(result, "deleteTasks") ??
    findMutationDataByMatcher(result, (key) => /^delete/i.test(key) && /task/i.test(key));
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id || deletedRecord?.ID || extractCreatedRecordId(result, "PeterpmTask") || normalizedId
  ).trim();
  if (result?.isCancelling && !deletedId) {
    throw new Error(extractCancellationMessage(result, "Task delete was cancelled."));
  }
  if (!deletedId) {
    throw new Error("Unable to delete task.");
  }
  return deletedId;
}

function normalizeCurrencyString(value) {
  if (value === null || value === undefined || value === "") return "";
  const normalized = String(value).replace(/[^0-9.-]+/g, "").trim();
  if (!normalized) return "";
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return "";
  return parsed.toFixed(2);
}

function normalizeActivityDateRequired(value) {
  if (value === null || value === undefined || value === "") return null;

  const text = String(value).trim();
  if (!text) return null;

  if (/^\d+$/.test(text)) {
    const numeric = Number.parseInt(text, 10);
    if (!Number.isFinite(numeric)) return null;
    return numeric > 9_999_999_999 ? Math.floor(numeric / 1000) : numeric;
  }

  const ausMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ausMatch) {
    const day = ausMatch[1].padStart(2, "0");
    const month = ausMatch[2].padStart(2, "0");
    const iso = `${ausMatch[3]}-${month}-${day}`;
    const parsed = new Date(`${iso}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const parsed = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return Math.floor(parsed.getTime() / 1000);
    }
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return Math.floor(parsed.getTime() / 1000);
}

function normalizeActivityRecord(rawActivity = {}) {
  const service = rawActivity?.Service || {};

  return {
    id: String(rawActivity?.id || rawActivity?.ID || "").trim(),
    service_id: String(rawActivity?.service_id || rawActivity?.Service_ID || "").trim(),
    task: String(rawActivity?.task || rawActivity?.Task || "").trim(),
    option: String(rawActivity?.option || rawActivity?.Option || "").trim(),
    quantity: String(rawActivity?.quantity || rawActivity?.Quantity || "1").trim(),
    activity_price: String(
      rawActivity?.activity_price || rawActivity?.Activity_Price || ""
    ).trim(),
    activity_text: String(rawActivity?.activity_text || rawActivity?.Activity_Text || "").trim(),
    activity_status: String(
      rawActivity?.activity_status ||
        rawActivity?.Activity_Status ||
        rawActivity?.Activity_status ||
        rawActivity?.status ||
        rawActivity?.Status ||
        ""
    ).trim(),
    status: String(rawActivity?.status || rawActivity?.Status || "").trim(),
    date_required:
      rawActivity?.date_required || rawActivity?.Date_Required || rawActivity?.date || "",
    quoted_price: String(rawActivity?.quoted_price || rawActivity?.Quoted_Price || "").trim(),
    quoted_text: String(rawActivity?.quoted_text || rawActivity?.Quoted_Text || "").trim(),
    note: String(rawActivity?.note || rawActivity?.Note || "").trim(),
    warranty: String(rawActivity?.warranty || rawActivity?.Warranty || "").trim(),
    include_in_quote_subtotal: parseBooleanValue(
      rawActivity?.include_in_quote_subtotal ?? rawActivity?.Include_In_Quote_Subtotal
    ),
    include_in_quote: parseBooleanValue(
      rawActivity?.include_in_quote ?? rawActivity?.Include_In_Quote
    ),
    invoice_to_client: parseBooleanValue(
      rawActivity?.invoice_to_client ?? rawActivity?.Invoice_to_Client
    ),
    service_name: String(
      rawActivity?.service_name ||
        rawActivity?.Service_Service_Name ||
        service?.service_name ||
        service?.Service_Name ||
        ""
    ).trim(),
  };
}

function normalizeActivityMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};

  const jobId = normalizeIdentifier(source?.job_id ?? source?.Job_ID ?? source?.jobId);
  const serviceId = normalizeIdentifier(
    source?.service_id ?? source?.Service_ID ?? source?.serviceId
  );
  const quantityRaw = normalizeIdentifier(source?.quantity ?? source?.Quantity ?? "1");
  const quantity =
    quantityRaw === "" || quantityRaw === null || quantityRaw === undefined ? 1 : quantityRaw;
  const activityPrice = normalizeCurrencyString(
    source?.activity_price ?? source?.Activity_Price ?? source?.activityPrice
  );
  const dateRequired = normalizeActivityDateRequired(
    source?.date_required ?? source?.Date_Required ?? source?.dateRequired
  );

  next.task = String(source?.task ?? source?.Task ?? "").trim();
  next.option = String(source?.option ?? source?.Option ?? "").trim();
  next.quantity = quantity;
  next.warranty = String(source?.warranty ?? source?.Warranty ?? "").trim();
  next.activity_text = String(source?.activity_text ?? source?.Activity_Text ?? "").trim();
  next.activity_status = String(
    source?.activity_status ??
      source?.Activity_Status ??
      source?.status ??
      source?.Status ??
      "To Be Scheduled"
  ).trim();
  next.include_in_quote = parseBooleanValue(
    source?.include_in_quote ?? source?.Include_In_Quote
  );
  next.include_in_quote_subtotal = parseBooleanValue(
    source?.include_in_quote_subtotal ?? source?.Include_In_Quote_Subtotal ?? true
  );
  next.invoice_to_client = parseBooleanValue(
    source?.invoice_to_client ?? source?.Invoice_to_Client ?? true
  );
  next.note = String(source?.note ?? source?.Note ?? "").trim();
  if (activityPrice) next.activity_price = activityPrice;
  if (serviceId !== "" && serviceId !== null && serviceId !== undefined) {
    next.service_id = serviceId;
  }
  if (dateRequired !== null) next.date_required = dateRequired;
  if (forCreate && (jobId === "" || jobId === null || jobId === undefined)) {
    throw new Error("Activity create is missing job ID.");
  }
  if (forCreate) next.job_id = jobId;
  return next;
}

function normalizeMaterialRecord(rawMaterial = {}) {
  const provider = rawMaterial?.Service_Provider || {};
  const contact = provider?.Contact_Information || {};
  const providerFirstName = String(
    rawMaterial?.service_provider_contact_information_first_name ||
      rawMaterial?.Service_Provider_Contact_Information_First_Name ||
      rawMaterial?.contact_first_name ||
      rawMaterial?.Contact_First_Name ||
      contact?.first_name ||
      contact?.First_Name ||
      ""
  ).trim();
  const providerLastName = String(
    rawMaterial?.service_provider_contact_information_last_name ||
      rawMaterial?.Service_Provider_Contact_Information_Last_Name ||
      rawMaterial?.contact_last_name ||
      rawMaterial?.Contact_Last_Name ||
      contact?.last_name ||
      contact?.Last_Name ||
      ""
  ).trim();

  const fileRaw =
    rawMaterial?.file ??
    rawMaterial?.File ??
    rawMaterial?.receipt ??
    rawMaterial?.Receipt ??
    "";
  const parsedFile = parseUploadFileObject(fileRaw);
  const parsedFileUrl = String(parsedFile?.link || parsedFile?.url || "").trim();
  const fileUrl = parsedFileUrl || String(fileRaw || "").trim();
  const filePayload =
    parsedFile ||
    (fileUrl
      ? {
          link: fileUrl,
          name: String(rawMaterial?.file_name || rawMaterial?.File_Name || "").trim(),
          size: "",
          type: "",
          s3_id: "",
        }
      : "");

  return {
    id: String(rawMaterial?.id || rawMaterial?.ID || "").trim(),
    material_name: String(rawMaterial?.material_name || rawMaterial?.Material_Name || "").trim(),
    status: String(rawMaterial?.status || rawMaterial?.Status || "").trim(),
    total: String(rawMaterial?.total || rawMaterial?.Total || "").trim(),
    tax: String(rawMaterial?.tax || rawMaterial?.Tax || "").trim(),
    description: String(rawMaterial?.description || rawMaterial?.Description || "").trim(),
    created_at: rawMaterial?.created_at || rawMaterial?.Created_At || "",
    transaction_type: String(
      rawMaterial?.transaction_type || rawMaterial?.Transaction_Type || ""
    ).trim(),
    service_provider_id: String(
      rawMaterial?.service_provider_id || rawMaterial?.Service_Provider_ID || ""
    ).trim(),
    receipt: String(rawMaterial?.receipt || rawMaterial?.Receipt || "").trim(),
    file: fileRaw,
    file_payload: filePayload,
    file_url: fileUrl,
    file_name: String(rawMaterial?.file_name || rawMaterial?.File_Name || parsedFile?.name || "").trim(),
    provider_first_name: providerFirstName,
    provider_last_name: providerLastName,
    provider_name: [providerFirstName, providerLastName].filter(Boolean).join(" ").trim(),
  };
}

function normalizeMaterialMutationPayload(payload = {}, { forCreate = false } = {}) {
  const source = payload && typeof payload === "object" ? payload : {};
  const next = {};
  const hasOwn = (key) => Object.prototype.hasOwnProperty.call(source, key);

  const jobId = normalizeIdentifier(source?.job_id ?? source?.Job_ID ?? source?.jobId);
  const providerId = normalizeIdentifier(
    source?.service_provider_id ??
      source?.Service_Provider_ID ??
      source?.serviceProviderId
  );
  const total = normalizeCurrencyString(source?.total ?? source?.Total ?? source?.total_cost);

  const hasMaterialName = hasOwn("material_name") || hasOwn("Material_Name");
  if (hasMaterialName) {
    next.material_name = String(source?.material_name ?? source?.Material_Name ?? "").trim();
  }

  const hasStatus = hasOwn("status") || hasOwn("Status");
  if (hasStatus) {
    next.status = String(source?.status ?? source?.Status ?? "").trim();
  } else if (forCreate) {
    next.status = "New";
  }

  const hasTax = hasOwn("tax") || hasOwn("Tax");
  if (hasTax) {
    next.tax = String(source?.tax ?? source?.Tax ?? "").trim();
  }

  const hasDescription = hasOwn("description") || hasOwn("Description");
  if (hasDescription) {
    next.description = String(source?.description ?? source?.Description ?? "").trim();
  }

  const hasTransactionType = hasOwn("transaction_type") || hasOwn("Transaction_Type");
  if (hasTransactionType) {
    next.transaction_type = String(
      source?.transaction_type ?? source?.Transaction_Type ?? ""
    ).trim();
  }

  const hasTotal = hasOwn("total") || hasOwn("Total") || hasOwn("total_cost");
  if (hasTotal) {
    next.total = total;
  }

  const hasServiceProviderId =
    hasOwn("service_provider_id") || hasOwn("Service_Provider_ID") || hasOwn("serviceProviderId");
  if (hasServiceProviderId) {
    next.service_provider_id =
      providerId !== "" && providerId !== null && providerId !== undefined ? providerId : "";
  }

  const hasFileField =
    Object.prototype.hasOwnProperty.call(source, "file") ||
    Object.prototype.hasOwnProperty.call(source, "File");
  const fileInput = source?.file ?? source?.File;
  if (hasFileField) {
    if (typeof fileInput === "string") {
      next.file = fileInput.trim();
    } else if (fileInput && typeof fileInput === "object") {
      next.file = fileInput;
    } else {
      next.file = "";
    }
  }

  const hasReceiptField =
    Object.prototype.hasOwnProperty.call(source, "receipt") ||
    Object.prototype.hasOwnProperty.call(source, "Receipt");
  const receipt = String(source?.receipt ?? source?.Receipt ?? "").trim();
  if (hasReceiptField) next.receipt = receipt;
  if (!hasFileField && receipt) next.file = receipt;

  if (forCreate && (jobId === "" || jobId === null || jobId === undefined)) {
    throw new Error("Material create is missing job ID.");
  }
  if (forCreate) next.job_id = jobId;

  return next;
}

export async function fetchServicesForActivities({ plugin } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmService")
      .query()
      .deSelectAll()
      .select([
        "id",
        "service_name",
        "service_description",
        "description",
        "service_price",
        "standard_warranty",
        "primary_service_id",
        "service_type",
      ])
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch services for activities", error);
    return [];
  }
}

export async function fetchActivitiesByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmActivity")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select([
        "id",
        "service_id",
        "task",
        "option",
        "quantity",
        "activity_price",
        "activity_text",
        "activity_status",
        "status",
        "date_required",
        "quoted_price",
        "quoted_text",
        "note",
        "warranty",
        "include_in_quote_subtotal",
        "include_in_quote",
        "invoice_to_client",
      ])
      .include("Service", (serviceQuery) =>
        serviceQuery.deSelectAll().select(["id", "service_name"])
      )
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map((record) => normalizeActivityRecord(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch activities", error);
    return [];
  }
}

export async function createActivityRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutationPayload = normalizeActivityMutationPayload(payload, { forCreate: true });
  const mutation = await activityModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Activity create was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create activity."
    );
  }

  const created =
    findMutationData(result, "createActivity") ??
    findMutationData(result, "createActivities") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /activity/i.test(key));
  if (created === null) {
    throw new Error("Unable to create activity.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmActivity");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Activity create was cancelled."));
  }

  if (!isPersistedId(resolvedId)) {
    throw new Error("Activity was not confirmed by server. Please try again.");
  }

  return normalizeActivityRecord({
    ...(mutationPayload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateActivityRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Activity ID is missing.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutationPayload = normalizeActivityMutationPayload(payload, { forCreate: false });
  const mutation = await activityModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Activity update was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update activity."
    );
  }

  const updated =
    findMutationData(result, "updateActivity") ??
    findMutationData(result, "updateActivities") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /activity/i.test(key));
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const updatedId = extractCreatedRecordId(result, "PeterpmActivity");
  const resolvedId = String(
    updatedRecord?.id || updatedRecord?.ID || updatedId || normalizedId || ""
  ).trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Activity update was cancelled."));
  }

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Activity update returned no updated record. Treating as success.",
      result
    );
  }

  return normalizeActivityRecord({
    ...(mutationPayload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId || normalizedId,
  });
}

export async function deleteActivityRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Activity ID is missing.");
  }

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const mutation = await activityModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Activity delete operation is unavailable.");
  }

  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Activity delete was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete activity."
    );
  }

  const deleted =
    findMutationData(result, "deleteActivity") ??
    findMutationData(result, "deleteActivities") ??
    findMutationDataByMatcher(result, (key) => /^delete/i.test(key) && /activity/i.test(key));
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, "PeterpmActivity") ||
      normalizedId
  ).trim();
  if (result?.isCancelling && !deletedId) {
    throw new Error(extractCancellationMessage(result, "Activity delete was cancelled."));
  }
  if (!deletedId) {
    throw new Error("Unable to delete activity.");
  }
  return deletedId;
}

export async function fetchMaterialsByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmMaterial")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select([
        "id",
        "material_name",
        "status",
        "total",
        "tax",
        "description",
        "created_at",
        "transaction_type",
        "service_provider_id",
        "file",
        "receipt",
      ])
      .include("Service_Provider", (providerQuery) =>
        providerQuery
          .deSelectAll()
          .select(["id"])
          .include("Contact_Information", (contactQuery) =>
            contactQuery.deSelectAll().select(["first_name", "last_name"])
          )
      )
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map((record) => normalizeMaterialRecord(record));
  } catch (error) {
    console.error("[JobDirect] Failed to fetch materials", error);
    return [];
  }
}

export async function createMaterialRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutationPayload = normalizeMaterialMutationPayload(payload, { forCreate: true });
  const mutation = await materialModel.mutation();
  mutation.createOne(mutationPayload);
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Material create was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create material."
    );
  }

  const created =
    findMutationData(result, "createMaterial") ??
    findMutationData(result, "createMaterials") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /material/i.test(key));
  if (created === null) {
    throw new Error("Unable to create material.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmMaterial");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Material create was cancelled."));
  }
  if (!isPersistedId(resolvedId)) {
    throw new Error("Material was not confirmed by server. Please try again.");
  }

  return normalizeMaterialRecord({
    ...(mutationPayload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateMaterialRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Material ID is missing.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutationPayload = normalizeMaterialMutationPayload(payload, { forCreate: false });
  const mutation = await materialModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(mutationPayload));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Material update was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update material."
    );
  }

  const updated =
    findMutationData(result, "updateMaterial") ??
    findMutationData(result, "updateMaterials") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /material/i.test(key));
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const updatedId = extractCreatedRecordId(result, "PeterpmMaterial");
  const resolvedId = String(
    updatedRecord?.id || updatedRecord?.ID || updatedId || normalizedId || ""
  ).trim();

  if (result?.isCancelling && !isPersistedId(resolvedId)) {
    throw new Error(extractCancellationMessage(result, "Material update was cancelled."));
  }

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Material update returned no updated record. Treating as success.",
      result
    );
  }

  return normalizeMaterialRecord({
    ...(mutationPayload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: resolvedId || normalizedId,
  });
}

export async function deleteMaterialRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Material ID is missing.");
  }

  const materialModel = resolvedPlugin.switchTo("PeterpmMaterial");
  if (!materialModel?.mutation) {
    throw new Error("Material model is unavailable.");
  }

  const mutation = await materialModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Material delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  if (!result) throw new Error("Material delete was cancelled.");

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete material."
    );
  }

  const deleted =
    findMutationData(result, "deleteMaterial") ??
    findMutationData(result, "deleteMaterials") ??
    findMutationDataByMatcher(result, (key) => /^delete/i.test(key) && /material/i.test(key));
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, "PeterpmMaterial") ||
      normalizedId
  ).trim();
  if (result?.isCancelling && !deletedId) {
    throw new Error(extractCancellationMessage(result, "Material delete was cancelled."));
  }
  if (!deletedId) {
    throw new Error("Unable to delete material.");
  }
  return deletedId;
}

function normalizeAppointmentRecord(rawAppointment = {}) {
  const hostContact = rawAppointment?.Host?.Contact_Information || {};
  const primaryGuest = rawAppointment?.Primary_Guest || {};
  const location = rawAppointment?.Location || {};

  return {
    id: String(rawAppointment?.id || rawAppointment?.ID || "").trim(),
    status: String(rawAppointment?.status || rawAppointment?.Status || "").trim(),
    type: String(rawAppointment?.type || rawAppointment?.Type || "").trim(),
    title: String(rawAppointment?.title || rawAppointment?.Title || "").trim(),
    description: String(
      rawAppointment?.description || rawAppointment?.Description || ""
    ).trim(),
    start_time:
      rawAppointment?.start_time || rawAppointment?.Start_Time || rawAppointment?.startTime || "",
    end_time:
      rawAppointment?.end_time || rawAppointment?.End_Time || rawAppointment?.endTime || "",
    duration_hours: String(
      rawAppointment?.duration_hours || rawAppointment?.Duration_Hours || "0"
    ).trim(),
    duration_minutes: String(
      rawAppointment?.duration_minutes || rawAppointment?.Duration_Minutes || "0"
    ).trim(),
    event_color: String(
      rawAppointment?.event_color ||
        rawAppointment?.Event_Color ||
        rawAppointment?.event_colour ||
        rawAppointment?.Event_Colour ||
        rawAppointment?.google_calendar_event_color ||
        rawAppointment?.Google_Calendar_Event_Color ||
        rawAppointment?.google_calendar_color ||
        rawAppointment?.Google_Calendar_Color ||
        ""
    ).trim(),
    job_id: String(rawAppointment?.job_id || rawAppointment?.Job_ID || "").trim(),
    location_id: String(
      rawAppointment?.location_id || rawAppointment?.Location_ID || ""
    ).trim(),
    host_id: String(rawAppointment?.host_id || rawAppointment?.Host_ID || "").trim(),
    primary_guest_contact_id: String(
      rawAppointment?.primary_guest_contact_id ||
        rawAppointment?.primary_guest_id ||
        rawAppointment?.Primary_Guest_Contact_ID ||
        rawAppointment?.Primary_Guest_ID ||
        ""
    ).trim(),
    location_name: String(
      rawAppointment?.Location_Property_Name ||
        rawAppointment?.location_property_name ||
        location?.property_name ||
        location?.Property_Name ||
        ""
    ).trim(),
    host_first_name: String(
      rawAppointment?.Host_Contact_Information_First_Name ||
        rawAppointment?.host_contact_information_first_name ||
        hostContact?.first_name ||
        hostContact?.First_Name ||
        ""
    ).trim(),
    host_last_name: String(
      rawAppointment?.Host_Contact_Information_Last_Name ||
        rawAppointment?.host_contact_information_last_name ||
        hostContact?.last_name ||
        hostContact?.Last_Name ||
        ""
    ).trim(),
    primary_guest_first_name: String(
      rawAppointment?.Primary_Guest_First_Name ||
        rawAppointment?.primary_guest_first_name ||
        primaryGuest?.first_name ||
        primaryGuest?.First_Name ||
        ""
    ).trim(),
    primary_guest_last_name: String(
      rawAppointment?.Primary_Guest_Last_Name ||
        rawAppointment?.primary_guest_last_name ||
        primaryGuest?.last_name ||
        primaryGuest?.Last_Name ||
        ""
    ).trim(),
  };
}

export async function fetchAppointmentsByJobId({ plugin, jobId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmAppointment")
      .query()
      .where("job_id", normalizedJobId)
      .deSelectAll()
      .select([
        "id",
        "status",
        "type",
        "title",
        "description",
        "start_time",
        "end_time",
        "event_color",
        "google_calendar_event_color",
        "google_calendar_color",
        "duration_hours",
        "duration_minutes",
        "job_id",
        "location_id",
        "host_id",
        "primary_guest_contact_id",
        "primary_guest_id",
      ])
      .include("Location", (locationQuery) =>
        locationQuery.deSelectAll().select(["id", "property_name"])
      )
      .include("Host", (hostQuery) =>
        hostQuery
          .deSelectAll()
          .select(["id"])
          .include("Contact_Information", (contactQuery) =>
            contactQuery
              .deSelectAll()
              .select(["first_name", "last_name", "email", "sms_number"])
          )
      )
      .include("Primary_Guest", (guestQuery) =>
        guestQuery.deSelectAll().select(["id", "first_name", "last_name", "email", "sms_number"])
      )
      .noDestroy();

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response)
      .map((record) => normalizeAppointmentRecord(record))
      .filter((record) => record.id);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch appointments", error);
    return [];
  }
}

export async function createAppointmentRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Appointment create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create appointment."
    );
  }

  const created =
    findMutationData(result, "createAppointment") ??
    findMutationData(result, "createAppointments") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /appointment/i.test(key));

  if (created === null) {
    throw new Error("Unable to create appointment.");
  }

  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmAppointment");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || createdId || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Appointment was not confirmed by server. Please try again.");
  }

  return normalizeAppointmentRecord({
    ...(payload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateAppointmentRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Appointment ID is missing.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Appointment update was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update appointment."
    );
  }

  const updated =
    findMutationData(result, "updateAppointment") ??
    findMutationData(result, "updateAppointments") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /appointment/i.test(key));
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const updatedId = extractCreatedRecordId(result, "PeterpmAppointment");

  if (updatedRecord === null || (!updatedRecord && !updatedId)) {
    console.warn(
      "[JobDirect] Appointment update returned no updated record. Treating as success.",
      result
    );
  }

  return normalizeAppointmentRecord({
    ...(payload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: updatedRecord?.id || updatedRecord?.ID || updatedId || normalizedId,
  });
}

export async function deleteAppointmentRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Appointment ID is missing.");
  }

  const appointmentModel = resolvedPlugin.switchTo("PeterpmAppointment");
  if (!appointmentModel?.mutation) {
    throw new Error("Appointment model is unavailable.");
  }

  const mutation = await appointmentModel.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Appointment delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error("Appointment delete was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete appointment."
    );
  }

  const deleted =
    findMutationData(result, "deleteAppointment") ??
    findMutationData(result, "deleteAppointments") ??
    findMutationDataByMatcher(result, (key) => /^delete/i.test(key) && /appointment/i.test(key));
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id ||
      deletedRecord?.ID ||
      extractCreatedRecordId(result, "PeterpmAppointment") ||
      normalizedId
  ).trim();
  if (!deletedId) {
    throw new Error("Unable to delete appointment.");
  }

  return deletedId;
}

function parseUploadFileObject(raw = null) {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    for (const item of raw) {
      const parsed = parseUploadFileObject(item);
      if (parsed) return parsed;
    }
    return null;
  }
  if (typeof raw === "string") {
    const stripWrappingQuotes = (value = "") => {
      let next = String(value || "").trim();
      while (
        (next.startsWith('"') && next.endsWith('"')) ||
        (next.startsWith("'") && next.endsWith("'"))
      ) {
        next = next.slice(1, -1).trim();
      }
      return next;
    };

    let trimmed = stripWrappingQuotes(raw);
    if (!trimmed) return null;

    if (/%[0-9A-Fa-f]{2}/.test(trimmed)) {
      try {
        const decoded = decodeURIComponent(trimmed);
        if (decoded) trimmed = stripWrappingQuotes(decoded);
      } catch {
        // Keep original if decode fails.
      }
    }

    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return parseUploadFileObject(JSON.parse(trimmed));
      } catch {
        return null;
      }
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return { link: trimmed };
    }
    return null;
  }
  if (typeof raw === "object") {
    if (raw.File) {
      const nested = parseUploadFileObject(raw.File);
      if (nested) return nested;
    }
    const link = raw.link || raw.url || raw.path || raw.src || "";
    if (!link) return null;
    return {
      link,
      name: raw.name || raw.filename || "",
      size: raw.size ?? "",
      type: raw.type || raw.mime || "",
      s3_id: raw.s3_id || raw.s3Id || "",
    };
  }
  return null;
}

function extractFileNameFromUrl(url = "") {
  const value = String(url || "").trim();
  if (!value) return "";
  try {
    const clean = value.split("?")[0];
    const parts = clean.split("/");
    return decodeURIComponent(parts[parts.length - 1] || "");
  } catch {
    return "";
  }
}

function isImageUpload(fileType = "", fileName = "", uploadType = "") {
  if (/photo/i.test(String(uploadType || ""))) return true;
  if (/^image\//i.test(String(fileType || "").trim())) return true;
  return /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif|avif)$/i.test(String(fileName || "").trim());
}

function normalizeUploadRecord(rawUpload = {}) {
  const id = String(rawUpload?.id || rawUpload?.ID || "").trim();
  const uploadType = String(rawUpload?.type || rawUpload?.Type || "").trim();
  const photoUpload = String(rawUpload?.photo_upload || rawUpload?.Photo_Upload || "").trim();
  const fileUploadObj = parseUploadFileObject(rawUpload?.file_upload || rawUpload?.File_Upload);
  const fileUploadUrl = String(fileUploadObj?.link || fileUploadObj?.url || "").trim();
  const url = photoUpload || fileUploadUrl;

  const explicitFileName = String(
    rawUpload?.file_name ||
      rawUpload?.File_Name ||
      rawUpload?.photo_name ||
      rawUpload?.Photo_Name ||
      fileUploadObj?.name ||
      ""
  ).trim();
  const derivedFileName = explicitFileName || extractFileNameFromUrl(url) || "Upload";
  const mime = String(fileUploadObj?.type || "").trim();
  const isPhoto = isImageUpload(mime, derivedFileName, uploadType) || Boolean(photoUpload);

  return {
    id,
    type: uploadType || (isPhoto ? "Photo" : "File"),
    photo_upload: photoUpload,
    file_upload: fileUploadObj,
    url,
    name: derivedFileName,
    file_type: mime,
    created_at: rawUpload?.created_at || rawUpload?.Created_At || "",
    property_name_id: String(
      rawUpload?.property_name_id || rawUpload?.Property_Name_ID || ""
    ).trim(),
  };
}

async function requestSignedUpload({ file, uploadPath = "uploads" } = {}) {
  const apiKey = String(VITAL_STATS_CONFIG.apiKey || "").trim();
  const slug = String(VITAL_STATS_CONFIG.slug || "").trim().toLowerCase();
  const uploadEndpoint = String(
    import.meta.env.VITE_VITALSTATS_UPLOAD_ENDPOINT || (slug ? `https://${slug}.vitalstats.app/api/v1/rest/upload` : "")
  ).trim();

  if (!apiKey || !uploadEndpoint) {
    throw new Error("Upload endpoint config is missing.");
  }

  const safePath = sanitizeUploadPath(uploadPath || "uploads");
  const baseName = String(file?.name || "upload").trim() || "upload";
  const scopedName = safePath ? `${safePath}/${baseName}` : baseName;

  const response = await fetch(uploadEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Api-Key": apiKey,
    },
    body: JSON.stringify([
      {
        type: file?.type || "application/octet-stream",
        name: scopedName,
        generateName: true,
      },
    ]),
  });

  if (!response.ok) {
    throw new Error("Unable to request upload URL.");
  }

  const payload = await response.json().catch(() => null);
  const result = Array.isArray(payload) ? payload[0] : payload;
  if (Number(result?.statusCode || 200) >= 400) {
    throw new Error("Upload endpoint rejected the request.");
  }

  const data = result?.data || result || {};
  if (!data?.uploadUrl || !data?.url) {
    throw new Error("Invalid upload response.");
  }
  return data;
}

async function uploadToSignedUrl({ uploadUrl, file } = {}) {
  const response = await fetch(uploadUrl, {
    method: "PUT",
    body: file,
    headers: {
      "Content-Type": file?.type || "application/octet-stream",
    },
  });
  if (!response.ok) {
    throw new Error("Failed to upload file.");
  }
}

async function fetchUploadsByField({
  plugin,
  fieldName,
  variableName,
  variableType,
  idValue,
  fetchErrorLabel = "uploads",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) return [];

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.query) return [];

  try {
    const customQuery = uploadModel.query().fromGraphql(`
      query calcUploads($${variableName}: ${variableType}!) {
        calcUploads(query: [{ where: { ${fieldName}: $${variableName} } }]) {
          ID: field(arg: ["id"])
          File_Upload: field(arg: ["file_upload"])
          Type: field(arg: ["type"])
          Photo_Upload: field(arg: ["photo_upload"])
          File_Name: field(arg: ["file_name"])
          Photo_Name: field(arg: ["photo_name"])
          Created_At: field(arg: ["created_at"])
          Property_Name_ID: field(arg: ["property_name_id"])
          Job_ID: field(arg: ["job_id"])
        }
      }
    `);
    const response = await fetchDirectWithTimeout(customQuery, {
      variables: { [variableName]: normalizedId },
    });
    const records = extractRecords(response).map((item) => normalizeUploadRecord(item));
    if (records.length) return records;
  } catch (error) {
    console.warn(
      `[JobDirect] Custom ${fetchErrorLabel} query failed, using model fallback`,
      error
    );
  }

  try {
    const query = uploadModel
      .query()
      .where(fieldName, normalizedId)
      .deSelectAll()
      .select([
        "id",
        "photo_upload",
        "file_upload",
        "type",
        "file_name",
        "photo_name",
        "created_at",
        "property_name_id",
        "job_id",
      ])
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    return extractRecords(response).map((item) => normalizeUploadRecord(item));
  } catch (error) {
    console.error(`[JobDirect] Failed to fetch ${fetchErrorLabel}`, error);
    return [];
  }
}

function subscribeUploadsByField({
  plugin,
  fieldName,
  idValue,
  onChange,
  onError,
  logLabel = "uploads",
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) return () => {};

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.query) return () => {};

  const query = uploadModel
    .query()
    .where(fieldName, normalizedId)
    .deSelectAll()
    .select([
      "id",
      "photo_upload",
      "file_upload",
      "type",
      "file_name",
      "photo_name",
      "created_at",
      "property_name_id",
      "job_id",
    ])
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((record) => normalizeUploadRecord(record));
      onChange?.(records);
    },
    onError: (error) => {
      console.error(`[JobDirect] ${logLabel} subscription failed`, error);
      onError?.(error);
    },
  });
}

async function createUploadFromFileByField({
  plugin,
  fieldName,
  idValue,
  missingIdMessage,
  file,
  uploadPath,
  additionalPayload,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(idValue);
  if (!normalizedId) {
    throw new Error(missingIdMessage || "Record ID is missing.");
  }
  if (!file) {
    throw new Error("No file selected.");
  }

  const signed = await requestSignedUpload({
    file,
    uploadPath: sanitizeUploadPath(uploadPath),
  });
  await uploadToSignedUrl({ uploadUrl: signed.uploadUrl, file });

  const isPhoto = isImageUpload(file?.type || "", file?.name || "", "");
  const extraPayload =
    additionalPayload && typeof additionalPayload === "object" ? additionalPayload : {};

  const payload = {
    ...extraPayload,
    [fieldName]: normalizedId,
    type: isPhoto ? "Photo" : "File",
    photo_upload: isPhoto ? signed.url : "",
    file_upload: isPhoto
      ? ""
      : {
          link: signed.url,
          name: file?.name || "",
          size: file?.size || "",
          type: file?.type || "",
          s3_id: signed?.key || "",
        },
    file_name: isPhoto ? "" : file?.name || "",
    photo_name: isPhoto ? file?.name || "" : "",
  };

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const mutation = await uploadModel.mutation();
  mutation.createOne(payload);
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Upload create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to save upload."
    );
  }

  const created =
    findMutationData(result, "createUpload") ??
    findMutationData(result, "createUploads") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /upload/i.test(key));
  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const createdId = extractCreatedRecordId(result, "PeterpmUpload");

  return normalizeUploadRecord({
    ...payload,
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: createdRecord?.id || createdRecord?.ID || createdId || "",
  });
}

export async function fetchPropertyUploads({ plugin, propertyId } = {}) {
  return fetchUploadsByField({
    plugin,
    fieldName: "property_name_id",
    variableName: "property_name_id",
    variableType: "PeterpmPropertyID",
    idValue: propertyId,
    fetchErrorLabel: "property uploads",
  });
}

export async function createPropertyUploadFromFile({
  plugin,
  propertyId,
  file,
  uploadPath = "property-uploads",
  additionalPayload,
} = {}) {
  return createUploadFromFileByField({
    plugin,
    fieldName: "property_name_id",
    idValue: propertyId,
    missingIdMessage: "Property ID is missing.",
    file,
    uploadPath,
    additionalPayload,
  });
}

export function subscribePropertyUploadsByPropertyId({
  plugin,
  propertyId,
  onChange,
  onError,
} = {}) {
  return subscribeUploadsByField({
    plugin,
    fieldName: "property_name_id",
    idValue: propertyId,
    onChange,
    onError,
    logLabel: "Property uploads",
  });
}

export async function fetchJobUploads({ plugin, jobId } = {}) {
  return fetchUploadsByField({
    plugin,
    fieldName: "job_id",
    variableName: "jobid",
    variableType: "PeterpmJobID",
    idValue: jobId,
    fetchErrorLabel: "job uploads",
  });
}

export async function createJobUploadFromFile({
  plugin,
  jobId,
  file,
  uploadPath = "job-uploads",
  additionalPayload,
} = {}) {
  return createUploadFromFileByField({
    plugin,
    fieldName: "job_id",
    idValue: jobId,
    missingIdMessage: "Job ID is missing.",
    file,
    uploadPath,
    additionalPayload,
  });
}

export function subscribeJobUploadsByJobId({ plugin, jobId, onChange, onError } = {}) {
  return subscribeUploadsByField({
    plugin,
    fieldName: "job_id",
    idValue: jobId,
    onChange,
    onError,
    logLabel: "Job uploads",
  });
}

export async function uploadMaterialFile({ file, uploadPath = "materials/receipts" } = {}) {
  if (!file) {
    throw new Error("No file selected.");
  }
  const signed = await requestSignedUpload({
    file,
    uploadPath: sanitizeUploadPath(uploadPath),
  });
  await uploadToSignedUrl({ uploadUrl: signed.uploadUrl, file });
  const url = String(signed?.url || "").trim();
  return {
    url,
    fileObject: {
      link: url,
      name: String(file?.name || "").trim(),
      size: file?.size || "",
      type: String(file?.type || "").trim(),
      s3_id: String(signed?.key || "").trim(),
    },
  };
}

export async function deleteUploadRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Upload ID is missing.");
  }

  const uploadModel = resolvedPlugin.switchTo("PeterpmUpload");
  if (!uploadModel?.mutation) {
    throw new Error("Upload model is unavailable.");
  }

  const mutation = await uploadModel.mutation();
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Upload delete was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete upload."
    );
  }

  return true;
}

export async function createContactRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const contactModel = resolvedPlugin.switchTo("PeterpmContact");
  if (!contactModel?.mutation) {
    throw new Error("Contact model is unavailable.");
  }

  const mutation = await contactModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Contact create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create contact."
    );
  }

  const created = findMutationData(result, "createContact");
  if (created === null) {
    throw new Error("Unable to create contact.");
  }

  const id = extractCreatedRecordId(result, "PeterpmContact");
  const resolvedId = String(created?.id || created?.ID || created?.Contact_ID || id || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Contact was not confirmed by server. Please try again.");
  }

  return {
    ...payload,
    ...(created && typeof created === "object" ? created : {}),
    id: resolvedId,
  };
}

export async function createCompanyRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const companyModel = resolvedPlugin.switchTo("PeterpmCompany");
  if (!companyModel?.mutation) {
    throw new Error("Company model is unavailable.");
  }

  const mutation = await companyModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Company create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create company."
    );
  }

  const created = findMutationData(result, "createCompany");
  if (created === null) {
    throw new Error("Unable to create company.");
  }

  const id = extractCreatedRecordId(result, "PeterpmCompany");
  const resolvedId = String(created?.id || created?.ID || id || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Company was not confirmed by server. Please try again.");
  }

  return {
    ...payload,
    ...(created && typeof created === "object" ? created : {}),
    id: resolvedId,
  };
}

const PROPERTY_FEATURE_OPTIONS = [
  { value: "713", label: "Brick" },
  { value: "712", label: "Concrete" },
  { value: "711", label: "Flat Roof" },
  { value: "710", label: "Highset" },
  { value: "709", label: "Iron Roof" },
  { value: "708", label: "Lowset" },
  { value: "707", label: "PostWar" },
  { value: "706", label: "Queenslander" },
  { value: "705", label: "Raked Ceiling" },
  { value: "704", label: "Sloping Block" },
  { value: "703", label: "Super 6 / Fibro roof" },
  { value: "702", label: "Tile Roof" },
  { value: "701", label: "Town house" },
  { value: "700", label: "Unit Block" },
  { value: "699", label: "Warehouse" },
  { value: "698", label: "Wood" },
  { value: "697", label: "Wood & Brick" },
];

const PROPERTY_FEATURE_LABEL_BY_VALUE = Object.fromEntries(
  PROPERTY_FEATURE_OPTIONS.map((option) => [String(option.value), option.label])
);
const PROPERTY_FEATURE_VALUE_BY_LABEL = Object.fromEntries(
  PROPERTY_FEATURE_OPTIONS.map((option) => [String(option.label).trim().toLowerCase(), String(option.value)])
);

function normalizePropertyFeatureValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (PROPERTY_FEATURE_LABEL_BY_VALUE[raw]) return raw;
  const fromLabel = PROPERTY_FEATURE_VALUE_BY_LABEL[raw.toLowerCase()];
  if (fromLabel) return fromLabel;
  const idMatch = raw.match(/\d+/);
  if (idMatch && PROPERTY_FEATURE_LABEL_BY_VALUE[idMatch[0]]) return idMatch[0];
  return "";
}

function extractPropertyFeatureTokens(value) {
  if (value === null || value === undefined) return [];

  const raw =
    typeof value === "object" && !Array.isArray(value)
      ? value.id || value.value || value.name || value.label || ""
      : value;
  const text = String(raw || "").trim();
  if (!text) return [];

  return text
    .replace(/\*\/\*/g, ",")
    .split(/[,;\n|]/)
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function preparePropertyMutationPayload(payload = {}) {
  const valueOrEmpty = (value) => String(value || "").trim();
  const features = Array.isArray(payload?.building_features)
    ? payload.building_features
        .flatMap((item) => extractPropertyFeatureTokens(item))
        .map((item) => normalizePropertyFeatureValue(item))
        .filter(Boolean)
    : extractPropertyFeatureTokens(valueOrEmpty(payload?.building_features))
        .map((item) => normalizePropertyFeatureValue(item))
        .filter(Boolean);
  const uniqueFeatures = Array.from(new Set(features));
  const featuresText = uniqueFeatures
    .map((featureId) => PROPERTY_FEATURE_LABEL_BY_VALUE[featureId] || featureId)
    .join(", ");
  const buildingFeaturesRelation = uniqueFeatures.map((featureId) => ({
    id: /^\d+$/.test(String(featureId)) ? Number.parseInt(featureId, 10) : featureId,
  }));

  return {
    property_name: valueOrEmpty(payload?.property_name),
    lot_number: valueOrEmpty(payload?.lot_number),
    unit_number: valueOrEmpty(payload?.unit_number),
    address_1: valueOrEmpty(payload?.address_1),
    address_2: valueOrEmpty(payload?.address_2),
    suburb_town: valueOrEmpty(payload?.suburb_town),
    postal_code: valueOrEmpty(payload?.postal_code),
    state: valueOrEmpty(payload?.state),
    country: valueOrEmpty(payload?.country),
    property_type: valueOrEmpty(payload?.property_type),
    building_type: valueOrEmpty(payload?.building_type),
    building_type_other: valueOrEmpty(payload?.building_type_other),
    foundation_type: valueOrEmpty(payload?.foundation_type),
    bedrooms: valueOrEmpty(payload?.bedrooms),
    manhole: Boolean(payload?.manhole),
    stories: valueOrEmpty(payload?.stories),
    building_age: valueOrEmpty(payload?.building_age),
    building_features: featuresText,
    building_features_options_as_text: featuresText,
    Building_Features: buildingFeaturesRelation,
  };
}

export async function createPropertyRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.mutation) {
    throw new Error("Property model is unavailable.");
  }

  const mutation = await propertyModel.mutation();
  mutation.createOne(preparePropertyMutationPayload(payload || {}));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Property create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create property."
    );
  }

  const created = findMutationData(result, "createProperty");
  if (created === null) {
    throw new Error("Unable to create property.");
  }

  const id = extractCreatedRecordId(result, "PeterpmProperty");
  const resolvedId = String(created?.id || created?.ID || created?.Property_ID || id || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Property was not confirmed by server. Please try again.");
  }

  return {
    ...(payload || {}),
    ...(created && typeof created === "object" ? created : {}),
    id: resolvedId,
  };
}

export async function updatePropertyRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Property ID is missing.");
  }

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.mutation) {
    throw new Error("Property model is unavailable.");
  }

  const mutation = await propertyModel.mutation();
  mutation.update((query) =>
    query.where("id", normalizedId).set(preparePropertyMutationPayload(payload || {}))
  );
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error("Property update was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update property."
    );
  }

  const updated =
    findMutationData(result, "updateProperty") ??
    findMutationData(result, "updateProperties") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /property/i.test(key));
  const createdId = extractCreatedRecordId(result, "PeterpmProperty");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;

  if (updatedRecord === null || (!updatedRecord && !createdId)) {
    console.warn(
      "[JobDirect] Property update returned no updated record. Treating as success.",
      result
    );
  }

  return {
    ...(payload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || createdId || normalizedId),
  };
}

export async function fetchPropertyRecordById({ plugin, propertyId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(propertyId);
  if (!normalizedId) return null;

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.query) {
    throw new Error("Property model is unavailable.");
  }

  const query = propertyModel
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "property_name",
      "lot_number",
      "unit_number",
      "address_1",
      "address_2",
      "address",
      "city",
      "suburb_town",
      "state",
      "postal_code",
      "zip_code",
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
    );

  query.getOrInitQueryCalc?.();
  const response = await fetchDirectWithTimeout(query);
  const record = extractFirstRecord(response);
  if (!record) return null;
  return normalizePropertyRecord(record);
}

export async function fetchPropertyRecordByUniqueId({ plugin, uniqueId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedUid = String(uniqueId || "").trim();
  if (!normalizedUid) return null;

  const propertyModel = resolvedPlugin.switchTo("PeterpmProperty");
  if (!propertyModel?.query) {
    throw new Error("Property model is unavailable.");
  }

  const query = propertyModel
    .query()
    .where("unique_id", normalizedUid)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "property_name",
      "lot_number",
      "unit_number",
      "address_1",
      "address_2",
      "address",
      "city",
      "suburb_town",
      "state",
      "postal_code",
      "zip_code",
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
    );

  query.getOrInitQueryCalc?.();
  const response = await fetchDirectWithTimeout(query);
  const record = extractFirstRecord(response);
  if (!record) return null;
  return normalizePropertyRecord(record);
}

function normalizeIdentifier(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function normalizeDealRecord(rawDeal = {}) {
  return {
    id: String(rawDeal?.id || rawDeal?.ID || rawDeal?.DealsID || "").trim(),
    unique_id: String(
      rawDeal?.unique_id || rawDeal?.Unique_ID || rawDeal?.Deals_Unique_ID || ""
    ).trim(),
    deal_name: String(
      rawDeal?.deal_name || rawDeal?.Deal_Name || rawDeal?.Deals_Deal_Name || ""
    ).trim(),
  };
}

function normalizeDealDetailRecord(rawDeal = {}) {
  return {
    id: String(rawDeal?.id || rawDeal?.ID || rawDeal?.DealsID || "").trim(),
    deal_name: String(rawDeal?.deal_name || rawDeal?.Deal_Name || "").trim(),
    deal_value: String(rawDeal?.deal_value || rawDeal?.Deal_Value || "").trim(),
    sales_stage: String(rawDeal?.sales_stage || rawDeal?.Sales_Stage || "").trim(),
    expected_win: String(rawDeal?.expected_win || rawDeal?.Expected_Win || "").trim(),
    expected_close_date: rawDeal?.expected_close_date || rawDeal?.Expected_Close_Date || "",
    actual_close_date: rawDeal?.actual_close_date || rawDeal?.Actual_Close_Date || "",
    weighted_value: String(rawDeal?.weighted_value || rawDeal?.Weighted_Value || "").trim(),
    recent_activity: String(rawDeal?.recent_activity || rawDeal?.Recent_Activity || "").trim(),
  };
}

function parseBooleanValue(value) {
  if (typeof value === "boolean") return value;
  const text = String(value || "").trim().toLowerCase();
  return text === "true" || text === "1" || text === "yes";
}

function normalizePropertyRecord(rawProperty = {}) {
  const featureArray = Array.isArray(rawProperty?.Building_Features)
    ? rawProperty.Building_Features.map((item) => item?.id || item?.value || item?.name || item?.label || item)
        .filter(Boolean)
        .map((item) => String(item).trim())
    : [];

  return {
    id: String(
      rawProperty?.id ||
        rawProperty?.ID ||
        rawProperty?.Property_ID ||
        rawProperty?.PropertiesID ||
        ""
    ).trim(),
    unique_id: String(
      rawProperty?.unique_id ||
        rawProperty?.Unique_ID ||
        rawProperty?.Property_Unique_ID ||
        rawProperty?.Properties_Unique_ID ||
        ""
    ).trim(),
    property_name: String(
      rawProperty?.property_name ||
        rawProperty?.Property_Name ||
        rawProperty?.Property_Property_Name ||
        rawProperty?.Properties_Property_Name ||
        ""
    ).trim(),
    lot_number: String(rawProperty?.lot_number || rawProperty?.Lot_Number || "").trim(),
    unit_number: String(rawProperty?.unit_number || rawProperty?.Unit_Number || "").trim(),
    address_1: String(rawProperty?.address_1 || rawProperty?.Address_1 || "").trim(),
    address_2: String(rawProperty?.address_2 || rawProperty?.Address_2 || "").trim(),
    address: String(rawProperty?.address || rawProperty?.Address || "").trim(),
    city: String(rawProperty?.city || rawProperty?.City || "").trim(),
    suburb_town: String(rawProperty?.suburb_town || rawProperty?.Suburb_Town || "").trim(),
    state: String(rawProperty?.state || rawProperty?.State || "").trim(),
    postal_code: String(
      rawProperty?.postal_code ||
        rawProperty?.Postal_Code ||
        rawProperty?.zip_code ||
        rawProperty?.Zip_Code ||
        ""
    ).trim(),
    zip_code: String(rawProperty?.zip_code || rawProperty?.Zip_Code || "").trim(),
    country: String(rawProperty?.country || rawProperty?.Country || "").trim(),
    property_type: String(rawProperty?.property_type || rawProperty?.Property_Type || "").trim(),
    building_type: String(rawProperty?.building_type || rawProperty?.Building_Type || "").trim(),
    building_type_other: String(
      rawProperty?.building_type_other || rawProperty?.Building_Type_Other || ""
    ).trim(),
    foundation_type: String(rawProperty?.foundation_type || rawProperty?.Foundation_Type || "").trim(),
    bedrooms: String(rawProperty?.bedrooms || rawProperty?.Bedrooms || "").trim(),
    manhole:
      rawProperty?.manhole === true || String(rawProperty?.manhole || rawProperty?.Manhole || "").trim().toLowerCase() === "true",
    stories: String(rawProperty?.stories || rawProperty?.Stories || "").trim(),
    building_age: String(rawProperty?.building_age || rawProperty?.Building_Age || "").trim(),
    building_features:
      featureArray.length > 0
        ? featureArray
        : extractPropertyFeatureTokens(
            String(
            rawProperty?.building_features ||
              rawProperty?.Building_Features_Options_As_Text ||
              rawProperty?.building_features_options_as_text ||
              ""
            )
          )
            .map((item) => normalizePropertyFeatureValue(item) || String(item || "").trim())
            .filter(Boolean),
    building_features_options_as_text: String(
      rawProperty?.building_features_options_as_text ||
        rawProperty?.Building_Features_Options_As_Text ||
        rawProperty?.building_features ||
        ""
    ).trim(),
  };
}

function normalizeAffiliationRecord(rawAffiliation = {}) {
  const contactFirstName = String(
    rawAffiliation?.contact_first_name ||
      rawAffiliation?.Contact_First_Name ||
      rawAffiliation?.Contact?.first_name ||
      rawAffiliation?.Contact?.First_Name ||
      ""
  ).trim();
  const contactLastName = String(
    rawAffiliation?.contact_last_name ||
      rawAffiliation?.Contact_Last_Name ||
      rawAffiliation?.Contact?.last_name ||
      rawAffiliation?.Contact?.Last_Name ||
      ""
  ).trim();
  const companyName = String(
    rawAffiliation?.company_name ||
      rawAffiliation?.CompanyName ||
      rawAffiliation?.Company?.name ||
      rawAffiliation?.Company?.Name ||
      ""
  ).trim();
  const accountsCompanyName = String(
    rawAffiliation?.company_as_accounts_contact_name ||
      rawAffiliation?.Company_as_Accounts_Contact_Name ||
      rawAffiliation?.Company_as_Accounts_Contact?.name ||
      rawAffiliation?.Company_as_Accounts_Contact?.Name ||
      ""
  ).trim();

  return {
    id: String(rawAffiliation?.id || rawAffiliation?.ID || "").trim(),
    role: String(rawAffiliation?.role || rawAffiliation?.Role || "").trim(),
    property_id: String(rawAffiliation?.property_id || rawAffiliation?.Property_ID || "").trim(),
    contact_id: String(rawAffiliation?.contact_id || rawAffiliation?.Contact_ID || "").trim(),
    company_id: String(rawAffiliation?.company_id || rawAffiliation?.Company_ID || "").trim(),
    company_as_accounts_contact_id: String(
      rawAffiliation?.company_as_accounts_contact_id ||
        rawAffiliation?.Company_as_Accounts_Contact_ID ||
        ""
    ).trim(),
    primary_owner_contact: parseBooleanValue(
      rawAffiliation?.primary_owner_contact || rawAffiliation?.Primary_Owner_Contact
    ),
    primary_resident_contact: parseBooleanValue(
      rawAffiliation?.primary_resident_contact || rawAffiliation?.Primary_Resident_Contact
    ),
    primary_property_manager_contact: parseBooleanValue(
      rawAffiliation?.primary_property_manager_contact ||
        rawAffiliation?.Primary_Property_Manager_Contact
    ),
    contact_first_name: contactFirstName,
    contact_last_name: contactLastName,
    contact_email: String(
      rawAffiliation?.contact_email ||
        rawAffiliation?.ContactEmail ||
        rawAffiliation?.Contact?.email ||
        rawAffiliation?.Contact?.Email ||
        ""
    ).trim(),
    contact_sms_number: String(
      rawAffiliation?.contact_sms_number ||
        rawAffiliation?.Contact_SMS_Number ||
        rawAffiliation?.Contact?.sms_number ||
        rawAffiliation?.Contact?.SMS_Number ||
        ""
    ).trim(),
    company_name: companyName,
    company_phone: String(
      rawAffiliation?.company_phone ||
        rawAffiliation?.CompanyPhone ||
        rawAffiliation?.Company?.phone ||
        rawAffiliation?.Company?.Phone ||
        ""
    ).trim(),
    company_as_accounts_contact_name: accountsCompanyName,
  };
}

function dedupeAffiliations(affiliations = []) {
  const seen = new Set();
  return affiliations.filter((item) => {
    const key = String(item?.id || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeDealsFromFlatFields(record = {}) {
  const ids = record?.DealsID;
  const uniqueIds = record?.Deals_Unique_ID;
  const names = record?.Deals_Deal_Name;

  if (Array.isArray(ids) || Array.isArray(uniqueIds) || Array.isArray(names)) {
    const maxLength = Math.max(ids?.length || 0, uniqueIds?.length || 0, names?.length || 0);
    const deals = [];
    for (let index = 0; index < maxLength; index += 1) {
      deals.push(
        normalizeDealRecord({
          DealsID: ids?.[index],
          Deals_Unique_ID: uniqueIds?.[index],
          Deals_Deal_Name: names?.[index],
        })
      );
    }
    return deals.filter((deal) => deal.id || deal.unique_id || deal.deal_name);
  }

  const single = normalizeDealRecord(record);
  if (!single.id && !single.unique_id && !single.deal_name) return [];
  return [single];
}

function extractDealsFromAccountRecord(record) {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Deals)) {
    return record.Deals.map((item) => normalizeDealRecord(item)).filter(
      (deal) => deal.id || deal.unique_id || deal.deal_name
    );
  }

  return normalizeDealsFromFlatFields(record);
}

function dedupeDeals(deals = []) {
  const seen = new Set();
  return deals.filter((deal) => {
    const key = String(deal.id || deal.unique_id || deal.deal_name || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePropertiesFromFlatFields(record = {}) {
  const ids = record?.PropertiesID || record?.Property_ID;
  const uniqueIds = record?.Properties_Unique_ID || record?.Property_Unique_ID;
  const names = record?.Properties_Property_Name || record?.Property_Property_Name;

  if (Array.isArray(ids) || Array.isArray(uniqueIds) || Array.isArray(names)) {
    const maxLength = Math.max(ids?.length || 0, uniqueIds?.length || 0, names?.length || 0);
    const properties = [];
    for (let index = 0; index < maxLength; index += 1) {
      properties.push(
        normalizePropertyRecord({
          PropertiesID: ids?.[index],
          Properties_Unique_ID: uniqueIds?.[index],
          Properties_Property_Name: names?.[index],
        })
      );
    }
    return properties.filter((property) => property.id || property.unique_id || property.property_name);
  }

  const single = normalizePropertyRecord(record);
  if (!single.id && !single.unique_id && !single.property_name) return [];
  return [single];
}

function extractPropertiesFromAccountRecord(record) {
  if (!record || typeof record !== "object") return [];

  if (Array.isArray(record?.Properties)) {
    return record.Properties.map((item) => normalizePropertyRecord(item)).filter(
      (property) => property.id || property.unique_id || property.property_name
    );
  }

  return normalizePropertiesFromFlatFields(record);
}

function dedupeProperties(properties = []) {
  const seen = new Set();
  return properties.filter((property) => {
    const key = String(property.id || property.unique_id || property.property_name || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function fetchDealsByAccountId({ plugin, accountType, accountId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const modelName = accountType === "Company" ? "PeterpmCompany" : "PeterpmContact";
  const resolvedId = normalizeIdentifier(accountId);
  if (!resolvedId) return [];

  try {
    const customDealQuery =
      accountType === "Company"
        ? `
          query calcCompanies($id: PeterpmCompanyID!) {
            calcCompanies(query: [{ where: { id: $id } }]) {
              Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
              DealsID: field(arg: ["Deals", "id"])
              Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
            }
          }
        `
        : `
          query calcContacts($id: PeterpmContactID!) {
            calcContacts(query: [{ where: { id: $id } }]) {
              Deals_Unique_ID: field(arg: ["Deals", "unique_id"])
              DealsID: field(arg: ["Deals", "id"])
              Deals_Deal_Name: field(arg: ["Deals", "deal_name"])
            }
          }
        `;

    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(customDealQuery);
    const customResponse = await fetchDirectWithTimeout(customQuery, {
      variables: { id: resolvedId },
    }, 20000);
    const customRecords = extractRecords(customResponse);
    const customDeals = dedupeDeals(
      customRecords.flatMap((record) => extractDealsFromAccountRecord(record))
    );
    if (customDeals.length) return customDeals;
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.warn("[JobDirect] Custom deal query failed, using include fallback", error);
    }
  }

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("id", resolvedId)
      .deSelectAll()
      .select(["id"])
      .include("Deals", (dealQuery) =>
        dealQuery.deSelectAll().select(["id", "unique_id", "deal_name"])
      );

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    const accountRecords = extractRecords(response);
    const dealsFromAllRows = accountRecords.flatMap((record) =>
      extractDealsFromAccountRecord(record)
    );
    return dedupeDeals(dealsFromAllRows);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch linked deals", { accountType, accountId, error });
    return [];
  }
}

async function executeJobUpdateMutation({ plugin, whereField, whereValue, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const jobModel = resolvedPlugin.switchTo("PeterpmJob");
  if (!jobModel?.mutation) {
    throw new Error("Job model is unavailable.");
  }

  const mutation = await jobModel.mutation();
  mutation.update((query) => query.where(whereField, whereValue).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  if (!result) {
    throw new Error("Job update was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update job."
    );
  }

  const updated =
    findMutationData(result, "updateJob") ??
    findMutationData(result, "updateJobs") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /job/i.test(key));
  const id = extractCreatedRecordId(result, "PeterpmJob");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  const fallbackIdFromWhere =
    String(whereField || "").trim() === "id" ? normalizeIdentifier(whereValue) : "";
  const resolvedId = normalizeIdentifier(
    updatedRecord?.id || updatedRecord?.ID || id || fallbackIdFromWhere || ""
  );

  if (updatedRecord === null || (!updatedRecord && !resolvedId)) {
    // SDK occasionally reports no updated record even when mutation is persisted.
    // Avoid false-negative failures for caller flows that only need mutation dispatch.
    console.warn("[JobDirect] Job update returned no updated record. Treating as success.", result);
  }

  return { updatedRecord, id: resolvedId || id };
}

export async function updateJobRecordByUid({ plugin, uniqueId, payload } = {}) {
  const normalizedUid = String(uniqueId || "").trim();
  if (!normalizedUid) {
    throw new Error("Job UID is missing.");
  }

  const { updatedRecord, id } = await executeJobUpdateMutation({
    plugin,
    whereField: "unique_id",
    whereValue: normalizedUid,
    payload,
  });

  return {
    unique_id: normalizedUid,
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || ""),
  };
}

export async function updateJobRecordById({ plugin, id, payload } = {}) {
  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Job ID is missing.");
  }

  const { updatedRecord, id: mutationId } = await executeJobUpdateMutation({
    plugin,
    whereField: "id",
    whereValue: normalizedId,
    payload,
  });

  return {
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || mutationId || normalizedId),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
  };
}

export async function fetchInvoiceBillContextByJobUid({ plugin, jobUid } = {}) {
  const job = await fetchJobDirectDataByUid({ plugin, jobUid });
  if (!job) return null;

  const jobId = normalizeIdentifier(job?.id || job?.ID);
  const [activities, materials] = await Promise.all([
    fetchActivitiesByJobId({ plugin, jobId }),
    fetchMaterialsByJobId({ plugin, jobId }),
  ]);

  return {
    job: normalizeInvoiceBillContextRecord(job),
    activities: Array.isArray(activities) ? activities : [],
    materials: Array.isArray(materials) ? materials : [],
  };
}

export async function updateInvoiceTriggerByJobId({ plugin, jobId, payload } = {}) {
  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }

  const normalizedInvoiceDate = normalizeEpochSeconds(payload?.invoice_date);
  const normalizedDueDate = normalizeEpochSeconds(payload?.due_date);
  if (normalizedInvoiceDate === null || normalizedDueDate === null) {
    throw new Error("Invoice Date and Due Date are required.");
  }

  const triggerPayload = {
    invoice_date: normalizedInvoiceDate,
    due_date: normalizedDueDate,
    xero_invoice_status:
      getFirstNonEmptyText(payload?.xero_invoice_status) || "Create Invoice",
  };

  let updatedRecord = null;
  let id = normalizedJobId;
  try {
    const updateResult = await executeJobUpdateMutation({
      plugin,
      whereField: "id",
      whereValue: normalizedJobId,
      payload: triggerPayload,
    });
    updatedRecord = updateResult?.updatedRecord || null;
    id = updateResult?.id || normalizedJobId;
  } catch (error) {
    const message = String(error?.message || "").toLowerCase();
    const canRecoverWithSnapshot =
      message.includes("cancelled") || message.includes("no updated record");
    if (!canRecoverWithSnapshot) {
      throw error;
    }

    const snapshot = await fetchInvoiceJobSnapshotById({
      plugin,
      jobId: normalizedJobId,
    });

    if (snapshot && typeof snapshot === "object") {
      const snapshotInvoiceDate = normalizeEpochSeconds(
        snapshot?.invoice_date ?? snapshot?.Invoice_Date
      );
      const snapshotDueDate = normalizeEpochSeconds(snapshot?.due_date ?? snapshot?.Due_Date);
      const snapshotStatus = getFirstNonEmptyText(
        snapshot?.xero_invoice_status,
        snapshot?.Xero_Invoice_Status
      );
      const applied =
        snapshotInvoiceDate === normalizedInvoiceDate &&
        snapshotDueDate === normalizedDueDate &&
        normalizeStatusText(snapshotStatus) ===
          normalizeStatusText(triggerPayload.xero_invoice_status);

      if (applied) {
        updatedRecord = snapshot;
        id = normalizeIdentifier(snapshot?.id || snapshot?.ID || normalizedJobId);
      }
    }

    if (!updatedRecord) {
      // SDK occasionally reports cancelled despite dispatching the update mutation.
      // Return optimistic payload and let subsequent query/subscription confirm backend state.
      updatedRecord = {
        id: normalizedJobId,
        invoice_date: normalizedInvoiceDate,
        due_date: normalizedDueDate,
        xero_invoice_status: triggerPayload.xero_invoice_status,
      };
      id = normalizedJobId;
    }
  }

  return {
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || normalizedJobId),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
  };
}

export async function updateBillTriggerByJobId({ plugin, jobId, payload } = {}) {
  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }
  return updateJobRecordById({
    plugin,
    id: normalizedJobId,
    payload,
  });
}

export async function waitForJobInvoiceApiResponseChange({
  plugin,
  jobId,
  previous = null,
  timeoutMs = 45000,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedJobId = normalizeIdentifier(jobId);
  if (!normalizedJobId) {
    throw new Error("Job ID is missing.");
  }

  const jobModel = resolvedPlugin.switchTo("PeterpmJob");
  if (!jobModel?.query) {
    throw new Error("Job model is unavailable.");
  }

  const previousSnapshot = {
    xero_api_response: getFirstNonEmptyText(previous?.xero_api_response),
    invoice_url_admin: getFirstNonEmptyText(previous?.invoice_url_admin),
    invoice_url_client: getFirstNonEmptyText(previous?.invoice_url_client),
    xero_invoice_status: getFirstNonEmptyText(previous?.xero_invoice_status),
    xero_invoice_pdf: getFirstNonEmptyText(previous?.xero_invoice_pdf),
    invoice_number: getFirstNonEmptyText(previous?.invoice_number),
  };
  const query = jobModel
    .query()
    .where("id", normalizedJobId)
    .deSelectAll()
    .select([
      "id",
      "xero_api_response",
      "invoice_url_admin",
      "invoice_url_client",
      "xero_invoice_status",
      "xero_invoice_pdf",
      "invoice_number",
    ])
    .noDestroy();

  return await new Promise((resolve) => {
    let done = false;
    let timeoutId = null;
    let sub = null;

    const finish = (value) => {
      if (done) return;
      done = true;
      if (timeoutId) clearTimeout(timeoutId);
      try {
        sub?.unsubscribe?.();
      } catch (_) {}
      try {
        query?.destroy?.();
      } catch (_) {}
      resolve(value || null);
    };

    const handlePayload = (payload) => {
      const firstRecord = extractFirstRecord(payload);
      if (!firstRecord || typeof firstRecord !== "object") return;
      const snapshot = {
        xero_api_response: getFirstNonEmptyText(
          firstRecord?.xero_api_response,
          firstRecord?.Xero_API_Response
        ),
        invoice_url_admin: getFirstNonEmptyText(
          firstRecord?.invoice_url_admin,
          firstRecord?.Invoice_URL_Admin
        ),
        invoice_url_client: getFirstNonEmptyText(
          firstRecord?.invoice_url_client,
          firstRecord?.Invoice_URL_Client
        ),
        xero_invoice_status: getFirstNonEmptyText(
          firstRecord?.xero_invoice_status,
          firstRecord?.Xero_Invoice_Status
        ),
        xero_invoice_pdf: getFirstNonEmptyText(
          firstRecord?.xero_invoice_pdf,
          firstRecord?.Xero_Invoice_PDF
        ),
        invoice_number: getFirstNonEmptyText(
          firstRecord?.invoice_number,
          firstRecord?.Invoice_Number
        ),
      };

      const changed =
        snapshot.xero_api_response !== previousSnapshot.xero_api_response ||
        snapshot.invoice_url_admin !== previousSnapshot.invoice_url_admin ||
        snapshot.invoice_url_client !== previousSnapshot.invoice_url_client ||
        snapshot.xero_invoice_status !== previousSnapshot.xero_invoice_status ||
        snapshot.xero_invoice_pdf !== previousSnapshot.xero_invoice_pdf ||
        snapshot.invoice_number !== previousSnapshot.invoice_number;

      if (!changed) return;

      const hasSignal =
        snapshot.xero_api_response ||
        snapshot.invoice_url_admin ||
        snapshot.invoice_url_client ||
        snapshot.xero_invoice_pdf ||
        snapshot.invoice_number;

      if (!hasSignal) return;

      finish(snapshot);
    };

    timeoutId = setTimeout(() => finish(null), timeoutMs);

    try {
      let stream = null;
      if (typeof query.subscribe === "function") {
        stream = query.subscribe();
      }
      if (!stream && typeof query.localSubscribe === "function") {
        stream = query.localSubscribe();
      }
      if (!stream || typeof stream.subscribe !== "function") {
        finish(null);
        return;
      }

      if (
        typeof window !== "undefined" &&
        typeof window.toMainInstance === "function" &&
        typeof stream.pipe === "function"
      ) {
        stream = stream.pipe(window.toMainInstance(true));
      }

      sub = stream.subscribe({
        next: handlePayload,
        error: () => finish(null),
      });
    } catch (_) {
      finish(null);
    }
  });
}

export async function persistInvoiceActivitySelection({ plugin, activityUpdates = [] } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const updates = Array.isArray(activityUpdates) ? activityUpdates : [];
  if (!updates.length) return [];

  const activityModel = resolvedPlugin.switchTo("PeterpmActivity");
  if (!activityModel?.mutation) {
    throw new Error("Activity model is unavailable.");
  }

  const settled = await Promise.allSettled(updates.map(async (item) => {
    const activityId = normalizeIdentifier(item?.id || item?.activity_id || "");
    if (!activityId) {
      throw new Error("Activity ID is missing.");
    }

    const mutation = await activityModel.mutation();
    mutation.update((query) =>
      query.where("id", activityId).set({
        invoice_to_client: Boolean(item?.invoice_to_client),
      })
    );
    const result = await mutation.execute(true).toPromise();
    if (!result || result?.isCancelling) {
      throw new Error("Activity invoice selection update was cancelled.");
    }

    const failure = extractStatusFailure(result);
    if (failure) {
      throw new Error(
        extractMutationErrorMessage(failure.statusMessage) ||
          "Unable to save invoice activity selection."
      );
    }

    return {
      id: activityId,
      invoice_to_client: Boolean(item?.invoice_to_client),
    };
  }));

  const failed = settled.filter((item) => item.status === "rejected");
  if (failed.length) {
    const firstReason = failed[0]?.reason;
    throw new Error(firstReason?.message || "Unable to save invoice activity selection.");
  }

  return settled
    .filter((item) => item.status === "fulfilled")
    .map((item) => item.value)
    .filter(Boolean);
}

export async function fetchLinkedDealsByAccount({ plugin, accountType, accountId } = {}) {
  const normalizedType = String(accountType || "").trim().toLowerCase();
  const resolvedType = normalizedType === "company" || normalizedType === "entity" ? "Company" : "Contact";
  return fetchDealsByAccountId({
    plugin,
    accountType: resolvedType,
    accountId,
  });
}

export async function fetchLinkedPropertiesByAccount({ plugin, accountType, accountId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedType = String(accountType || "").trim().toLowerCase();
  const resolvedType = normalizedType === "company" || normalizedType === "entity" ? "Company" : "Contact";
  const modelName = resolvedType === "Company" ? "PeterpmCompany" : "PeterpmContact";
  const normalizedId = normalizeIdentifier(accountId);
  if (!normalizedId) return [];

  try {
    const customPropertyQuery =
      resolvedType === "Company"
        ? `
          query getCompany($id: PeterpmCompanyID!) {
            getCompany(query: [{ where: { id: $id } }]) {
              Properties {
                id
                unique_id
                property_name
                lot_number
                unit_number
                address_1
                address_2
                address
                city
                suburb_town
                postal_code
                zip_code
                state
                country
                property_type
                building_type
                building_type_other
                foundation_type
                bedrooms
                manhole
                stories
                building_age
                building_features
                building_features_options_as_text
              }
            }
          }
        `
        : `
          query getContact($id: PeterpmContactID!) {
            getContact(query: [{ where: { id: $id } }]) {
              Properties {
                id
                unique_id
                property_name
                lot_number
                unit_number
                address_1
                address_2
                address
                city
                suburb_town
                postal_code
                zip_code
                state
                country
                property_type
                building_type
                building_type_other
                foundation_type
                bedrooms
                manhole
                stories
                building_age
                building_features
                building_features_options_as_text
              }
            }
          }
        `;

    const customQuery = resolvedPlugin
      .switchTo(modelName)
      .query()
      .fromGraphql(customPropertyQuery);
    const customResponse = await fetchDirectWithTimeout(customQuery, {
      variables: { id: normalizedId },
    }, 20000);
    const customRecords = extractRecords(customResponse);
    const customProperties = dedupeProperties(
      customRecords.flatMap((record) => extractPropertiesFromAccountRecord(record))
    );
    if (customProperties.length) return customProperties;
  } catch (error) {
    if (!isTimeoutError(error)) {
      console.warn("[JobDirect] Custom property query failed, using include fallback", error);
    }
  }

  try {
    const query = resolvedPlugin
      .switchTo(modelName)
      .query()
      .where("id", normalizedId)
      .deSelectAll()
      .select(["id"])
      .include("Properties", (propertyQuery) =>
        propertyQuery.deSelectAll().select([
          "id",
          "unique_id",
          "property_name",
          "lot_number",
          "unit_number",
          "address_1",
          "address_2",
          "address",
          "city",
          "suburb_town",
          "postal_code",
          "zip_code",
          "state",
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
      );

    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    const accountRecords = extractRecords(response);
    const propertiesFromAllRows = accountRecords.flatMap((record) =>
      extractPropertiesFromAccountRecord(record)
    );
    return dedupeProperties(propertiesFromAllRows);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch linked properties", {
      accountType: resolvedType,
      accountId: normalizedId,
      error,
    });
    return [];
  }
}

export async function fetchDealRecordById({ plugin, dealId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(dealId);
  if (!normalizedId) {
    throw new Error("Deal ID is missing.");
  }

  const dealModel = resolvedPlugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) {
    throw new Error("Deal model is unavailable.");
  }

  const query = dealModel
    .query()
    .where("id", normalizedId)
    .deSelectAll()
    .select([
      "id",
      "deal_name",
      "deal_value",
      "sales_stage",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "recent_activity",
    ]);

  query.getOrInitQueryCalc?.();
  const result = await fetchDirectWithTimeout(query);
  const deal = extractFirstRecord(result);
  if (!deal) return null;
  return normalizeDealDetailRecord(deal);
}

export async function updateDealRecordById({ plugin, dealId, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(dealId);
  if (!normalizedId) {
    throw new Error("Deal ID is missing.");
  }

  const dealModel = resolvedPlugin.switchTo("PeterpmDeal");
  if (!dealModel?.mutation) {
    throw new Error("Deal model is unavailable.");
  }

  const mutation = await dealModel.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(payload || {}));
  const result = await mutation.execute(true).toPromise();

  if (!result || result?.isCancelling) {
    throw new Error("Deal update was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update deal."
    );
  }

  const updated =
    findMutationData(result, "updateDeal") ??
    findMutationData(result, "updateDeals") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /deal/i.test(key));
  const id = extractCreatedRecordId(result, "PeterpmDeal");
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  if (updatedRecord === null || (!updatedRecord && !id)) {
    console.warn(
      "[JobDirect] Deal update returned no updated record. Treating as success.",
      result
    );
  }

  return {
    ...(updatedRecord && typeof updatedRecord === "object"
      ? normalizeDealDetailRecord(updatedRecord)
      : normalizeDealDetailRecord(payload || {})),
    id: normalizeIdentifier(updatedRecord?.id || updatedRecord?.ID || id || normalizedId),
  };
}

export async function fetchPropertyAffiliationsByPropertyId({ plugin, propertyId } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return [];

  const normalizedPropertyId = normalizeIdentifier(propertyId);
  if (!normalizedPropertyId) return [];

  try {
    const query = resolvedPlugin
      .switchTo("PeterpmAffiliation")
      .query()
      .where("property_id", normalizedPropertyId)
      .deSelectAll()
      .select([
        "id",
        "role",
        "property_id",
        "contact_id",
        "company_id",
        "company_as_accounts_contact_id",
        "primary_owner_contact",
        "primary_resident_contact",
        "primary_property_manager_contact",
      ])
      .include("Contact", (contactQuery) =>
        contactQuery.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
      )
      .include("Company", (companyQuery) =>
        companyQuery.deSelectAll().select(["name", "phone"])
      )
      .include("Company_as_Accounts_Contact", (companyQuery) =>
        companyQuery.deSelectAll().select(["name", "phone"])
      )
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const response = await fetchDirectWithTimeout(query);
    const records = extractRecords(response).map((item) => normalizeAffiliationRecord(item));
    return dedupeAffiliations(records);
  } catch (error) {
    console.error("[JobDirect] Failed to fetch property affiliations", error);
    return [];
  }
}

export function subscribePropertyAffiliationsByPropertyId({
  plugin,
  propertyId,
  onChange,
  onError,
} = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) return () => {};

  const normalizedPropertyId = normalizeIdentifier(propertyId);
  if (!normalizedPropertyId) return () => {};

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.query) return () => {};

  const query = model
    .query()
    .where("property_id", normalizedPropertyId)
    .deSelectAll()
    .select([
      "id",
      "role",
      "property_id",
      "contact_id",
      "company_id",
      "company_as_accounts_contact_id",
      "primary_owner_contact",
      "primary_resident_contact",
      "primary_property_manager_contact",
    ])
    .include("Contact", (contactQuery) =>
      contactQuery.deSelectAll().select(["first_name", "last_name", "email", "sms_number"])
    )
    .include("Company", (companyQuery) => companyQuery.deSelectAll().select(["name", "phone"]))
    .include("Company_as_Accounts_Contact", (companyQuery) =>
      companyQuery.deSelectAll().select(["name", "phone"])
    )
    .noDestroy();
  query.getOrInitQueryCalc?.();

  return subscribeToQueryStream(query, {
    onNext: (payload) => {
      const records = extractRecords(payload).map((item) => normalizeAffiliationRecord(item));
      onChange?.(dedupeAffiliations(records));
    },
    onError: (error) => {
      console.error("[JobDirect] Property affiliations subscription failed", error);
      onError?.(error);
    },
  });
}

export async function createAffiliationRecord({ plugin, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Property contact create was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create property contact."
    );
  }

  const created =
    findMutationData(result, "createAffiliation") ??
    findMutationData(result, "createAffiliations") ??
    findMutationDataByMatcher(result, (key) => /^create/i.test(key) && /affiliation/i.test(key));
  if (created === null) {
    throw new Error("Unable to create property contact.");
  }
  const createdRecord = Array.isArray(created) ? created[0] || null : created;
  const id = extractCreatedRecordId(result, "PeterpmAffiliation");
  const resolvedId = String(createdRecord?.id || createdRecord?.ID || id || "").trim();
  if (!isPersistedId(resolvedId)) {
    throw new Error("Property contact was not confirmed by server. Please try again.");
  }

  return normalizeAffiliationRecord({
    ...(payload || {}),
    ...(createdRecord && typeof createdRecord === "object" ? createdRecord : {}),
    id: resolvedId,
  });
}

export async function updateAffiliationRecord({ plugin, id, payload } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Affiliation ID is missing.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  mutation.update((query) => query.where("id", normalizedId).set(payload || {}));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Property contact update was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to update property contact."
    );
  }

  const updated =
    findMutationData(result, "updateAffiliation") ??
    findMutationData(result, "updateAffiliations") ??
    findMutationDataByMatcher(result, (key) => /^update/i.test(key) && /affiliation/i.test(key));
  const updatedRecord = Array.isArray(updated) ? updated[0] || null : updated;
  if (updatedRecord === null || !updatedRecord) {
    console.warn(
      "[JobDirect] Affiliation update returned no updated record. Treating as success.",
      result
    );
    return normalizeAffiliationRecord({
      ...(payload || {}),
      id: normalizedId,
    });
  }
  return normalizeAffiliationRecord({
    ...(payload || {}),
    ...(updatedRecord && typeof updatedRecord === "object" ? updatedRecord : {}),
    id: updatedRecord?.id || updatedRecord?.ID || normalizedId,
  });
}

export async function deleteAffiliationRecord({ plugin, id } = {}) {
  const resolvedPlugin = resolvePlugin(plugin);
  if (!resolvedPlugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }

  const normalizedId = normalizeIdentifier(id);
  if (!normalizedId) {
    throw new Error("Affiliation ID is missing.");
  }

  const model = resolvedPlugin.switchTo("PeterpmAffiliation");
  if (!model?.mutation) {
    throw new Error("Affiliation model is unavailable.");
  }

  const mutation = await model.mutation();
  if (typeof mutation.delete !== "function") {
    throw new Error("Affiliation delete operation is unavailable.");
  }
  mutation.delete((query) => query.where("id", normalizedId));
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Property contact delete was cancelled.");
  }

  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to delete property contact."
    );
  }

  const deleted =
    findMutationData(result, "deleteAffiliation") ??
    findMutationData(result, "deleteAffiliations") ??
    findMutationDataByMatcher(result, (key) => /^delete/i.test(key) && /affiliation/i.test(key));
  const deletedRecord = Array.isArray(deleted) ? deleted[0] || null : deleted;
  const deletedId = String(
    deletedRecord?.id || deletedRecord?.ID || extractCreatedRecordId(result, "PeterpmAffiliation") || normalizedId
  ).trim();
  if (!deletedId) {
    throw new Error("Unable to delete property contact.");
  }
  return deletedId;
}
