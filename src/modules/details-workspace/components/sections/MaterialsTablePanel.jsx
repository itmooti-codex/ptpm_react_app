import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import {
  DocumentActionIcon,
  EditActionIcon,
  EyeActionIcon,
  TrashActionIcon,
} from "../icons/ActionIcons.jsx";
import { JobDirectCardTablePanel } from "../primitives/WorkspaceLayoutPrimitives.jsx";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectTable,
} from "../primitives/WorkspaceTablePrimitives.jsx";
import { toText } from "@shared/utils/formatters.js";
import {
  formatDateForDisplay,
  formatCurrency,
  resolveMaterialFileUrl,
  getFileNameFromUrl,
} from "./materialsUtils.js";

export function MaterialsTablePanel({
  materials,
  visibleMaterials,
  hasMoreMaterials,
  remainingMaterialsCount,
  isMaterialsWindowed,
  showMoreMaterials,
  isTableOnlyLayout,
  isSubmitting,
  activeActionId,
  providerById,
  viewMaterial,
  setViewMaterial,
  deleteTarget,
  setDeleteTarget,
  handleEdit,
  handleDelete,
  onRequestCreate,
  onRequestEdit,
}) {
  return (
    <>
      <JobDirectCardTablePanel className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="type-subheadline text-slate-800">Materials</div>
          {isTableOnlyLayout && typeof onRequestCreate === "function" ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="h-8 whitespace-nowrap px-3 text-xs"
              onClick={() => onRequestCreate()}
            >
              Add Material
            </Button>
          ) : null}
        </div>
        <JobDirectTable className="table-fixed" minWidthClass="min-w-[920px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="w-[22%] px-2 py-2">Material Name</th>
              <th className="w-[13%] px-2 py-2">Total</th>
              <th className="w-[16%] px-2 py-2">Transaction Type</th>
              <th className="w-[13%] px-2 py-2">Tax</th>
              <th className="w-[20%] px-2 py-2">Service Provider</th>
              <th className="w-[16%] px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleMaterials.length ? (
              visibleMaterials.map((material) => {
                const materialId = toText(material?.id || material?.ID);
                const isBusy = Boolean(materialId) && activeActionId === materialId;
                const materialFileUrl = resolveMaterialFileUrl(material);
                const providerName =
                  toText(material?.provider_name) ||
                  providerById.get(toText(material?.service_provider_id))?.label ||
                  "-";

                return (
                  <tr key={materialId || material.material_name} className="border-b border-slate-100">
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {toText(material?.material_name) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {formatCurrency(material?.total)}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {toText(material?.transaction_type) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {toText(material?.tax) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {providerName}
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        {materialFileUrl ? (
                          <JobDirectIconActionButton
                            onClick={() => {
                              window.open(materialFileUrl, "_blank", "noopener,noreferrer");
                            }}
                            title="View Receipt"
                          >
                            <DocumentActionIcon />
                          </JobDirectIconActionButton>
                        ) : null}
                        <JobDirectIconActionButton
                          onClick={() => setViewMaterial(material)}
                          title="View Material"
                        >
                          <EyeActionIcon />
                        </JobDirectIconActionButton>
                        <JobDirectIconActionButton
                          onClick={() => {
                            if (isTableOnlyLayout && typeof onRequestEdit === "function") {
                              onRequestEdit(material);
                              return;
                            }
                            handleEdit(material);
                          }}
                          disabled={isSubmitting || isBusy}
                          title="Edit Material"
                        >
                          <EditActionIcon />
                        </JobDirectIconActionButton>
                        <JobDirectIconActionButton
                          variant="danger"
                          onClick={() => setDeleteTarget(material)}
                          disabled={isSubmitting || isBusy}
                          title="Delete Material"
                        >
                          <TrashActionIcon />
                        </JobDirectIconActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <JobDirectEmptyTableRow colSpan={6} message="No materials found." />
            )}
          </tbody>
        </JobDirectTable>
        {hasMoreMaterials ? (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {visibleMaterials.length} of {materials.length} materials
            </span>
            <Button type="button" variant="outline" onClick={showMoreMaterials}>
              Load {Math.min(remainingMaterialsCount, 120)} more
            </Button>
          </div>
        ) : isMaterialsWindowed ? (
          <div className="mt-3 text-xs text-slate-500">
            Showing all {materials.length} materials.
          </div>
        ) : null}
      </JobDirectCardTablePanel>

      <Modal
        open={Boolean(viewMaterial)}
        onClose={() => setViewMaterial(null)}
        title="Material Details"
        widthClass="max-w-3xl"
      >
        {viewMaterial ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Material Name:</span>{" "}
              {toText(viewMaterial.material_name) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Date Added:</span>{" "}
              {formatDateForDisplay(viewMaterial.created_at)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Total:</span>{" "}
              {formatCurrency(viewMaterial.total)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Status:</span>{" "}
              {toText(viewMaterial.status) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Transaction Type:</span>{" "}
              {toText(viewMaterial.transaction_type) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Tax:</span> {toText(viewMaterial.tax) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Description:</span>{" "}
              {toText(viewMaterial.description) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Receipt:</span>{" "}
              {resolveMaterialFileUrl(viewMaterial) ? (
                <a
                  href={resolveMaterialFileUrl(viewMaterial)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#003882] underline underline-offset-2"
                >
                  {getFileNameFromUrl(resolveMaterialFileUrl(viewMaterial)) || "View receipt"}
                </a>
              ) : (
                "-"
              )}
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => {
          if (activeActionId) return;
          setDeleteTarget(null);
        }}
        title="Delete Material?"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setDeleteTarget(null)}
              disabled={Boolean(activeActionId)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleDelete}
              disabled={Boolean(activeActionId)}
            >
              {activeActionId ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-600">
          Are you sure you want to delete this material?
        </p>
      </Modal>
    </>
  );
}
