import { JobDetailsCardSection } from "./JobDetailsCardSection.jsx";
import { LinkInquiryCardSection } from "./LinkInquiryCardSection.jsx";

export function OverviewTabSection({
  jobData,
  plugin,
  preloadedLookupData,
  onOpenContactDetailsModal,
  selection,
  onSelectionChange,
  onInquiryRecordChange,
  onJobFieldsChange,
}) {
  return (
    <div
      data-job-section="job-section-overview"
      className="grid grid-cols-1 gap-6 xl:grid-cols-[460px_460px]"
    >
      <div className="w-full">
        <JobDetailsCardSection
          jobData={jobData}
          plugin={plugin}
          preloadedLookupData={preloadedLookupData}
          onOpenContactDetailsModal={onOpenContactDetailsModal}
          onClientSelectionChange={onSelectionChange}
          onJobFieldsChange={onJobFieldsChange}
        />
      </div>
      <div className="w-full">
        <LinkInquiryCardSection
          jobData={jobData}
          plugin={plugin}
          accountType={selection.accountType}
          clientId={selection.clientId}
          companyId={selection.companyId}
          onInquiryRecordChange={onInquiryRecordChange}
        />
      </div>
    </div>
  );
}
