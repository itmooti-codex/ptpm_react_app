import { useEffect, useState } from "react";
import { PageScaffold } from "../../../../shared/layout/PageScaffold.jsx";
import { useJobDirectState } from "../../hooks/useDetailsWorkspaceState.js";
import { useJobDirectRealtimeSync } from "../../hooks/useDetailsWorkspaceRealtimeSync.js";
import { JobDirectContent } from "./DetailsWorkspaceContent.jsx";
import { JobDirectHeader } from "./DetailsWorkspaceHeader.jsx";
import { ContactDetailsModal } from "../modals/ContactDetailsModal.jsx";
import { AddPropertyModal } from "../modals/AddPropertyModal.jsx";
import { LegacyRuntimeModals } from "../modals/WorkspaceRuntimeModals.jsx";
import { MODAL_KEYS, SECTION_LABELS, SECTION_ORDER } from "../../constants/navigation.js";
import { JobDirectSidebar } from "./DetailsWorkspaceSidebar.jsx";
import { useDetailsWorkspaceSelector } from "../../hooks/useDetailsWorkspaceStore.jsx";
import { selectJobEntity } from "../../state/selectors.js";
import { useWorkspaceOverviewSave } from "./useWorkspaceOverviewSave.js";

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
  useJobDirectRealtimeSync({ plugin, initialJobData: jobData });
  const storeJobEntity = useDetailsWorkspaceSelector(selectJobEntity);
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
  const [hasExternalUnsavedChanges, setHasExternalUnsavedChanges] = useState(false);

  const {
    hasUnsavedChanges,
    handleOverviewDraftChange,
    handleSaveJob,
    handleSubmitServiceProvider,
  } = useWorkspaceOverviewSave({
    plugin,
    jobUid,
    activeJobData,
    onExternalUnsavedChange: setHasExternalUnsavedChanges,
  });

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

  useEffect(() => {
    const handleBeforeUnload = (event) => {
      if (!hasUnsavedChanges && !hasExternalUnsavedChanges) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges, hasExternalUnsavedChanges]);

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
        plugin={plugin}
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
        plugin={plugin}
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
