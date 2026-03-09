import { toText } from "@shared/utils/formatters.js";
import { resolveJobStatusStyle, resolveQuoteStatusStyle } from "@shared/constants/statusStyles.js";

function RecordListColumn({ label, children }) {
  return (
    <div className="space-y-1.5 rounded border border-slate-200 bg-slate-50 p-2">
      <div className="text-[9px] font-semibold uppercase tracking-wide text-slate-600">{label}</div>
      {children}
    </div>
  );
}

function EmptyState({ isLoading, loadingText, emptyText }) {
  return (
    <div className="text-[11px] text-slate-500">
      {isLoading ? loadingText : emptyText}
    </div>
  );
}

function DealItem({ deal, linkedDealId, onToggleDealLink, isLinkingDeal, onNavigateToDeal }) {
  const dealId = toText(deal?.id || deal?.ID);
  const dealUid = toText(deal?.unique_id || deal?.Unique_ID || deal?.id || deal?.ID);
  const dealName = toText(deal?.deal_name || deal?.Deal_Name);
  if (!dealUid) return null;
  const isSelected = Boolean(linkedDealId) && linkedDealId === dealId;
  const canToggle = typeof onToggleDealLink === "function";

  return (
    <div
      className={`rounded border bg-white px-2 py-1.5 ${isSelected ? "border-sky-400" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            className="truncate text-[11px] font-semibold text-sky-700 underline"
            onClick={() => onNavigateToDeal?.(dealUid)}
          >
            {dealUid}
          </button>
          {dealName ? (
            <div className="truncate text-[11px] text-slate-600">{dealName}</div>
          ) : null}
        </div>
        {canToggle ? (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0 accent-[#003882]"
            checked={isSelected}
            disabled={!dealId || isLinkingDeal}
            onChange={() => onToggleDealLink(deal)}
            aria-label={`Link to inquiry ${dealUid}`}
          />
        ) : null}
      </div>
    </div>
  );
}

function JobItem({ job, linkedJobId, currentJobId, jobIdByUid, onToggleJobLink, isLinkingJob, onNavigateToJob }) {
  const jobId = toText(job?.id || job?.ID);
  const jobUid = toText(job?.unique_id || job?.Unique_ID);
  const resolvedJobId = jobId || toText(jobIdByUid?.[jobUid]);
  const jobIdentifier = jobUid || jobId;
  const propertyName = toText(job?.property_name || job?.Property_Name);
  const jobStatusText = toText(job?.job_status || job?.Job_Status);
  const quoteStatusText = toText(job?.quote_status || job?.Quote_Status);
  if (!jobIdentifier && !propertyName) return null;

  const isLinked = Boolean(linkedJobId) && (linkedJobId === resolvedJobId || linkedJobId === jobUid);
  const isCurrent = Boolean(currentJobId) && currentJobId === jobId;
  const isHighlighted = isLinked || isCurrent;
  const canToggle = typeof onToggleJobLink === "function";

  return (
    <div
      className={`rounded border bg-white px-2 py-1.5 ${isHighlighted ? "border-sky-400" : "border-slate-200"}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            className="truncate text-[11px] font-semibold text-sky-700 underline"
            onClick={() => onNavigateToJob?.(jobUid)}
            disabled={!jobUid}
          >
            {jobIdentifier}
          </button>
          {propertyName ? (
            <div className="truncate text-[11px] text-slate-600">{propertyName}</div>
          ) : null}
          {jobStatusText || quoteStatusText ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {jobStatusText ? (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={resolveJobStatusStyle(jobStatusText)}
                >
                  {jobStatusText}
                </span>
              ) : null}
              {quoteStatusText ? (
                <span
                  className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                  style={resolveQuoteStatusStyle(quoteStatusText)}
                >
                  {quoteStatusText}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {canToggle ? (
          <input
            type="checkbox"
            className="h-3.5 w-3.5 shrink-0 accent-[#003882]"
            checked={isLinked}
            disabled={(!resolvedJobId && !jobUid) || isLinkingJob}
            onChange={() => onToggleJobLink(job)}
            aria-label={`Link to job ${jobUid || jobId || ""}`}
          />
        ) : null}
      </div>
    </div>
  );
}

/**
 * Shared related records panel used by both InquiryDetailsPage and JobDetailsPage.
 *
 * - InquiryDetailsPage: deals are navigate-only; jobs have a checkbox to link the job to the inquiry.
 * - JobDetailsPage: deals have a checkbox to link the inquiry to the job; jobs are navigate-only,
 *   with the current job highlighted by `currentJobId`.
 */
export function RelatedRecordsSection({
  deals = [],
  jobs = [],
  isLoading = false,
  error = "",
  hasAccount = true,
  noAccountMessage = "Link a contact/company to load related records.",

  // Deal (inquiry) column interactions — for job page: link a deal to the current job
  linkedDealId = "",
  onToggleDealLink = null,
  isLinkingDeal = false,

  // Job column interactions — for inquiry page: link a job to the current inquiry
  linkedJobId = "",
  currentJobId = "",     // highlights the current page's job without a checkbox
  jobIdByUid = {},       // map of unique_id → numeric id for reliable linked check
  onToggleJobLink = null,
  isLinkingJob = false,

  // Navigation
  onNavigateToDeal = null,
  onNavigateToJob = null,
}) {
  if (!hasAccount) {
    return (
      <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
        {noAccountMessage}
      </div>
    );
  }

  const dealList = Array.isArray(deals) ? [...deals].sort((a, b) => {
    const aId = toText(a?.id || a?.ID);
    const aLinked = Boolean(linkedDealId) && linkedDealId === aId ? 1 : 0;
    const bId = toText(b?.id || b?.ID);
    const bLinked = Boolean(linkedDealId) && linkedDealId === bId ? 1 : 0;
    return bLinked - aLinked;
  }) : [];
  const jobList = Array.isArray(jobs) ? [...jobs].sort((a, b) => {
    const aId = toText(a?.id || a?.ID);
    const aUid = toText(a?.unique_id || a?.Unique_ID);
    const aResolved = aId || toText(jobIdByUid?.[aUid]);
    const aScore = (Boolean(linkedJobId) && (linkedJobId === aResolved || linkedJobId === aUid) ? 2 : 0) +
      (Boolean(currentJobId) && currentJobId === aId ? 1 : 0);
    const bId = toText(b?.id || b?.ID);
    const bUid = toText(b?.unique_id || b?.Unique_ID);
    const bResolved = bId || toText(jobIdByUid?.[bUid]);
    const bScore = (Boolean(linkedJobId) && (linkedJobId === bResolved || linkedJobId === bUid) ? 2 : 0) +
      (Boolean(currentJobId) && currentJobId === bId ? 1 : 0);
    return bScore - aScore;
  }) : [];

  return (
    <div className="space-y-2">
      {isLoading && !dealList.length && !jobList.length ? (
        <div className="text-[11px] text-slate-500">Loading related inquiries and jobs...</div>
      ) : null}
      {error ? (
        <div className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-900">
          {toText(error)}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <RecordListColumn label="Related Inquiries">
          {dealList.length ? (
            <div className="max-h-60 space-y-1.5 overflow-auto pr-1">
              {dealList.slice(0, 12).map((deal) => {
                const key = toText(deal?.unique_id || deal?.Unique_ID || deal?.id || deal?.ID);
                return (
                  <DealItem
                    key={key || Math.random()}
                    deal={deal}
                    linkedDealId={linkedDealId}
                    onToggleDealLink={onToggleDealLink}
                    isLinkingDeal={isLinkingDeal}
                    onNavigateToDeal={onNavigateToDeal}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              isLoading={isLoading}
              loadingText="Loading related inquiries..."
              emptyText="No related inquiries found."
            />
          )}
        </RecordListColumn>

        <RecordListColumn label="Related Jobs">
          {jobList.length ? (
            <div className="max-h-60 space-y-1.5 overflow-auto pr-1">
              {jobList.slice(0, 12).map((job) => {
                const key = toText(job?.unique_id || job?.Unique_ID || job?.id || job?.ID);
                return (
                  <JobItem
                    key={key || Math.random()}
                    job={job}
                    linkedJobId={linkedJobId}
                    currentJobId={currentJobId}
                    jobIdByUid={jobIdByUid}
                    onToggleJobLink={onToggleJobLink}
                    isLinkingJob={isLinkingJob}
                    onNavigateToJob={onNavigateToJob}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState
              isLoading={isLoading}
              loadingText="Loading related jobs..."
              emptyText="No related jobs found."
            />
          )}
        </RecordListColumn>
      </div>
    </div>
  );
}
