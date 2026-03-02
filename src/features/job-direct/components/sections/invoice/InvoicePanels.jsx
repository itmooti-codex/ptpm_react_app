import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { InputField } from "../../../../../shared/components/ui/InputField.jsx";

function toText(value) {
  return String(value ?? "").trim();
}

function LinkButton({ href, children }) {
  const safeHref = toText(href);
  if (!safeHref) {
    return (
      <span className="inline-flex cursor-not-allowed items-center rounded border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-400">
        {children}
      </span>
    );
  }
  return (
    <a
      href={safeHref}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400"
    >
      {children}
    </a>
  );
}

function SectionTitle({ title, subtitle }) {
  return (
    <div className="space-y-1">
      <h3 className="type-subheadline text-slate-800">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function ClientInvoicePanel({
  activeJob,
  invoiceStatus,
  isWaitingForInvoiceResponse,
  xeroApiResponse,
  xeroApiResponseTone,
  accountSummary,
  accountXeroId,
  onCopyXeroId,
  invoiceDate,
  invoiceDueDate,
  onInvoiceDateChange,
  onInvoiceDueDateChange,
  activeActivities,
  selectedActivityIdSet,
  onToggleActivitySelection,
  selectedActivities,
  lineAmount,
  toNumber,
  formatCurrency,
  toText: toTextFromProps,
  tableHeaderCellClass,
  tableBodyCellClass,
  storedInvoiceTotal,
  invoiceSubtotal,
  invoiceGst,
  invoiceTotal,
  paymentStatus,
  onGenerateOrUpdateInvoice,
  isInvoiceSaving,
  onSendToCustomer,
  isSendingToCustomer,
}) {
  const toLabel = typeof toTextFromProps === "function" ? toTextFromProps : toText;
  return (
    <div className="min-w-0 space-y-4">
      <Card className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="h-1.5 w-full bg-[var(--color-primary)]" />
        <div className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle title="Client Invoice" />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
                style={invoiceStatus.style}
              >
                {invoiceStatus.label}
              </span>
              <span className="rounded border border-slate-300 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                Invoice # {toLabel(activeJob?.invoice_number || activeJob?.Invoice_Number) || "--"}
              </span>
            </div>
          </div>

          {isWaitingForInvoiceResponse ? (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Waiting for Xero response...
            </div>
          ) : null}

          {xeroApiResponse ? (
            <div className={`rounded border px-3 py-2 text-sm ${xeroApiResponseTone.className}`}>
              <div className="text-[11px] font-semibold uppercase tracking-wide">
                {xeroApiResponseTone.title}
              </div>
              <div className="mt-1 whitespace-pre-wrap">{xeroApiResponse}</div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">
            <Card className="space-y-3 border-slate-200 bg-slate-50/55 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contact</div>
              <div className="space-y-2 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Account Type</span>
                  <span className="font-medium text-slate-800">{accountSummary.accountType}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Accounts Contact</span>
                  <span className="max-w-[240px] truncate whitespace-nowrap font-medium text-slate-800">
                    {accountSummary.accountName}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Email</span>
                  {accountSummary.accountEmail !== "--" ? (
                    <a
                      href={`mailto:${accountSummary.accountEmail}`}
                      className="max-w-[240px] truncate whitespace-nowrap font-medium text-sky-700 underline-offset-2 hover:underline"
                      title={accountSummary.accountEmail}
                    >
                      {accountSummary.accountEmail}
                    </a>
                  ) : (
                    <span className="max-w-[240px] truncate whitespace-nowrap font-medium text-slate-800">
                      {accountSummary.accountEmail}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Xero ID</span>
                  {accountXeroId ? (
                    <button
                      type="button"
                      onClick={() => onCopyXeroId(accountXeroId, "Xero ID")}
                      className="max-w-[210px] truncate text-right font-mono text-[12px] font-medium text-sky-700 underline underline-offset-2 hover:text-sky-800"
                      title="Click to copy Xero ID"
                    >
                      {accountXeroId}
                    </button>
                  ) : (
                    <span className="max-w-[210px] truncate text-right font-mono text-[12px] font-medium text-slate-800">
                      --
                    </span>
                  )}
                </div>
              </div>
            </Card>

            <Card className="space-y-3 border-slate-200 bg-slate-50/55 p-3">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dates</div>
              <div className="grid grid-cols-1 gap-3">
                <InputField
                  label="Invoice Date"
                  type="date"
                  data-field="invoice_date"
                  value={invoiceDate}
                  onChange={(event) => onInvoiceDateChange(event.target.value)}
                />
                <InputField
                  label="Due Date"
                  type="date"
                  data-field="due_date"
                  value={invoiceDueDate}
                  onChange={(event) => onInvoiceDueDateChange(event.target.value)}
                />
              </div>
            </Card>
          </div>

          <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-700">Invoice Activities</div>
              <div className="text-xs text-slate-500">Select activities to include in invoice</div>
            </div>
            <div className="w-full overflow-x-auto rounded border border-slate-200">
              <table className="w-full min-w-[900px] table-fixed text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-100/90">
                  <tr>
                    <th className={`w-[90px] ${tableHeaderCellClass}`}>Include</th>
                    <th className={`w-[130px] ${tableHeaderCellClass}`}>Task</th>
                    <th className={`w-[150px] ${tableHeaderCellClass}`}>Option</th>
                    <th className={`w-[240px] ${tableHeaderCellClass}`}>Service</th>
                    <th className={`w-[80px] text-right ${tableHeaderCellClass}`}>Qty</th>
                    <th className={`w-[130px] text-right ${tableHeaderCellClass}`}>Price</th>
                    <th className={`w-[130px] text-right ${tableHeaderCellClass}`}>Amount</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {!activeActivities.length ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400" colSpan={7}>
                        No activities found for this job.
                      </td>
                    </tr>
                  ) : (
                    activeActivities.map((record) => {
                      const activityId = toLabel(record?.id || record?.ID);
                      const checked = selectedActivityIdSet.has(activityId);
                      const quantity = Math.max(1, toNumber(record?.quantity || 1));
                      const price = toNumber(record?.activity_price || record?.quoted_price || 0);
                      const amount = lineAmount(record);

                      return (
                        <tr
                          key={activityId || `${record?.task}-${record?.service_name}`}
                          className="border-b border-slate-100 transition-colors hover:bg-slate-50/65 last:border-b-0"
                        >
                          <td className={tableBodyCellClass}>
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-slate-300 accent-[#0A3E8C]"
                              checked={checked}
                              onChange={(event) =>
                                onToggleActivitySelection(activityId, event.target.checked)
                              }
                            />
                          </td>
                          <td className={`${tableBodyCellClass} text-slate-800`}>
                            {toLabel(record?.task || record?.Task) || "-"}
                          </td>
                          <td className={`${tableBodyCellClass} text-slate-800`}>
                            {toLabel(record?.option || record?.Option) || "-"}
                          </td>
                          <td className={`${tableBodyCellClass} text-slate-800`}>
                            {toLabel(record?.service_name || record?.Service_Service_Name) || "-"}
                          </td>
                          <td className={`${tableBodyCellClass} text-right text-slate-800`}>{quantity}</td>
                          <td className={`${tableBodyCellClass} text-right text-slate-800`}>
                            {formatCurrency(price)}
                          </td>
                          <td className={`${tableBodyCellClass} text-right font-semibold text-slate-900`}>
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <Card className="space-y-2 border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-700">Line Items</div>
            <div className="w-full overflow-x-auto rounded border border-slate-200">
              <table className="w-full min-w-[640px] table-fixed text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-100/90">
                  <tr>
                    <th className={tableHeaderCellClass}>Service</th>
                    <th className={tableHeaderCellClass}>Task</th>
                    <th className={`w-[90px] text-right ${tableHeaderCellClass}`}>Qty</th>
                    <th className={`w-[130px] text-right ${tableHeaderCellClass}`}>Price</th>
                    <th className={`w-[130px] text-right ${tableHeaderCellClass}`}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {!selectedActivities.length ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400" colSpan={5}>
                        No line items selected.
                      </td>
                    </tr>
                  ) : (
                    selectedActivities.map((record) => {
                      const quantity = Math.max(1, toNumber(record?.quantity || 1));
                      const price = toNumber(record?.activity_price || record?.quoted_price || 0);
                      const amount = lineAmount(record);
                      return (
                        <tr
                          key={`line-${toLabel(record?.id || record?.ID)}`}
                          className="border-b border-slate-100 last:border-b-0"
                        >
                          <td className={`${tableBodyCellClass} text-slate-800`}>
                            {toLabel(record?.service_name || record?.Service_Service_Name) || "-"}
                          </td>
                          <td className={`${tableBodyCellClass} text-slate-800`}>
                            {toLabel(record?.task || record?.Task) || "-"}
                          </td>
                          <td className={`${tableBodyCellClass} text-right text-slate-800`}>{quantity}</td>
                          <td className={`${tableBodyCellClass} text-right text-slate-800`}>
                            {formatCurrency(price)}
                          </td>
                          <td className={`${tableBodyCellClass} text-right font-semibold text-slate-900`}>
                            {formatCurrency(amount)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 pt-3">
              <div className="ml-auto w-full max-w-[420px] space-y-2 pr-3 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>Invoice Total (Saved)</span>
                  <span className="min-w-[130px] text-right font-medium">
                    {formatCurrency(storedInvoiceTotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="min-w-[130px] text-right font-medium">
                    {formatCurrency(invoiceSubtotal)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Includes GST</span>
                  <span className="min-w-[130px] text-right font-medium">
                    {formatCurrency(invoiceGst)}
                  </span>
                </div>
                <div className="border-t-2 border-slate-300 pt-2.5">
                  <div className="flex items-center justify-between text-base font-semibold text-slate-900">
                    <span>Total</span>
                    <span data-field="invoice_total" className="min-w-[130px] text-right">
                      {formatCurrency(invoiceTotal)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                  <span>Payment Status</span>
                  <span
                    className="inline-flex items-center rounded-full border border-transparent px-3 py-1 text-[11px] font-semibold"
                    style={paymentStatus.style}
                  >
                    {paymentStatus.label}
                  </span>
                </div>
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="bg-[#003882] text-white hover:bg-[#003882]"
                onClick={onGenerateOrUpdateInvoice}
                disabled={isInvoiceSaving || isWaitingForInvoiceResponse}
              >
                {isInvoiceSaving
                  ? "Saving..."
                  : isWaitingForInvoiceResponse
                    ? "Waiting for Xero..."
                    : "Generate/Update Invoice"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSendToCustomer}
                disabled={
                  isSendingToCustomer ||
                  !toLabel(activeJob?.invoice_url_client || activeJob?.Invoice_URL_Client)
                }
              >
                {isSendingToCustomer ? "Sending..." : "Send To Customer"}
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LinkButton href={activeJob?.xero_invoice_pdf || activeJob?.Xero_Invoice_PDF}>
                Download Invoice PDF
              </LinkButton>
              <LinkButton href={activeJob?.invoice_url_admin || activeJob?.Invoice_URL_Admin}>
                View Xero Invoice (Admin)
              </LinkButton>
              <LinkButton href={activeJob?.invoice_url_client || activeJob?.Invoice_URL_Client}>
                View Xero Invoice (Client)
              </LinkButton>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

export function ServiceProviderBillPanel({
  billStatus,
  serviceProviderSummary,
  providerRate,
  activeJob,
  accountSummary,
  billDate,
  billDueDate,
  onBillDateChange,
  onBillDueDateChange,
  billApprovedByAdmin,
  billActivityRows,
  tableHeaderCellClass,
  tableBodyCellClass,
  formatCurrency,
  materialSummary,
  materialsNetTotal,
  billSubtotal,
  billGst,
  billTotal,
  formatDateDisplay,
  billApprovalTimeLabel,
  onApproveBill,
  isBillSaving,
}) {
  return (
    <div className="min-w-0 space-y-4">
      <Card className="overflow-hidden border border-[var(--color-line)] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="h-1.5 w-full bg-[var(--color-primary)]" />
        <div className="space-y-4 p-4 md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <SectionTitle
              title="Service Provider Bill"
              subtitle="Service provider share of selected activities and materials"
            />
            <span
              className="inline-flex items-center rounded-full border border-transparent px-3 py-1 text-xs font-semibold"
              style={billStatus.style}
            >
              {billStatus.label}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <Card className="space-y-2 border-slate-200 bg-slate-50/55 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Bill From</div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Service Provider</span>
                  <span className="truncate font-medium text-slate-900">
                    {serviceProviderSummary.label}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Rate</span>
                  <span className="font-medium text-slate-900">{providerRate}%</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Bill Xero ID</span>
                  <span className="uid-text">
                    {toText(activeJob?.bill_xero_id || activeJob?.Bill_Xero_ID) || "--"}
                  </span>
                </div>
              </div>
            </Card>

            <Card className="space-y-2 border-slate-200 bg-slate-50/55 p-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Bill To</div>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Reference</span>
                  <span className="uid-text">
                    {toText(activeJob?.unique_id || activeJob?.Unique_ID) || "--"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Client</span>
                  <span className="truncate font-medium text-slate-900">{accountSummary.accountName}</span>
                </div>
                <div className="flex items-center justify-between gap-2 rounded border border-slate-200 bg-white px-3 py-2">
                  <span>Account Type</span>
                  <span className="font-medium text-slate-900">{accountSummary.accountType}</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <InputField
              label="Bill Date"
              type="date"
              data-field="bill_date"
              value={billDate}
              disabled={billApprovedByAdmin}
              onChange={(event) => onBillDateChange(event.target.value)}
            />
            <InputField
              label="Bill Due Date"
              type="date"
              data-field="bill_due_date"
              value={billDueDate}
              disabled={billApprovedByAdmin}
              onChange={(event) => onBillDueDateChange(event.target.value)}
            />
          </div>

          <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-700">Activity Share Line Items</div>
            <div className="w-full overflow-x-auto rounded border border-slate-200">
              <table className="w-full min-w-[740px] table-fixed text-left text-sm text-slate-600">
                <thead className="border-b border-slate-200 bg-slate-100/90">
                  <tr>
                    <th className={tableHeaderCellClass}>Service</th>
                    <th className={tableHeaderCellClass}>Task</th>
                    <th className={tableHeaderCellClass}>Option</th>
                    <th className={`text-right ${tableHeaderCellClass}`}>Provider Share</th>
                  </tr>
                </thead>
                <tbody>
                  {!billActivityRows.length ? (
                    <tr>
                      <td className="px-3 py-4 text-center text-slate-400" colSpan={4}>
                        No selected activity line items.
                      </td>
                    </tr>
                  ) : (
                    billActivityRows.map((row) => (
                      <tr key={`bill-row-${row.id}`} className="border-b border-slate-100 last:border-b-0">
                        <td className={`${tableBodyCellClass} text-slate-800`}>{row.service || "-"}</td>
                        <td className={`${tableBodyCellClass} text-slate-800`}>{row.task || "-"}</td>
                        <td className={`${tableBodyCellClass} text-slate-800`}>{row.option || "-"}</td>
                        <td className={`${tableBodyCellClass} text-right font-semibold text-slate-900`}>
                          {formatCurrency(row.amount)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2 rounded border border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-700">Materials Summary</div>
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Reimburse Total</span>
                <span className="font-medium">{formatCurrency(materialSummary.reimburse)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Deduct Total</span>
                <span className="font-medium">{formatCurrency(materialSummary.deduct)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                <span>Materials Net</span>
                <span className="font-semibold">{formatCurrency(materialsNetTotal)}</span>
              </div>
            </div>
          </div>

          <Card className="space-y-2 border-slate-200 bg-white p-3">
            <div className="text-sm font-semibold text-slate-700">Bill Totals</div>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex items-center justify-between">
                <span>Subtotal</span>
                <span className="font-medium">{formatCurrency(billSubtotal)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Includes GST</span>
                <span className="font-medium">{formatCurrency(billGst)}</span>
              </div>
              <div className="flex items-center justify-between border-t-2 border-slate-300 pt-2 text-base font-semibold text-slate-900">
                <span>Total</span>
                <span data-field="bill_total">{formatCurrency(billTotal)}</span>
              </div>
              <div className="text-xs text-slate-500">
                Last bill date: {formatDateDisplay(activeJob?.bill_date || activeJob?.Bill_Date)} | Due:{" "}
                {formatDateDisplay(activeJob?.bill_due_date || activeJob?.Bill_Due_Date)}
              </div>
              <div
                className={`text-xs font-semibold ${
                  billApprovedByAdmin ? "text-emerald-700" : "text-amber-700"
                }`}
              >
                {billApprovedByAdmin
                  ? billApprovalTimeLabel && billApprovalTimeLabel !== "-"
                    ? `Approved by admin on ${billApprovalTimeLabel}`
                    : "Approved by admin"
                  : "Waiting approval by admin"}
              </div>
            </div>
          </Card>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                size="sm"
                className="bg-[#003882] text-white hover:bg-[#003882]"
                onClick={onApproveBill}
                disabled={isBillSaving || billApprovedByAdmin}
              >
                {isBillSaving ? "Saving..." : billApprovedByAdmin ? "Approved by admin" : "Approve Bill"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
