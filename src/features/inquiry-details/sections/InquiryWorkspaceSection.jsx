import {
  AppointmentTabSection,
  PropertyTabSection,
  RelatedRecordsSection,
  UploadsSection,
} from "@modules/details-workspace/exports/components.js";
import { SectionLoadingState } from "@shared/components/ui/SectionLoadingState.jsx";
import {
  ContactLogsPanel,
  JobMemosPreviewPanel,
  JobNotesPanel,
} from "@modules/details-workspace/exports/components.js";

function WorkspaceTabPanel({ isMounted = false, isActive = false, children }) {
  if (!isMounted) return null;
  return (
    <div className={isActive ? "block" : "hidden"} aria-hidden={!isActive}>
      {children}
    </div>
  );
}

export function InquiryWorkspaceSection({
  activeWorkspaceTab = "related-records",
  mountedWorkspaceTabs = {},
  visibleWorkspaceTabs = [],
  onChangeWorkspaceTab,
  isInitialLoadInProgress = false,
  relatedData = {},
  properties = {},
  uploads = {},
  appointments = {},
}) {
  const linkedJobData = {
    id: uploads.linkedJobId || appointments.linkedJobId || "",
    ID: uploads.linkedJobId || appointments.linkedJobId || "",
  };

  return (
    <section className="inquiry-details-workspace mt-1.5 overflow-hidden rounded-md border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-slate-200 bg-slate-50/70 px-1.5 py-1">
        {visibleWorkspaceTabs.map((tab) => {
          const isActive = activeWorkspaceTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className={`rounded-md border px-2 py-[3px] text-[11px] font-semibold leading-4 transition ${
                isActive
                  ? "border-[#003882] bg-[#003882] text-white shadow-sm"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
              }`}
              onClick={() => onChangeWorkspaceTab?.(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-1.5">
        {isInitialLoadInProgress ? (
          <SectionLoadingState
            label="Loading workspace"
            blocks={6}
            columnsClass="md:grid-cols-2"
          />
        ) : (
          <>
            <WorkspaceTabPanel
              isMounted={Boolean(mountedWorkspaceTabs["related-records"])}
              isActive={activeWorkspaceTab === "related-records"}
            >
              <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
                <RelatedRecordsSection
                  deals={relatedData.deals}
                  jobs={relatedData.jobs}
                  stackPrimaryColumns
                  extraPanels={[
                    <div className="flex h-full min-h-[420px] min-w-0 flex-col gap-2">
                      <JobMemosPreviewPanel
                        title="Latest Memo"
                        unavailableMessage="Memos are available when the inquiry is linked."
                        hasMemoContext={relatedData.hasMemoContext}
                        isLoading={relatedData.isMemosLoading}
                        errorMessage={relatedData.memosError}
                        memos={relatedData.memos}
                        resolveMemoAuthor={relatedData.resolveMemoAuthor}
                        onOpen={relatedData.onOpenMemoPreview}
                        panelClassName="min-h-[148px]"
                      />
                      <JobNotesPanel
                        plugin={relatedData.plugin}
                        jobId={relatedData.linkedJobId}
                        inquiryId={relatedData.inquiryId}
                        contextType="inquiry"
                        panelClassName="min-h-0 flex-1"
                        listMaxHeightClass="min-h-0 flex-1"
                      />
                    </div>,
                  ]}
                  isLoading={relatedData.isLoading}
                  error={relatedData.error}
                  hasAccount={relatedData.hasAccount}
                  noAccountMessage="Link a contact/company on this inquiry to load related records."
                  linkedJobId={relatedData.selectedRelatedJobId}
                  jobIdByUid={relatedData.jobIdByUid}
                  onToggleJobLink={relatedData.onToggleJobLink}
                  isLinkingJob={relatedData.isLinkingJob}
                  onNavigateToDeal={relatedData.onNavigateToDeal}
                  onNavigateToJob={relatedData.onNavigateToJob}
                />

                <ContactLogsPanel
                  title="Contact Logs"
                  unavailableMessage="Contact logs are available when the inquiry has a linked contact context."
                  hasContactContext={relatedData.hasContactLogsContext}
                  isLoading={relatedData.isContactLogsLoading}
                  errorMessage={relatedData.contactLogsError}
                  logs={relatedData.contactLogs}
                  panelClassName="h-full"
                />
              </div>
            </WorkspaceTabPanel>

            <WorkspaceTabPanel
              isMounted={Boolean(mountedWorkspaceTabs.properties)}
              isActive={activeWorkspaceTab === "properties"}
            >
              <PropertyTabSection
                plugin={properties.plugin}
                preloadedLookupData={properties.workspaceLookupData}
                quoteJobId={properties.linkedJobId}
                inquiryId={properties.inquiryId}
                currentPropertyId={properties.currentPropertyId}
                onOpenContactDetailsModal={properties.onOpenContactDetailsModal}
                accountType={properties.accountType}
                selectedAccountId={properties.selectedAccountId}
                propertySearchValue={properties.propertySearchValue}
                propertySearchItems={properties.propertySearchItems}
                onPropertySearchValueChange={properties.onPropertySearchValueChange}
                onPropertySearchQueryChange={properties.onPropertySearchQueryChange}
                onSelectPropertyFromSearch={properties.onSelectPropertyFromSearch}
                onAddProperty={properties.onAddProperty}
                activeRelatedProperty={properties.activeRelatedProperty}
                linkedProperties={properties.linkedProperties}
                isLoading={properties.isLoading}
                loadError={properties.loadError}
                selectedPropertyId={properties.selectedPropertyId}
                onSelectProperty={properties.onSelectProperty}
                onEditRelatedProperty={properties.onEditRelatedProperty}
                sameAsContactLabel={properties.sameAsContactLabel}
                isSameAsContactChecked={properties.isSameAsContactChecked}
                isSameAsContactDisabled={properties.isSameAsContactDisabled}
                onSameAsContactChange={properties.onSameAsContactChange}
                showPropertyUploadsSection={false}
                propertyDetailsVariant="cards"
              />
            </WorkspaceTabPanel>

            <WorkspaceTabPanel
              isMounted={Boolean(mountedWorkspaceTabs.uploads)}
              isActive={activeWorkspaceTab === "uploads"}
            >
              {uploads.inquiryId ? (
                <UploadsSection
                  plugin={uploads.plugin}
                  jobData={linkedJobData}
                  uploadsMode="inquiry"
                  inquiryId={uploads.inquiryId}
                  inquiryUid={uploads.inquiryUid}
                  linkedJobId={uploads.linkedJobId}
                  additionalCreatePayload={{
                    inquiry_id: uploads.inquiryId,
                    Inquiry_ID: uploads.inquiryId,
                    inquiry_record_id: uploads.inquiryId,
                    Inquiry_Record_ID: uploads.inquiryId,
                    job_id: uploads.linkedJobId || null,
                    Job_ID: uploads.linkedJobId || null,
                    ...(uploads.propertyId ? { property_name_id: uploads.propertyId } : {}),
                  }}
                  layoutMode="table"
                  existingUploadsView="tiles"
                  onRequestAddUpload={uploads.onRequestAddUpload}
                  enableFormUploads
                />
              ) : (
                <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  Inquiry record ID is required to load uploads.
                </div>
              )}
            </WorkspaceTabPanel>

            <WorkspaceTabPanel
              isMounted={Boolean(mountedWorkspaceTabs.appointments)}
              isActive={activeWorkspaceTab === "appointments"}
            >
              <AppointmentTabSection
                plugin={appointments.plugin}
                jobData={linkedJobData}
                preloadedLookupData={appointments.workspaceLookupData}
                inquiryRecordId={appointments.inquiryId}
                inquiryUid={appointments.inquiryUid}
                prefillContext={appointments.prefillContext}
                layoutMode="table"
                eventRowTintOpacity={0.4}
                onRequestCreate={appointments.onRequestCreate}
                onRequestEdit={appointments.onRequestEdit}
              />
            </WorkspaceTabPanel>
          </>
        )}
      </div>
    </section>
  );
}
