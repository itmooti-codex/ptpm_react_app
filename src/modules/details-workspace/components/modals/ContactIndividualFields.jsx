import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { STATE_OPTIONS, COUNTRY_OPTIONS } from "./contactDetailsSchema.js";
import { trimValue } from "./contactDetailsUtils.js";
import { AccordionSection } from "./AccordionSection.jsx";

export function ContactIndividualFields({
  form,
  updateField,
  openSections,
  setOpenSections,
  sameAsAddress,
  handleSameAsAddressChange,
  individualAddressLookupRef,
  enableInlineDuplicateLookup,
  isContactLookupLoading,
  existingContactRecord,
}) {
  return (
    <>
      <AccordionSection
        title="Basic Information"
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
                    existingContactRecord?.id ||
                      existingContactRecord?.ID ||
                      existingContactRecord?.Contact_ID
                  )
                    ? "text-amber-700"
                    : "text-slate-500"
                }`}
              >
                {isContactLookupLoading
                  ? "Searching contact..."
                  : trimValue(
                  existingContactRecord?.id ||
                    existingContactRecord?.ID ||
                    existingContactRecord?.Contact_ID
                )
                  ? "Email already exists."
                  : "Type email to search existing contact or add a new one."}
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

      <AccordionSection
        title="Address"
        isOpen={openSections.address}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            address: !prev.address,
          }))
        }
      >
        <InputField
          label="Address Lookup"
          placeholder="Search address"
          inputRef={individualAddressLookupRef}
          data-contact-field="address_lookup"
        />
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Lot Number"
            value={form.lot_number}
            onChange={updateField("lot_number")}
            data-contact-field="lot_number"
          />
          <InputField
            label="Unit Number"
            value={form.unit_number}
            onChange={updateField("unit_number")}
            data-contact-field="unit_number"
          />
          <InputField
            label="Address"
            value={form.address}
            onChange={updateField("address", { syncToPostal: true })}
            data-contact-field="address"
          />
          <InputField
            label="City"
            value={form.city}
            onChange={updateField("city", { syncToPostal: true })}
            data-contact-field="city"
          />
          <SelectField
            label="State"
            options={STATE_OPTIONS}
            value={form.state}
            onChange={updateField("state", { syncToPostal: true })}
            data-contact-field="state"
          />
          <InputField
            label="Postcode"
            value={form.zip_code}
            onChange={updateField("zip_code", { syncToPostal: true })}
            data-contact-field="zip_code"
          />
          <SelectField
            label="Country"
            options={COUNTRY_OPTIONS}
            value={form.country}
            onChange={updateField("country", { syncToPostal: true })}
            data-contact-field="country"
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="Postal Address"
        isOpen={openSections.postal}
        onToggle={() =>
          setOpenSections((prev) => ({
            ...prev,
            postal: !prev.postal,
          }))
        }
      >
        <CheckboxField
          label="Same as address"
          checked={sameAsAddress}
          onChange={handleSameAsAddressChange}
          data-contact-field="postal_same_as_address"
        />

        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Postal Address"
            value={form.postal_address}
            onChange={updateField("postal_address")}
            disabled={sameAsAddress}
            data-contact-field="postal_address"
          />
          <InputField
            label="Postal City"
            value={form.postal_city}
            onChange={updateField("postal_city")}
            disabled={sameAsAddress}
            data-contact-field="postal_city"
          />
          <SelectField
            label="Postal State"
            options={STATE_OPTIONS}
            value={form.postal_state}
            onChange={updateField("postal_state")}
            disabled={sameAsAddress}
            data-contact-field="postal_state"
          />
          <InputField
            label="Postal Postcode"
            value={form.postal_code}
            onChange={updateField("postal_code")}
            disabled={sameAsAddress}
            data-contact-field="postal_code"
          />
          <SelectField
            label="Postal Country"
            options={COUNTRY_OPTIONS}
            value={form.postal_country}
            onChange={updateField("postal_country")}
            disabled={sameAsAddress}
            data-contact-field="postal_country"
          />
        </div>
      </AccordionSection>
    </>
  );
}
