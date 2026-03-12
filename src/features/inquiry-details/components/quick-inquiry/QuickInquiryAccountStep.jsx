import { InputField } from "../../../../shared/components/ui/InputField.jsx";

export function QuickInquiryAccountStep({
  accountMode,
  companyForm,
  companyMatchState,
  companyAddressLookupRef,
  contactMatchState,
  individualAddressLookupRef,
  individualForm,
  matchMessageClassByStatus,
  setAccountMode,
  setCompanyForm,
  setIndividualForm,
  setShowCompanyOptional,
  setShowIndividualOptional,
  showCompanyOptional,
  showIndividualOptional,
}) {
  return (
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-600">
        Are you an individual or company?
      </div>
      <div className="mb-3 inline-flex rounded border border-slate-300 p-0.5">
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs font-semibold ${
            accountMode === "individual"
              ? "bg-[#003882] text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setAccountMode("individual")}
        >
          Individual
        </button>
        <button
          type="button"
          className={`rounded px-3 py-1 text-xs font-semibold ${
            accountMode === "company"
              ? "bg-[#003882] text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setAccountMode("company")}
        >
          Company
        </button>
      </div>

      {accountMode === "individual" ? (
        <div className="space-y-2">
          <InputField
            label="Email"
            field="quick_individual_email"
            value={individualForm.email}
            onChange={(event) =>
              setIndividualForm((previous) => ({
                ...previous,
                email: event.target.value,
              }))
            }
            placeholder="Enter email"
          />
          {contactMatchState.message ? (
            <div
              className={`text-xs ${
                matchMessageClassByStatus[contactMatchState.status] || "text-slate-500"
              }`}
            >
              {contactMatchState.message}
            </div>
          ) : null}
          <button
            type="button"
            className="text-xs font-medium text-sky-700 underline underline-offset-2"
            onClick={() => setShowIndividualOptional((previous) => !previous)}
          >
            {showIndividualOptional ? "Hide optional details" : "Add optional details"}
          </button>

          {showIndividualOptional ? (
            <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
              <InputField
                label="First Name"
                field="quick_individual_first_name"
                value={individualForm.first_name}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    first_name: event.target.value,
                  }))
                }
              />
              <InputField
                label="Last Name"
                field="quick_individual_last_name"
                value={individualForm.last_name}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    last_name: event.target.value,
                  }))
                }
              />
              <InputField
                label="SMS Number"
                field="quick_individual_phone"
                value={individualForm.sms_number}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    sms_number: event.target.value,
                  }))
                }
              />
              <InputField
                label="Address (Google Lookup)"
                field="quick_individual_address"
                inputRef={individualAddressLookupRef}
                value={individualForm.address}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    address: event.target.value,
                  }))
                }
              />
              <InputField
                label="City"
                field="quick_individual_city"
                value={individualForm.city}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    city: event.target.value,
                  }))
                }
              />
              <InputField
                label="State"
                field="quick_individual_state"
                value={individualForm.state}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    state: event.target.value,
                  }))
                }
              />
              <InputField
                label="Postal Code"
                field="quick_individual_zip_code"
                value={individualForm.zip_code}
                onChange={(event) =>
                  setIndividualForm((previous) => ({
                    ...previous,
                    zip_code: event.target.value,
                  }))
                }
              />
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2">
          <InputField
            label="Company Name"
            field="quick_company_name"
            value={companyForm.company_name}
            onChange={(event) =>
              setCompanyForm((previous) => ({
                ...previous,
                company_name: event.target.value,
              }))
            }
            placeholder="Enter company name"
          />
          {companyMatchState.message ? (
            <div
              className={`text-xs ${
                matchMessageClassByStatus[companyMatchState.status] || "text-slate-500"
              }`}
            >
              {companyMatchState.message}
            </div>
          ) : null}
          <button
            type="button"
            className="text-xs font-medium text-sky-700 underline underline-offset-2"
            onClick={() => setShowCompanyOptional((previous) => !previous)}
          >
            {showCompanyOptional ? "Hide optional details" : "Add optional details"}
          </button>
          {showCompanyOptional ? (
            <div className="grid grid-cols-1 gap-2 rounded border border-slate-200 bg-slate-50 p-2 sm:grid-cols-2">
              <InputField
                label="SMS Number"
                field="quick_company_phone"
                value={companyForm.company_phone}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_phone: event.target.value,
                  }))
                }
              />
              <InputField
                label="Address (Google Lookup)"
                field="quick_company_address"
                inputRef={companyAddressLookupRef}
                value={companyForm.company_address}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_address: event.target.value,
                  }))
                }
              />
              <InputField
                label="City"
                field="quick_company_city"
                value={companyForm.company_city}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_city: event.target.value,
                  }))
                }
              />
              <InputField
                label="State"
                field="quick_company_state"
                value={companyForm.company_state}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_state: event.target.value,
                  }))
                }
              />
              <InputField
                label="Postal Code"
                field="quick_company_postal_code"
                value={companyForm.company_postal_code}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_postal_code: event.target.value,
                  }))
                }
              />
              <InputField
                label="Account Type"
                field="quick_company_account_type"
                value={companyForm.company_account_type}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    company_account_type: event.target.value,
                  }))
                }
                placeholder="Business / Body Corp / Other"
              />
              <InputField
                label="Primary First Name"
                field="quick_company_primary_first_name"
                value={companyForm.primary_first_name}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    primary_first_name: event.target.value,
                  }))
                }
              />
              <InputField
                label="Primary Last Name"
                field="quick_company_primary_last_name"
                value={companyForm.primary_last_name}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    primary_last_name: event.target.value,
                  }))
                }
              />
              <InputField
                label="Primary Email"
                field="quick_company_primary_email"
                value={companyForm.primary_email}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    primary_email: event.target.value,
                  }))
                }
              />
              <InputField
                label="Primary Phone"
                field="quick_company_primary_phone"
                value={companyForm.primary_sms_number}
                onChange={(event) =>
                  setCompanyForm((previous) => ({
                    ...previous,
                    primary_sms_number: event.target.value,
                  }))
                }
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
