import {
  AccountDetailsSection,
  TrashActionIcon as TrashIcon,
} from "@modules/details-workspace/exports/components.js";
import { EMAIL_OPTIONS_DATA } from "../shared/jobDetailsWorkflow.js";
import { JobDetailsHeaderBar } from "./JobDetailsHeaderBar.jsx";
import { JobDetailsFloatingWidgets } from "./JobDetailsFloatingWidgets.jsx";
import { JobDetailsModalStack } from "./JobDetailsModalStack.jsx";
import { JobDetailsWorkspaceSection } from "./JobDetailsWorkspaceSection.jsx";
import { JobQuotePaymentDetailsCard } from "./JobQuotePaymentDetailsCard.jsx";

export function JobDetailsBodySection({
  accountEditor,
  actions,
  boolToggles,
  derivedFull,
  handlePrintJobSheet,
  isJobTakenByLookupLoading,
  isServiceProviderLookupLoading,
  memoSystem,
  navigate,
  openContactDetailsModal,
  plugin,
  quoteWorkflow,
  relatedRecords,
  relatedRecordsAccountId,
  relatedRecordsAccountType,
  route,
  s,
  searchCompaniesInDatabase,
  searchContactsInDatabase,
  spAlloc,
  wsProperty,
}) {
  return (
    <>
      <JobDetailsHeaderBar
        activeEmailGroup={s.activeEmailGroup}
        effectiveJobId={route.effectiveJobId}
        emailOptionsData={EMAIL_OPTIONS_DATA}
        externalJobUrl={route.externalJobUrl}
        handleConfirmJobTakenBy={spAlloc.handleConfirmJobTakenBy}
        handleConfirmServiceProviderAllocation={spAlloc.handleConfirmServiceProviderAllocation}
        handleCopyUid={actions.handleCopyUid}
        handleCreateCallback={actions.handleCreateCallback}
        handleDuplicateJob={actions.handleDuplicateJob}
        handleEmailJob={actions.handleEmailJob}
        handleMarkCompleteClick={boolToggles.handleMarkCompleteClick}
        handleOpenTasksModal={actions.handleOpenTasksModal}
        handlePcaDoneToggle={boolToggles.handlePcaDoneToggle}
        handlePrestartDoneToggle={boolToggles.handlePrestartDoneToggle}
        handlePrintJobSheet={handlePrintJobSheet}
        handleRecordEmailAction={actions.handleRecordEmailAction}
        hasQuoteAcceptedDateValue={quoteWorkflow.hasQuoteAcceptedDateValue}
        hasRelatedInquiry={derivedFull.hasRelatedInquiry}
        isAllocatingServiceProvider={s.isAllocatingServiceProvider}
        isCreatingCallback={s.isCreatingCallback}
        isDuplicatingJob={s.isDuplicatingJob}
        isJobTakenByLookupLoading={isJobTakenByLookupLoading}
        isMarkComplete={s.isMarkComplete}
        isNewJob={route.isNewJob}
        isPcaDone={s.isPcaDone}
        isPrestartDone={s.isPrestartDone}
        isRecordingEmailAction={s.isRecordingEmailAction}
        isSavingJobTakenBy={s.isSavingJobTakenBy}
        isSavingPcaDone={s.isSavingPcaDone}
        isSavingPrestartDone={s.isSavingPrestartDone}
        isSendingJobUpdate={s.isSendingJobUpdate}
        isServiceProviderLookupLoading={isServiceProviderLookupLoading}
        jobStatusLabel={derivedFull.jobStatusLabel}
        jobStatusStyle={derivedFull.jobStatusStyle}
        jobTakenByItems={spAlloc.jobTakenByItems}
        jobTakenBySearch={s.jobTakenBySearch}
        menuRootRef={s.menuRootRef}
        onOpenRelatedInquiry={() => {
          if (!derivedFull.relatedInquiryDetailsPath) return;
          navigate(derivedFull.relatedInquiryDetailsPath);
        }}
        onReviewInvoice={() => {
          s.setOpenMenu("");
          s.setActiveWorkspaceTab("invoice-payment");
          s.setInvoiceActiveTab("client-invoice");
          s.setInvoiceActiveTabVersion((v) => v + 1);
        }}
        onReviewQuote={() => {
          s.setOpenMenu("");
          s.setActiveWorkspaceTab("invoice-payment");
          s.setInvoiceActiveTab("quote");
          s.setInvoiceActiveTabVersion((v) => v + 1);
        }}
        openMenu={s.openMenu}
        priorityLabel={quoteWorkflow.priorityLabel}
        priorityStyle={quoteWorkflow.priorityStyle}
        quoteStatusNormalized={quoteWorkflow.quoteStatusNormalized}
        relatedInquiryId={s.relatedInquiryId}
        safeUid={route.safeUid}
        serviceProviderItems={spAlloc.serviceProviderItems}
        serviceProviderSearch={s.serviceProviderSearch}
        setActiveEmailGroup={s.setActiveEmailGroup}
        setJobTakenBySearch={s.setJobTakenBySearch}
        setOpenMenu={s.setOpenMenu}
        setSelectedJobTakenById={s.setSelectedJobTakenById}
        setSelectedServiceProviderId={s.setSelectedServiceProviderId}
        setServiceProviderSearch={s.setServiceProviderSearch}
        toggleMenu={actions.toggleMenu}
      />

      <section className="w-full px-2 py-2" data-page="job-details">
        <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
          <AccountDetailsSection
            isLoading={s.isAccountDetailsLoading}
            editDisabled={!route.effectiveJobId}
            onEdit={accountEditor.handleOpenAccountEditor}
            onCopy={actions.handleCopyFieldValue}
            safeUid={route.safeUid}
            accountType={derivedFull.accountType}
            showContactDetails={derivedFull.showContactDetails}
            hasAccountContactFields={derivedFull.hasAccountContactFields}
            accountContactName={derivedFull.accountContactName}
            accountContactEmail={derivedFull.accountContactEmail}
            accountContactEmailHref={derivedFull.accountContactEmailHref}
            accountContactPhone={derivedFull.accountContactPhone}
            accountContactPhoneHref={derivedFull.accountContactPhoneHref}
            accountContactAddress={derivedFull.accountContactAddress}
            accountContactAddressHref={derivedFull.accountContactAddressHref}
            showCompanyDetails={derivedFull.showCompanyDetails}
            hasAccountCompanyFields={derivedFull.hasAccountCompanyFields}
            accountCompanyName={derivedFull.accountCompanyName}
            accountCompanyPhone={derivedFull.accountCompanyPhone}
            accountCompanyPhoneHref={derivedFull.accountCompanyPhoneHref}
            accountCompanyPrimaryName={derivedFull.accountCompanyPrimaryName}
            accountCompanyPrimaryEmail={derivedFull.accountCompanyPrimaryEmail}
            accountCompanyPrimaryEmailHref={derivedFull.accountCompanyPrimaryEmailHref}
            accountCompanyPrimaryPhone={derivedFull.accountCompanyPrimaryPhone}
            accountCompanyPrimaryPhoneHref={derivedFull.accountCompanyPrimaryPhoneHref}
            accountCompanyAddress={derivedFull.accountCompanyAddress}
            accountCompanyAddressHref={derivedFull.accountCompanyAddressHref}
            isBodyCorpAccount={derivedFull.isBodyCorpAccount}
            hasBodyCorpDetails={derivedFull.hasBodyCorpDetails}
            accountBodyCorpName={derivedFull.accountBodyCorpName}
            accountBodyCorpType={derivedFull.accountBodyCorpType}
            accountBodyCorpPhone={derivedFull.accountBodyCorpPhone}
            accountBodyCorpPhoneHref={derivedFull.accountBodyCorpPhoneHref}
            accountBodyCorpAddress={derivedFull.accountBodyCorpAddress}
            accountBodyCorpAddressHref={derivedFull.accountBodyCorpAddressHref}
          />

          <JobQuotePaymentDetailsCard
            effectiveJobId={route.effectiveJobId}
            hasAdminRecommendationValue={quoteWorkflow.hasAdminRecommendationValue}
            hasAnyQuotePaymentDisplayField={quoteWorkflow.hasAnyQuotePaymentDisplayField}
            hasFollowUpDateValue={quoteWorkflow.hasFollowUpDateValue}
            hasPaymentStatusValue={quoteWorkflow.hasPaymentStatusValue}
            hasPriorityValue={quoteWorkflow.hasPriorityValue}
            hasQuoteAcceptedDateValue={quoteWorkflow.hasQuoteAcceptedDateValue}
            hasQuoteDateValue={quoteWorkflow.hasQuoteDateValue}
            hasQuoteRequestedDateValue={quoteWorkflow.hasQuoteRequestedDateValue}
            hasQuoteSentDateValue={quoteWorkflow.hasQuoteSentDateValue}
            hasQuoteStatusValue={quoteWorkflow.hasQuoteStatusValue}
            hasQuoteValidUntilValue={quoteWorkflow.hasQuoteValidUntilValue}
            isNewJob={route.isNewJob}
            paymentStatusLabel={quoteWorkflow.paymentStatusLabel}
            paymentStatusStyle={quoteWorkflow.paymentStatusStyle}
            priorityLabel={quoteWorkflow.priorityLabel}
            priorityStyle={quoteWorkflow.priorityStyle}
            quotePaymentDetails={s.quotePaymentDetails}
            quoteStatusLabel={quoteWorkflow.quoteStatusLabel}
            quoteStatusStyle={quoteWorkflow.quoteStatusStyle}
          />
        </div>

        <JobDetailsWorkspaceSection
          accountsContactItems={derivedFull.accountsContactItems}
          accountsContactSearchValue={s.accountsContactSearchValue}
          activeWorkspaceProperty={wsProperty.activeWorkspaceProperty}
          activeWorkspaceTab={s.activeWorkspaceTab}
          activityModalMode={s.activityModalMode}
          appointmentModalMode={s.appointmentModalMode}
          appointmentPrefillContext={derivedFull.appointmentPrefillContext}
          canAcceptQuote={quoteWorkflow.canAcceptQuote}
          canSendQuote={quoteWorkflow.canSendQuote}
          closeAffiliationModal={actions.closeAffiliationModal}
          closeUploadsModal={actions.closeUploadsModal}
          contactLogs={s.contactLogs}
          contactLogsContactId={derivedFull.contactLogsContactId}
          contactLogsError={s.contactLogsError}
          editingActivityId={s.editingActivityId}
          editingAppointmentId={s.editingAppointmentId}
          editingMaterialId={s.editingMaterialId}
          effectiveJobId={route.effectiveJobId}
          affiliationsError={s.affiliationsError}
          handleAcceptQuote={quoteWorkflow.handleAcceptQuote}
          handleActivitySaved={actions.handleActivitySaved}
          handleAddAccountsContact={actions.handleAddAccountsContact}
          handleAddJobEmailContact={accountEditor.handleAddJobEmailContact}
          handleCloseActivityModal={actions.handleCloseActivityModal}
          handleCloseAppointmentModal={actions.handleCloseAppointmentModal}
          handleCloseMaterialModal={actions.handleCloseMaterialModal}
          handleOpenCreateActivityModal={actions.handleOpenCreateActivityModal}
          handleOpenCreateAppointmentModal={actions.handleOpenCreateAppointmentModal}
          handleOpenCreateMaterialModal={actions.handleOpenCreateMaterialModal}
          handleOpenEditActivityModal={actions.handleOpenEditActivityModal}
          handleOpenEditAppointmentModal={actions.handleOpenEditAppointmentModal}
          handleOpenEditMaterialModal={actions.handleOpenEditMaterialModal}
          handleOpenUploadsModal={actions.handleOpenUploadsModal}
          handleSelectWorkspacePropertyFromSearch={wsProperty.handleSelectWorkspacePropertyFromSearch}
          handleSelectWorkspacePropertyId={wsProperty.handleSelectWorkspacePropertyId}
          handleSendQuote={quoteWorkflow.handleSendQuote}
          handleToggleRelatedInquiryLink={actions.handleToggleRelatedInquiryLink}
          hasMemoContext={derivedFull.hasMemoContext}
          invoiceActiveTab={s.invoiceActiveTab}
          invoiceActiveTabVersion={s.invoiceActiveTabVersion}
          isActivityModalOpen={s.isActivityModalOpen}
          isAffiliationsLoading={s.isAffiliationsLoading}
          isAppointmentModalOpen={s.isAppointmentModalOpen}
          isCompanyAccount={derivedFull.isCompanyAccount}
          isCompanyLookupLoading={s.isCompanyLookupLoading}
          isContactLookupLoading={s.isContactLookupLoading}
          isContactLogsLoading={s.isContactLogsLoading}
          isLinkedPropertiesLoading={s.isLinkedPropertiesLoading}
          isMaterialModalOpen={s.isMaterialModalOpen}
          isMemosLoading={s.isMemosLoading}
          isQuoteWorkflowUpdating={s.isQuoteWorkflowUpdating}
          isSavingLinkedInquiry={s.isSavingLinkedInquiry}
          isUploadsModalOpen={s.isUploadsModalOpen}
          isWorkspaceSectionsLoading={s.isWorkspaceSectionsLoading}
          jobActivities={s.jobActivities}
          jobData={derivedFull.jobDirectBootstrapJobData}
          jobEmailContactSearchValue={s.jobEmailContactSearchValue}
          jobEmailItems={derivedFull.jobEmailItems}
          jobMaterials={s.jobMaterials}
          linkedPropertiesError={s.linkedPropertiesError}
          linkedWorkspaceProperties={wsProperty.linkedWorkspaceProperties}
          loadedPropertyId={s.loadedPropertyId}
          lookupData={derivedFull.workspaceLookupData}
          materialModalMode={s.materialModalMode}
          memos={s.memos}
          memosError={s.memosError}
          mountedWorkspaceTabs={s.mountedWorkspaceTabs}
          onAccountsContactSearchValueChange={s.setAccountsContactSearchValue}
          onActiveWorkspaceTabChange={s.setActiveWorkspaceTab}
          onAffiliationSaved={actions.handleAffiliationSaved}
          onAddProperty={actions.handleOpenAddPropertyModal}
          onEditRelatedProperty={actions.handleOpenEditPropertyModal}
          onJobEmailContactSearchValueChange={s.setJobEmailContactSearchValue}
          onNavigateToDeal={(nextUid) => navigate(`/inquiry-details/${encodeURIComponent(nextUid)}`)}
          onNavigateToJob={(nextUid) => navigate(`/job-details/${encodeURIComponent(nextUid)}`)}
          onOpenContactDetailsModal={openContactDetailsModal}
          onOpenMemoReply={memoSystem.handleOpenMemoReply}
          onWorkspacePropertySearchValueChange={s.setWorkspacePropertySearchValue}
          plugin={plugin}
          propertyAffiliationModalState={s.affiliationModalState}
          quoteHeaderData={derivedFull.quoteHeaderData}
          relatedDealsForDisplay={derivedFull.relatedDealsForDisplay}
          relatedInquiryId={s.relatedInquiryId}
          relatedInquiryUid={s.relatedInquiryUid}
          relatedJobsForDisplay={derivedFull.relatedJobsForDisplay}
          relatedRecords={relatedRecords}
          relatedRecordsAccountId={relatedRecordsAccountId}
          relatedRecordsAccountType={relatedRecordsAccountType}
          resolveMemoAuthor={derivedFull.resolveMemoAuthor}
          safeUid={route.safeUid}
          saveAffiliation={actions.saveAffiliation}
          searchCompaniesInDatabase={searchCompaniesInDatabase}
          searchContactsInDatabase={searchContactsInDatabase}
          searchWorkspacePropertiesInDatabase={wsProperty.searchWorkspacePropertiesInDatabase}
          selectedAccountsContactId={s.selectedAccountsContactId}
          selectedWorkspacePropertyId={s.selectedWorkspacePropertyId}
          setSelectedAccountsContactId={s.setSelectedAccountsContactId}
          setSelectedJobEmailContactId={s.setSelectedJobEmailContactId}
          uploadsPropertyId={derivedFull.uploadsPropertyId}
          workspacePropertyLookupError={s.workspacePropertyLookupError}
          workspacePropertySearchItems={wsProperty.workspacePropertySearchItems}
          workspacePropertySearchValue={s.workspacePropertySearchValue}
          workspaceSectionsError={s.workspaceSectionsError}
        />
      </section>

      <JobDetailsModalStack
        activeWorkspaceProperty={wsProperty.activeWorkspaceProperty}
        closeContactDetailsModal={accountEditor.closeContactDetailsModal}
        closeMarkCompleteConfirm={boolToggles.handleCloseMarkCompleteConfirm}
        closeTasksModal={actions.handleCloseTasksModal}
        companyPopupComment={derivedFull.companyPopupComment}
        confirmDeleteMemoItem={memoSystem.confirmDeleteMemoItem}
        contactModalState={s.contactModalState}
        contactPopupComment={derivedFull.contactPopupComment}
        effectiveJobId={route.effectiveJobId}
        handleConfirmMarkComplete={boolToggles.handleConfirmMarkComplete}
        handleSavePopupComments={actions.handleSavePopupComments}
        isAddPropertyOpen={s.isAddPropertyOpen}
        isDeletingMemoItem={s.isDeletingMemoItem}
        isMarkCompleteConfirmOpen={s.isMarkCompleteConfirmOpen}
        isPopupCommentModalOpen={s.isPopupCommentModalOpen}
        isSavingMarkComplete={s.isSavingMarkComplete}
        isSavingPopupComment={s.isSavingPopupComment}
        memoDeleteTarget={s.memoDeleteTarget}
        onCloseAddProperty={() => s.setIsAddPropertyOpen(false)}
        pendingMarkCompleteValue={s.pendingMarkCompleteValue}
        plugin={plugin}
        popupCommentDrafts={s.popupCommentDrafts}
        propertyModalMode={s.propertyModalMode}
        relatedInquiryId={s.relatedInquiryId}
        relatedInquiryRecord={s.relatedInquiryRecord}
        saveProperty={actions.handleSaveProperty}
        setIsPopupCommentModalOpen={s.setIsPopupCommentModalOpen}
        setMemoDeleteTarget={s.setMemoDeleteTarget}
        setPopupCommentDrafts={s.setPopupCommentDrafts}
        showCompanyDetails={derivedFull.showCompanyDetails}
        showContactDetails={derivedFull.showContactDetails}
        tasksModalOpen={s.isTasksModalOpen}
      />

      <JobDetailsFloatingWidgets
        areFloatingWidgetsVisible={s.areFloatingWidgetsVisible}
        currentUserId={derivedFull.currentUserId}
        DeleteIcon={TrashIcon}
        focusMemoId={s.memoFocusRequest.memoId}
        focusRequestKey={s.memoFocusRequest.key}
        handleClearMemoFile={memoSystem.handleClearMemoFile}
        handleMemoFileChange={memoSystem.handleMemoFileChange}
        handleSendMemo={memoSystem.handleSendMemo}
        handleSendMemoReply={memoSystem.handleSendMemoReply}
        hasMemoContext={derivedFull.hasMemoContext}
        hasPopupCommentsSection={derivedFull.hasPopupCommentsSection}
        isMemoChatOpen={s.isMemoChatOpen}
        isMemosLoading={s.isMemosLoading}
        isPostingMemo={s.isPostingMemo}
        memoFile={s.memoFile}
        memoFileInputRef={s.memoFileInputRef}
        memoReplyDrafts={s.memoReplyDrafts}
        memoText={s.memoText}
        memos={s.memos}
        memosError={s.memosError}
        onChangeReplyDraft={(memoId, value) =>
          s.setMemoReplyDrafts((previous) => ({ ...(previous || {}), [memoId]: value }))
        }
        onCloseMemoChat={() => s.setIsMemoChatOpen(false)}
        onDeleteMemoItem={s.setMemoDeleteTarget}
        onMemoTextChange={s.setMemoText}
        onOpenPopupComments={() => {
          if (!derivedFull.hasPopupCommentsSection) return;
          s.setIsPopupCommentModalOpen(true);
        }}
        onToggleMemoChat={() => s.setIsMemoChatOpen((previous) => !previous)}
        onToggleWidgets={() => s.setAreFloatingWidgetsVisible((previous) => !previous)}
        resolveMemoAuthor={derivedFull.resolveMemoAuthor}
        sendingReplyPostId={s.sendingReplyPostId}
      />
    </>
  );
}
