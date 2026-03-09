import { useState } from "react";
import { DetailsCard } from "@shared/components/ui/DetailsCard.jsx";
import { CardField } from "@shared/components/ui/CardField.jsx";
import { SectionLoadingState } from "@shared/components/ui/SectionLoadingState.jsx";
import { ChevronDownIcon } from "@shared/components/icons/index.jsx";

export function AccountDetailsSection({
  isLoading = false,
  editDisabled = false,
  onEdit,
  onCopy,

  // Core
  safeUid = "",
  accountType = "",

  // Contact fields
  showContactDetails = false,
  hasAccountContactFields = false,
  accountContactName = "",
  accountContactEmail = "",
  accountContactEmailHref = "",
  accountContactPhone = "",
  accountContactPhoneHref = "",
  accountContactAddress = "",
  accountContactAddressHref = "",

  // Company fields
  showCompanyDetails = false,
  hasAccountCompanyFields = false,
  accountCompanyName = "",
  accountCompanyPhone = "",
  accountCompanyPhoneHref = "",
  accountCompanyPrimaryName = "",
  accountCompanyPrimaryEmail = "",
  accountCompanyPrimaryEmailHref = "",
  accountCompanyPrimaryPhone = "",
  accountCompanyPrimaryPhoneHref = "",
  accountCompanyAddress = "",
  accountCompanyAddressHref = "",

  // Body corp fields
  isBodyCorpAccount = false,
  hasBodyCorpDetails = false,
  accountBodyCorpName = "",
  accountBodyCorpType = "",
  accountBodyCorpPhone = "",
  accountBodyCorpPhoneHref = "",
  accountBodyCorpAddress = "",
  accountBodyCorpAddressHref = "",
}) {
  const [isBodyCorpDetailsOpen, setIsBodyCorpDetailsOpen] = useState(false);

  return (
    <DetailsCard title="Account Details" onEdit={onEdit} editDisabled={editDisabled}>
      {isLoading ? (
        <SectionLoadingState
          label="Loading account details"
          blocks={6}
          columnsClass="sm:grid-cols-2"
        />
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
            <CardField
              label="UID"
              value={safeUid}
              mono
              copyable
              copyValue={safeUid}
              onCopy={onCopy}
            />
            <CardField label="Account Type" value={accountType} />
          </div>

          {showContactDetails && hasAccountContactFields ? (
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              <CardField label="Contact Name" value={accountContactName} />
              <CardField
                label="Contact Email"
                value={accountContactEmail}
                href={accountContactEmailHref}
                copyable
                copyValue={accountContactEmail}
                onCopy={onCopy}
              />
              <CardField
                label="Contact Phone"
                value={accountContactPhone}
                href={accountContactPhoneHref}
                copyable
                copyValue={accountContactPhone}
                onCopy={onCopy}
              />
              <CardField
                label="Contact Address"
                value={accountContactAddress}
                href={accountContactAddressHref}
                openInNewTab
                copyable
                copyValue={accountContactAddressHref ? accountContactAddress : ""}
                onCopy={onCopy}
                className="sm:col-span-2"
              />
            </div>
          ) : null}

          {showCompanyDetails && hasAccountCompanyFields ? (
            <div className="grid grid-cols-1 gap-x-3 gap-y-2 sm:grid-cols-2">
              <CardField label="Company" value={accountCompanyName} />
              <CardField
                label="Company Phone"
                value={accountCompanyPhone}
                href={accountCompanyPhoneHref}
                copyable
                copyValue={accountCompanyPhone}
                onCopy={onCopy}
              />
              <CardField label="Company Primary" value={accountCompanyPrimaryName} />
              <CardField
                label="Primary Email"
                value={accountCompanyPrimaryEmail}
                href={accountCompanyPrimaryEmailHref}
                copyable
                copyValue={accountCompanyPrimaryEmail}
                onCopy={onCopy}
              />
              <CardField
                label="Primary Phone"
                value={accountCompanyPrimaryPhone}
                href={accountCompanyPrimaryPhoneHref}
                copyable
                copyValue={accountCompanyPrimaryPhone}
                onCopy={onCopy}
              />
              <CardField
                label="Company Address"
                value={accountCompanyAddress}
                href={accountCompanyAddressHref}
                openInNewTab
                copyable
                copyValue={accountCompanyAddressHref ? accountCompanyAddress : ""}
                onCopy={onCopy}
                className="sm:col-span-2"
              />
            </div>
          ) : null}

          {showCompanyDetails && isBodyCorpAccount && hasBodyCorpDetails ? (
            <div className="rounded border border-slate-200 bg-slate-50">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-2 py-2 text-left"
                onClick={() => setIsBodyCorpDetailsOpen((previous) => !previous)}
                aria-expanded={isBodyCorpDetailsOpen}
                aria-controls="body-corp-company-details"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Body Corp Company
                </span>
                <span
                  className={`text-slate-500 transition-transform ${
                    isBodyCorpDetailsOpen ? "rotate-180" : ""
                  }`}
                >
                  <ChevronDownIcon />
                </span>
              </button>
              {isBodyCorpDetailsOpen ? (
                <div
                  id="body-corp-company-details"
                  className="grid grid-cols-1 gap-x-3 gap-y-2 px-2 pb-2 sm:grid-cols-2"
                >
                  <CardField label="Body Corp Name" value={accountBodyCorpName} />
                  <CardField label="Body Corp Type" value={accountBodyCorpType} />
                  <CardField
                    label="Body Corp Phone"
                    value={accountBodyCorpPhone}
                    href={accountBodyCorpPhoneHref}
                    copyable
                    copyValue={accountBodyCorpPhone}
                    onCopy={onCopy}
                  />
                  <CardField
                    label="Body Corp Address"
                    value={accountBodyCorpAddress}
                    href={accountBodyCorpAddressHref}
                    openInNewTab
                    copyable
                    copyValue={accountBodyCorpAddressHref ? accountBodyCorpAddress : ""}
                    onCopy={onCopy}
                    className="sm:col-span-2"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {!hasAccountContactFields && !hasAccountCompanyFields && !hasBodyCorpDetails ? (
            <div className="text-sm text-slate-500">No account details available.</div>
          ) : null}
        </div>
      )}
    </DetailsCard>
  );
}
