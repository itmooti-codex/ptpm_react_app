import { Button } from "../../../../shared/components/ui/Button.jsx";
import { CheckboxField } from "../../../../shared/components/ui/CheckboxField.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { SearchLookupInput } from "./SearchLookupInput.jsx";
import { usePropertyAffiliationForm } from "./usePropertyAffiliationForm.js";

export function PropertyAffiliationModal({
  open,
  onClose,
  onSave,
  initialData = null,
  plugin,
  propertyId,
  onOpenContactDetailsModal,
}) {
  const {
    form,
    setForm,
    isSaving,
    saveError,
    contactItems,
    companyItems,
    handleSearchContacts,
    handleSearchCompanies,
    handleAddLookupRecord,
    handleSave,
  } = usePropertyAffiliationForm({
    open,
    initialData,
    plugin,
    propertyId,
    onClose,
    onSave,
    onOpenContactDetailsModal,
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={form.id ? "Edit Property Contact" : "Add Property Contact"}
      widthClass="max-w-3xl"
      footer={
        <div className="flex items-center justify-end gap-2">
          {saveError ? <div className="mr-auto text-xs text-red-600">{saveError}</div> : null}
          <Button variant="ghost" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : form.id ? "Update Contact" : "Save Contact"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <InputField
          label="Role"
          value={form.role}
          onChange={(event) => setForm((previous) => ({ ...previous, role: event.target.value }))}
          placeholder="Owner, Resident, Property Manager"
        />
        <CheckboxField
          label="Is Primary?"
          checked={Boolean(form.is_primary)}
          onChange={(event) =>
            setForm((previous) => ({
              ...previous,
              is_primary: Boolean(event.target.checked),
            }))
          }
        />

        <SearchLookupInput
          label="Contact"
          value={form.contact_label}
          placeholder="Search contact"
          items={contactItems}
          onSearchQueryChange={handleSearchContacts}
          onValueChange={(nextValue) =>
            setForm((previous) => ({
              ...previous,
              contact_label: nextValue,
              contact_id: "",
            }))
          }
          onSelect={(item) =>
            setForm((previous) => ({
              ...previous,
              contact_id: item.id || "",
              contact_label: item.label || "",
            }))
          }
          onAdd={() => handleAddLookupRecord("individual")}
          addLabel="Add New Contact"
          emptyText="No contacts found."
        />

        <SearchLookupInput
          label="Company"
          value={form.company_label}
          placeholder="Search company"
          items={companyItems}
          onSearchQueryChange={handleSearchCompanies}
          onValueChange={(nextValue) =>
            setForm((previous) => ({
              ...previous,
              company_label: nextValue,
              company_id: "",
              ...(previous.same_as_company
                ? {
                    company_as_accounts_contact_id: "",
                    company_as_accounts_contact_label: nextValue,
                  }
                : {}),
            }))
          }
          onSelect={(item) =>
            setForm((previous) => ({
              ...previous,
              company_id: item.id || "",
              company_label: item.label || "",
              ...(previous.same_as_company
                ? {
                    company_as_accounts_contact_id: item.id || "",
                    company_as_accounts_contact_label: item.label || "",
                  }
                : {}),
            }))
          }
          onAdd={() => handleAddLookupRecord("entity")}
          addLabel="Add New Company"
          emptyText="No companies found."
        />

        <section className="rounded border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 text-sm font-semibold text-neutral-700">Company As Accounts Contact</div>
          <CheckboxField
            label="Same as company"
            checked={form.same_as_company}
            onChange={(event) =>
              setForm((previous) => {
                const checked = event.target.checked;
                if (!checked) {
                  return {
                    ...previous,
                    same_as_company: false,
                    company_as_accounts_contact_id: "",
                    company_as_accounts_contact_label: "",
                  };
                }
                return {
                  ...previous,
                  same_as_company: true,
                  company_as_accounts_contact_id: previous.company_id || "",
                  company_as_accounts_contact_label: previous.company_label || "",
                };
              })
            }
          />

          <div className="mt-2">
            <SearchLookupInput
              label="Accounts Company"
              value={form.company_as_accounts_contact_label}
              placeholder="Search company"
              items={companyItems}
              onSearchQueryChange={handleSearchCompanies}
              onValueChange={(nextValue) =>
                setForm((previous) => ({
                  ...previous,
                  company_as_accounts_contact_label: nextValue,
                  company_as_accounts_contact_id: "",
                }))
              }
              onSelect={(item) =>
                setForm((previous) => ({
                  ...previous,
                  company_as_accounts_contact_id: item.id || "",
                  company_as_accounts_contact_label: item.label || "",
                }))
              }
              onAdd={() => handleAddLookupRecord("entity")}
              addLabel="Add New Company"
              emptyText="No companies found."
              disabled={form.same_as_company}
            />
          </div>
        </section>
      </div>
    </Modal>
  );
}
