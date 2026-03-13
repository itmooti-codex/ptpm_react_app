import { useDetailsWorkspaceSelector } from "../../hooks/useDetailsWorkspaceStore.jsx";
import {
  ClientInvoicePanel,
  ServiceProviderBillPanel,
} from "./invoice/InvoicePanels.jsx";
import { QuoteSheetPanel } from "./invoice/QuoteSheetPanel.jsx";
import { useInvoiceForm } from "./invoice/useInvoiceForm.js";
import { useInvoiceCrud } from "./invoice/useInvoiceCrud.js";
import { normalizeId, formatCurrency, formatDateDisplay, lineAmount, toNumber } from "./invoice/invoiceUtils.js";
import { toText } from "@shared/utils/formatters.js";
import { selectJobEntity } from "../../state/selectors.js";

const tableHeaderCellClass =
  "px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500";
const tableBodyCellClass = "px-3 py-2.5 align-middle text-[13px] text-slate-700";

export function InvoiceSection({
  plugin,
  jobData,
  jobUid,
  onExternalUnsavedChange,
  quoteHeaderData,
  onAcceptQuote,
  isAcceptingQuote,
  canAcceptQuote,
  canSendQuote,
  onSendQuote,
  isSendingQuote,
  hasAccountsContact,
  quoteContactSelectorSlot,
  activeTab,
  activeTabVersion,
}) {
  const jobEntity = useDetailsWorkspaceSelector(selectJobEntity);

  const form = useInvoiceForm({
    jobData,
    jobEntity,
    activeTab,
    activeTabVersion,
    onExternalUnsavedChange,
  });

  const jobId = normalizeId(form.activeJob?.id || form.activeJob?.ID);
  const inquiryRecordId = toText(form.activeJob?.inquiry_record_id || form.activeJob?.Inquiry_Record_ID);

  const crud = useInvoiceCrud({
    plugin,
    jobId,
    inquiryRecordId,
    activeJob: form.activeJob,
    invoiceDate: form.invoiceDate,
    invoiceDueDate: form.invoiceDueDate,
    billDate: form.billDate,
    billDueDate: form.billDueDate,
    setInvoiceDirty: form.setInvoiceDirty,
    setBillDirty: form.setBillDirty,
    hasSeenPaymentStatusRef: form.hasSeenPaymentStatusRef,
    previousPaymentStatusRef: form.previousPaymentStatusRef,
  });

  const accountXeroId =
    form.accountSummary.accountType === "Company"
      ? form.accountSummary.companyXeroId || ""
      : form.accountSummary.contactXeroId || "";

  return (
    <section data-section="invoice" className="mx-auto w-full max-w-full space-y-4 pb-10 xl:w-[60%]">
      <div className="border-b border-slate-300 bg-white pt-1">
        <div className="flex items-center justify-between">
        <div className="inline-flex items-center">
          <button
            type="button"
            className={`inline-flex items-center px-6 py-3 ${
              form.activeBillingTab === "quote"
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => form.setActiveBillingTab("quote")}
            data-tab="quote"
          >
            Quote
          </button>
          <button
            type="button"
            className={`inline-flex items-center px-6 py-3 ${
              form.activeBillingTab === "client-invoice"
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => form.setActiveBillingTab("client-invoice")}
            data-tab="client-invoice"
          >
            Client Invoice
          </button>
          <button
            type="button"
            className={`inline-flex items-center px-6 py-3 ${
              form.activeBillingTab === "service-provider-bill"
                ? "border-b-2 border-sky-900 text-sky-900"
                : "text-neutral-700"
            }`}
            onClick={() => form.setActiveBillingTab("service-provider-bill")}
            data-tab="service-provider-bill"
          >
            Service Provider Bill
          </button>
        </div>
        {jobUid && form.activeBillingTab === "quote" ? (
          <div className="mr-3 flex items-center gap-1">
            <button
              type="button"
              title="Copy public job sheet URL"
              className="flex items-center gap-1.5 rounded px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              onClick={() => {
                const url = `${window.location.origin}/quote/${encodeURIComponent(jobUid)}`;
                navigator.clipboard.writeText(url).then(() => {
                  form.setUrlCopied(true);
                  setTimeout(() => form.setUrlCopied(false), 2000);
                });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3z" />
                <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865z" />
              </svg>
              {form.urlCopied ? "Copied!" : "Copy URL"}
            </button>
            <a
              href={`${window.location.origin}/quote/${encodeURIComponent(jobUid)}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Open public job sheet in new tab"
              className="flex items-center rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
        ) : null}
        </div>
      </div>

      {form.activeBillingTab === "quote" ? (
        <>
          {quoteContactSelectorSlot ? (
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              {quoteContactSelectorSlot}
            </div>
          ) : null}
          <QuoteSheetPanel
            activities={form.storeActivities}
            headerData={quoteHeaderData}
            onAcceptQuote={onAcceptQuote}
            isAcceptingQuote={isAcceptingQuote}
            canAcceptQuote={canAcceptQuote}
            canSendQuote={canSendQuote}
            onSendQuote={onSendQuote}
            isSendingQuote={isSendingQuote}
            hasAccountsContact={hasAccountsContact}
          />
        </>
      ) : null}

      {form.activeBillingTab === "client-invoice" ? (
        <ClientInvoicePanel
          activeJob={form.activeJob}
          invoiceStatus={form.invoiceStatus}
          isWaitingForInvoiceResponse={crud.isWaitingForInvoiceResponse}
          xeroApiResponse={form.xeroApiResponse}
          xeroApiResponseTone={form.xeroApiResponseTone}
          accountSummary={form.accountSummary}
          accountXeroId={accountXeroId}
          onCopyXeroId={crud.handleCopyToClipboard}
          invoiceDate={form.invoiceDate}
          invoiceDueDate={form.invoiceDueDate}
          onInvoiceDateChange={(value) => {
            form.setInvoiceDate(value);
            form.setInvoiceDirty(true);
          }}
          onInvoiceDueDateChange={(value) => {
            form.setInvoiceDueDate(value);
            form.setInvoiceDirty(true);
          }}
          activeActivities={form.activeActivities}
          selectedActivityIdSet={form.selectedActivityIdSet}
          onToggleActivitySelection={form.toggleActivitySelection}
          selectedActivities={form.selectedActivities}
          lineAmount={lineAmount}
          toNumber={toNumber}
          formatCurrency={formatCurrency}
          toText={toText}
          tableHeaderCellClass={tableHeaderCellClass}
          tableBodyCellClass={tableBodyCellClass}
          storedInvoiceTotal={form.storedInvoiceTotal}
          invoiceSubtotal={form.invoiceSubtotal}
          invoiceGst={form.invoiceGst}
          invoiceTotal={form.invoiceTotal}
          paymentStatus={form.paymentStatus}
          onGenerateOrUpdateInvoice={crud.handleGenerateOrUpdateInvoice}
          isInvoiceSaving={crud.isInvoiceSaving}
          onSendToCustomer={crud.handleSendToCustomer}
          isSendingToCustomer={crud.isSendingToCustomer}
        />
      ) : null}

      {form.activeBillingTab === "service-provider-bill" ? (
        <ServiceProviderBillPanel
          billStatus={form.billStatus}
          serviceProviderSummary={form.serviceProviderSummary}
          providerRate={form.providerRate}
          activeJob={form.activeJob}
          accountSummary={form.accountSummary}
          billDate={form.billDate}
          billDueDate={form.billDueDate}
          onBillDateChange={(value) => {
            form.setBillDate(value);
            form.setBillDirty(true);
          }}
          onBillDueDateChange={(value) => {
            form.setBillDueDate(value);
            form.setBillDirty(true);
          }}
          billApprovedByAdmin={form.billApprovedByAdmin}
          billActivityRows={form.billActivityRows}
          tableHeaderCellClass={tableHeaderCellClass}
          tableBodyCellClass={tableBodyCellClass}
          formatCurrency={formatCurrency}
          materialSummary={form.materialSummary}
          materialsNetTotal={form.materialsNetTotal}
          billSubtotal={form.billSubtotal}
          billGst={form.billGst}
          billTotal={form.billTotal}
          formatDateDisplay={formatDateDisplay}
          billApprovalTimeLabel={form.billApprovalTimeLabel}
          onApproveBill={crud.handleApproveBill}
          isBillSaving={crud.isBillSaving}
        />
      ) : null}
    </section>
  );
}
