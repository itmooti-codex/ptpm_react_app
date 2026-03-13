import {
  AddActivitiesSection,
  AddMaterialsSection,
  AppointmentTabSection,
  InvoiceSection,
  PropertyTabSection,
  RelatedRecordsSection,
  SearchDropdownInput,
  UploadsSection,
} from "@modules/details-workspace/exports/components.js";
import { JobDirectStoreProvider } from "@modules/details-workspace/exports/hooks.js";
import { toText } from "@shared/utils/formatters.js";
import {
  ContactLogsPanel,
  JobMemosPreviewPanel,
  JobNotesPanel,
} from "@modules/details-workspace/exports/components.js";
import { WorkspaceTabPanel } from "./JobWorkspaceTabPanel.jsx";
import { JobWorkspaceModals } from "./JobWorkspaceModals.jsx";
import { JOB_WORKSPACE_TABS } from "../shared/jobDetailsConstants.js";

export function JobDetailsWorkspaceSection({
  accountsContactItems,
  accountsContactSearchValue,
  activeWorkspaceProperty,
  activeWorkspaceTab,
  activityModalMode,
  appointmentModalMode,
  appointmentPrefillContext,
  canAcceptQuote,
  canSendQuote,
  closeAffiliationModal,
  closeUploadsModal,
  contactLogs,
  contactLogsContactId,
  contactLogsError,
  editingActivityId,
  editingAppointmentId,
  editingMaterialId,
  effectiveJobId,
  handleAcceptQuote,
  handleActivitySaved,
  handleAddAccountsContact,
  handleAddJobEmailContact,
  handleCloseActivityModal,
  handleCloseAppointmentModal,
  handleCloseMaterialModal,
  handleOpenCreateActivityModal,
  handleOpenCreateAppointmentModal,
  handleOpenCreateMaterialModal,
  handleOpenEditActivityModal,
  handleOpenEditAppointmentModal,
  handleOpenEditMaterialModal,
  handleOpenUploadsModal,
  handleSelectWorkspacePropertyFromSearch,
  handleSelectWorkspacePropertyId,
  handleSendQuote,
  handleToggleRelatedInquiryLink,
  hasMemoContext,
  invoiceActiveTab,
  invoiceActiveTabVersion,
  isActivityModalOpen,
  affiliationsError,
  isAffiliationsLoading,
  isAppointmentModalOpen,
  isCompanyAccount,
  isCompanyLookupLoading,
  isContactLookupLoading,
  isContactLogsLoading,
  isLinkedPropertiesLoading,
  isMaterialModalOpen,
  isMemosLoading,
  isQuoteWorkflowUpdating,
  isSavingLinkedInquiry,
  isUploadsModalOpen,
  isWorkspaceSectionsLoading,
  jobActivities,
  jobData,
  jobEmailContactSearchValue,
  jobEmailItems,
  jobMaterials,
  linkedPropertiesError,
  linkedWorkspaceProperties,
  loadedPropertyId,
  lookupData,
  materialModalMode,
  memos,
  memosError,
  mountedWorkspaceTabs,
  onAccountsContactSearchValueChange,
  onActiveWorkspaceTabChange,
  onJobEmailContactSearchValueChange,
  onWorkspacePropertySearchValueChange,
  onNavigateToDeal,
  onNavigateToJob,
  onOpenContactDetailsModal,
  onOpenMemoReply,
  plugin,
  propertyAffiliationModalState,
  quoteHeaderData,
  relatedDealsForDisplay,
  relatedInquiryId,
  relatedInquiryUid,
  relatedJobsForDisplay,
  relatedRecords,
  relatedRecordsAccountId,
  relatedRecordsAccountType,
  resolveMemoAuthor,
  safeUid,
  saveAffiliation,
  searchCompaniesInDatabase,
  searchContactsInDatabase,
  searchWorkspacePropertiesInDatabase,
  selectedAccountsContactId,
  selectedWorkspacePropertyId,
  setSelectedAccountsContactId,
  setSelectedJobEmailContactId,
  uploadsPropertyId,
  workspacePropertyLookupError,
  workspacePropertySearchItems,
  workspacePropertySearchValue,
  workspaceSectionsError,
  onAffiliationSaved,
  onEditRelatedProperty,
  onAddProperty,
}) {
  return (
    <div className="mt-2 space-y-2">
      <section className="rounded border border-slate-200 bg-white px-2.5 py-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {JOB_WORKSPACE_TABS.map((tab) => {
            const isActive = activeWorkspaceTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`rounded px-2.5 py-1.5 text-xs font-semibold ${
                  isActive
                    ? "bg-[#003882] text-white"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
                }`}
                onClick={() => onActiveWorkspaceTabChange(tab.id)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      <JobDirectStoreProvider jobUid={safeUid || null} jobData={jobData} lookupData={lookupData}>
        <section className="rounded border border-slate-200 bg-white p-2">
          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs["related-data"])}
            isActive={activeWorkspaceTab === "related-data"}
          >
            <div className="grid grid-cols-1 gap-2 xl:grid-cols-2">
              <RelatedRecordsSection
                deals={relatedDealsForDisplay}
                jobs={relatedJobsForDisplay}
                stackPrimaryColumns
                extraPanels={[
                  <div key="notes-memos" className="flex h-full min-h-[420px] min-w-0 flex-col gap-2">
                    <JobMemosPreviewPanel
                      hasMemoContext={hasMemoContext}
                      isLoading={isMemosLoading}
                      errorMessage={memosError}
                      memos={memos}
                      resolveMemoAuthor={resolveMemoAuthor}
                      onOpen={onOpenMemoReply}
                      panelClassName="min-h-[148px]"
                    />
                    <JobNotesPanel
                      plugin={plugin}
                      jobId={effectiveJobId}
                      inquiryId={relatedInquiryId}
                      contextType="job"
                      panelClassName="min-h-0 flex-1"
                      listMaxHeightClass="min-h-0 flex-1"
                    />
                  </div>,
                ]}
                isLoading={relatedRecords?.isLoading}
                error={relatedRecords?.error}
                hasAccount={Boolean(relatedRecordsAccountId)}
                noAccountMessage="Link a contact/company on this job to load related records."
                linkedDealId={relatedInquiryId}
                onToggleDealLink={handleToggleRelatedInquiryLink}
                isLinkingDeal={isSavingLinkedInquiry}
                currentJobId={effectiveJobId}
                onNavigateToDeal={onNavigateToDeal}
                onNavigateToJob={onNavigateToJob}
              />

              <ContactLogsPanel
                hasContactContext={Boolean(contactLogsContactId)}
                isLoading={isContactLogsLoading}
                errorMessage={contactLogsError}
                logs={contactLogs}
                panelClassName="h-full"
              />
            </div>
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs.properties)}
            isActive={activeWorkspaceTab === "properties"}
          >
            <PropertyTabSection
              plugin={plugin}
              preloadedLookupData={lookupData}
              quoteJobId={effectiveJobId}
              inquiryId={relatedInquiryId}
              currentPropertyId={toText(selectedWorkspacePropertyId || loadedPropertyId)}
              onOpenContactDetailsModal={onOpenContactDetailsModal}
              accountType={relatedRecordsAccountType}
              selectedAccountId={relatedRecordsAccountId}
              propertySearchValue={workspacePropertySearchValue}
              propertySearchItems={workspacePropertySearchItems}
              onPropertySearchValueChange={onWorkspacePropertySearchValueChange}
              onPropertySearchQueryChange={searchWorkspacePropertiesInDatabase}
              onSelectPropertyFromSearch={handleSelectWorkspacePropertyFromSearch}
              onAddProperty={onAddProperty}
              activeRelatedProperty={activeWorkspaceProperty}
              linkedProperties={linkedWorkspaceProperties}
              isLoading={isLinkedPropertiesLoading}
              loadError={linkedPropertiesError || workspacePropertyLookupError}
              selectedPropertyId={toText(selectedWorkspacePropertyId)}
              onSelectProperty={handleSelectWorkspacePropertyId}
              onEditRelatedProperty={onEditRelatedProperty}
              sameAsContactLabel=""
              isSameAsContactChecked={false}
              isSameAsContactDisabled
              onSameAsContactChange={null}
              showPropertyUploadsSection={false}
              propertyDetailsVariant="cards"
              onAffiliationSaved={onAffiliationSaved}
            />
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs.uploads)}
            isActive={activeWorkspaceTab === "uploads"}
          >
            <UploadsSection
              plugin={plugin}
              uploadsMode={effectiveJobId ? "job" : "inquiry"}
              jobData={{ id: effectiveJobId, ID: effectiveJobId }}
              inquiryId={relatedInquiryId}
              inquiryUid={relatedInquiryUid}
              linkedJobId={effectiveJobId}
              additionalCreatePayload={{
                ...(relatedInquiryId ? { inquiry_id: relatedInquiryId, Inquiry_ID: relatedInquiryId } : {}),
                ...(effectiveJobId ? { job_id: effectiveJobId, Job_ID: effectiveJobId } : {}),
                ...(uploadsPropertyId ? { property_name_id: uploadsPropertyId } : {}),
              }}
              layoutMode="table"
              existingUploadsView="tiles"
              onRequestAddUpload={handleOpenUploadsModal}
              enableFormUploads
            />
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs.appointments)}
            isActive={activeWorkspaceTab === "appointments"}
          >
            <AppointmentTabSection
              plugin={plugin}
              jobData={jobData}
              preloadedLookupData={lookupData}
              inquiryRecordId={relatedInquiryId}
              inquiryUid={relatedInquiryUid}
              prefillContext={appointmentPrefillContext}
              layoutMode="table"
              onRequestCreate={handleOpenCreateAppointmentModal}
              onRequestEdit={handleOpenEditAppointmentModal}
            />
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs.activities)}
            isActive={activeWorkspaceTab === "activities"}
          >
            {isWorkspaceSectionsLoading && !jobActivities.length ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Loading activities...
              </div>
            ) : workspaceSectionsError && !jobActivities.length ? (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                {workspaceSectionsError}
              </div>
            ) : (
              <AddActivitiesSection
                plugin={plugin}
                jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                layoutMode="table"
                onRequestCreate={handleOpenCreateActivityModal}
                onRequestEdit={handleOpenEditActivityModal}
              />
            )}
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs.materials)}
            isActive={activeWorkspaceTab === "materials"}
          >
            {isWorkspaceSectionsLoading && !jobMaterials.length ? (
              <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Loading materials...
              </div>
            ) : workspaceSectionsError && !jobMaterials.length ? (
              <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
                {workspaceSectionsError}
              </div>
            ) : (
              <AddMaterialsSection
                plugin={plugin}
                jobData={{ id: effectiveJobId, ID: effectiveJobId }}
                preloadedLookupData={lookupData}
                layoutMode="table"
                onRequestCreate={handleOpenCreateMaterialModal}
                onRequestEdit={handleOpenEditMaterialModal}
              />
            )}
          </WorkspaceTabPanel>

          <WorkspaceTabPanel
            isMounted={Boolean(mountedWorkspaceTabs["invoice-payment"])}
            isActive={activeWorkspaceTab === "invoice-payment"}
          >
            <InvoiceSection
              plugin={plugin}
              jobData={jobData}
              jobUid={safeUid}
              quoteHeaderData={quoteHeaderData}
              onAcceptQuote={handleAcceptQuote}
              isAcceptingQuote={isQuoteWorkflowUpdating}
              canAcceptQuote={canAcceptQuote}
              canSendQuote={canSendQuote}
              onSendQuote={handleSendQuote}
              isSendingQuote={isQuoteWorkflowUpdating}
              hasAccountsContact={Boolean(toText(selectedAccountsContactId))}
              quoteContactSelectorSlot={
                <div className="grid grid-cols-2 gap-3">
                  <SearchDropdownInput
                    label={isCompanyAccount ? "Job Email Company" : "Job Email Contact"}
                    field="job_email_contact_search"
                    value={jobEmailContactSearchValue}
                    placeholder={isCompanyAccount ? "Search company" : "Search contact"}
                    items={jobEmailItems}
                    onValueChange={onJobEmailContactSearchValueChange}
                    onSearchQueryChange={
                      isCompanyAccount ? searchCompaniesInDatabase : searchContactsInDatabase
                    }
                    onSelect={(item) => {
                      const nextId = toText(item?.id);
                      setSelectedJobEmailContactId(nextId);
                      onJobEmailContactSearchValueChange(toText(item?.label));
                    }}
                    onAdd={handleAddJobEmailContact}
                    addButtonLabel={isCompanyAccount ? "Add New Company" : "Add New Contact"}
                    emptyText={
                      isCompanyAccount
                        ? isCompanyLookupLoading
                          ? "Loading companies..."
                          : "No companies found."
                        : isContactLookupLoading
                          ? "Loading contacts..."
                          : "No contacts found."
                    }
                  />
                  <SearchDropdownInput
                    label="Accounts Contact"
                    field="accounts_contact_search"
                    value={accountsContactSearchValue}
                    placeholder="Search property contact"
                    items={accountsContactItems}
                    onValueChange={onAccountsContactSearchValueChange}
                    onSearchQueryChange={null}
                    onSelect={(item) => {
                      const nextId = toText(item?.id);
                      setSelectedAccountsContactId(nextId);
                      onAccountsContactSearchValueChange(toText(item?.label));
                    }}
                    onAdd={handleAddAccountsContact}
                    addButtonLabel="Add Property Contact"
                    emptyText={
                      isAffiliationsLoading
                        ? "Loading property contacts..."
                        : affiliationsError
                          ? affiliationsError
                          : "No property contacts found."
                    }
                  />
                </div>
              }
              activeTab={invoiceActiveTab}
              activeTabVersion={invoiceActiveTabVersion}
            />
          </WorkspaceTabPanel>
        </section>

        <JobWorkspaceModals
          affiliationModalState={propertyAffiliationModalState}
          appointmentModalMode={appointmentModalMode}
          appointmentPrefillContext={appointmentPrefillContext}
          closeAffiliationModal={closeAffiliationModal}
          closeUploadsModal={closeUploadsModal}
          editingActivityId={editingActivityId}
          editingAppointmentId={editingAppointmentId}
          editingMaterialId={editingMaterialId}
          effectiveJobId={effectiveJobId}
          handleActivitySaved={handleActivitySaved}
          handleCloseActivityModal={handleCloseActivityModal}
          handleCloseAppointmentModal={handleCloseAppointmentModal}
          handleCloseMaterialModal={handleCloseMaterialModal}
          isActivityModalOpen={isActivityModalOpen}
          isAppointmentModalOpen={isAppointmentModalOpen}
          isMaterialModalOpen={isMaterialModalOpen}
          isUploadsModalOpen={isUploadsModalOpen}
          jobData={jobData}
          loadedPropertyId={loadedPropertyId}
          lookupData={lookupData}
          materialModalMode={materialModalMode}
          openContactDetailsModal={onOpenContactDetailsModal}
          plugin={plugin}
          relatedInquiryId={relatedInquiryId}
          relatedInquiryUid={relatedInquiryUid}
          saveAffiliation={saveAffiliation}
          selectedWorkspacePropertyId={selectedWorkspacePropertyId}
          uploadsPropertyId={uploadsPropertyId}
          activityModalMode={activityModalMode}
        />
      </JobDirectStoreProvider>
    </div>
  );
}
