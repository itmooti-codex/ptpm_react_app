export { ClientInvoicePanel } from "./ClientInvoicePanel.jsx";

import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { InputField } from "../../../../../shared/components/ui/InputField.jsx";
import { toText } from "@shared/utils/formatters.js";

function SectionTitle({ title, subtitle }) {
  return (
    <div className="space-y-1">
      <h3 className="type-subheadline text-slate-800">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
}

export function ServiceProviderBillPanel({
  billStatus,
  serviceProviderSummary,
  providerRate,
  activeJob,
  accountSummary: _accountSummary,
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
              <div className="space-y-2 rounded border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <div className="text-sm font-semibold text-slate-900">
                  Peter The Possum and Bird Man
                </div>
                <div>
                  <span className="font-medium text-slate-800">Phone: </span>
                  <a href="tel:0420908066" className="text-blue-700 hover:underline">
                    0420908066
                  </a>
                </div>
                <div>
                  <span className="font-medium text-slate-800">ABN: </span>
                  --
                </div>
                <div>
                  <span className="font-medium text-slate-800">Address: </span>
                  13 Parakeet Pl Mullumbimby NSW, 2482 Australia
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
