import { useCallback, useEffect, useState } from "react";
import { useGoogleAddressLookup } from "../../../../shared/hooks/useGoogleAddressLookup.js";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { SelectField } from "../../../../shared/components/ui/SelectField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";

const STATE_OPTIONS = [
  { value: "NSW", label: "NSW" },
  { value: "QLD", label: "QLD" },
  { value: "VIC", label: "VIC" },
  { value: "TAS", label: "TAS" },
  { value: "SA", label: "SA" },
  { value: "ACT", label: "ACT" },
  { value: "NT", label: "NT" },
  { value: "WA", label: "WA" },
];

const COUNTRY_OPTIONS = [
  { value: "AU", label: "Australia" },
];

const COMPANY_TYPE_OPTIONS = [
  { value: "Family/Individual", label: "Family/Individual" },
  { value: "Business", label: "Business" },
];

const COMPANY_INDUSTRY_OPTIONS = [
  { value: "Education", label: "Education" },
  { value: "Telecom", label: "Telecom" },
  { value: "Software", label: "Software" },
  { value: "Automotive", label: "Automotive" },
  { value: "Hospitality", label: "Hospitality" },
  { value: "Accounting", label: "Accounting" },
  { value: "Restaurant", label: "Restaurant" },
  { value: "Printing", label: "Printing" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Engineering", label: "Engineering" },
  { value: "Healthcare", label: "Healthcare" },
  { value: "Food + Agriculture", label: "Food + Agriculture" },
  { value: "Insurance", label: "Insurance" },
  { value: "Pharma", label: "Pharma" },
  { value: "Clothing", label: "Clothing" },
  { value: "Marketing + Advertising", label: "Marketing + Advertising" },
  { value: "Retail", label: "Retail" },
  { value: "Real Estate", label: "Real Estate" },
  { value: "Transport", label: "Transport" },
  { value: "Construction", label: "Construction" },
  { value: "Finance", label: "Finance" },
  { value: "Manufacturing", label: "Manufacturing" },
];

const COMPANY_ACCOUNT_TYPE_OPTIONS = [
  { value: "Body Corp", label: "Body Corp" },
  { value: "Body Corp Company", label: "Body Corp Company" },
  { value: "Business & Gov", label: "Business & Gov" },
  { value: "Closed Real Estate", label: "Closed Real Estate" },
  { value: "School/Childcare", label: "School/Childcare" },
  { value: "Real Estate Agent", label: "Real Estate Agent" },
  { value: "Tenant to Pay", label: "Tenant to Pay" },
  { value: "Wildlife Rescue", label: "Wildlife Rescue" },
];

const COMPANY_ANNUAL_REVENUE_OPTIONS = [
  { value: "> 100m", label: "> 100m" },
  { value: "50m - 100m", label: "50m - 100m" },
  { value: "20m - 50m", label: "20m - 50m" },
  { value: "5m - 20m", label: "5m - 20m" },
  { value: "1m - 5m", label: "1m - 5m" },
  { value: "< 1m", label: "< 1m" },
];

const COMPANY_EMPLOYEE_COUNT_OPTIONS = [
  { value: "< 10", label: "< 10" },
  { value: "10 - 50", label: "10 - 50" },
  { value: "50 - 200", label: "50 - 200" },
  { value: "200 - 1000", label: "200 - 1000" },
  { value: "1000 +", label: "1000 +" },
];

const INITIAL_FORM = {
  company_name: "",
  company_type: "",
  company_description: "",
  company_phone: "",
  company_address: "",
  company_city: "",
  company_state: "",
  company_postal_code: "",
  company_industry: "",
  company_annual_revenue: "",
  company_number_of_employees: "",
  company_account_type: "",
  popup_comment: "",

  first_name: "",
  last_name: "",
  email: "",
  sms_number: "",

  lot_number: "",
  unit_number: "",
  address: "",
  city: "",
  state: "",
  zip_code: "",
  country: "AU",

  postal_address: "",
  postal_city: "",
  postal_state: "",
  postal_country: "AU",
  postal_code: "",
};

const ADDRESS_TO_POSTAL_FIELD = {
  address: "postal_address",
  city: "postal_city",
  state: "postal_state",
  country: "postal_country",
  zip_code: "postal_code",
};

function copyAddressIntoPostal(form) {
  return {
    ...form,
    postal_address: form.address || "",
    postal_city: form.city || "",
    postal_state: form.state || "",
    postal_country: form.country || "",
    postal_code: form.zip_code || "",
  };
}

function trimValue(value) {
  return String(value || "").trim();
}

function AccordionSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded border border-slate-200 bg-white">
      <button
        type="button"
        className={`flex w-full items-center justify-between bg-[color:var(--color-light)] px-4 py-3 text-left transition-colors hover:bg-[#eaf0f7] ${
          isOpen ? "rounded-t" : "rounded"
        }`}
        onClick={onToggle}
      >
        <span className="type-subheadline-2 text-slate-800">{title}</span>
        <span
          className={`inline-block text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          ▼
        </span>
      </button>
      {isOpen ? <div className="border-t border-slate-200 p-4">{children}</div> : null}
    </section>
  );
}

export function ContactDetailsModal({ open, onClose, mode = "individual", onSave }) {
  const { error: showErrorToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [sameAsAddress, setSameAsAddress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [openSections, setOpenSections] = useState({
    company: true,
    companyAddress: true,
    basic: true,
    address: true,
    postal: true,
  });
  const isEntity = mode === "entity";

  useEffect(() => {
    if (!open) return;
    setIsSaving(false);
    setSaveError("");
    setSameAsAddress(false);
    setOpenSections({
      company: true,
      companyAddress: true,
      basic: true,
      address: true,
      postal: true,
    });
    setForm({
      ...INITIAL_FORM,
      country: "AU",
      postal_country: "AU",
    });
  }, [open, isEntity]);

  const updateField =
    (field, { syncToPostal = false } = {}) =>
    (event) => {
      const nextValue = event.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: nextValue };
        if (sameAsAddress && syncToPostal) {
          const postalField = ADDRESS_TO_POSTAL_FIELD[field];
          if (postalField) next[postalField] = nextValue;
        }
        return next;
      });
    };

  const handleAddressLookupSelected = useCallback(
    (parsed) => {
      setForm((prev) => {
        let next = {
          ...prev,
          lot_number: parsed.lot_number || prev.lot_number,
          unit_number: parsed.unit_number || prev.unit_number,
          address: parsed.address || prev.address,
          city: parsed.city || prev.city,
          state: parsed.state || prev.state,
          zip_code: parsed.zip_code || prev.zip_code,
          country: "AU",
        };

        if (sameAsAddress) next = copyAddressIntoPostal(next);
        return next;
      });
    },
    [sameAsAddress]
  );

  const handleCompanyAddressLookupSelected = useCallback((parsed) => {
    setForm((prev) => ({
      ...prev,
      company_address: parsed.address || prev.company_address,
      company_city: parsed.city || prev.company_city,
      company_state: parsed.state || prev.company_state,
      company_postal_code: parsed.zip_code || prev.company_postal_code,
    }));
  }, []);

  const individualAddressLookupRef = useGoogleAddressLookup({
    enabled: open && !isEntity,
    country: "au",
    onAddressSelected: handleAddressLookupSelected,
  });

  const companyAddressLookupRef = useGoogleAddressLookup({
    enabled: open && isEntity,
    country: "au",
    onAddressSelected: handleCompanyAddressLookupSelected,
  });

  const handleSameAsAddressChange = (event) => {
    const checked = event.target.checked;
    setSameAsAddress(checked);
    if (!checked) return;
    setForm((prev) => copyAddressIntoPostal(prev));
  };

  const handleSave = async () => {
    if (isSaving) return;

    if (typeof onSave !== "function") {
      onClose?.();
      return;
    }

    const contactPayload = {
      first_name: trimValue(form.first_name),
      last_name: trimValue(form.last_name),
      email: trimValue(form.email),
      sms_number: trimValue(form.sms_number),

      lot_number: trimValue(form.lot_number),
      unit_number: trimValue(form.unit_number),
      address: trimValue(form.address),
      city: trimValue(form.city),
      state: trimValue(form.state),
      zip_code: trimValue(form.zip_code),
      country: trimValue(form.country),

      postal_address: trimValue(form.postal_address),
      postal_city: trimValue(form.postal_city),
      postal_state: trimValue(form.postal_state),
      postal_country: trimValue(form.postal_country),
      postal_code: trimValue(form.postal_code),
    };

    if (isEntity) {
      const companyName = trimValue(form.company_name);
      if (!companyName) {
        const message = "Company name is required.";
        setSaveError(message);
        showErrorToast("Save failed", message);
        return;
      }

      setIsSaving(true);
      setSaveError("");
      try {
        await onSave({
          type: trimValue(form.company_type),
          name: companyName,
          description: trimValue(form.company_description),
          phone: trimValue(form.company_phone),
          address: trimValue(form.company_address),
          city: trimValue(form.company_city),
          state: trimValue(form.company_state),
          postal_code: trimValue(form.company_postal_code),
          industry: trimValue(form.company_industry),
          annual_revenue: trimValue(form.company_annual_revenue),
          number_of_employees: trimValue(form.company_number_of_employees),
          account_type: trimValue(form.company_account_type),
          popup_comment: trimValue(form.popup_comment),
          Primary_Person: {
            first_name: trimValue(form.first_name),
            last_name: trimValue(form.last_name),
            email: trimValue(form.email),
            sms_number: trimValue(form.sms_number),
          },
        });
        onClose?.();
      } catch (error) {
        console.error("[JobDirect] Entity save failed", error);
        const message = error?.message || "Unable to save entity right now.";
        setSaveError(message);
        showErrorToast("Save failed", message);
      } finally {
        setIsSaving(false);
      }
      return;
    }

    setIsSaving(true);
    setSaveError("");
    try {
      await onSave(contactPayload);
      onClose?.();
    } catch (error) {
      console.error("[JobDirect] Contact save failed", error);
      const message = error?.message || "Unable to save contact right now.";
      setSaveError(message);
      showErrorToast("Save failed", message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEntity ? "Add Entity" : "Add Contact"}
      widthClass="max-w-5xl max-h-[calc(100vh-4rem)] my-8 overflow-hidden"
      footer={
        <div className="flex justify-end gap-2">
          {saveError ? (
            <div className="mr-auto self-center text-xs text-[color:var(--color-danger)]">
              {saveError}
            </div>
          ) : null}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : isEntity ? "Save Entity" : "Save Contact"}
          </Button>
        </div>
      }
    >
      <div className="max-h-[calc(100vh-20rem)] space-y-4 overflow-y-auto pr-1">
        {isEntity ? (
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
              <InputField
                label="Name"
                value={form.company_name}
                onChange={updateField("company_name")}
                data-contact-field="company_name"
              />
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
        ) : null}

        {isEntity ? (
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
        ) : null}

        <AccordionSection
          title={isEntity ? "Primary Person" : "Basic Information"}
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
            <InputField
              label="Email"
              value={form.email}
              onChange={updateField("email")}
              data-contact-field="email"
            />
            <InputField
              label="SMS Number"
              value={form.sms_number}
              onChange={updateField("sms_number")}
              data-contact-field="sms_number"
            />
          </div>
        </AccordionSection>

        {!isEntity ? (
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
        ) : null}

        {!isEntity ? (
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
        ) : null}
      </div>
    </Modal>
  );
}
