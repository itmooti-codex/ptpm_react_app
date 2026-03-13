import { useEffect, useMemo, useState } from "react";
import { buildLookupDisplayLabel } from "../../../../../shared/utils/lookupLabel.js";
import {
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "../../../constants/options.js";
import { usePropertyLookupData } from "../../../hooks/usePropertyLookupData.js";
import {
  useDetailsWorkspaceSelector,
} from "../../../hooks/useDetailsWorkspaceStore.jsx";
import {
  selectJobEntity,
} from "../../../state/selectors.js";
import { useLinkedPropertiesData } from "./useLinkedPropertiesData.js";
import { usePropertyActions } from "./usePropertyActions.js";
import {
  getFirstFilledValue,
  getJobEntitySelection,
  getJobIndividualSelection,
  getJobPrimaryServiceProviderDetails,
  getJobRelatedInquiry,
  normalizeInquiryId,
  normalizePropertyId,
  resolveContactTypeFromJob,
  resolveOptionDefault,
} from "./jobInfoUtils.js";
import { toText } from "../../../../../shared/utils/formatters.js";

function formatPropertyPrefillDetails({
  propertyLabel = "",
  propertyMeta = "",
  activeProperty = null,
} = {}) {
  const label = toText(propertyLabel);
  const metaTokens = toText(propertyMeta)
    .split("|")
    .map((item) => toText(item))
    .filter(Boolean);
  const uidFromMeta = toText(metaTokens[0]);
  if (label && uidFromMeta && !label.toLowerCase().includes(uidFromMeta.toLowerCase())) {
    return `${label} | ${uidFromMeta}`;
  }
  if (label) return label;

  const propertyName = toText(
    activeProperty?.property_name ||
      activeProperty?.Property_Name ||
      activeProperty?.name ||
      activeProperty?.Name
  );
  const propertyUid = toText(activeProperty?.unique_id || activeProperty?.Unique_ID || uidFromMeta);
  const address = [
    toText(
      activeProperty?.address_1 ||
        activeProperty?.Address_1 ||
        activeProperty?.address ||
        activeProperty?.Address
    ),
    toText(
      activeProperty?.suburb_town ||
        activeProperty?.Suburb_Town ||
        activeProperty?.city ||
        activeProperty?.City
    ),
    toText(activeProperty?.state || activeProperty?.State),
    toText(
      activeProperty?.postal_code ||
        activeProperty?.Postal_Code ||
        activeProperty?.zip_code ||
        activeProperty?.Zip_Code
    ),
  ]
    .filter(Boolean)
    .join(", ");

  return [propertyName, propertyUid, address].filter(Boolean).join(" | ");
}

export function useJobInformationState({
  activeTab,
  jobData,
  plugin,
  preloadedLookupData,
  onSaveJob,
  onSubmitServiceProvider,
  onOpenAddPropertyModal,
  onOverviewDraftChange,
}) {
  const storeJobData = useDetailsWorkspaceSelector(selectJobEntity);
  const activeJobData = storeJobData || jobData || null;
  const {
    properties: lookupProperties,
    addProperty,
    searchProperties,
  } = usePropertyLookupData(plugin, {
    initialProperties: preloadedLookupData?.properties || [],
    skipInitialFetch: true,
  });
  const [selection, setSelection] = useState({
    accountType: "Contact",
    clientId: "",
    companyId: "",
  });
  const [appointmentDraft, setAppointmentDraft] = useState(null);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [linkedInquiryRecordId, setLinkedInquiryRecordId] = useState(
    normalizeInquiryId(getJobRelatedInquiry(activeJobData)?.id)
  );
  const [jobFieldsDraft, setJobFieldsDraft] = useState({
    priority: "",
    job_type: "",
    job_status: "",
  });
  const [selectedServiceProviderId, setSelectedServiceProviderId] = useState(
    String(
      getJobPrimaryServiceProviderDetails(activeJobData)?.id ||
        activeJobData?.primary_service_provider_id ||
        activeJobData?.Primary_Service_Provider_ID ||
        ""
    ).trim()
  );
  const [mountedTabs, setMountedTabs] = useState(() => {
    const initialTab = String(activeTab || "overview").trim() || "overview";
    return new Set([initialTab]);
  });

  useEffect(() => {
    const nextTab = String(activeTab || "overview").trim() || "overview";
    setMountedTabs((previous) => {
      if (previous.has(nextTab)) return previous;
      const next = new Set(previous);
      next.add(nextTab);
      return next;
    });
  }, [activeTab]);

  useEffect(() => {
    const resolvedType =
      resolveContactTypeFromJob(activeJobData) === "entity" ? "Company" : "Contact";
    const nextSelection = {
      accountType: resolvedType,
      clientId: getJobIndividualSelection(activeJobData).id,
      companyId: getJobEntitySelection(activeJobData).id,
    };
    setSelection((previous) => {
      if (
        previous.accountType === nextSelection.accountType &&
        previous.clientId === nextSelection.clientId &&
        previous.companyId === nextSelection.companyId
      ) {
        return previous;
      }
      return nextSelection;
    });
  }, [activeJobData]);

  useEffect(() => {
    setLinkedInquiryRecordId(normalizeInquiryId(getJobRelatedInquiry(activeJobData)?.id));
  }, [activeJobData]);

  useEffect(() => {
    setJobFieldsDraft({
      priority:
        resolveOptionDefault(
          PRIORITY_OPTIONS,
          getFirstFilledValue(activeJobData, ["priority", "Priority"]) || "123"
        ) || "123",
      job_type:
        resolveOptionDefault(
          JOB_TYPE_OPTIONS,
          getFirstFilledValue(activeJobData, ["job_type", "Job_Type"])
        ) || "",
      job_status:
        resolveOptionDefault(
          JOB_STATUS_OPTIONS,
          getFirstFilledValue(activeJobData, ["job_status", "Job_Status", "status", "Status"])
        ) || "",
    });
  }, [activeJobData]);

  useEffect(() => {
    setSelectedServiceProviderId(
      String(
        getJobPrimaryServiceProviderDetails(activeJobData)?.id ||
          activeJobData?.primary_service_provider_id ||
          activeJobData?.Primary_Service_Provider_ID ||
          ""
      ).trim()
    );
  }, [activeJobData]);

  const selectedAccountId =
    selection.accountType === "Company" ? selection.companyId : selection.clientId;
  const activeJobId = normalizePropertyId(activeJobData?.id || activeJobData?.ID);
  const {
    activeRelatedProperty,
    effectivePropertyId,
    isPropertiesLoading,
    linkedProperties,
    propertyLoadError,
    propertySearchItems,
    propertySearchQuery,
    selectedPropertyId,
    setLinkedPropertiesWithCache,
    setPropertySearchQuery,
    setSelectedPropertyId,
  } = useLinkedPropertiesData({
    plugin,
    activeJobData,
    lookupProperties,
    addProperty,
    accountType: selection.accountType,
    selectedAccountId,
  });

  const selectedPropertyLabel = useMemo(() => {
    const selected = (propertySearchItems || []).find(
      (item) => normalizePropertyId(item?.id) === normalizePropertyId(effectivePropertyId)
    );
    return String(selected?.label || "").trim();
  }, [effectivePropertyId, propertySearchItems]);
  const selectedPropertyMeta = useMemo(() => {
    const selected = (propertySearchItems || []).find(
      (item) => normalizePropertyId(item?.id) === normalizePropertyId(effectivePropertyId)
    );
    return toText(selected?.meta);
  }, [effectivePropertyId, propertySearchItems]);

  const selectedIndividual = useMemo(
    () => getJobIndividualSelection(activeJobData),
    [activeJobData]
  );
  const selectedEntity = useMemo(
    () => getJobEntitySelection(activeJobData),
    [activeJobData]
  );
  const selectedProvider = useMemo(
    () => getJobPrimaryServiceProviderDetails(activeJobData),
    [activeJobData]
  );
  const linkedInquiry = useMemo(
    () => getJobRelatedInquiry(activeJobData) || null,
    [activeJobData]
  );
  const appointmentPrefillContext = useMemo(() => {
    const isCompanyAccount = selection.accountType === "Company";
    const inquiryUid = toText(linkedInquiry?.unique_id);
    const jobUid = toText(activeJobData?.unique_id || activeJobData?.Unique_ID);
    const jobTypeLabel = toText(
      JOB_TYPE_OPTIONS.find((option) => toText(option?.value) === toText(jobFieldsDraft.job_type))
        ?.label || jobFieldsDraft.job_type
    );
    const serviceLabel = toText(linkedInquiry?.deal_name || jobTypeLabel);
    const title = [inquiryUid || jobUid, serviceLabel].filter(Boolean).join(" | ");
    const propertyDetails = formatPropertyPrefillDetails({
      propertyLabel: selectedPropertyLabel,
      propertyMeta: selectedPropertyMeta,
      activeProperty: activeRelatedProperty,
    });
    const description = [
      serviceLabel ? `Service:\n${serviceLabel}` : "",
      propertyDetails ? `Property:\n${propertyDetails}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    const contactGuestId = String(selection.clientId || selectedIndividual.id || "").trim();
    const companyPrimaryId = String(selectedEntity.primaryId || "").trim();
    const companyPrimaryLabel = buildLookupDisplayLabel(
      selectedEntity.name,
      selectedEntity.primaryEmail,
      selectedEntity.primaryMobile,
      companyPrimaryId ? `Contact #${companyPrimaryId}` : ""
    );

    return {
      accountType: isCompanyAccount ? "Company" : "Contact",
      locationId: String(effectivePropertyId || "").trim(),
      locationLabel: selectedPropertyLabel,
      hostId: String(selectedServiceProviderId || "").trim(),
      hostLabel:
        String(selectedProvider?.label || "").trim() ||
        String(selectedProvider?.id || "").trim(),
      guestId: isCompanyAccount ? companyPrimaryId || contactGuestId : contactGuestId,
      guestLabel: isCompanyAccount
        ? companyPrimaryLabel || selectedIndividual.label
        : selectedIndividual.label,
      title,
      description,
    };
  }, [
    activeJobData?.Unique_ID,
    activeJobData?.unique_id,
    activeRelatedProperty,
    effectivePropertyId,
    jobFieldsDraft.job_type,
    linkedInquiry?.deal_name,
    linkedInquiry?.unique_id,
    selectedEntity.name,
    selectedEntity.primaryEmail,
    selectedEntity.primaryId,
    selectedEntity.primaryMobile,
    selectedIndividual.id,
    selectedIndividual.label,
    selectedPropertyLabel,
    selectedPropertyMeta,
    selectedProvider?.id,
    selectedProvider?.label,
    selectedServiceProviderId,
    selection.accountType,
    selection.clientId,
  ]);

  useEffect(() => {
    if (typeof onOverviewDraftChange !== "function") return;
    onOverviewDraftChange({
      account_type: selection.accountType === "Company" ? "Company" : "Contact",
      client_id: selection.clientId || "",
      company_id: selection.companyId || "",
      priority: jobFieldsDraft.priority || "",
      job_type: jobFieldsDraft.job_type || "",
      job_status: jobFieldsDraft.job_status || "",
      inquiry_record_id: linkedInquiryRecordId || "",
      property_id: effectivePropertyId || "",
      primary_service_provider_id: selectedServiceProviderId || "",
    });
  }, [
    effectivePropertyId,
    linkedInquiryRecordId,
    onOverviewDraftChange,
    jobFieldsDraft.job_status,
    jobFieldsDraft.job_type,
    jobFieldsDraft.priority,
    selectedServiceProviderId,
    selection.accountType,
    selection.clientId,
    selection.companyId,
  ]);

  const { handleAddProperty, handleEditRelatedProperty } = usePropertyActions({
    plugin,
    activeJobId,
    linkedInquiryRecordId,
    activeRelatedProperty,
    lookupProperties,
    linkedProperties,
    addProperty,
    setSelectedPropertyId,
    setLinkedPropertiesWithCache,
    setPropertySearchQuery,
    onOpenAddPropertyModal,
  });

  return {
    activeJobData,
    activeJobId,
    activeRelatedProperty,
    appointmentCount,
    appointmentDraft,
    appointmentPrefillContext,
    effectivePropertyId,
    handleAddProperty,
    handleEditRelatedProperty,
    isPropertiesLoading,
    linkedInquiryRecordId,
    linkedProperties,
    mountedTabs,
    onSaveJob,
    onSubmitServiceProvider,
    preloadedLookupData,
    propertyLoadError,
    propertySearchItems,
    propertySearchQuery,
    searchProperties,
    selectedAccountId,
    selectedPropertyId,
    selection,
    selectedServiceProviderId,
    setAppointmentCount,
    setAppointmentDraft,
    setJobFieldsDraft,
    setLinkedInquiryRecordId,
    setPropertySearchQuery,
    setSelectedPropertyId,
    setSelection,
    setSelectedServiceProviderId,
  };
}
