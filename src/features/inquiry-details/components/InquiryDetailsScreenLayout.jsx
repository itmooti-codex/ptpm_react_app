import { GlobalTopHeader } from "../../../shared/layout/GlobalTopHeader.jsx";
import { DetailsWorkspaceStoreProvider } from "../../../modules/details-workspace/hooks/useDetailsWorkspaceStore.jsx";
import { AccountDetailsSection } from "@modules/details-workspace/exports/components.js";
import { InquiryDetailsActionModals } from "./InquiryDetailsActionModals.jsx";
import { InquiryDetailsHeaderBar } from "./InquiryDetailsHeaderBar.jsx";
import { InquiryRequestDetailsCard } from "./InquiryRequestDetailsCard.jsx";
import { InquiryDetailsWorkspaceModals } from "./InquiryDetailsWorkspaceModals.jsx";
import { InquiryFloatingWidgets } from "./InquiryFloatingWidgets.jsx";
import { InquiryWorkspaceArea } from "./InquiryWorkspaceArea.jsx";

export function InquiryDetailsScreenLayout({
  actions,
  accountView,
  assignmentView,
  configuredAdminProviderId,
  detailsView,
  flags,
  memoThread,
  plugin,
  propertyWorkspace,
  relatedRecords,
  screenContext,
  screenState,
  visibleWorkspaceTabs,
}) {
  const { propertyActions, quickWorkflowActions, recordMutationActions, workspaceActions } = actions;
  const { hasUid, isQuickInquiryBookingMode, safeUid } = flags;

  return (
    <main className="min-h-screen w-full bg-slate-50 font-['Inter']" data-page="inquiry-details">
      <GlobalTopHeader />
      <InquiryDetailsHeaderBar
        hasUid={hasUid}
        externalInquiryUrl={screenContext.externalInquiryUrl}
        inquiryNumericId={screenContext.inquiryNumericId}
        safeUid={safeUid}
        handleCopyUid={workspaceActions.handleCopyUid}
        headerInquiryStatusStyle={screenContext.headerInquiryStatusStyle}
        headerInquiryStatusLabel={screenContext.headerInquiryStatusLabel}
        serviceProviderSearch={screenState.serviceProviderSearch}
        setServiceProviderSearch={screenState.setServiceProviderSearch}
        setSelectedServiceProviderId={screenState.setSelectedServiceProviderId}
        serviceProviderSearchItems={assignmentView.serviceProviderSearchItems}
        handleConfirmServiceProviderAllocation={recordMutationActions.handleConfirmServiceProviderAllocation}
        isAllocatingServiceProvider={screenState.isAllocatingServiceProvider}
        isServiceProviderLookupLoading={assignmentView.isServiceProviderLookupLoading}
        inquiryTakenBySearch={screenState.inquiryTakenBySearch}
        setInquiryTakenBySearch={screenState.setInquiryTakenBySearch}
        setSelectedInquiryTakenById={screenState.setSelectedInquiryTakenById}
        inquiryTakenBySearchItems={assignmentView.inquiryTakenBySearchItems}
        handleConfirmInquiryTakenBy={recordMutationActions.handleConfirmInquiryTakenBy}
        isSavingInquiryTakenBy={screenState.isSavingInquiryTakenBy}
        isInquiryTakenByLookupLoading={assignmentView.isInquiryTakenByLookupLoading}
        handleCreateCallback={quickWorkflowActions.handleCreateCallback}
        isCreatingCallback={screenState.isCreatingCallback}
        handleOpenTasksModal={workspaceActions.handleOpenTasksModal}
        isQuickInquiryBookingMode={isQuickInquiryBookingMode}
        handleQuickView={quickWorkflowActions.handleQuickView}
        setIsQuickInquiryBookingModalOpen={screenState.setIsQuickInquiryBookingModalOpen}
        handleQuoteJobAction={quickWorkflowActions.handleQuoteJobAction}
        isCreatingQuote={screenState.isCreatingQuote}
        isOpeningQuoteJob={screenState.isOpeningQuoteJob}
        hasLinkedQuoteJob={screenContext.hasLinkedQuoteJob}
        moreMenuRef={screenState.moreMenuRef}
        isMoreOpen={screenState.isMoreOpen}
        setIsMoreOpen={screenState.setIsMoreOpen}
        handleDeleteRecord={recordMutationActions.handleDeleteRecord}
        isDeletingRecord={screenState.isDeletingRecord}
      />
      <DetailsWorkspaceStoreProvider
        jobUid={hasUid ? safeUid : null}
        jobData={{
          id: screenContext.linkedInquiryJobIdFromRecord,
          ID: screenContext.linkedInquiryJobIdFromRecord,
        }}
        lookupData={propertyWorkspace.workspaceLookupData}
      >
        <InquiryDetailsWorkspaceModals
          isTasksModalOpen={screenState.isTasksModalOpen}
          handleCloseTasksModal={workspaceActions.handleCloseTasksModal}
          plugin={plugin}
          inquiryNumericId={screenContext.inquiryNumericId}
          resolvedInquiry={screenState.resolvedInquiry}
          contactModalState={screenState.contactModalState}
          closeContactDetailsModal={propertyActions.closeContactDetailsModal}
          isQuickInquiryBookingModalOpen={screenState.isQuickInquiryBookingModalOpen}
          handleCloseQuickInquiryBookingModal={quickWorkflowActions.handleCloseQuickInquiryBookingModal}
          quickInquiryPrefillContext={detailsView.quickInquiryPrefillContext}
          configuredAdminProviderId={configuredAdminProviderId}
          handleQuickInquiryBookingSavingStart={quickWorkflowActions.handleQuickInquiryBookingSavingStart}
          handleQuickInquiryBookingSavingProgress={quickWorkflowActions.handleQuickInquiryBookingSavingProgress}
          handleQuickInquiryBookingSaved={quickWorkflowActions.handleQuickInquiryBookingSaved}
          handleQuickInquiryBookingError={quickWorkflowActions.handleQuickInquiryBookingError}
          propertyModalState={propertyWorkspace.propertyModalState}
          closePropertyModal={propertyActions.closePropertyModal}
          handleSaveProperty={propertyActions.handleSaveProperty}
          isInquiryDetailsModalOpen={screenState.isInquiryDetailsModalOpen}
          handleCloseInquiryDetailsEditor={recordMutationActions.handleCloseInquiryDetailsEditor}
          handleSaveInquiryDetails={recordMutationActions.handleSaveInquiryDetails}
          isSavingInquiryDetails={screenState.isSavingInquiryDetails}
          inquiryDetailsForm={screenState.inquiryDetailsForm}
          setInquiryDetailsForm={screenState.setInquiryDetailsForm}
          inquiryEditFlowRule={detailsView.inquiryEditFlowRule}
          isInquiryServiceLookupLoading={screenState.isInquiryServiceLookupLoading}
          resolvedInquiryServiceOptions={detailsView.resolvedInquiryServiceOptions}
          shouldShowInquiryEditOther={detailsView.shouldShowInquiryEditOther}
          handleInquiryDetailsTextFieldChange={workspaceActions.handleInquiryDetailsTextFieldChange}
          isInquiryEditPestAccordionOpen={screenState.isInquiryEditPestAccordionOpen}
          setIsInquiryEditPestAccordionOpen={screenState.setIsInquiryEditPestAccordionOpen}
          isAppointmentModalOpen={propertyWorkspace.isAppointmentModalOpen}
          closeAppointmentModal={propertyActions.closeAppointmentModal}
          appointmentModalMode={propertyWorkspace.appointmentModalMode}
          linkedInquiryJobIdFromRecord={screenContext.linkedInquiryJobIdFromRecord}
          workspaceLookupData={propertyWorkspace.workspaceLookupData}
          safeUid={safeUid}
          appointmentModalEditingId={propertyWorkspace.appointmentModalEditingId}
          appointmentModalDraft={propertyWorkspace.appointmentModalDraft}
          inquiryAppointmentPrefillContext={assignmentView.inquiryAppointmentPrefillContext}
          isUploadsModalOpen={propertyWorkspace.isUploadsModalOpen}
          closeUploadsModal={propertyActions.closeUploadsModal}
          uploadsPropertyId={propertyWorkspace.uploadsPropertyId}
        />
        <InquiryDetailsActionModals
          isCreateQuoteModalOpen={screenState.isCreateQuoteModalOpen}
          handleCloseCreateQuoteModal={quickWorkflowActions.handleCloseCreateQuoteModal}
          isCreatingQuote={screenState.isCreatingQuote}
          handleConfirmCreateQuote={quickWorkflowActions.handleConfirmCreateQuote}
          quoteCreateDraft={screenState.quoteCreateDraft}
          setQuoteCreateDraft={screenState.setQuoteCreateDraft}
          isDeleteRecordModalOpen={screenState.isDeleteRecordModalOpen}
          handleCloseDeleteRecordModal={recordMutationActions.handleCloseDeleteRecordModal}
          isDeletingRecord={screenState.isDeletingRecord}
          handleConfirmDeleteRecord={recordMutationActions.handleConfirmDeleteRecord}
          isPopupCommentModalOpen={screenState.isPopupCommentModalOpen}
          setPopupCommentDrafts={screenState.setPopupCommentDrafts}
          contactPopupComment={screenContext.contactPopupComment}
          companyPopupComment={screenContext.companyPopupComment}
          setIsPopupCommentModalOpen={screenState.setIsPopupCommentModalOpen}
          isSavingPopupComment={screenState.isSavingPopupComment}
          handleSavePopupComments={recordMutationActions.handleSavePopupComments}
          showContactDetails={screenContext.showContactDetails}
          showCompanyDetails={screenContext.showCompanyDetails}
          popupCommentDrafts={screenState.popupCommentDrafts}
          memoDeleteTarget={memoThread.memoDeleteTarget}
          closeMemoDeleteModal={memoThread.closeMemoDeleteModal}
          isDeletingMemoItem={memoThread.isDeletingMemoItem}
          confirmDeleteMemoItem={memoThread.confirmDeleteMemoItem}
        />

        <section className="w-full px-2 py-2" data-page="inquiry-details" data-inquiry-uid={safeUid}>
          {!hasUid && !isQuickInquiryBookingMode ? (
            <div className="mb-3 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Open this page with a valid inquiry UID to load inquiry details.
            </div>
          ) : null}

          <div className="grid grid-cols-1 items-start gap-2 md:grid-cols-2 xl:grid-cols-3">
            <AccountDetailsSection
              isLoading={detailsView.isInquiryInitialLoadInProgress}
              editDisabled={!screenContext.inquiryNumericId}
              onEdit={workspaceActions.handleOpenAccountEditor}
              onCopy={workspaceActions.handleCopyFieldValue}
              safeUid={safeUid}
              accountType={screenContext.accountType}
              showContactDetails={screenContext.showContactDetails}
              hasAccountContactFields={accountView.hasAccountContactFields}
              accountContactName={accountView.accountContactName}
              accountContactEmail={accountView.accountContactEmail}
              accountContactEmailHref={accountView.accountContactEmailHref}
              accountContactPhone={accountView.accountContactPhone}
              accountContactPhoneHref={accountView.accountContactPhoneHref}
              accountContactAddress={accountView.accountContactAddress}
              accountContactAddressHref={accountView.accountContactAddressHref}
              showCompanyDetails={screenContext.showCompanyDetails}
              hasAccountCompanyFields={accountView.hasAccountCompanyFields}
              accountCompanyName={accountView.accountCompanyName}
              accountCompanyPhone={accountView.accountCompanyPhone}
              accountCompanyPhoneHref={accountView.accountCompanyPhoneHref}
              accountCompanyPrimaryName={accountView.accountCompanyPrimaryName}
              accountCompanyPrimaryEmail={accountView.accountCompanyPrimaryEmail}
              accountCompanyPrimaryEmailHref={accountView.accountCompanyPrimaryEmailHref}
              accountCompanyPrimaryPhone={accountView.accountCompanyPrimaryPhone}
              accountCompanyPrimaryPhoneHref={accountView.accountCompanyPrimaryPhoneHref}
              accountCompanyAddress={accountView.accountCompanyAddress}
              accountCompanyAddressHref={accountView.accountCompanyAddressHref}
              isBodyCorpAccount={screenContext.isBodyCorpAccount}
              hasBodyCorpDetails={accountView.hasBodyCorpDetails}
              accountBodyCorpName={accountView.accountBodyCorpName}
              accountBodyCorpType={accountView.accountBodyCorpType}
              accountBodyCorpPhone={accountView.accountBodyCorpPhone}
              accountBodyCorpPhoneHref={accountView.accountBodyCorpPhoneHref}
              accountBodyCorpAddress={accountView.accountBodyCorpAddress}
              accountBodyCorpAddressHref={accountView.accountBodyCorpAddressHref}
            />
            <InquiryRequestDetailsCard
              isInquiryInitialLoadInProgress={detailsView.isInquiryInitialLoadInProgress}
              handleOpenInquiryDetailsEditor={recordMutationActions.handleOpenInquiryDetailsEditor}
              inquiryNumericId={screenContext.inquiryNumericId}
              isInquiryRequestExpanded
              inquiryStatus={screenContext.inquiryStatus}
              statusSource={detailsView.statusSource}
              statusType={detailsView.statusType}
              inquiryDisplayFlowRule={detailsView.inquiryDisplayFlowRule}
              statusServiceName={detailsView.statusServiceName}
              statusServiceNameHref={detailsView.statusServiceNameHref}
              statusHowHeardDisplay={detailsView.statusHowHeardDisplay}
              requestDateRequired={detailsView.requestDateRequired}
              requestRenovations={detailsView.requestRenovations}
              requestResidentAvailability={detailsView.requestResidentAvailability}
              requestPestNoiseTags={detailsView.requestPestNoiseTags}
              handleQuickRemoveListSelectionTag={workspaceActions.handleQuickRemoveListSelectionTag}
              requestPestNoiseRawValue={detailsView.requestPestNoiseRawValue}
              isListSelectionTagRemoving={workspaceActions.isListSelectionTagRemoving}
              requestPestActiveTimesTags={detailsView.requestPestActiveTimesTags}
              requestPestActiveTimesRawValue={detailsView.requestPestActiveTimesRawValue}
              requestPestLocationsTags={detailsView.requestPestLocationsTags}
              requestPestLocationsRawValue={detailsView.requestPestLocationsRawValue}
              statusHowCanHelp={detailsView.statusHowCanHelp}
              notesAdmin={detailsView.notesAdmin}
              notesClient={detailsView.notesClient}
            />
          </div>

          <InquiryWorkspaceArea
            activeWorkspaceTab={screenState.activeWorkspaceTab}
            mountedWorkspaceTabs={screenState.mountedWorkspaceTabs}
            visibleWorkspaceTabs={visibleWorkspaceTabs}
            setActiveWorkspaceTab={screenState.setActiveWorkspaceTab}
            isInquiryInitialLoadInProgress={detailsView.isInquiryInitialLoadInProgress}
            filteredRelatedDeals={relatedRecords.filteredRelatedDeals}
            relatedJobsForDisplay={propertyWorkspace.relatedJobsForDisplay}
            hasMemoContext={screenContext.hasMemoContext}
            isMemosLoading={memoThread.isMemosLoading}
            memosError={memoThread.memosError}
            memos={memoThread.memos}
            resolveMemoAuthor={screenContext.resolveMemoAuthor}
            handleOpenMemoPreview={quickWorkflowActions.handleOpenMemoPreview}
            plugin={plugin}
            linkedInquiryJobIdFromRecord={screenContext.linkedInquiryJobIdFromRecord}
            inquiryNumericId={screenContext.inquiryNumericId}
            isRelatedRecordsLoading={relatedRecords.isRelatedRecordsLoading}
            relatedRecordsError={relatedRecords.relatedRecordsError}
            relatedRecordsAccountId={screenContext.relatedRecordsAccountId}
            selectedRelatedJobId={screenContext.selectedRelatedJobId}
            relatedJobIdByUid={screenState.relatedJobIdByUid}
            handleToggleRelatedJobLink={workspaceActions.handleToggleRelatedJobLink}
            isSavingLinkedJob={screenState.isSavingLinkedJob}
            openRelatedRecord={workspaceActions.openRelatedRecord}
            contactLogsContactId={screenContext.contactLogsContactId}
            isContactLogsLoading={relatedRecords.isContactLogsLoading}
            contactLogsError={relatedRecords.contactLogsError}
            contactLogs={relatedRecords.contactLogs}
            workspaceLookupData={propertyWorkspace.workspaceLookupData}
            safeUid={safeUid}
            uploadsPropertyId={propertyWorkspace.uploadsPropertyId}
            inquiryAppointmentPrefillContext={assignmentView.inquiryAppointmentPrefillContext}
            handleOpenCreateAppointmentModal={propertyActions.handleOpenCreateAppointmentModal}
            handleOpenEditAppointmentModal={propertyActions.handleOpenEditAppointmentModal}
            activeRelatedProperty={propertyWorkspace.activeRelatedProperty}
            selectedPropertyId={propertyWorkspace.selectedPropertyId}
            openContactDetailsModal={propertyActions.openContactDetailsModal}
            relatedRecordsAccountType={screenContext.relatedRecordsAccountType}
            propertySearchQuery={propertyWorkspace.propertySearchQuery}
            propertySearchItems={propertyWorkspace.propertySearchItems}
            handlePropertySearchValueChange={propertyActions.handlePropertySearchValueChange}
            handlePropertySearchQueryChange={propertyActions.handlePropertySearchQueryChange}
            handleSelectPropertyFromSearch={propertyActions.handleSelectPropertyFromSearch}
            handleOpenAddPropertyModal={propertyActions.handleOpenAddPropertyModal}
            linkedPropertiesSorted={propertyWorkspace.linkedPropertiesSorted}
            isLinkedPropertiesLoading={propertyWorkspace.isLinkedPropertiesLoading}
            linkedPropertiesError={propertyWorkspace.linkedPropertiesError}
            setSelectedPropertyId={propertyWorkspace.setSelectedPropertyId}
            handleOpenEditPropertyModal={propertyActions.handleOpenEditPropertyModal}
            isApplyingSameAsContactProperty={propertyWorkspace.isApplyingSameAsContactProperty}
            isPropertySameAsContact={propertyWorkspace.isPropertySameAsContact}
            handleSameAsContactPropertyChange={propertyActions.handleSameAsContactPropertyChange}
            handleOpenUploadModal={propertyActions.handleOpenUploadModal}
          />
        </section>

        <InquiryFloatingWidgets
          areFloatingWidgetsVisible={screenState.areFloatingWidgetsVisible}
          setAreFloatingWidgetsVisible={screenState.setAreFloatingWidgetsVisible}
          hasPopupCommentsSection={screenContext.hasPopupCommentsSection}
          memos={memoThread.memos}
          setIsPopupCommentModalOpen={screenState.setIsPopupCommentModalOpen}
          isMemoChatOpen={memoThread.isMemoChatOpen}
          hasMemoContext={screenContext.hasMemoContext}
          isMemosLoading={memoThread.isMemosLoading}
          memosError={memoThread.memosError}
          currentUserId={screenContext.currentUserId}
          resolveMemoAuthor={screenContext.resolveMemoAuthor}
          sendingReplyPostId={memoThread.sendingReplyPostId}
          memoReplyDrafts={memoThread.memoReplyDrafts}
          handleChangeMemoReplyDraft={memoThread.handleChangeMemoReplyDraft}
          handleSendMemoReply={memoThread.handleSendMemoReply}
          setMemoDeleteTarget={memoThread.setMemoDeleteTarget}
          memoText={memoThread.memoText}
          setMemoText={memoThread.setMemoText}
          isPostingMemo={memoThread.isPostingMemo}
          handleSendMemo={memoThread.handleSendMemo}
          memoFile={memoThread.memoFile}
          memoFileInputRef={memoThread.memoFileInputRef}
          handleMemoFileChange={memoThread.handleMemoFileChange}
          handleClearMemoFile={memoThread.handleClearMemoFile}
          memoFocusRequest={memoThread.memoFocusRequest}
          setIsMemoChatOpen={memoThread.setIsMemoChatOpen}
        />
      </DetailsWorkspaceStoreProvider>
    </main>
  );
}
