import { Link } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import {
  ChevronDownIcon,
  CopyIcon,
} from "@shared/components/icons/index.jsx";
import {
  SearchDropdownInput,
  TitleBackIcon,
} from "@modules/details-workspace/exports/components.js";
import { toText } from "@shared/utils/formatters.js";

export function InquiryDetailsHeaderBar({
  hasUid,
  externalInquiryUrl,
  inquiryNumericId,
  safeUid,
  handleCopyUid,
  headerInquiryStatusStyle,
  headerInquiryStatusLabel,
  serviceProviderSearch,
  setServiceProviderSearch,
  setSelectedServiceProviderId,
  serviceProviderSearchItems,
  handleConfirmServiceProviderAllocation,
  isAllocatingServiceProvider,
  isServiceProviderLookupLoading,
  inquiryTakenBySearch,
  setInquiryTakenBySearch,
  setSelectedInquiryTakenById,
  inquiryTakenBySearchItems,
  handleConfirmInquiryTakenBy,
  isSavingInquiryTakenBy,
  isInquiryTakenByLookupLoading,
  handleCreateCallback,
  isCreatingCallback,
  handleOpenTasksModal,
  isQuickInquiryBookingMode,
  handleQuickView,
  setIsQuickInquiryBookingModalOpen,
  handleQuoteJobAction,
  isCreatingQuote,
  isOpeningQuoteJob,
  hasLinkedQuoteJob,
  moreMenuRef,
  isMoreOpen,
  setIsMoreOpen,
  handleDeleteRecord,
  isDeletingRecord,
}) {
  return (
    <section className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
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
              <div className="truncate text-sm font-semibold text-slate-900">Inquiry Details</div>
              {hasUid ? (
                <>
                  {externalInquiryUrl ? (
                    <a
                      href={externalInquiryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="uid-link hover:text-blue-800"
                      title={`Open inquiry ${inquiryNumericId} in Ontraport`}
                    >
                      {safeUid}
                    </a>
                  ) : (
                    <span className="uid-text">{safeUid}</span>
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
              style={headerInquiryStatusStyle}
            >
              {headerInquiryStatusLabel}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="service-provider-allocation-field w-full min-w-[360px] max-w-[620px] md:w-auto md:flex-1">
              <span className="service-provider-allocation-legend">Service Provider</span>
              <SearchDropdownInput
                label=""
                field="service_provider_allocation"
                value={serviceProviderSearch}
                placeholder="Allocate service provider"
                items={serviceProviderSearchItems}
                onValueChange={(value) => {
                  setServiceProviderSearch(value);
                  setSelectedServiceProviderId("");
                }}
                onSelect={(item) => {
                  const providerId = toText(item?.id);
                  setSelectedServiceProviderId(providerId);
                  setServiceProviderSearch(toText(item?.valueLabel || item?.label));
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
              <span className="service-provider-allocation-legend">Inquiry Taken By</span>
              <SearchDropdownInput
                label=""
                field="inquiry_taken_by_allocation"
                value={inquiryTakenBySearch}
                placeholder="Set inquiry taken by"
                items={inquiryTakenBySearchItems}
                onValueChange={(value) => {
                  setInquiryTakenBySearch(value);
                  setSelectedInquiryTakenById("");
                }}
                onSelect={(item) => {
                  const providerId = toText(item?.id);
                  setSelectedInquiryTakenById(providerId);
                  setInquiryTakenBySearch(toText(item?.valueLabel || item?.label));
                }}
                onAdd={handleConfirmInquiryTakenBy}
                addButtonLabel={isSavingInquiryTakenBy ? "Saving..." : "Confirm Selection"}
                closeOnSelect={false}
                autoConfirmOnClose
                emptyText={
                  isInquiryTakenByLookupLoading ? "Loading admins..." : "No admin records found."
                }
                rootData={{
                  className: "service-provider-allocation-root w-full",
                  "data-search-root": "inquiry-taken-by-allocation",
                }}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap px-3 !text-xs"
              onClick={handleCreateCallback}
              disabled={!inquiryNumericId || isCreatingCallback}
            >
              {isCreatingCallback ? "Creating..." : "Create Call Back"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap px-3 !text-xs"
              onClick={handleOpenTasksModal}
              disabled={!inquiryNumericId}
            >
              Manage Tasks
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 whitespace-nowrap px-3 !text-xs"
              onClick={() => {
                if (!isQuickInquiryBookingMode) {
                  handleQuickView();
                  return;
                }
                setIsQuickInquiryBookingModalOpen(true);
              }}
            >
              Quick View
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="h-8 whitespace-nowrap px-3 !text-xs"
              onClick={handleQuoteJobAction}
              disabled={!inquiryNumericId || isCreatingQuote || isOpeningQuoteJob}
            >
              {isCreatingQuote
                ? "Creating..."
                : isOpeningQuoteJob
                  ? "Opening..."
                  : hasLinkedQuoteJob
                    ? "View Quote/Job"
                    : "Create Quote/Job"}
            </Button>
            <div className="relative" ref={moreMenuRef}>
              <Button
                variant="outline"
                size="sm"
                className="h-8 whitespace-nowrap px-3 !text-xs"
                onClick={() => setIsMoreOpen((previous) => !previous)}
                aria-haspopup="menu"
                aria-expanded={isMoreOpen}
              >
                More
                <ChevronDownIcon />
              </Button>
              {isMoreOpen ? (
                <div className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-md border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className={`block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 ${
                      isDeletingRecord ? "pointer-events-none opacity-50" : ""
                    }`}
                    onClick={handleDeleteRecord}
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
