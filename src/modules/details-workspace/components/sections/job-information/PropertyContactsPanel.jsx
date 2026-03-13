import { Button } from "../../../../../shared/components/ui/Button.jsx";
import { Card } from "../../../../../shared/components/ui/Card.jsx";
import { Modal } from "../../../../../shared/components/ui/Modal.jsx";
import { PropertyAffiliationModal } from "../../modals/PropertyAffiliationModal.jsx";
import {
  EditActionIcon as EditIcon,
  TrashActionIcon as TrashIcon,
} from "../../icons/ActionIcons.jsx";
import { StarIcon } from "./JobInfoOptionCards.jsx";
import {
  getAffiliationCompanyName,
  getAffiliationContactName,
  isPrimaryAffiliation,
  normalizePropertyId,
} from "./jobInfoUtils.js";

export function PropertyContactsPanel({
  plugin,
  resolvedPropertyId,
  affiliations,
  isAffiliationsLoading,
  affiliationLoadError,
  affiliationModalState,
  deleteTarget,
  isDeleting,
  contactLookupById,
  companyLookupById,
  onOpenContactDetailsModal,
  openCreateAffiliation,
  openEditAffiliation,
  closeAffiliationModal,
  saveAffiliation,
  confirmDeleteAffiliation,
  setDeleteTarget,
}) {
  return (
    <>
      <Card className="h-fit space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-base font-bold leading-4 text-neutral-700">Property Contacts</div>
          <Button size="sm" variant="outline" onClick={openCreateAffiliation}>
            Add Contact
          </Button>
        </div>

        {!resolvedPropertyId ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Select a property to manage property contacts.
          </div>
        ) : null}

        {resolvedPropertyId && isAffiliationsLoading ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            Loading property contacts...
          </div>
        ) : null}

        {resolvedPropertyId && !isAffiliationsLoading && affiliationLoadError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {affiliationLoadError}
          </div>
        ) : null}

        {resolvedPropertyId && !isAffiliationsLoading && !affiliationLoadError ? (
          <div className="overflow-x-auto">
            <table className="table-fixed w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="w-1/5 px-2 py-2">Primary</th>
                  <th className="w-1/5 px-2 py-2">Role</th>
                  <th className="w-1/5 px-2 py-2">Contact</th>
                  <th className="w-1/5 px-2 py-2">Company</th>
                  <th className="w-1/5 px-2 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {!affiliations.length ? (
                  <tr>
                    <td className="px-2 py-3 text-slate-400" colSpan={5}>
                      No property contacts linked yet.
                    </td>
                  </tr>
                ) : (
                  affiliations.map((record) => (
                    <tr key={record.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-2 py-3">
                        <span
                          className="inline-flex items-center"
                          title={isPrimaryAffiliation(record) ? "Primary" : "Not Primary"}
                        >
                          <StarIcon active={isPrimaryAffiliation(record)} />
                        </span>
                      </td>
                      <td className="px-2 py-3">{record.role || "-"}</td>
                      <td className="px-2 py-3">
                        {getAffiliationContactName(record) !== "-"
                          ? getAffiliationContactName(record)
                          : contactLookupById.get(normalizePropertyId(record?.contact_id))?.label || "-"}
                      </td>
                      <td className="px-2 py-3">
                        {getAffiliationCompanyName(record) !== "-"
                          ? getAffiliationCompanyName(record)
                          : companyLookupById.get(normalizePropertyId(record?.company_id))?.name || "-"}
                      </td>
                      <td className="px-2 py-3">
                        <div className="flex w-full items-center justify-end gap-2">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800"
                            onClick={() => openEditAffiliation(record)}
                            aria-label="Edit property contact"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700"
                            onClick={() => setDeleteTarget(record)}
                            aria-label="Delete property contact"
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <PropertyAffiliationModal
        open={affiliationModalState.open}
        onClose={closeAffiliationModal}
        initialData={affiliationModalState.initialData}
        plugin={plugin}
        propertyId={resolvedPropertyId}
        onOpenContactDetailsModal={onOpenContactDetailsModal}
        onSave={saveAffiliation}
      />

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        title="Delete Property Contact"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={confirmDeleteAffiliation}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this property contact?
        </p>
      </Modal>
    </>
  );
}
