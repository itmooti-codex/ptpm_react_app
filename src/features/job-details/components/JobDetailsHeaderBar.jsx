import { Link } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  CopyIcon,
} from "@shared/components/icons/index.jsx";
import {
  SearchDropdownInput,
  TitleBackIcon,
} from "@modules/details-workspace/exports/components.js";

export function JobDetailsHeaderBar({
  activeEmailGroup,
  effectiveJobId,
  emailOptionsData,
  externalJobUrl,
  handleConfirmJobTakenBy,
  handleConfirmServiceProviderAllocation,
  handleCopyUid,
  handleCreateCallback,
  handleDuplicateJob,
  handleEmailJob,
  handleMarkCompleteClick,
  handleOpenTasksModal,
  handlePcaDoneToggle,
  handlePrestartDoneToggle,
  handlePrintJobSheet,
  handleRecordEmailAction,
  hasQuoteAcceptedDateValue,
  hasRelatedInquiry,
  isAllocatingServiceProvider,
  isCreatingCallback,
  isDuplicatingJob,
  isJobTakenByLookupLoading,
  isMarkComplete,
  isNewJob,
  isPcaDone,
  isPrestartDone,
  isRecordingEmailAction,
  isSavingJobTakenBy,
  isSavingPcaDone,
  isSavingPrestartDone,
  isSendingJobUpdate,
  isServiceProviderLookupLoading,
  jobStatusLabel,
  jobStatusStyle,
  jobTakenByItems,
  jobTakenBySearch,
  menuRootRef,
  onOpenRelatedInquiry,
  onReviewInvoice,
  onReviewQuote,
  openMenu,
  priorityLabel,
  priorityStyle,
  quoteStatusNormalized,
  relatedInquiryId,
  safeUid,
  serviceProviderItems,
  serviceProviderSearch,
  setActiveEmailGroup,
  setJobTakenBySearch,
  setOpenMenu,
  setSelectedJobTakenById,
  setSelectedServiceProviderId,
  setServiceProviderSearch,
  toggleMenu,
}) {
  return (
    <section className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="w-full px-2">
        <div className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-2">
          <div className="min-w-0 flex items-center gap-3">
            <Link
              to="/"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded border border-slate-300 text-slate-700 hover:bg-slate-50"
              aria-label="Back to dashboard"
            >
              <TitleBackIcon className="h-4 w-4" />
            </Link>

            <div className="min-w-0 flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-slate-900">Job Details</div>
              {!isNewJob ? (
                <>
                  {externalJobUrl ? (
                    <a
                      href={externalJobUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="uid-link hover:text-blue-800"
                      title={`Open job ${effectiveJobId} in Ontraport`}
                    >
                      {safeUid}
                    </a>
                  ) : (
                    <span className="uid-link">{safeUid}</span>
                  )}
                  <button
                    type="button"
                    className="inline-flex h-5 w-5 items-center justify-center rounded border border-slate-300 text-slate-500 hover:border-slate-400 hover:text-slate-700"
                    onClick={handleCopyUid}
                    title="Copy UID"
                    aria-label="Copy UID"
                  >
                    <CopyIcon />
                  </button>
                </>
              ) : null}
            </div>

            <span
              className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
              style={jobStatusStyle}
            >
              {jobStatusLabel}
            </span>
            {priorityLabel && priorityStyle ? (
              <span
                className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                style={priorityStyle}
              >
                {priorityLabel}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2" ref={menuRootRef}>
            <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
              <span className="service-provider-allocation-legend">Service Provider</span>
              <SearchDropdownInput
                label=""
                field="service_provider_allocation"
                value={serviceProviderSearch}
                placeholder="Allocate service provider"
                items={serviceProviderItems}
                onValueChange={(value) => {
                  setServiceProviderSearch(value);
                  setSelectedServiceProviderId("");
                }}
                onSelect={(item) => {
                  const providerId = String(item?.id || "").trim();
                  setSelectedServiceProviderId(providerId);
                  setServiceProviderSearch(String(item?.valueLabel || item?.label || "").trim());
                }}
                onAdd={handleConfirmServiceProviderAllocation}
                addButtonLabel={isAllocatingServiceProvider ? "Allocating..." : "Confirm Allocation"}
                closeOnSelect={false}
                autoConfirmOnClose
                emptyText={
                  isServiceProviderLookupLoading
                    ? "Loading service providers..."
                    : "No service providers found."
                }
                rootData={{
                  className: "service-provider-allocation-root w-full",
                  "data-search-root": "service-provider-allocation",
                }}
              />
            </div>

            <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
              <span className="service-provider-allocation-legend">Job Taken By</span>
              <SearchDropdownInput
                label=""
                field="job_taken_by_allocation"
                value={jobTakenBySearch}
                placeholder="Set job taken by"
                items={jobTakenByItems}
                onValueChange={(value) => {
                  setJobTakenBySearch(value);
                  setSelectedJobTakenById("");
                }}
                onSelect={(item) => {
                  const providerId = String(item?.id || "").trim();
                  setSelectedJobTakenById(providerId);
                  setJobTakenBySearch(String(item?.valueLabel || item?.label || "").trim());
                }}
                onAdd={handleConfirmJobTakenBy}
                addButtonLabel={isSavingJobTakenBy ? "Saving..." : "Confirm Selection"}
                closeOnSelect={false}
                autoConfirmOnClose
                emptyText={
                  isJobTakenByLookupLoading ? "Loading admins..." : "No admin records found."
                }
                rootData={{
                  className: "service-provider-allocation-root w-full",
                  "data-search-root": "job-taken-by-allocation",
                }}
              />
            </div>

            <label className="inline-flex h-8 cursor-pointer select-none items-center gap-2 px-1 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                checked={isPcaDone}
                onChange={(event) => {
                  handlePcaDoneToggle(event.target.checked);
                }}
                disabled={isSavingPcaDone}
              />
              <span>PCA Done</span>
            </label>

            <label className="inline-flex h-8 cursor-pointer select-none items-center gap-2 px-1 text-xs font-medium text-slate-700">
              <input
                type="checkbox"
                className="h-3.5 w-3.5 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                checked={isPrestartDone}
                onChange={(event) => {
                  handlePrestartDoneToggle(event.target.checked);
                }}
                disabled={isSavingPrestartDone}
              />
              <span>Prestart Done</span>
            </label>

            {hasRelatedInquiry ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={onOpenRelatedInquiry}
              >
                View Inquiry
              </Button>
            ) : null}
            <Button
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap px-3 !text-xs"
              onClick={handleOpenTasksModal}
              disabled={!effectiveJobId && !relatedInquiryId}
            >
              Manage Tasks
            </Button>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={() => toggleMenu("review")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "review"}
              >
                Review
                <ChevronDownIcon />
              </Button>
              {openMenu === "review" ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={onReviewQuote}
                  >
                    Review Quote
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={onReviewInvoice}
                  >
                    Review Invoice
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => setOpenMenu("")}
                  >
                    Review Receipt
                  </button>
                </div>
              ) : null}
            </div>

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={() => {
                  setActiveEmailGroup((previous) => previous || "general");
                  toggleMenu("email");
                }}
                aria-haspopup="menu"
                aria-expanded={openMenu === "email"}
              >
                Email
                <ChevronDownIcon />
              </Button>
              {openMenu === "email" ? (
                <div className="absolute right-0 top-full z-40 mt-1 flex min-w-[460px] rounded-md border border-slate-200 bg-white shadow-lg">
                  <div className="w-48 border-r border-slate-200 py-1">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                      disabled={isSendingJobUpdate || !effectiveJobId}
                      onClick={() => {
                        setOpenMenu("");
                        handleEmailJob();
                      }}
                    >
                      <span>{isSendingJobUpdate ? "Sending..." : "Email Job"}</span>
                    </button>
                    <div className="mx-2 my-1 border-t border-slate-200" />
                    {Object.entries(emailOptionsData).map(([groupKey, group]) => (
                      <button
                        key={groupKey}
                        type="button"
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                          activeEmailGroup === groupKey
                            ? "bg-slate-100 text-slate-900"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                        onMouseEnter={() => setActiveEmailGroup(groupKey)}
                        onClick={() => setActiveEmailGroup(groupKey)}
                      >
                        <span>{group.label}</span>
                        <ChevronRightIcon />
                      </button>
                    ))}
                  </div>
                  <div className="w-[280px] py-1">
                    {(emailOptionsData[activeEmailGroup]?.buttons || []).map((option) => (
                      <div
                        key={`${activeEmailGroup}-${option.button_name}`}
                        className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-100"
                      >
                        <button
                          type="button"
                          className="text-left text-sm text-slate-700 disabled:opacity-50"
                          disabled={isRecordingEmailAction || !effectiveJobId}
                          onClick={() => {
                            setOpenMenu("");
                            void handleRecordEmailAction({
                              groupKey: activeEmailGroup,
                              option,
                              target: "button",
                            });
                          }}
                        >
                          {option.button_name}
                        </button>
                        <button
                          type="button"
                          className="text-sm font-medium text-blue-700 underline disabled:opacity-50"
                          disabled={isRecordingEmailAction || !effectiveJobId}
                          onClick={() => {
                            setOpenMenu("");
                            void handleRecordEmailAction({
                              groupKey: activeEmailGroup,
                              option,
                              target: "template",
                            });
                          }}
                        >
                          ({option.template_link_button})
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {(hasQuoteAcceptedDateValue || quoteStatusNormalized === "accepted" || isMarkComplete) ? (
              <Button
                variant={isMarkComplete ? "outline" : "primary"}
                size="sm"
                className={`h-8 whitespace-nowrap px-3 !text-xs ${
                  isMarkComplete
                    ? "!border-emerald-600 !bg-emerald-600 !text-white hover:!bg-emerald-700"
                    : ""
                }`}
                onClick={handleMarkCompleteClick}
              >
                {isMarkComplete ? "Complete" : "Mark Complete"}
              </Button>
            ) : null}

            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={() => toggleMenu("more")}
                aria-haspopup="menu"
                aria-expanded={openMenu === "more"}
              >
                More
                <ChevronDownIcon />
              </Button>
              {openMenu === "more" ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-[180px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    disabled={isDuplicatingJob}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    onClick={() => {
                      setOpenMenu("");
                      handleDuplicateJob();
                    }}
                  >
                    {isDuplicatingJob ? "Duplicating..." : "Duplicate Job"}
                  </button>
                  <button
                    type="button"
                    disabled={isCreatingCallback}
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                    onClick={() => {
                      setOpenMenu("");
                      handleCreateCallback();
                    }}
                  >
                    {isCreatingCallback ? "Creating..." : "Create Callback"}
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                    onClick={() => {
                      setOpenMenu("");
                      handlePrintJobSheet();
                    }}
                  >
                    Print Job Sheet
                  </button>
                  <button
                    type="button"
                    className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    onClick={() => setOpenMenu("")}
                  >
                    Delete Record
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
