import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import {
  STATE_OPTIONS,
  COMPANY_TYPE_OPTIONS,
  COMPANY_INDUSTRY_OPTIONS,
  COMPANY_ACCOUNT_TYPE_OPTIONS,
  COMPANY_ANNUAL_REVENUE_OPTIONS,
  COMPANY_EMPLOYEE_COUNT_OPTIONS,
} from "./contactDetailsSchema.js";
import { trimValue } from "./contactDetailsUtils.js";
import { AccordionSection } from "./AccordionSection.jsx";

export function ContactEntityFields({
  form,
  updateField,
  openSections,
  setOpenSections,
  companyAddressLookupRef,
  useTopLookupSearch,
  enableInlineDuplicateLookup,
  isCompanyLookupLoading,
  existingCompanyRecord,
  existingPrimaryPersonRecord,
  isPrimaryPersonLookupLoading,
}) {
  return (
    <>
      <AccordionSection
        title="Company Details"
        isOpen={openSections.company}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            company: !prev.company,
          }))
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <InputField
              label="Name"
              value={form.company_name}
              onChange={updateField("company_name")}
              data-contact-field="company_name"
            />
            {!useTopLookupSearch ? (
              <div
                className={`mt-1 text-xs ${
                  trimValue(existingCompanyRecord?.id || existingCompanyRecord?.ID)
                    ? "text-amber-700"
                    : "text-slate-500"
                }`}
              >
                {isCompanyLookupLoading
                  ? "Searching company..."
                  : trimValue(existingCompanyRecord?.id || existingCompanyRecord?.ID)
                  ? "Company already exists. Form is prefilled with existing details."
                  : "Type company name to search existing company or add a new one."}
              </div>
            ) : null}
          </div>
          <SelectField
            label="Type"
            options={COMPANY_TYPE_OPTIONS}
            value={form.company_type}
            onChange={updateField("company_type")}
            data-contact-field="company_type"
          />
          <SelectField
            label="Account Type"
            options={COMPANY_ACCOUNT_TYPE_OPTIONS}
            value={form.company_account_type}
            onChange={updateField("company_account_type")}
            data-contact-field="company_account_type"
          />
          <SelectField
            label="Industry"
            options={COMPANY_INDUSTRY_OPTIONS}
            value={form.company_industry}
            onChange={updateField("company_industry")}
            data-contact-field="company_industry"
          />
          <InputField
            label="Phone"
            value={form.company_phone}
            onChange={updateField("company_phone")}
            data-contact-field="company_phone"
          />
          <SelectField
            label="Annual Revenue"
            options={COMPANY_ANNUAL_REVENUE_OPTIONS}
            value={form.company_annual_revenue}
            onChange={updateField("company_annual_revenue")}
            data-contact-field="company_annual_revenue"
          />
          <SelectField
            label="Number of Employees"
            options={COMPANY_EMPLOYEE_COUNT_OPTIONS}
            value={form.company_number_of_employees}
            onChange={updateField("company_number_of_employees")}
            data-contact-field="company_number_of_employees"
          />
          <InputField
            label="Description"
            value={form.company_description}
            onChange={updateField("company_description")}
            data-contact-field="company_description"
          />
          <InputField
            label="Popup Comment"
            value={form.popup_comment}
            onChange={updateField("popup_comment")}
            className="md:col-span-2"
            data-contact-field="popup_comment"
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="Company Address"
        isOpen={openSections.companyAddress}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            companyAddress: !prev.companyAddress,
          }))
        }
      >
        <InputField
          label="Address Lookup"
          placeholder="Search address"
          inputRef={companyAddressLookupRef}
          data-contact-field="company_address_lookup"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Address"
            value={form.company_address}
            onChange={updateField("company_address")}
            className="md:col-span-2"
            data-contact-field="company_address"
          />
          <InputField
            label="City"
            value={form.company_city}
            onChange={updateField("company_city")}
            data-contact-field="company_city"
          />
          <SelectField
            label="State"
            options={STATE_OPTIONS}
            value={form.company_state}
            onChange={updateField("company_state")}
            data-contact-field="company_state"
          />
          <InputField
            label="Postal Code"
            value={form.company_postal_code}
            onChange={updateField("company_postal_code")}
            data-contact-field="company_postal_code"
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="Primary Person"
        isOpen={openSections.basic}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            basic: !prev.basic,
          }))
        }
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="First Name"
            value={form.first_name}
            onChange={updateField("first_name")}
            data-contact-field="first_name"
          />
          <InputField
            label="Last Name"
            value={form.last_name}
            onChange={updateField("last_name")}
            data-contact-field="last_name"
          />
          <div>
            <InputField
              label="Email"
              value={form.email}
              onChange={updateField("email")}
              data-contact-field="email"
            />
            {enableInlineDuplicateLookup ? (
              <div
                className={`mt-1 text-xs ${
                  trimValue(
                    existingPrimaryPersonRecord?.id ||
                      existingPrimaryPersonRecord?.ID ||
                      existingPrimaryPersonRecord?.Contact_ID
                  )
                    ? "text-amber-700"
                    : "text-slate-500"
                }`}
              >
                {isPrimaryPersonLookupLoading
                  ? "Searching contact..."
                  : trimValue(
                  existingPrimaryPersonRecord?.id ||
                    existingPrimaryPersonRecord?.ID ||
                    existingPrimaryPersonRecord?.Contact_ID
                )
                  ? "Email already exists."
                  : "Primary person email for this entity."}
              </div>
            ) : null}
          </div>
          <div>
            <InputField
              label="SMS Number"
              value={form.sms_number}
              onChange={updateField("sms_number")}
              data-contact-field="sms_number"
            />
          </div>
        </div>
      </AccordionSection>
    </>
  );
}
