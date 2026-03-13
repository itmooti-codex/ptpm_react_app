import { useCallback, useEffect, useRef, useState } from "react";
import { useGoogleAddressLookup } from "../../../../shared/hooks/useGoogleAddressLookup.js";
import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { useToast } from "../../../../shared/providers/ToastProvider.jsx";
import { SearchDropdownInput } from "../sections/job-information/JobInfoFormFields.jsx";
import {
  INITIAL_FORM,
  ADDRESS_TO_POSTAL_FIELD,
} from "./contactDetailsSchema.js";
import {
  trimValue,
  copyAddressIntoPostal,
  buildContactSearchValue,
  buildCompanySearchValue,
  compactStringFields,
} from "./contactDetailsUtils.js";
import { useContactDetailsLookups } from "./useContactDetailsLookups.js";
import { ContactIndividualFields } from "./ContactIndividualFields.jsx";
import { ContactEntityFields } from "./ContactEntityFields.jsx";
import { AccordionSection } from "./AccordionSection.jsx";

export function ContactDetailsModal({
  open,
  onClose,
  mode = "individual",
  onSave,
  plugin = null,
  onModeChange = null,
  allowModeSwitch = false,
  titleVerb = "Add",
  initialValues = null,
  saveOnLookupSelect = false,
  useTopLookupSearch = false,
  enableInlineDuplicateLookup = false,
}) {
  const { error: showErrorToast } = useToast();
  const [form, setForm] = useState(INITIAL_FORM);
  const [sameAsAddress, setSameAsAddress] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [companySearch, setCompanySearch] = useState("");
  const [existingContactRecord, setExistingContactRecord] = useState(null);
  const [existingCompanyRecord, setExistingCompanyRecord] = useState(null);
  const [isContactLookupLoading, setIsContactLookupLoading] = useState(false);
  const [isCompanyLookupLoading, setIsCompanyLookupLoading] = useState(false);
  const [openSections, setOpenSections] = useState({
    company: true,
    companyAddress: true,
    basic: true,
    address: true,
    postal: true,
  });
  const [lookupContacts, setLookupContacts] = useState([]);
  const [lookupCompanies, setLookupCompanies] = useState([]);
  const [isLookupLoading, setIsLookupLoading] = useState(false);
  const [isLookupSearching, setIsLookupSearching] = useState(false);
  const [selectedLookupContact, setSelectedLookupContact] = useState({ id: "", email: "" });
  const [selectedPrimaryPersonContact, setSelectedPrimaryPersonContact] = useState({ id: "", email: "" });
  const existingLookupRef = useRef({ requestKey: "", matchedId: "" });
  const companyLookupRef = useRef({ requestKey: "", matchedId: "" });
  const primaryPersonLookupRef = useRef({ requestKey: "", matchedId: "" });
  const [existingPrimaryPersonRecord, setExistingPrimaryPersonRecord] = useState(null);
  const [isPrimaryPersonLookupLoading, setIsPrimaryPersonLookupLoading] = useState(false);
  const isEntity = mode === "entity";

  // Reset state when modal opens
  useEffect(() => {
    if (!open) return;
    setIsSaving(false);
    setSaveError("");
    setSameAsAddress(false);
    setOpenSections({ company: true, companyAddress: true, basic: true, address: true, postal: true });
    setSelectedLookupContact({ id: "", email: "" });
    const resolvedInitialValues =
      initialValues && typeof initialValues === "object" ? initialValues : {};
    setSelectedPrimaryPersonContact({
      id: trimValue(
        resolvedInitialValues?.primary_person_contact_id ||
          resolvedInitialValues?.primary_contact_id ||
          resolvedInitialValues?.Primary_Contact_ID
      ),
      email: trimValue(resolvedInitialValues?.email || resolvedInitialValues?.Email),
    });
    setExistingContactRecord(null);
    setExistingCompanyRecord(null);
    setIsContactLookupLoading(false);
    setIsCompanyLookupLoading(false);
    setExistingPrimaryPersonRecord(null);
    setIsPrimaryPersonLookupLoading(false);
    existingLookupRef.current = { requestKey: "", matchedId: "" };
    companyLookupRef.current = { requestKey: "", matchedId: "" };
    primaryPersonLookupRef.current = { requestKey: "", matchedId: "" };
    setForm({ ...INITIAL_FORM, country: "AU", postal_country: "AU", ...resolvedInitialValues });
    setContactSearch(buildContactSearchValue(resolvedInitialValues));
    setCompanySearch(buildCompanySearchValue(resolvedInitialValues));
  }, [open, isEntity, initialValues]);

  const { searchContacts, searchCompanies, handleContactLookupSelect, handleCompanyLookupSelect, contactItems, companyItems } =
    useContactDetailsLookups({
      open,
      isEntity,
      plugin,
      useTopLookupSearch,
      enableInlineDuplicateLookup,
      saveOnLookupSelect,
      onSave,
      form,
      setForm,
      setContactSearch,
      setCompanySearch,
      lookupContacts,
      lookupCompanies,
      setLookupContacts,
      setLookupCompanies,
      setIsLookupLoading,
      setIsLookupSearching,
      setIsContactLookupLoading,
      setIsCompanyLookupLoading,
      setIsPrimaryPersonLookupLoading,
      setExistingContactRecord,
      setExistingCompanyRecord,
      setExistingPrimaryPersonRecord,
      setSelectedLookupContact,
      setSelectedPrimaryPersonContact,
      selectedLookupContact,
      isSaving,
      setIsSaving,
      setSaveError,
      onClose,
      showErrorToast,
      existingLookupRef,
      companyLookupRef,
      primaryPersonLookupRef,
    });

  const updateField =
    (field, { syncToPostal = false } = {}) =>
    (event) => {
      const nextValue = event.target.value;
      setForm((prev) => {
        const next = { ...prev, [field]: nextValue };
        if (
          useTopLookupSearch &&
          !isEntity &&
          field === "email" &&
          trimValue(selectedLookupContact.id) &&
          trimValue(prev.id) === trimValue(selectedLookupContact.id)
        ) {
          const previousSelectedEmail = trimValue(selectedLookupContact.email).toLowerCase();
          const currentEmail = trimValue(nextValue).toLowerCase();
          if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
            next.id = "";
          }
        }
        if (sameAsAddress && syncToPostal) {
          const postalField = ADDRESS_TO_POSTAL_FIELD[field];
          if (postalField) next[postalField] = nextValue;
        }
        return next;
      });
      if (useTopLookupSearch && !isEntity && field === "email" && trimValue(selectedLookupContact.id)) {
        const previousSelectedEmail = trimValue(selectedLookupContact.email).toLowerCase();
        const currentEmail = trimValue(nextValue).toLowerCase();
        if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
          setSelectedLookupContact({ id: "", email: "" });
        }
      }
      if (isEntity && field === "email" && trimValue(selectedPrimaryPersonContact.id)) {
        const previousSelectedEmail = trimValue(selectedPrimaryPersonContact.email).toLowerCase();
        const currentEmail = trimValue(nextValue).toLowerCase();
        if (previousSelectedEmail && previousSelectedEmail !== currentEmail) {
          setSelectedPrimaryPersonContact({ id: "", email: "" });
          setExistingPrimaryPersonRecord(null);
        }
      }
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

  // Keep lookup inputs in sync with form address fields (handles both initial load and contact prefill)
  useEffect(() => {
    const addr = [form.address, form.city, form.state, form.zip_code].filter(Boolean).join(", ");
    if (individualAddressLookupRef.current) individualAddressLookupRef.current.value = addr;
  }, [form.address, form.city, form.state, form.zip_code, individualAddressLookupRef]);

  useEffect(() => {
    const addr = [form.company_address, form.company_city, form.company_state, form.company_postal_code].filter(Boolean).join(", ");
    if (companyAddressLookupRef.current) companyAddressLookupRef.current.value = addr;
  }, [form.company_address, form.company_city, form.company_state, form.company_postal_code, companyAddressLookupRef]);

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
      id: trimValue(form.id),
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
      const primaryPersonPayload = compactStringFields({
        id: trimValue(selectedPrimaryPersonContact?.id || form.primary_person_contact_id),
        first_name: trimValue(form.first_name),
        last_name: trimValue(form.last_name),
        email: trimValue(form.email),
        sms_number: trimValue(form.sms_number),
      });
      const entityPayload = {
        id: trimValue(form.id),
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
        ...(Object.keys(primaryPersonPayload).length ? { Primary_Person: primaryPersonPayload } : {}),
      };
      setIsSaving(true);
      setSaveError("");
      try {
        await onSave(entityPayload, { mode: "entity" });
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
      await onSave(contactPayload, { mode: "individual" });
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

  const resolvedTitleVerb = trimValue(titleVerb) || "Add";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEntity ? `${resolvedTitleVerb} Entity` : `${resolvedTitleVerb} Contact`}
      widthClass="max-w-5xl max-h-[calc(100vh-4rem)] my-8 overflow-hidden"
      zIndexClass="z-[80]"
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
        {allowModeSwitch && typeof onModeChange === "function" ? (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`rounded-xl border px-2 py-1 text-xs ${
                !isEntity
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
              onClick={() => { setSaveError(""); onModeChange?.("individual"); }}
              disabled={isSaving}
            >
              Individual
            </button>
            <button
              type="button"
              className={`rounded-xl border px-2 py-1 text-xs ${
                isEntity
                  ? "border-sky-900 bg-[#003882] text-white"
                  : "border-slate-300 bg-white text-slate-500"
              }`}
              onClick={() => { setSaveError(""); onModeChange?.("entity"); }}
              disabled={isSaving}
            >
              Entity
            </button>
          </div>
        ) : null}

        {useTopLookupSearch ? (
          isEntity ? (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <SearchDropdownInput
                label="Search Existing Entity"
                field="existing_entity_lookup"
                value={companySearch}
                placeholder="Search company"
                items={companyItems}
                onValueChange={setCompanySearch}
                onSearchQueryChange={searchCompanies}
                onSelect={handleCompanyLookupSelect}
                hideAddAction
                emptyText={
                  isLookupSearching
                    ? "Searching entities..."
                    : isLookupLoading
                    ? "Loading entities..."
                    : "No entities found."
                }
                rootData={{ "data-search-root": "contact-details-entity" }}
              />
              <div className="mt-1 text-xs text-slate-500">
                {saveOnLookupSelect
                  ? "Select an existing entity to link it immediately."
                  : "Search and select an existing entity, or fill the form below."}
              </div>
            </div>
          ) : (
            <div className="rounded border border-slate-200 bg-slate-50 p-3">
              <SearchDropdownInput
                label="Search Existing Contact"
                field="existing_contact_lookup"
                value={contactSearch}
                placeholder="Search contact"
                items={contactItems}
                onValueChange={setContactSearch}
                onSearchQueryChange={searchContacts}
                onSelect={handleContactLookupSelect}
                hideAddAction
                emptyText={
                  isLookupSearching
                    ? "Searching contacts..."
                    : isLookupLoading
                    ? "Loading contacts..."
                    : "No contacts found."
                }
                rootData={{ "data-search-root": "contact-details-individual" }}
              />
              <div className="mt-1 text-xs text-slate-500">
                {saveOnLookupSelect
                  ? "Select an existing contact to link it immediately."
                  : "Search and select an existing contact, or fill the form below."}
              </div>
            </div>
          )
        ) : null}

        {isEntity ? (
          <ContactEntityFields
            form={form}
            updateField={updateField}
            openSections={openSections}
            setOpenSections={setOpenSections}
            companyAddressLookupRef={companyAddressLookupRef}
            useTopLookupSearch={useTopLookupSearch}
            enableInlineDuplicateLookup={enableInlineDuplicateLookup}
            isCompanyLookupLoading={isCompanyLookupLoading}
            existingCompanyRecord={existingCompanyRecord}
            existingPrimaryPersonRecord={existingPrimaryPersonRecord}
            isPrimaryPersonLookupLoading={isPrimaryPersonLookupLoading}
          />
        ) : (
          <ContactIndividualFields
            form={form}
            updateField={updateField}
            openSections={openSections}
            setOpenSections={setOpenSections}
            sameAsAddress={sameAsAddress}
            handleSameAsAddressChange={handleSameAsAddressChange}
            individualAddressLookupRef={individualAddressLookupRef}
            enableInlineDuplicateLookup={enableInlineDuplicateLookup}
            isContactLookupLoading={isContactLookupLoading}
            existingContactRecord={existingContactRecord}
          />
        )}
      </div>
    </Modal>
  );
}
