import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { JobDirectLayout } from "@modules/job-workspace/public/components.js";
import { JobDirectStoreProvider } from "@modules/job-workspace/public/hooks.js";
import { useVitalStatsPlugin } from "@platform/vitalstats/useVitalStatsPlugin.js";
import { getFriendlyServiceMessage } from "../../../shared/utils/userFacingErrors.js";
import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../shared/announcements/announcementEmitter.js";
import { SECTION_LABELS } from "@modules/job-workspace/public/constants.js";
import { InquiryInformationSection } from "../components/sections/InquiryInformationSection.jsx";
import { useInquiryUid } from "../hooks/useInquiryUid.js";
import {
  extractFirstRecord,
  extractMutationErrorMessage,
  extractStatusFailure,
  isPersistedId,
  normalizeObjectList,
} from "@modules/job-workspace/public/sdk.js";
import {
  fetchInquiryByUid,
  fetchJobByUid,
  fetchLinkedJobForInquiry,
  updateInquiryFieldsById,
} from "@modules/job-records/public/sdk.js";

const INQUIRY_SECTION_ORDER = ["job-information", "uploads"];
const INQUIRY_SECTION_LABELS = {
  ...SECTION_LABELS,
  "job-information": "Inquiry Information",
};
const INQUIRY_PAGE_DATA_ATTR = "inquiry-direct";
const EMPTY_DRAFT = {
  sales_stage: "",
  deal_value: "",
  expected_win: "",
  expected_close_date: "",
  actual_close_date: "",
  weighted_value: "",
  recent_activity: "",
  account_type: "Contact",
  client_id: "",
  company_id: "",
  service_provider_id: "",
  client_notes: "",
  property_id: "",
  inquiry_for_job_id: "",
  inquiry_status: "New Inquiry",
  inquiry_source: "",
  type: "",
  how_did_you_hear: "",
  other: "",
  service_inquiry_id: "",
  how_can_we_help: "",
  admin_notes: "",
  noise_signs_options_as_text: "",
  pest_active_times_options_as_text: "",
  pest_location_options_as_text: "",
  renovations: "",
  resident_availability: "",
  date_job_required_by: "",
};

function toText(value) {
  return String(value ?? "").trim();
}

function normalizeId(value) {
  const text = toText(value);
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toNullableText(value) {
  const text = toText(value);
  return text || null;
}

function toDateInput(value) {
  if (value === null || value === undefined || value === "") return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  if (/^\d+$/.test(text)) {
    const num = Number(text);
    if (!Number.isFinite(num)) return "";
    const seconds = num > 4102444800 ? Math.floor(num / 1000) : num;
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) return "";
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toUnixSeconds(dateInput) {
  const value = toText(dateInput);
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  return Math.floor(Date.UTC(year, month - 1, day) / 1000);
}

function normalizeAccountType(value) {
  const text = toText(value).toLowerCase();
  if (!text) return "Contact";
  if (text.includes("company") || text.includes("entity")) return "Company";
  return "Contact";
}

function normalizeServiceInquiryId(value) {
  const text = toText(value);
  if (!text) return "";
  if (/^\d+$/.test(text)) return text;
  const digitMatch = text.match(/\d+/);
  return digitMatch ? digitMatch[0] : text;
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  if (typeof result.subscribe === "function") {
    let subscription = null;
    return new Promise((resolve, reject) => {
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
  }
  return Promise.resolve(result);
}

function extractCreatedDealId(result) {
  const managed = result?.mutations?.PeterpmDeal?.managedData;
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

async function fetchInquiryRecordByUid({ plugin, inquiryUid } = {}) {
  const uniqueId = toText(inquiryUid);
  if (!plugin?.switchTo || !uniqueId) return null;

  const query = plugin
    .switchTo("PeterpmDeal")
    .query()
    .where("unique_id", uniqueId)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "sales_stage",
      "deal_value",
      "expected_win",
      "expected_close_date",
      "actual_close_date",
      "weighted_value",
      "recent_activity",
      "account_type",
      "company_id",
      "primary_contact_id",
      "service_provider_id",
      "client_notes",
      "property_id",
      "quote_record_id",
      "inquiry_for_job_id",
      "inquiry_status",
      "inquiry_source",
      "type",
      "how_did_you_hear",
      "other",
      "service_inquiry_id",
      "how_can_we_help",
      "admin_notes",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "renovations",
      "resident_availability",
      "date_job_required_by",
    ])
    .limit(1)
    .noDestroy();
  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  const record = extractFirstRecord(result);
  if (!record) return null;
  return {
    id: toText(record?.id || record?.ID),
    unique_id: toText(record?.unique_id || record?.Unique_ID),
    raw: record,
  };
}

function mapRecordToDraft(record = {}) {
  return {
    ...EMPTY_DRAFT,
    sales_stage: toText(record?.sales_stage || record?.Sales_Stage),
    deal_value: toText(record?.deal_value || record?.Deal_Value),
    expected_win: toText(record?.expected_win || record?.Expected_Win),
    expected_close_date: toDateInput(
      record?.expected_close_date || record?.Expected_Close_Date
    ),
    actual_close_date: toDateInput(record?.actual_close_date || record?.Actual_Close_Date),
    weighted_value: toText(record?.weighted_value || record?.Weighted_Value),
    recent_activity: toText(record?.recent_activity || record?.Recent_Activity),
    account_type: normalizeAccountType(record?.account_type || record?.Account_Type),
    client_id: toText(record?.primary_contact_id || record?.Primary_Contact_ID),
    company_id: toText(record?.company_id || record?.Company_ID),
    service_provider_id: toText(record?.service_provider_id || record?.Service_Provider_ID),
    client_notes: toText(record?.client_notes || record?.Client_Notes),
    property_id: toText(record?.property_id || record?.Property_ID),
    inquiry_for_job_id: toText(
      record?.inquiry_for_job_id ||
        record?.Inquiry_For_Job_ID ||
        record?.Inquiry_for_Job_ID ||
        record?.quote_record_id ||
        record?.Quote_Record_ID
    ),
    inquiry_status: toText(record?.inquiry_status || record?.Inquiry_Status) || "New Inquiry",
    inquiry_source: toText(record?.inquiry_source || record?.Inquiry_Source),
    type: toText(record?.type || record?.Type),
    how_did_you_hear: toText(record?.how_did_you_hear || record?.How_did_you_hear),
    other: toText(record?.other || record?.Other),
    service_inquiry_id: normalizeServiceInquiryId(
      record?.service_inquiry_id || record?.Service_Inquiry_ID
    ),
    how_can_we_help: toText(record?.how_can_we_help || record?.How_can_we_help),
    admin_notes: toText(record?.admin_notes || record?.Admin_Notes),
    noise_signs_options_as_text: toText(
      record?.noise_signs_options_as_text || record?.Noise_Signs_Options_As_Text
    ),
    pest_active_times_options_as_text: toText(
      record?.pest_active_times_options_as_text || record?.Pest_Active_Times_Options_As_Text
    ),
    pest_location_options_as_text: toText(
      record?.pest_location_options_as_text || record?.Pest_Location_Options_As_Text
    ),
    renovations: toText(record?.renovations || record?.Renovations),
    resident_availability: toText(
      record?.resident_availability || record?.Resident_Availability
    ),
    date_job_required_by: toDateInput(
      record?.date_job_required_by || record?.Date_Job_Required_By
    ),
  };
}

async function createInquiryRecord({ plugin, payload = null } = {}) {
  if (!plugin?.switchTo) {
    throw new Error("SDK plugin is not ready.");
  }
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.mutation) {
    throw new Error("Deal model is unavailable.");
  }

  const mutation = await dealModel.mutation();
  mutation.createOne(payload || {});
  const result = await mutation.execute(true).toPromise();
  if (!result || result?.isCancelling) {
    throw new Error("Inquiry create was cancelled.");
  }
  const failure = extractStatusFailure(result);
  if (failure) {
    throw new Error(
      extractMutationErrorMessage(failure.statusMessage) || "Unable to create inquiry."
    );
  }

  const createdId = extractCreatedDealId(result);
  if (!isPersistedId(createdId)) {
    throw new Error("Inquiry create did not return an ID.");
  }

  const detailQuery = dealModel
    .query()
    .where("id", createdId)
    .deSelectAll()
    .select(["id", "unique_id", "quote_record_id", "inquiry_for_job_id"])
    .limit(1)
    .noDestroy();
  detailQuery.getOrInitQueryCalc?.();
  const detailResult = await toPromiseLike(detailQuery.fetchDirect());
  const createdRecord = extractFirstRecord(detailResult);
  const createdUid = toText(createdRecord?.unique_id || createdRecord?.Unique_ID);
  if (!createdUid) {
    throw new Error("Inquiry was created but unique ID was not returned.");
  }

  return {
    id: toText(createdRecord?.id || createdRecord?.ID || createdId),
    unique_id: createdUid,
    raw: createdRecord || null,
  };
}

async function resolveLinkedJobIdForPayload({ plugin, linkedJobValue } = {}) {
  const normalizedValue = toText(linkedJobValue);
  if (!normalizedValue) return null;
  if (/^\d+$/.test(normalizedValue)) {
    return Number.parseInt(normalizedValue, 10);
  }
  if (!plugin?.switchTo) return null;

  const resolveByJobField = async (field) => {
    const query = plugin
      .switchTo("PeterpmJob")
      .query()
      .where(field, normalizedValue)
      .deSelectAll()
      .select(["id"])
      .limit(1)
      .noDestroy();
    query.getOrInitQueryCalc?.();
    const result = await toPromiseLike(query.fetchDirect());
    const record = extractFirstRecord(result);
    return normalizeId(record?.id || record?.ID);
  };

  try {
    const directById = await resolveByJobField("id");
    if (directById) return directById;
  } catch (_) {
    // Fallbacks below.
  }

  try {
    const jobByUid = await fetchJobByUid({ plugin, uid: normalizedValue });
    const resolvedByUid = normalizeId(jobByUid?.id || jobByUid?.ID);
    if (resolvedByUid) return resolvedByUid;
  } catch (_) {
    // Fallbacks below.
  }

  try {
    const directByUniqueId = await resolveByJobField("unique_id");
    if (directByUniqueId) return directByUniqueId;
  } catch (_) {
    // Fallbacks below.
  }

  try {
    const inquiryByUid = await fetchInquiryByUid({ plugin, uid: normalizedValue });
    if (inquiryByUid) {
      const linkedJob = await fetchLinkedJobForInquiry({ plugin, inquiry: inquiryByUid });
      const linkedJobId = normalizeId(linkedJob?.id || linkedJob?.ID);
      if (linkedJobId) return linkedJobId;
    }
  } catch (error) {
    console.error("[InquiryDirect] Failed resolving linked job ID", error);
  }

  return null;
}

function buildDealPayloadFromDraft(draft = {}) {
  const accountType = normalizeAccountType(draft?.account_type);
  const clientId = toText(draft?.client_id);
  const companyId = toText(draft?.company_id);

  const payload = {
    sales_stage: toNullableText(draft?.sales_stage),
    deal_value: toNullableText(draft?.deal_value),
    expected_win: toNullableText(draft?.expected_win),
    expected_close_date: toUnixSeconds(draft?.expected_close_date),
    actual_close_date: toUnixSeconds(draft?.actual_close_date),
    weighted_value: toNullableText(draft?.weighted_value),
    recent_activity: toNullableText(draft?.recent_activity),
    account_type: accountType,
    service_provider_id: normalizeId(draft?.service_provider_id),
    client_notes: toNullableText(draft?.client_notes),
    property_id: normalizeId(draft?.property_id),
    inquiry_for_job_id: null,
    inquiry_status: toNullableText(draft?.inquiry_status),
    inquiry_source: toNullableText(draft?.inquiry_source),
    type: toNullableText(draft?.type),
    how_did_you_hear: toNullableText(draft?.how_did_you_hear),
    other: toNullableText(draft?.other),
    service_inquiry_id: normalizeId(normalizeServiceInquiryId(draft?.service_inquiry_id)),
    how_can_we_help: toNullableText(draft?.how_can_we_help),
    admin_notes: toNullableText(draft?.admin_notes),
    noise_signs_options_as_text: toNullableText(draft?.noise_signs_options_as_text),
    pest_active_times_options_as_text: toNullableText(draft?.pest_active_times_options_as_text),
    pest_location_options_as_text: toNullableText(draft?.pest_location_options_as_text),
    renovations: toNullableText(draft?.renovations),
    resident_availability: toNullableText(draft?.resident_availability),
    date_job_required_by: toUnixSeconds(draft?.date_job_required_by),
    primary_contact_id: null,
    company_id: null,
  };

  if (accountType === "Company") {
    if (!companyId) {
      throw new Error("Please select a company before saving.");
    }
    payload.company_id = normalizeId(companyId);
  } else {
    if (!clientId) {
      throw new Error("Please select a contact before saving.");
    }
    payload.primary_contact_id = normalizeId(clientId);
  }

  return payload;
}

function FullPageLoader({ title = "Loading inquiry page...", description = "" }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
            <div className="text-sm font-semibold text-slate-800">{title}</div>
          </div>
          <p className="mt-3 text-sm text-slate-500">{description || "Preparing data..."}</p>
        </div>
      </div>
    </main>
  );
}

function FullPageError({ title = "Unable to load inquiry page.", description = "" }) {
  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']">
      <div className="flex min-h-screen w-full items-center justify-center px-6">
        <div className="w-full max-w-md rounded-lg border border-red-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold text-red-700">{title}</div>
          <p className="mt-3 text-sm text-slate-600">{description || "Please try refreshing the page."}</p>
        </div>
      </div>
    </main>
  );
}

export function InquiryDirectPage() {
  const navigate = useNavigate();
  const inquiryUid = useInquiryUid();
  const { plugin, isReady: isSdkReady, error: sdkError } = useVitalStatsPlugin();
  const [resolvedInquiry, setResolvedInquiry] = useState(null);
  const [inquiryDraft, setInquiryDraft] = useState(() => ({ ...EMPTY_DRAFT }));
  const [initialValues, setInitialValues] = useState(() => ({ ...EMPTY_DRAFT }));
  const [isLoadingInquiry, setIsLoadingInquiry] = useState(false);
  const [isCreatingInquiry, setIsCreatingInquiry] = useState(false);
  const [inquiryLoadError, setInquiryLoadError] = useState("");

  useEffect(() => {
    if (!plugin) return;
    if (toText(inquiryUid)) return;

    let isActive = true;
    setIsCreatingInquiry(true);
    setInquiryLoadError("");

    createInquiryRecord({
      plugin,
      payload: {
        inquiry_status: "New Inquiry",
        account_type: "Contact",
      },
    })
      .then((created) => {
        if (!isActive) return;
        navigate(`/inquiry-direct/${encodeURIComponent(created.unique_id)}`, {
          replace: true,
        });
      })
      .catch((error) => {
        if (!isActive) return;
        setInquiryLoadError(error?.message || "Unable to create inquiry.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsCreatingInquiry(false);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, inquiryUid, navigate]);

  useEffect(() => {
    if (!plugin) return;
    const uid = toText(inquiryUid);
    if (!uid) {
      setResolvedInquiry(null);
      setInitialValues({ ...EMPTY_DRAFT });
      setInquiryLoadError("");
      setIsLoadingInquiry(false);
      return;
    }

    let isActive = true;
    setIsLoadingInquiry(true);
    setInquiryLoadError("");

    fetchInquiryRecordByUid({ plugin, inquiryUid: uid })
      .then((record) => {
        if (!isActive) return;
        if (!record) {
          setResolvedInquiry(null);
          setInitialValues({ ...EMPTY_DRAFT });
          setInquiryLoadError(`Inquiry "${uid}" was not found.`);
          return;
        }
        setResolvedInquiry(record);
        setInitialValues(mapRecordToDraft(record.raw));
      })
      .catch((error) => {
        if (!isActive) return;
        setResolvedInquiry(null);
        setInitialValues({ ...EMPTY_DRAFT });
        setInquiryLoadError(error?.message || "Unable to load inquiry.");
      })
      .finally(() => {
        if (!isActive) return;
        setIsLoadingInquiry(false);
      });

    return () => {
      isActive = false;
    };
  }, [plugin, inquiryUid]);

  const handleDraftChange = useCallback((nextDraft = {}) => {
    setInquiryDraft((previous) => {
      const prevJson = JSON.stringify(previous || {});
      const nextJson = JSON.stringify(nextDraft || {});
      return prevJson === nextJson ? previous : { ...EMPTY_DRAFT, ...(nextDraft || {}) };
    });
  }, []);

  const handleSaveInquiry = useCallback(async () => {
    if (!plugin?.switchTo) {
      throw new Error("SDK is still initializing. Please try again.");
    }

    const payload = buildDealPayloadFromDraft(inquiryDraft);
    const linkedJobDraftValue = toText(inquiryDraft?.inquiry_for_job_id);
    const resolvedLinkedJobId = await resolveLinkedJobIdForPayload({
      plugin,
      linkedJobValue: linkedJobDraftValue,
    });
    if (linkedJobDraftValue && !resolvedLinkedJobId) {
      console.warn(
        `[InquiryDirect] Could not resolve linked job "${linkedJobDraftValue}" to a numeric record ID. Saving fallback value.`
      );
    }
    payload.inquiry_for_job_id =
      resolvedLinkedJobId ?? normalizeId(linkedJobDraftValue);
    const existingId = toText(resolvedInquiry?.id);
    const nextPropertyId = toText(payload?.property_id);
    const previousPropertyId = toText(
      resolvedInquiry?.raw?.property_id || resolvedInquiry?.raw?.Property_ID
    );
    const linkedJobId = toText(
      payload?.inquiry_for_job_id ||
        resolvedInquiry?.raw?.inquiry_for_job_id ||
        resolvedInquiry?.raw?.Inquiry_For_Job_ID ||
        resolvedInquiry?.raw?.Inquiry_for_Job_ID ||
        resolvedInquiry?.raw?.quote_record_id ||
        resolvedInquiry?.raw?.Quote_Record_ID
    );
    const serviceProviderId = toText(payload?.service_provider_id);
    if (existingId) {
      await updateInquiryFieldsById({
        plugin,
        inquiryId: existingId,
        payload,
      });
      if (nextPropertyId && nextPropertyId !== previousPropertyId) {
        await emitAnnouncement({
          plugin,
          eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_LINKED,
          quoteJobId: linkedJobId,
          inquiryId: existingId,
          serviceProviderId,
          focusId: nextPropertyId,
          dedupeEntityId: `${existingId}:${nextPropertyId}`,
          title: "Property linked",
          content: "A property was linked to this inquiry.",
          logContext: "inquiry-direct:handleSaveInquiry:update",
        });
      }
      return;
    }

    const created = await createInquiryRecord({ plugin, payload });
    setResolvedInquiry(created);
    setInitialValues(mapRecordToDraft(created.raw || {}));
    if (nextPropertyId) {
      await emitAnnouncement({
        plugin,
        eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_LINKED,
        quoteJobId: toText(
          created?.raw?.inquiry_for_job_id ||
            created?.raw?.Inquiry_For_Job_ID ||
            created?.raw?.Inquiry_for_Job_ID ||
            created?.raw?.quote_record_id ||
            created?.raw?.Quote_Record_ID
        ),
        inquiryId: toText(created?.id),
        serviceProviderId,
        focusId: nextPropertyId,
        dedupeEntityId: `${toText(created?.id)}:${nextPropertyId}`,
        title: "Property linked",
        content: "A property was linked to this inquiry.",
        logContext: "inquiry-direct:handleSaveInquiry:create",
      });
    }
    navigate(`/inquiry-direct/${encodeURIComponent(created.unique_id)}`, { replace: true });
  }, [plugin, inquiryDraft, resolvedInquiry, navigate]);

  const handleSubmitServiceProvider = useCallback(async () => {
    if (!plugin?.switchTo) {
      throw new Error("SDK is still initializing. Please try again.");
    }
    const inquiryId = toText(resolvedInquiry?.id);
    if (!inquiryId) {
      throw new Error("Inquiry record is missing.");
    }
    const providerId = toText(inquiryDraft?.service_provider_id);
    await updateInquiryFieldsById({
      plugin,
      inquiryId,
      payload: {
        service_provider_id: normalizeId(providerId),
      },
    });
    await emitAnnouncement({
      plugin,
      eventKey: ANNOUNCEMENT_EVENT_KEYS.INQUIRY_ALLOCATED,
      inquiryId,
      serviceProviderId: providerId,
      focusId: inquiryId,
      dedupeEntityId: `${inquiryId}:${providerId}`,
      title: "Inquiry allocated",
      content: "A service provider was allocated to this inquiry.",
      logContext: "inquiry-direct:handleSubmitServiceProvider",
    });
  }, [plugin, resolvedInquiry?.id, inquiryDraft?.service_provider_id]);

  const persistedLinkedJobId = useMemo(
    () =>
      toText(
        resolvedInquiry?.raw?.inquiry_for_job_id ||
          resolvedInquiry?.raw?.Inquiry_For_Job_ID ||
          resolvedInquiry?.raw?.Inquiry_for_Job_ID ||
          resolvedInquiry?.raw?.quote_record_id ||
          resolvedInquiry?.raw?.Quote_Record_ID
      ),
    [resolvedInquiry]
  );

  const linkedJobIdForUploads = useMemo(
    () => toText(inquiryDraft?.inquiry_for_job_id || persistedLinkedJobId),
    [inquiryDraft?.inquiry_for_job_id, persistedLinkedJobId]
  );

  const InquiryInfoBridge = useMemo(
    () =>
      function InquiryInfoBridgeComponent(props) {
        return (
          <InquiryInformationSection
            {...props}
            initialValues={initialValues}
            onDraftChange={handleDraftChange}
            inquiryId={toText(resolvedInquiry?.id)}
            inquiryUid={toText(resolvedInquiry?.unique_id || inquiryUid)}
            linkedJobId={persistedLinkedJobId}
          />
        );
      },
    [
      initialValues,
      handleDraftChange,
      resolvedInquiry?.id,
      resolvedInquiry?.unique_id,
      inquiryUid,
      persistedLinkedJobId,
    ]
  );

  if (sdkError) {
    const friendlyMessage = getFriendlyServiceMessage(sdkError);
    return (
      <FullPageError
        title={friendlyMessage ? "Temporary maintenance" : "Unable to load inquiry data."}
        description={friendlyMessage || "Please refresh and try again."}
      />
    );
  }

  if (!isSdkReady || !plugin) {
    return (
      <FullPageLoader
        title="Loading inquiry page..."
        description="Preparing data..."
      />
    );
  }

  if (isCreatingInquiry || isLoadingInquiry) {
    return (
      <FullPageLoader
        title={isCreatingInquiry ? "Creating inquiry..." : "Loading inquiry page..."}
        description={isCreatingInquiry ? "Setting up your inquiry..." : "Fetching inquiry data..."}
      />
    );
  }

  if (inquiryLoadError) {
    return (
      <FullPageError
        title="Unable to load inquiry data."
        description={inquiryLoadError}
      />
    );
  }

  return (
    <>
      <GlobalTopHeader />
      <main
        className="min-h-screen w-full bg-slate-50 font-['Inter']"
        data-page={INQUIRY_PAGE_DATA_ATTR}
        data-sdk-ready="true"
      >
        <JobDirectStoreProvider
          jobUid={null}
          jobData={null}
          lookupData={null}
        >
          <JobDirectLayout
            jobData={null}
            plugin={plugin}
            jobUid={null}
            preloadedLookupData={null}
            headerTitle="New Inquiry"
            pageDataAttr={INQUIRY_PAGE_DATA_ATTR}
            sectionOrder={INQUIRY_SECTION_ORDER}
            sectionLabels={INQUIRY_SECTION_LABELS}
            informationSectionComponent={InquiryInfoBridge}
            saveEnabled
            onSaveOverride={handleSaveInquiry}
            onSubmitServiceProviderOverride={handleSubmitServiceProvider}
            uploadsSectionProps={{
              uploadsMode: "inquiry",
              inquiryId: toText(resolvedInquiry?.id),
              inquiryUid: toText(resolvedInquiry?.unique_id || inquiryUid),
              linkedJobId: toText(linkedJobIdForUploads),
            }}
            showDealInfoButton={false}
            runtimeModalProps={{
              tasksModalProps: {
                contextType: "deal",
                contextId: toText(resolvedInquiry?.id),
                additionalCreatePayload: {
                  deal_id: toText(resolvedInquiry?.id),
                  Deal_id: toText(resolvedInquiry?.id),
                },
                additionalUpdatePayload: {
                  deal_id: toText(resolvedInquiry?.id),
                  Deal_id: toText(resolvedInquiry?.id),
                },
              },
            }}
          />
        </JobDirectStoreProvider>
      </main>
    </>
  );
}
