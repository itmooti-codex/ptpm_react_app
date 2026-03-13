import { AppointmentTabSection } from "./job-information/AppointmentTabSection.jsx";
import { JobInfoTabsNav } from "./job-information/JobInfoTabsNav.jsx";
import { OverviewTabSection } from "./job-information/OverviewTabSection.jsx";
import { PropertyTabSection } from "./job-information/PropertyTabSection.jsx";
import { ServiceProviderTabSection } from "./job-information/ServiceProviderTabSection.jsx";
import { normalizeInquiryId, normalizePropertyId } from "./job-information/jobInfoUtils.js";
import { useJobInformationState } from "./job-information/useJobInformationState.js";

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
  const {
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
    propertyLoadError,
    propertySearchItems,
    propertySearchQuery,
    searchProperties,
    selectedAccountId,
    selectedPropertyId,
    selection,
    setAppointmentCount,
    setAppointmentDraft,
    setJobFieldsDraft,
    setLinkedInquiryRecordId,
    setPropertySearchQuery,
    setSelectedPropertyId,
    setSelection,
    setSelectedServiceProviderId,
  } = useJobInformationState({
    activeTab,
    jobData,
    plugin,
    preloadedLookupData,
    onSaveJob,
    onSubmitServiceProvider,
    onOpenAddPropertyModal,
    onOverviewDraftChange,
  });

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
        onPropertySearchQueryChange={searchProperties}
        onSelectPropertyFromSearch={(item) => {
          const nextId = normalizePropertyId(item?.id);
          if (!nextId) return;
          setSelectedPropertyId(nextId);
          setPropertySearchQuery(item?.label || "");
        }}
        onAddProperty={handleAddProperty}
        onEditRelatedProperty={handleEditRelatedProperty}
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
        draft={appointmentDraft}
        onDraftChange={setAppointmentDraft}
        onResetDraft={() => setAppointmentDraft(null)}
        prefillContext={appointmentPrefillContext}
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
