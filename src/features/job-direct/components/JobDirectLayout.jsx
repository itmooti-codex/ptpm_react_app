import { useCallback, useEffect, useRef, useState } from "react";
import { PageScaffold } from "../../../shared/layout/PageScaffold.jsx";
import { useJobDirectState } from "../hooks/useJobDirectState.js";
import { useJobDirectRealtimeSync } from "../hooks/useJobDirectRealtimeSync.js";
import { JobDirectContent } from "./JobDirectContent.jsx";
import { JobDirectHeader } from "./JobDirectHeader.jsx";
import { ContactDetailsModal } from "./modals/ContactDetailsModal.jsx";
import { AddPropertyModal } from "./modals/AddPropertyModal.jsx";
import { LegacyRuntimeModals } from "./modals/LegacyRuntimeModals.jsx";
import { MODAL_KEYS, SECTION_LABELS, SECTION_ORDER } from "../constants/navigation.js";
import { JobDirectSidebar } from "./JobDirectSidebar.jsx";
import { updateJobRecordById, updateJobRecordByUid } from "../sdk/jobDirectSdk.js";
import { useJobDirectSelector, useJobDirectStoreActions } from "../hooks/useJobDirectStore.jsx";
import { selectJobEntity, selectOverviewDraft } from "../state/selectors.js";
import {
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "../constants/options.js";

function normalizeId(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  return text;
}

function toText(value) {
  return String(value ?? "").trim();
}

function resolveDropdownLabel(options = [], rawValue = "") {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  const matchedOption = options.find((option) => String(option.value) === value);
  return matchedOption ? String(matchedOption.label || "").trim() : value;
}

function resolveDropdownValue(options = [], rawValue = "") {
  const value = String(rawValue || "").trim();
  if (!value) return "";
  const byValue = options.find((option) => toText(option?.value) === value);
  if (byValue) return toText(byValue.value);
  const byLabel = options.find((option) => toText(option?.label).toLowerCase() === value.toLowerCase());
  if (byLabel) return toText(byLabel.value);
  return value;
}

const TRACKED_SAVE_FIELDS = [
  "account_type",
  "client_id",
  "company_id",
  "job_status",
  "priority",
  "job_type",
  "primary_service_provider_id",
  "property_id",
  "inquiry_record_id",
];

const TRACKED_SAVE_FIELD_SET = new Set(TRACKED_SAVE_FIELDS);

function pickTrackedDraftFields(source = {}) {
  return TRACKED_SAVE_FIELDS.reduce((acc, field) => {
    acc[field] = toText(source?.[field]);
    return acc;
  }, {});
}

function areTrackedDraftFieldsEqual(a = {}, b = {}) {
  return TRACKED_SAVE_FIELDS.every((field) => toText(a?.[field]) === toText(b?.[field]));
}

function createOverviewDraftFromJob(job = {}) {
  return {
    account_type: toText(job?.account_type || job?.Account_Type) || "Contact",
    client_id: toText(job?.client_individual_id || job?.Client_Individual_ID),
    company_id: toText(job?.client_entity_id || job?.Client_Entity_ID),
    job_status: resolveDropdownValue(
      JOB_STATUS_OPTIONS,
      toText(job?.job_status || job?.Job_Status)
    ),
    priority: resolveDropdownValue(PRIORITY_OPTIONS, toText(job?.priority || job?.Priority)),
    job_type: resolveDropdownValue(JOB_TYPE_OPTIONS, toText(job?.job_type || job?.Job_Type)),
    primary_service_provider_id: toText(
      job?.primary_service_provider_id || job?.Primary_Service_Provider_ID
    ),
    property_id: toText(job?.property_id || job?.Property_ID),
    inquiry_record_id: toText(job?.inquiry_record_id || job?.Inquiry_Record_ID),
  };
}

export function JobDirectLayout({
  jobData,
  plugin,
  jobUid,
  preloadedLookupData,
  headerTitle = "New Job Direct",
  pageDataAttr = "new-direct-job",
  sectionOrder = SECTION_ORDER,
  sectionLabels = SECTION_LABELS,
  onSaveOverride = undefined,
  onSubmitServiceProviderOverride = undefined,
  informationSectionComponent = null,
  uploadsSectionProps = null,
  saveEnabled = true,
  showDealInfoButton = true,
  runtimeModalProps = null,
}) {
  const storeActions = useJobDirectStoreActions();
  useJobDirectRealtimeSync({ plugin, initialJobData: jobData });
  const storeJobEntity = useJobDirectSelector(selectJobEntity);
  const overviewDraft = useJobDirectSelector(selectOverviewDraft);
  const activeJobData = storeJobEntity || jobData || null;
  const resolvedSectionOrder =
    Array.isArray(sectionOrder) && sectionOrder.length > 0 ? sectionOrder : SECTION_ORDER;

  const {
    activeSection,
    activeTab,
    sidebarCollapsed,
    modals,
    navState,
    setActiveTab,
    setSidebarCollapsed,
    setSection,
    goBack,
    goNext,
    openModal,
    closeModal,
  } = useJobDirectState({ sectionOrder: resolvedSectionOrder });
  const [contactDetailsContext, setContactDetailsContext] = useState({
    mode: "individual",
    onSave: null,
  });
  const [addPropertyContext, setAddPropertyContext] = useState({
    onSave: null,
    initialData: null,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasExternalUnsavedChanges, setHasExternalUnsavedChanges] = useState(false);
  const overviewBaselineRef = useRef(pickTrackedDraftFields({}));

  const openContactDetailsModal = ({ mode = "individual", onSave = null } = {}) => {
    setContactDetailsContext({ mode, onSave });
    openModal(MODAL_KEYS.contactDetails);
  };

  const closeContactDetailsModal = () => {
    closeModal(MODAL_KEYS.contactDetails);
  };

  const openAddPropertyModal = ({ onSave = null, initialData = null } = {}) => {
    setAddPropertyContext({ onSave, initialData });
    openModal(MODAL_KEYS.addProperty);
  };

  const closeAddPropertyModal = () => {
    closeModal(MODAL_KEYS.addProperty);
  };

  const commitOverviewBaseline = useCallback(
    (nextSource = null) => {
      const baselineFields = pickTrackedDraftFields(nextSource || overviewDraft || {});
      overviewBaselineRef.current = baselineFields;
      storeActions.setDraft("overview", {
        ...(overviewDraft || {}),
        ...baselineFields,
        dirty: false,
      });
      setHasUnsavedChanges(false);
    },
    [overviewDraft, storeActions]
  );

  const applyOverviewDraftPatch = useCallback(
    (patch = {}, { markDirty = true } = {}) => {
      const patchObject = patch && typeof patch === "object" ? patch : {};
      const currentFields = pickTrackedDraftFields(overviewDraft || {});
      const nextFields = { ...currentFields };
      let hasFieldChange = false;

      Object.entries(patchObject).forEach(([key, value]) => {
        if (!TRACKED_SAVE_FIELD_SET.has(key)) return;
        const normalizedValue = toText(value);
        if (toText(nextFields[key]) === normalizedValue) return;
        nextFields[key] = normalizedValue;
        hasFieldChange = true;
      });

      const nextDirty = markDirty
        ? !areTrackedDraftFieldsEqual(nextFields, overviewBaselineRef.current || {})
        : false;

      if (!hasFieldChange && Boolean(overviewDraft?.dirty) === Boolean(nextDirty)) return;

      storeActions.setDraft("overview", {
        ...(overviewDraft || {}),
        ...nextFields,
        dirty: nextDirty,
      });
      setHasUnsavedChanges(Boolean(nextDirty));
    },
    [overviewDraft, storeActions]
  );

  const handleOverviewDraftChange = useCallback(
    (patch = {}) => {
      applyOverviewDraftPatch(patch, { markDirty: true });
    },
    [applyOverviewDraftPatch]
  );

  useEffect(() => {
    if (overviewDraft?.dirty) return;
    const nextBaseline = createOverviewDraftFromJob(activeJobData || {});
    if (areTrackedDraftFieldsEqual(nextBaseline, overviewBaselineRef.current || {})) return;
    overviewBaselineRef.current = nextBaseline;
    storeActions.setDraft("overview", {
      ...(overviewDraft || {}),
      ...nextBaseline,
      dirty: false,
    });
    setHasUnsavedChanges(false);
    setHasExternalUnsavedChanges(false);
  }, [activeJobData, overviewDraft, storeActions]);

  useEffect(() => {
    setHasUnsavedChanges(Boolean(overviewDraft?.dirty));
  }, [overviewDraft?.dirty]);

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges && !hasExternalUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, hasExternalUnsavedChanges]);

  const handleSaveJob = async () => {
    const uniqueId = String(
      jobUid || activeJobData?.unique_id || activeJobData?.Unique_ID || ""
    ).trim();
    const jobId = normalizeId(activeJobData?.id || activeJobData?.ID || "");
    if (!uniqueId) {
      throw new Error("Job UID is missing from URL.");
    }
    if (!plugin) {
      throw new Error("SDK is still initializing. Please try again.");
    }
    const getFieldValue = (field, fallback = "") => toText(overviewDraft?.[field]) || fallback;
    const fallbackJobStatus = resolveDropdownValue(
      JOB_STATUS_OPTIONS,
      toText(activeJobData?.job_status || activeJobData?.Job_Status)
    );
    const fallbackPriority = resolveDropdownValue(
      PRIORITY_OPTIONS,
      toText(activeJobData?.priority || activeJobData?.Priority)
    );
    const fallbackJobType = resolveDropdownValue(
      JOB_TYPE_OPTIONS,
      toText(activeJobData?.job_type || activeJobData?.Job_Type)
    );

    const accountType =
      getFieldValue("account_type") ||
      toText(activeJobData?.account_type || activeJobData?.Account_Type);
    const clientIndividualId =
      getFieldValue("client_id") ||
      toText(activeJobData?.client_individual_id || activeJobData?.Client_Individual_ID);
    const clientEntityId =
      getFieldValue("company_id") ||
      toText(activeJobData?.client_entity_id || activeJobData?.Client_Entity_ID);
    const rawJobStatus = getFieldValue("job_status", fallbackJobStatus);
    const rawPriority = getFieldValue("priority", fallbackPriority);
    const rawJobType = getFieldValue("job_type", fallbackJobType);
    const jobStatus = resolveDropdownLabel(
      JOB_STATUS_OPTIONS,
      rawJobStatus
    );
    const priority = resolveDropdownLabel(
      PRIORITY_OPTIONS,
      rawPriority
    );
    const jobType = resolveDropdownLabel(
      JOB_TYPE_OPTIONS,
      rawJobType
    );
    const propertyId = getFieldValue(
      "property_id",
      toText(activeJobData?.property_id || activeJobData?.Property_ID)
    );
    const inquiryRecordId = getFieldValue(
      "inquiry_record_id",
      toText(activeJobData?.inquiry_record_id || activeJobData?.Inquiry_Record_ID)
    );
    const primaryServiceProviderId = getFieldValue(
      "primary_service_provider_id",
      toText(activeJobData?.primary_service_provider_id || activeJobData?.Primary_Service_Provider_ID)
    );

    const nextDraftFields = {
      account_type: accountType,
      client_id: clientIndividualId,
      company_id: clientEntityId,
      job_status: rawJobStatus,
      priority: rawPriority,
      job_type: rawJobType,
      primary_service_provider_id: primaryServiceProviderId,
      property_id: propertyId,
      inquiry_record_id: inquiryRecordId,
    };

    const payload = {};

    if (jobStatus) payload.job_status = jobStatus;
    if (priority) payload.priority = priority;
    if (jobType) payload.job_type = jobType;
    payload.property_id = propertyId ? normalizeId(propertyId) : null;
    payload.inquiry_record_id = inquiryRecordId ? normalizeId(inquiryRecordId) : null;
    payload.primary_service_provider_id = primaryServiceProviderId
      ? normalizeId(primaryServiceProviderId)
      : null;

    if (accountType === "Company") {
      payload.account_type = "Company";
      if (!clientEntityId) {
        throw new Error("Please select a company before saving.");
      }
      payload.client_entity_id = normalizeId(clientEntityId);
      payload.client_individual_id = null;
    } else if (accountType === "Contact") {
      payload.account_type = "Contact";
      if (!clientIndividualId) {
        throw new Error("Please select a contact before saving.");
      }
      payload.client_individual_id = normalizeId(clientIndividualId);
      payload.client_entity_id = null;
    }

    if (!Object.keys(payload).length) {
      commitOverviewBaseline(nextDraftFields);
      return;
    }

    if (jobId) {
      await updateJobRecordById({
        plugin,
        id: jobId,
        payload,
      });
    } else {
      await updateJobRecordByUid({
        plugin,
        uniqueId,
        payload,
      });
    }
    commitOverviewBaseline(nextDraftFields);
  };

  const handleSubmitServiceProvider = async () => {
    if (!plugin) {
      throw new Error("SDK is still initializing. Please try again.");
    }

    const jobId = normalizeId(activeJobData?.id || activeJobData?.ID || "");
    if (!jobId) {
      throw new Error("Job ID is missing.");
    }

    const providerId =
      toText(overviewDraft?.primary_service_provider_id) ||
      toText(activeJobData?.primary_service_provider_id || activeJobData?.Primary_Service_Provider_ID);
    await updateJobRecordById({
      plugin,
      id: jobId,
      payload: {
        primary_service_provider_id: providerId ? normalizeId(providerId) : null,
      },
    });
    commitOverviewBaseline({
      ...pickTrackedDraftFields(overviewDraft || {}),
      primary_service_provider_id: providerId,
    });
  };

  const saveHandler = onSaveOverride === undefined ? handleSaveJob : onSaveOverride;
  const submitServiceProviderHandler =
    onSubmitServiceProviderOverride === undefined
      ? handleSubmitServiceProvider
      : onSubmitServiceProviderOverride;

  return (
    <>
      <PageScaffold
        header={
          <JobDirectHeader
            navState={navState}
            onBack={goBack}
            onNext={goNext}
            onSave={saveHandler}
            title={headerTitle}
            sectionLabels={sectionLabels}
            pageDataAttr={pageDataAttr}
            saveEnabled={saveEnabled && typeof saveHandler === "function"}
            hasUnsavedChanges={hasUnsavedChanges || hasExternalUnsavedChanges}
          />
        }
        sidebar={
          <JobDirectSidebar
            activeSection={activeSection}
            sidebarCollapsed={sidebarCollapsed}
            setSidebarCollapsed={setSidebarCollapsed}
            onSelectSection={setSection}
            sectionOrder={resolvedSectionOrder}
            sectionLabels={sectionLabels}
          />
        }
      >
        <JobDirectContent
          activeSection={activeSection}
          activeTab={activeTab}
          jobData={activeJobData}
          plugin={plugin}
          jobUid={jobUid}
          preloadedLookupData={preloadedLookupData}
          onSaveJob={saveHandler}
          onSubmitServiceProvider={submitServiceProviderHandler}
          onTabChange={setActiveTab}
          onOpenModal={openModal}
          onOpenContactDetailsModal={openContactDetailsModal}
          onOpenAddPropertyModal={openAddPropertyModal}
          onExternalUnsavedChange={setHasExternalUnsavedChanges}
          onOverviewDraftChange={handleOverviewDraftChange}
          sectionOrder={resolvedSectionOrder}
          informationSectionComponent={informationSectionComponent}
          uploadsSectionProps={uploadsSectionProps}
          showDealInfoButton={showDealInfoButton}
        />
      </PageScaffold>

      <ContactDetailsModal
        open={modals[MODAL_KEYS.contactDetails]}
        mode={contactDetailsContext.mode}
        onSave={(record) => {
          if (typeof contactDetailsContext.onSave === "function") {
            return contactDetailsContext.onSave(record);
          }
          return null;
        }}
        onClose={closeContactDetailsModal}
      />

      <AddPropertyModal
        open={modals[MODAL_KEYS.addProperty]}
        initialData={addPropertyContext.initialData}
        onSave={(record) => {
          if (typeof addPropertyContext.onSave === "function") {
            return addPropertyContext.onSave(record);
          }
          return null;
        }}
        onClose={closeAddPropertyModal}
      />

      <LegacyRuntimeModals
        modals={modals}
        onClose={closeModal}
        plugin={plugin}
        jobData={activeJobData}
        {...(runtimeModalProps && typeof runtimeModalProps === "object"
          ? runtimeModalProps
          : {})}
      />
    </>
  );
}
