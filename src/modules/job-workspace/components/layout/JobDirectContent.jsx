import { Suspense, lazy, useEffect, useState } from "react";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../shared/components/ui/Card.jsx";
import { MODAL_KEYS, SECTION_ORDER } from "../../constants/navigation.js";

const JobInformationSection = lazy(() =>
  import("../sections/JobInformationSection.jsx").then((module) => ({
    default: module.JobInformationSection,
  }))
);

const AddActivitiesSection = lazy(() =>
  import("../sections/AddActivitiesSection.jsx").then((module) => ({
    default: module.AddActivitiesSection,
  }))
);

const AddMaterialsSection = lazy(() =>
  import("../sections/AddMaterialsSection.jsx").then((module) => ({
    default: module.AddMaterialsSection,
  }))
);

const UploadsSection = lazy(() =>
  import("../sections/UploadsSection.jsx").then((module) => ({
    default: module.UploadsSection,
  }))
);

const InvoiceSection = lazy(() =>
  import("../sections/InvoiceSection.jsx").then((module) => ({
    default: module.InvoiceSection,
  }))
);

function SectionLoader() {
  return (
    <Card className="flex min-h-[220px] items-center justify-center">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-[#003882]" />
        Loading section...
      </div>
    </Card>
  );
}

export function JobDirectContent({
  activeSection,
  activeTab,
  jobData,
  plugin,
  jobUid,
  preloadedLookupData,
  onSaveJob,
  onSubmitServiceProvider,
  onTabChange,
  onOpenModal,
  onOpenContactDetailsModal,
  onOpenAddPropertyModal,
  onExternalUnsavedChange,
  onOverviewDraftChange,
  sectionOrder = SECTION_ORDER,
  informationSectionComponent = null,
  uploadsSectionProps = null,
  showDealInfoButton = true,
}) {
  const resolvedSectionOrder =
    Array.isArray(sectionOrder) && sectionOrder.length > 0 ? sectionOrder : SECTION_ORDER;
  const enabledSectionSet = new Set(resolvedSectionOrder);
  const [mountedSections, setMountedSections] = useState(() => {
    const initial =
      String(activeSection || resolvedSectionOrder[0] || "job-information").trim() ||
      "job-information";
    return new Set([initial]);
  });

  useEffect(() => {
      const nextSection =
        String(activeSection || resolvedSectionOrder[0] || "job-information").trim() ||
        "job-information";
      setMountedSections((previous) => {
        if (previous.has(nextSection)) return previous;
        const next = new Set(previous);
        next.add(nextSection);
        return next;
      });
  }, [activeSection, resolvedSectionOrder]);

  const isMounted = (sectionId) => mountedSections.has(sectionId);
  const InformationSectionComponent =
    typeof informationSectionComponent === "function"
      ? informationSectionComponent
      : JobInformationSection;

  return (
    <div data-section="replaceable-section" className="space-y-4 pb-8">
      <Card className="flex flex-wrap items-center gap-2">
        {showDealInfoButton ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => onOpenModal(MODAL_KEYS.dealInformation)}
          >
            Deal Info
          </Button>
        ) : null}
        {/* <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenModal(MODAL_KEYS.quoteDocuments)}
        >
          Quote Docs
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenModal(MODAL_KEYS.activityList)}
        >
          Activity List
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenModal(MODAL_KEYS.wildlifeReport)}
        >
          Wildlife Report
        </Button> */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenModal(MODAL_KEYS.tasks)}
        >
          Tasks
        </Button>
      </Card>

      {enabledSectionSet.has("job-information") && isMounted("job-information") ? (
        <div className={activeSection === "job-information" ? "block" : "hidden"}>
          <Suspense fallback={<SectionLoader />}>
            <InformationSectionComponent
              activeTab={activeTab}
              jobData={jobData}
              plugin={plugin}
              preloadedLookupData={preloadedLookupData}
              onSaveJob={onSaveJob}
              onSubmitServiceProvider={onSubmitServiceProvider}
              onTabChange={onTabChange}
              onOpenContactDetailsModal={onOpenContactDetailsModal}
              onOpenAddPropertyModal={onOpenAddPropertyModal}
              onOverviewDraftChange={onOverviewDraftChange}
            />
          </Suspense>
        </div>
      ) : null}

      {enabledSectionSet.has("add-activities") && isMounted("add-activities") ? (
        <div className={activeSection === "add-activities" ? "block" : "hidden"}>
          <Suspense fallback={<SectionLoader />}>
            <AddActivitiesSection plugin={plugin} jobData={jobData} />
          </Suspense>
        </div>
      ) : null}
      {enabledSectionSet.has("add-materials") && isMounted("add-materials") ? (
        <div className={activeSection === "add-materials" ? "block" : "hidden"}>
          <Suspense fallback={<SectionLoader />}>
            <AddMaterialsSection
              plugin={plugin}
              jobData={jobData}
              preloadedLookupData={preloadedLookupData}
            />
          </Suspense>
        </div>
      ) : null}
      {enabledSectionSet.has("uploads") && isMounted("uploads") ? (
        <div className={activeSection === "uploads" ? "block" : "hidden"}>
          <Suspense fallback={<SectionLoader />}>
            <UploadsSection
              plugin={plugin}
              jobData={jobData}
              {...(uploadsSectionProps && typeof uploadsSectionProps === "object"
                ? uploadsSectionProps
                : {})}
            />
          </Suspense>
        </div>
      ) : null}
      {enabledSectionSet.has("invoice") && isMounted("invoice") ? (
        <div className={activeSection === "invoice" ? "block" : "hidden"}>
          <Suspense fallback={<SectionLoader />}>
            <InvoiceSection
              plugin={plugin}
              jobData={jobData}
              jobUid={jobUid}
              onExternalUnsavedChange={onExternalUnsavedChange}
            />
          </Suspense>
        </div>
      ) : null}
    </div>
  );
}
