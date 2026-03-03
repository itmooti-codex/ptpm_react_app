import { useCallback, useEffect, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import {
  ANNOUNCEMENT_EVENT_KEYS,
} from "../../../../shared/announcements/announcementTypes.js";
import { emitAnnouncement } from "../../../../shared/announcements/announcementEmitter.js";
import {
  JOB_STATUS_OPTIONS,
  JOB_TYPE_OPTIONS,
  PRIORITY_OPTIONS,
} from "../../constants/options.js";
import { usePropertyLookupData } from "../../hooks/usePropertyLookupData.js";
import {
  useJobDirectSelector,
} from "../../hooks/useJobDirectStore.jsx";
import {
  selectJobEntity,
} from "../../state/selectors.js";
import {
  createPropertyRecord,
  updatePropertyRecord,
} from "../../sdk/jobDirectSdk.js";
import { AppointmentTabSection } from "./job-information/AppointmentTabSection.jsx";
import { JobInfoTabsNav } from "./job-information/JobInfoTabsNav.jsx";
import { OverviewTabSection } from "./job-information/OverviewTabSection.jsx";
import { PropertyTabSection } from "./job-information/PropertyTabSection.jsx";
import { ServiceProviderTabSection } from "./job-information/ServiceProviderTabSection.jsx";
import { useLinkedPropertiesData } from "./job-information/useLinkedPropertiesData.js";
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
} from "./job-information/jobInfoUtils.js";

export function JobInformationSection({
  activeTab,
  onTabChange,
  jobData,
  plugin,
  preloadedLookupData,
  onSaveJob,
  onSubmitServiceProvider,
  onOpenContactDetailsModal,
  onOpenAddPropertyModal,
  onOverviewDraftChange,
}) {
  const { success } = useToast();
  const storeJobData = useJobDirectSelector(selectJobEntity);
  const activeJobData = storeJobData || jobData || null;
  const {
    properties: lookupProperties,
    addProperty,
  } = usePropertyLookupData(plugin, {
    initialProperties: preloadedLookupData?.properties || [],
    skipInitialFetch: true,
  });
  const [selection, setSelection] = useState({
    accountType: "Contact",
    clientId: "",
    companyId: "",
  });
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
  const savePropertyRecord = useCallback(
    async ({ draftProperty, initialPropertyId = "" } = {}) => {
      if (!plugin) {
        throw new Error("SDK is still initializing. Please try again.");
      }

      const resolvedId = normalizePropertyId(draftProperty?.id || initialPropertyId);
      const isPersisted = /^\d+$/.test(String(resolvedId || "").trim());

      if (isPersisted) {
        return updatePropertyRecord({
          plugin,
          id: resolvedId,
          payload: draftProperty,
        });
      }

      return createPropertyRecord({
        plugin,
        payload: draftProperty,
      });
    },
    [plugin]
  );

  const tabContent = {
    overview: (
      <OverviewTabSection
        jobData={activeJobData}
        plugin={plugin}
        preloadedLookupData={preloadedLookupData}
        onOpenContactDetailsModal={onOpenContactDetailsModal}
        selection={selection}
        onSelectionChange={setSelection}
        onInquiryRecordChange={setLinkedInquiryRecordId}
        onJobFieldsChange={setJobFieldsDraft}
      />
    ),
    property: (
      <PropertyTabSection
        plugin={plugin}
        preloadedLookupData={preloadedLookupData}
        quoteJobId={activeJobId}
        inquiryId={normalizeInquiryId(linkedInquiryRecordId)}
        currentPropertyId={effectivePropertyId}
        onOpenContactDetailsModal={onOpenContactDetailsModal}
        accountType={selection.accountType}
        selectedAccountId={selectedAccountId}
        propertySearchValue={propertySearchQuery}
        propertySearchItems={propertySearchItems}
        onPropertySearchValueChange={setPropertySearchQuery}
        onSelectPropertyFromSearch={(item) => {
          const nextId = normalizePropertyId(item?.id);
          if (!nextId) return;
          setSelectedPropertyId(nextId);
          setPropertySearchQuery(item?.label || "");
        }}
        onAddProperty={() =>
          onOpenAddPropertyModal?.({
            onSave: async (draftProperty) => {
              const savedProperty = await savePropertyRecord({ draftProperty });
              const normalized = addProperty({
                ...draftProperty,
                ...savedProperty,
                id: savedProperty?.id || draftProperty?.id || "",
              });
              const nextId = normalizePropertyId(normalized.id);
              if (nextId) setSelectedPropertyId(nextId);
              setLinkedPropertiesWithCache((prev) => {
                if (!nextId) return prev;
                const exists = prev.some(
                  (item) => normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                );
                if (exists) {
                  return prev.map((item) =>
                    normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                      ? { ...item, ...normalized }
                      : item
                  );
                }
                return [normalized, ...prev];
              });
              setPropertySearchQuery(
                normalized.property_name || normalized.unique_id || normalized.id || ""
              );
              await emitAnnouncement({
                plugin,
                eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_CREATED,
                quoteJobId: activeJobId,
                inquiryId: normalizeInquiryId(linkedInquiryRecordId),
                focusId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
                dedupeEntityId: nextId || normalizePropertyId(savedProperty?.id || draftProperty?.id),
                title: "Property created",
                content: "A new property was created and linked.",
                logContext: "job-direct:JobInformationSection:onAddProperty",
              });
              success("Property saved", "Property details were saved.");
            },
          })
        }
        onEditRelatedProperty={(propertyRecord) => {
          const editableId = normalizePropertyId(propertyRecord?.id || activeRelatedProperty?.id);
          const selectedFromLookup = (lookupProperties || []).find(
            (item) => normalizePropertyId(item?.id) === editableId
          );
          const selectedFromLinked = (linkedProperties || []).find(
            (item) => normalizePropertyId(item?.id) === editableId
          );
          const editableProperty = {
            ...(activeRelatedProperty || {}),
            ...(selectedFromLinked || {}),
            ...(selectedFromLookup || {}),
            ...(propertyRecord || {}),
          };

          onOpenAddPropertyModal?.({
            initialData: editableProperty,
            onSave: async (draftProperty) => {
              const savedProperty = await savePropertyRecord({
                draftProperty,
                initialPropertyId: editableProperty?.id,
              });
              const normalized = addProperty({
                ...editableProperty,
                ...draftProperty,
                ...savedProperty,
                id: savedProperty?.id || draftProperty?.id || editableProperty?.id || "",
              });
              const nextId = normalizePropertyId(normalized.id);
              if (nextId) setSelectedPropertyId(nextId);
              setLinkedPropertiesWithCache((prev) =>
                prev.map((item) =>
                  normalizePropertyId(item?.id) === normalizePropertyId(nextId)
                    ? { ...item, ...normalized }
                    : item
                )
              );
              setPropertySearchQuery(
                normalized.property_name || normalized.unique_id || normalized.id || ""
              );
              await emitAnnouncement({
                plugin,
                eventKey: ANNOUNCEMENT_EVENT_KEYS.PROPERTY_UPDATED,
                quoteJobId: activeJobId,
                inquiryId: normalizeInquiryId(linkedInquiryRecordId),
                focusId: nextId || editableId,
                dedupeEntityId: nextId || editableId,
                title: "Property updated",
                content: "Property details were updated.",
                logContext: "job-direct:JobInformationSection:onEditRelatedProperty",
              });
              success("Property updated", "Property details were updated.");
            },
          });
        }}
        activeRelatedProperty={activeRelatedProperty}
        linkedProperties={linkedProperties}
        isLoading={isPropertiesLoading}
        loadError={propertyLoadError}
        selectedPropertyId={selectedPropertyId}
        onSelectProperty={setSelectedPropertyId}
      />
    ),
    serviceman: (
      <ServiceProviderTabSection
        plugin={plugin}
        jobData={activeJobData}
        initialProviders={preloadedLookupData?.serviceProviders || []}
        onSubmitServiceProvider={onSubmitServiceProvider || onSaveJob}
        onProviderSelectionChange={setSelectedServiceProviderId}
      />
    ),
    appointments: (
      <AppointmentTabSection
        plugin={plugin}
        jobData={activeJobData}
        preloadedLookupData={preloadedLookupData}
        onCountChange={setAppointmentCount}
        inquiryRecordId={linkedInquiryRecordId}
      />
    ),
  };

  return (
    <section data-section="job-information" className="space-y-4">
      <input type="hidden" data-field="property_id" value={effectivePropertyId} readOnly />
      <JobInfoTabsNav
        activeTab={activeTab}
        onTabChange={onTabChange}
        appointmentCount={appointmentCount}
      />

      {Object.entries(tabContent)
        .filter(([tabId]) => mountedTabs.has(tabId))
        .map(([tabId, content]) => (
        <div
          key={tabId}
          className={activeTab === tabId ? "block" : "hidden"}
          aria-hidden={activeTab === tabId ? "false" : "true"}
        >
          {content}
        </div>
      ))}
    </section>
  );
}
