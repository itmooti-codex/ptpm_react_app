import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useVitalStatsPlugin } from "../../../platform/vitalstats/useVitalStatsPlugin.js";
import {
  fetchJobByUid,
  updateJobFieldsById,
} from "../../../modules/job-records/exports/api.js";
import { fetchActivitiesByJobId } from "../../../modules/details-workspace/api/core/domains/activities/activitiesMaterials.js";
import {
  fetchCompanyAccountRecordById,
  fetchContactAccountRecordById,
  fetchPropertyRecordById,
  fetchServiceProvidersForSearch,
  uploadMaterialFile,
} from "../../../modules/details-workspace/exports/api.js";
import { QuoteSheetPanel } from "../../../modules/details-workspace/components/sections/invoice/QuoteSheetPanel.jsx";
import logoAsset from "../../../assets/logo.webp";
import {
  formatDate,
  formatServiceProviderInputLabel,
  fullName,
  joinAddress,
  toText,
} from "../../../shared/utils/formatters.js";
import {
  isBodyCorpCompanyAccountType,
  isCompanyAccountType,
} from "../../../shared/utils/accountTypeUtils.js";

const JOB_TAKEN_BY_FIELD_ALIASES = ["Job_Taken_By_id", "job_taken_by_id", "Job_Taken_By_ID"];

function normalizeQuoteStatus(value) {
  return toText(value).toLowerCase();
}

function toPromiseLike(result) {
  if (!result) return Promise.resolve(result);
  if (typeof result.then === "function") return result;
  if (typeof result.toPromise === "function") return result.toPromise();
  return Promise.resolve(result);
}

function extractFirstRecord(payload) {
  if (Array.isArray(payload?.resp) && payload.resp.length) return payload.resp[0];
  if (Array.isArray(payload?.data) && payload.data.length) return payload.data[0];
  if (payload?.data && typeof payload.data === "object") {
    const firstArray = Object.values(payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray) && firstArray.length) return firstArray[0];
  }
  if (payload?.payload?.data && typeof payload.payload.data === "object") {
    const firstArray = Object.values(payload.payload.data).find((value) => Array.isArray(value));
    if (Array.isArray(firstArray) && firstArray.length) return firstArray[0];
  }
  return null;
}

async function fetchJobTakenById({ plugin, jobId } = {}) {
  const normalizedJobId = toText(jobId);
  if (!plugin?.switchTo || !normalizedJobId) return "";
  const jobModel = plugin.switchTo("PeterpmJob");
  if (!jobModel?.query) return "";

  const whereValue = /^\d+$/.test(normalizedJobId)
    ? Number.parseInt(normalizedJobId, 10)
    : normalizedJobId;

  for (const fieldName of JOB_TAKEN_BY_FIELD_ALIASES) {
    try {
      const query = jobModel
        .query()
        .where("id", whereValue)
        .deSelectAll()
        .select(["id", fieldName])
        .limit(1)
        .noDestroy();
      query.getOrInitQueryCalc?.();
      const result = await toPromiseLike(query.fetchDirect());
      const record = extractFirstRecord(result);
      if (!record || typeof record !== "object") continue;
      const value = toText(record?.[fieldName]);
      if (value) return value;
      if (Object.prototype.hasOwnProperty.call(record, fieldName)) return "";
    } catch {
      // Ignore unsupported aliases and keep trying fallbacks.
    }
  }

  return "";
}

function resolveNestedContactRecord(record = {}) {
  const nested = record?.Primary_Person || record?.primary_person || {};
  return Array.isArray(nested) ? nested[0] || {} : nested || {};
}

async function fetchInquiryAccountContextById({ plugin, inquiryId } = {}) {
  const normalizedInquiryId = toText(inquiryId);
  if (!plugin?.switchTo || !normalizedInquiryId) return null;
  const dealModel = plugin.switchTo("PeterpmDeal");
  if (!dealModel?.query) return null;

  const whereValue = /^\d+$/.test(normalizedInquiryId)
    ? Number.parseInt(normalizedInquiryId, 10)
    : normalizedInquiryId;

  const query = dealModel
    .query()
    .where("id", whereValue)
    .deSelectAll()
    .select([
      "id",
      "unique_id",
      "deal_name",
      "how_can_we_help",
      "renovations",
      "resident_availability",
      "noise_signs_options_as_text",
      "pest_active_times_options_as_text",
      "pest_location_options_as_text",
      "recommendations",
    ])
    .limit(1)
    .noDestroy();

  query.getOrInitQueryCalc?.();
  const result = await toPromiseLike(query.fetchDirect());
  return extractFirstRecord(result);
}

export function PublicJobSheetPage() {
  const { uid = "" } = useParams();
  const safeUid = toText(uid);
  const { plugin, isReady } = useVitalStatsPlugin();
  const configuredAdminProviderId = toText(import.meta.env.VITE_APP_USER_ADMIN_ID);

  const [job, setJob] = useState(null);
  const [inquiry, setInquiry] = useState(null);
  const [activities, setActivities] = useState([]);
  const [accountContact, setAccountContact] = useState(null);
  const [accountCompany, setAccountCompany] = useState(null);
  const [propertyRecord, setPropertyRecord] = useState(null);
  const [jobTakenByLabel, setJobTakenByLabel] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState(null);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!isReady || !safeUid) return;

    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    setAcceptError(null);
    setAccepted(false);
    setAccountContact(null);
    setAccountCompany(null);
    setPropertyRecord(null);
    setJobTakenByLabel("");

    (async () => {
      try {
        const fetchedJob = await fetchJobByUid({ plugin, uid: safeUid });
        if (cancelled) return;
        if (!fetchedJob) {
          setLoadError("Job not found.");
          setIsLoading(false);
          return;
        }

        const jobId = toText(fetchedJob?.id || fetchedJob?.ID);
        const companyId = toText(
          fetchedJob?.client_entity_id ||
            fetchedJob?.Client_Entity_ID ||
            fetchedJob?.Client_Entity?.id ||
            fetchedJob?.Client_Entity?.ID ||
            fetchedJob?.client_entity?.id ||
            fetchedJob?.client_entity?.ID
        );
        const contactId = toText(
          fetchedJob?.client_individual_id ||
            fetchedJob?.Client_Individual_ID ||
            fetchedJob?.Client_Individual?.id ||
            fetchedJob?.Client_Individual?.ID ||
            fetchedJob?.client_individual?.id ||
            fetchedJob?.client_individual?.ID
        );
        const inquiryId = toText(
          fetchedJob?.inquiry_record_id || fetchedJob?.Inquiry_Record_ID
        );
        const propertyId = toText(
          fetchedJob?.property_id ||
            fetchedJob?.Property_ID ||
            fetchedJob?.Property?.id ||
            fetchedJob?.Property?.ID ||
            fetchedJob?.property?.id ||
            fetchedJob?.property?.ID
        );

        const [
          fetchedActivities,
          fetchedInquiry,
          contactRecord,
          companyRecord,
          fetchedPropertyRecord,
          storedJobTakenById,
          adminProviders,
        ] = await Promise.all([
          jobId ? fetchActivitiesByJobId({ plugin, jobId }) : Promise.resolve([]),
          inquiryId ? fetchInquiryAccountContextById({ plugin, inquiryId }) : Promise.resolve(null),
          contactId ? fetchContactAccountRecordById({ plugin, contactId }) : Promise.resolve(null),
          companyId ? fetchCompanyAccountRecordById({ plugin, companyId }) : Promise.resolve(null),
          propertyId ? fetchPropertyRecordById({ plugin, propertyId }) : Promise.resolve(null),
          jobId ? fetchJobTakenById({ plugin, jobId }) : Promise.resolve(""),
          fetchServiceProvidersForSearch({ plugin, providerType: "Admin", status: "" }),
        ]);

        if (cancelled) return;

        const resolvedJobTakenById = toText(storedJobTakenById || configuredAdminProviderId);
        const matchedAdminProvider = (Array.isArray(adminProviders) ? adminProviders : []).find(
          (provider) => toText(provider?.id || provider?.ID) === resolvedJobTakenById
        );

        setJob(fetchedJob);
        setInquiry(fetchedInquiry);
        setActivities(Array.isArray(fetchedActivities) ? fetchedActivities : []);
        setAccountContact(contactRecord || null);
        setAccountCompany(companyRecord || null);
        setPropertyRecord(fetchedPropertyRecord || null);
        setJobTakenByLabel(
          matchedAdminProvider
            ? formatServiceProviderInputLabel(matchedAdminProvider)
            : resolvedJobTakenById
              ? `Provider #${resolvedJobTakenById}`
              : ""
        );
        setAccepted(
          normalizeQuoteStatus(fetchedJob?.quote_status || fetchedJob?.Quote_Status) === "accepted"
        );
      } catch (err) {
        if (!cancelled) {
          console.error("[PublicJobSheet] Failed to load job", err);
          setLoadError("Unable to load job sheet. Please try again.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [configuredAdminProviderId, isReady, plugin, safeUid]);

  const quoteStatusNormalized = useMemo(
    () => normalizeQuoteStatus(job?.quote_status || job?.Quote_Status),
    [job]
  );

  const canAcceptQuote = Boolean(job) && quoteStatusNormalized === "sent";
  const isQuoteAccepted = accepted || quoteStatusNormalized === "accepted";

  const headerData = useMemo(() => {
    if (!job) return null;

    const accountType = toText(job?.account_type || job?.Account_Type);
    const isCompanyAccountValue =
      isCompanyAccountType(accountType) || isBodyCorpCompanyAccountType(accountType);

    const contactRecord =
      accountContact ||
      job?.Client_Individual ||
      job?.client_individual ||
      {};
    const companyRecord =
      accountCompany ||
      job?.Client_Entity ||
      job?.client_entity ||
      {};
    const companyPrimaryRecord = resolveNestedContactRecord(companyRecord);
    const activePropertyRecord = propertyRecord || job?.Property || job?.property || {};

    const accountContactName = fullName(
      contactRecord?.first_name || contactRecord?.First_Name,
      contactRecord?.last_name || contactRecord?.Last_Name
    );
    const accountContactPhone = toText(
      contactRecord?.sms_number ||
        contactRecord?.SMS_Number ||
        contactRecord?.office_phone ||
        contactRecord?.Office_Phone
    );
    const accountContactAddress = joinAddress([
      contactRecord?.address || contactRecord?.Address,
      contactRecord?.city || contactRecord?.City,
      contactRecord?.state || contactRecord?.State,
      contactRecord?.zip_code || contactRecord?.Zip_Code || contactRecord?.postal_code,
    ]);

    const accountCompanyName = toText(companyRecord?.name || companyRecord?.Name);
    const accountCompanyAddress = joinAddress([
      companyRecord?.address || companyRecord?.Address,
      companyRecord?.city || companyRecord?.City,
      companyRecord?.state || companyRecord?.State,
      companyRecord?.postal_code || companyRecord?.Postal_Code || companyRecord?.zip_code,
    ]);
    const accountCompanyPrimaryName = fullName(
      companyPrimaryRecord?.first_name ||
        companyPrimaryRecord?.First_Name ||
        companyRecord?.Primary_Person_First_Name,
      companyPrimaryRecord?.last_name ||
        companyPrimaryRecord?.Last_Name ||
        companyRecord?.Primary_Person_Last_Name
    );
    const accountCompanyPrimaryPhone = toText(
      companyPrimaryRecord?.sms_number ||
        companyPrimaryRecord?.SMS_Number ||
        companyRecord?.Primary_Person_SMS_Number
    );

    const activePropertyAddress = joinAddress([
      activePropertyRecord?.address_1 || activePropertyRecord?.Address_1 || activePropertyRecord?.address,
      activePropertyRecord?.suburb_town || activePropertyRecord?.Suburb_Town || activePropertyRecord?.city,
      activePropertyRecord?.state || activePropertyRecord?.State,
      activePropertyRecord?.postal_code || activePropertyRecord?.Postal_Code,
    ]);
    const jobSuburb = toText(
      activePropertyRecord?.suburb_town ||
        activePropertyRecord?.Suburb_Town ||
        activePropertyRecord?.city ||
        activePropertyRecord?.City
    );

    const accountName = isCompanyAccountValue
      ? accountCompanyName || accountCompanyPrimaryName
      : accountContactName;
    const accountAddress = isCompanyAccountValue
      ? accountCompanyAddress
      : accountContactAddress;

    return {
      logoUrl: `${window.location.origin}${logoAsset}`,
      accountName: toText(accountName),
      accountType: toText(accountType || "—"),
      workReqBy: toText(jobTakenByLabel),
      workOrderUid: toText(safeUid),
      jobAddress: toText(activePropertyAddress || accountAddress),
      jobSuburb,
      date: formatDate(Date.now()),
      residentsRows: [
        [accountContactName, accountContactPhone].filter(Boolean).join("  Ph: "),
        [accountCompanyPrimaryName, accountCompanyPrimaryPhone].filter(Boolean).join("  Ph: "),
      ].filter(Boolean),
      feedback: null,
      recommendation: toText(
        job?.admin_recommendation ||
          job?.Admin_Recommendation ||
          inquiry?.recommendations ||
          inquiry?.Recommendations
      ),
    };
  }, [accountCompany, accountContact, inquiry, job, jobTakenByLabel, propertyRecord, safeUid]);

  const handleAcceptQuote = useCallback(
    async ({ signatureBlob } = {}) => {
      if (!canAcceptQuote || isAccepting) return;
      const jobId = toText(job?.id || job?.ID);
      if (!plugin || !jobId) return;

      setIsAccepting(true);
      setAcceptError(null);
      try {
        const now = Math.trunc(Date.now() / 1000);
        let signatureUrl = "";

        if (signatureBlob) {
          const signatureFile = new File([signatureBlob], "signature.png", {
            type: "image/png",
          });
          const uploaded = await uploadMaterialFile({
            file: signatureFile,
            uploadPath: `signatures/${jobId}`,
          });
          signatureUrl = toText(uploaded?.url);
        }

        await updateJobFieldsById({
          plugin,
          jobId,
          payload: {
            quote_status: "Accepted",
            job_status: "In Progress",
            date_quoted_accepted: now,
            terms_and_conditions_accepted: true,
            ...(signatureUrl ? { signature: signatureUrl } : {}),
          },
        });

        setJob((previous) =>
          previous
            ? {
                ...previous,
                quote_status: "Accepted",
                job_status: "In Progress",
                date_quoted_accepted: now,
              }
            : previous
        );
        setAccepted(true);
      } catch (err) {
        console.error("[PublicJobSheet] Failed accepting quote", err);
        setAcceptError(err?.message || "Unable to accept quote. Please try again.");
      } finally {
        setIsAccepting(false);
      }
    },
    [canAcceptQuote, isAccepting, job, plugin]
  );

  if (!isReady || isLoading) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 font-['Inter']">
        <div className="flex items-center gap-3 text-sm text-slate-600">
          <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
          Loading job sheet...
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 font-['Inter']">
        <div className="rounded-lg border border-red-200 bg-red-50 px-6 py-5 text-sm text-red-700">
          {loadError}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen w-full bg-slate-50 px-4 py-8 font-['Inter']">
      <div className="mx-auto max-w-3xl space-y-4">
        {isQuoteAccepted ? (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-center text-sm font-medium text-green-700">
            Quote accepted. Thank you!
          </div>
        ) : null}

        {acceptError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {acceptError}
          </div>
        ) : null}

        <QuoteSheetPanel
          activities={activities}
          headerData={headerData}
          onAcceptQuote={handleAcceptQuote}
          isAcceptingQuote={isAccepting}
          canAcceptQuote={canAcceptQuote && !isQuoteAccepted}
          canSendQuote={false}
          onSendQuote={null}
          isSendingQuote={false}
          hasAccountsContact={false}
        />
      </div>
    </main>
  );
}
