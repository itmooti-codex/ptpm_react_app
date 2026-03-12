import { CardField } from "@shared/components/ui/CardField.jsx";
import { DetailsCard } from "@shared/components/ui/DetailsCard.jsx";
import { toText } from "@shared/utils/formatters.js";
import { formatDateDisplay } from "../shared/jobDetailsFormatting.js";

export function JobQuotePaymentDetailsCard({
  effectiveJobId,
  hasAnyQuotePaymentDisplayField = false,
  hasFollowUpDateValue = false,
  hasPaymentStatusValue = false,
  hasPriorityValue = false,
  hasQuoteAcceptedDateValue = false,
  hasQuoteDateValue = false,
  hasQuoteRequestedDateValue = false,
  hasQuoteSentDateValue = false,
  hasQuoteStatusValue = false,
  hasQuoteValidUntilValue = false,
  hasAdminRecommendationValue = false,
  isNewJob = false,
  paymentStatusLabel = "",
  paymentStatusStyle = null,
  priorityLabel = "",
  priorityStyle = null,
  quotePaymentDetails = {},
  quoteStatusLabel = "",
  quoteStatusStyle = null,
}) {
  return (
    <DetailsCard title="Job Payment & Quote Details" className="xl:col-span-2">
      {!effectiveJobId || isNewJob ? (
        <div className="text-sm text-slate-500">
          Open an existing job to view quote/payment details.
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
            {hasQuoteStatusValue ? (
              <div className="min-w-0">
                <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Quote Status
                </div>
                <span
                  className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={quoteStatusStyle}
                >
                  {quoteStatusLabel}
                </span>
              </div>
            ) : null}

            {hasPaymentStatusValue ? (
              <div className="min-w-0">
                <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Payment Status
                </div>
                <span
                  className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={paymentStatusStyle}
                >
                  {paymentStatusLabel}
                </span>
              </div>
            ) : null}

            {hasQuoteDateValue ? (
              <CardField
                label="Quote Date"
                value={formatDateDisplay(quotePaymentDetails?.quote_date)}
              />
            ) : null}
            {hasFollowUpDateValue ? (
              <CardField
                label="Follow Up Date"
                value={formatDateDisplay(quotePaymentDetails?.follow_up_date)}
              />
            ) : null}
            {hasQuoteValidUntilValue ? (
              <CardField
                label="Quote Valid Until"
                value={formatDateDisplay(quotePaymentDetails?.quote_valid_until)}
              />
            ) : null}
            {hasQuoteRequestedDateValue ? (
              <CardField
                label="Quote Requested Date"
                value={formatDateDisplay(quotePaymentDetails?.date_quote_requested)}
              />
            ) : null}
            {hasQuoteSentDateValue ? (
              <CardField
                label="Quote Sent Date"
                value={formatDateDisplay(quotePaymentDetails?.date_quote_sent)}
              />
            ) : null}
            {hasQuoteAcceptedDateValue ? (
              <CardField
                label="Quote Accepted Date"
                value={formatDateDisplay(quotePaymentDetails?.date_quoted_accepted)}
              />
            ) : null}
            {hasPriorityValue ? (
              <div className="min-w-0">
                <div className="truncate text-[9px] font-semibold uppercase tracking-wide text-slate-500">
                  Priority
                </div>
                <span
                  className="mt-0.5 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={priorityStyle}
                >
                  {priorityLabel}
                </span>
              </div>
            ) : null}
            {hasAdminRecommendationValue ? (
              <CardField
                label="Admin Recommendation"
                value={toText(quotePaymentDetails?.admin_recommendation)}
                className="sm:col-span-2"
              />
            ) : null}

            {!hasAnyQuotePaymentDisplayField ? (
              <div className="text-sm text-slate-500">No quote/payment details available.</div>
            ) : null}
          </div>
        </div>
      )}
    </DetailsCard>
  );
}
