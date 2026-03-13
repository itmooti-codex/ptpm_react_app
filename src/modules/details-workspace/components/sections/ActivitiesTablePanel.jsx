import { Button } from "../../../../shared/components/ui/Button.jsx";
import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import {
  EditActionIcon,
  EyeActionIcon,
  TrashActionIcon,
} from "../icons/ActionIcons.jsx";
import { JobDirectCardTablePanel } from "../primitives/WorkspaceLayoutPrimitives.jsx";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectStatusBadge,
  JobDirectTable,
  resolveStatusStyle,
} from "../primitives/WorkspaceTablePrimitives.jsx";
import { ACTIVITY_STATUS_OPTIONS } from "../../constants/options.js";
import { formatActivityServiceLabel, toText } from "@shared/utils/formatters.js";
import {
  normalizeActivityId,
  formatDateForDisplay,
  formatCurrency,
} from "./activitiesUtils.js";

function CheckIndicator({ active }) {
  return (
    <span
      className={`inline-flex h-4 w-4 items-center justify-center rounded border ${
        active ? "border-[#003882] bg-[#003882] text-white" : "border-slate-300 bg-white"
      }`}
      aria-hidden="true"
    >
      {active ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path
            d="M20 7L9 18L4 13"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </span>
  );
}

export function ActivitiesTablePanel({
  activities,
  visibleActivities,
  hasMoreActivities,
  remainingActivitiesCount,
  isActivitiesWindowed,
  showMoreActivities,
  normalizedHighlightActivityId,
  isTableOnlyLayout,
  isSubmitting,
  activeActionId,
  viewActivity,
  setViewActivity,
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
          <div className="type-subheadline text-slate-800">Activities</div>
          {isTableOnlyLayout && typeof onRequestCreate === "function" ? (
            <Button
              type="button"
              size="sm"
              variant="primary"
              className="h-8 whitespace-nowrap px-3 text-xs"
              onClick={() => onRequestCreate()}
            >
              Add Activity
            </Button>
          ) : null}
        </div>
        <JobDirectTable className="table-fixed" minWidthClass="min-w-[920px]">
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th className="w-[11%] px-2 py-2">Task</th>
              <th className="w-[11%] px-2 py-2">Option</th>
              <th className="w-[19%] px-2 py-2">Services</th>
              <th className="w-[16%] px-2 py-2">Status</th>
              <th className="w-[11%] px-2 py-2">Price</th>
              <th className="w-[12%] px-2 py-2">Invoice to Client</th>
              <th className="w-[20%] px-2 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {visibleActivities.length ? (
              visibleActivities.map((activity) => {
                const activityId = toText(activity?.id || activity?.ID);
                const normalizedActivityId = normalizeActivityId(activityId);
                const status = toText(
                  activity?.activity_status || activity?.Activity_Status || activity?.status
                );
                const style = resolveStatusStyle(status, ACTIVITY_STATUS_OPTIONS);
                const isBusy = Boolean(activityId) && activeActionId === activityId;
                const isHighlighted =
                  Boolean(normalizedHighlightActivityId) &&
                  normalizedActivityId === normalizedHighlightActivityId;
                return (
                  <tr
                    key={activityId || `${activity.task}-${activity.option}`}
                    data-ann-kind="activity"
                    data-ann-id={normalizedActivityId || activityId}
                    data-ann-highlighted={isHighlighted ? "true" : "false"}
                    className={`border-b border-slate-100 ${
                      isHighlighted ? "bg-amber-50" : ""
                    }`}
                  >
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {toText(activity?.task) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {toText(activity?.option) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {formatActivityServiceLabel(activity) || "-"}
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <JobDirectStatusBadge label={status || "-"} style={style} />
                    </td>
                    <td className="px-2 py-3 align-middle text-slate-700">
                      {formatCurrency(activity?.activity_price)}
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex justify-center">
                        <CheckIndicator
                          active={
                            activity?.invoice_to_client === true ||
                            toText(activity?.invoice_to_client).toLowerCase() === "true"
                          }
                        />
                      </div>
                    </td>
                    <td className="px-2 py-3 align-middle">
                      <div className="flex justify-end gap-1">
                        <JobDirectIconActionButton
                          onClick={() => setViewActivity(activity)}
                          title="View Activity"
                        >
                          <EyeActionIcon />
                        </JobDirectIconActionButton>
                        <JobDirectIconActionButton
                          onClick={() => {
                            if (isTableOnlyLayout && typeof onRequestEdit === "function") {
                              onRequestEdit(activity);
                              return;
                            }
                            handleEdit(activity);
                          }}
                          disabled={isSubmitting || isBusy}
                          title="Edit Activity"
                        >
                          <EditActionIcon />
                        </JobDirectIconActionButton>
                        <JobDirectIconActionButton
                          variant="danger"
                          onClick={() => setDeleteTarget(activity)}
                          disabled={isSubmitting || isBusy}
                          title="Delete Activity"
                        >
                          <TrashActionIcon />
                        </JobDirectIconActionButton>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <JobDirectEmptyTableRow colSpan={7} message="No activities found." />
            )}
          </tbody>
        </JobDirectTable>
        {hasMoreActivities ? (
          <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
            <span>
              Showing {visibleActivities.length} of {activities.length} activities
            </span>
            <Button type="button" variant="outline" onClick={showMoreActivities}>
              Load {Math.min(remainingActivitiesCount, 120)} more
            </Button>
          </div>
        ) : isActivitiesWindowed ? (
          <div className="mt-3 text-xs text-slate-500">
            Showing all {activities.length} activities.
          </div>
        ) : null}
      </JobDirectCardTablePanel>

      <Modal
        open={Boolean(viewActivity)}
        onClose={() => setViewActivity(null)}
        title="Activity Details"
        widthClass="max-w-3xl"
      >
        {viewActivity ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Task:</span> {toText(viewActivity.task) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Option:</span> {toText(viewActivity.option) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Service:</span> {formatActivityServiceLabel(viewActivity) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Status:</span>{" "}
              {toText(viewActivity.activity_status || viewActivity.status) || "-"}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Date Required:</span>{" "}
              {formatDateForDisplay(viewActivity.date_required)}
            </div>
            <div className="text-sm text-slate-600">
              <span className="font-medium text-slate-700">Price:</span>{" "}
              {formatCurrency(viewActivity.activity_price)}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Activity Text:</span>{" "}
              {toText(viewActivity.activity_text) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Warranty:</span>{" "}
              {toText(viewActivity.warranty) || "-"}
            </div>
            <div className="text-sm text-slate-600 md:col-span-2">
              <span className="font-medium text-slate-700">Note:</span> {toText(viewActivity.note) || "-"}
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
        title="Delete Activity?"
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
          Are you sure you want to delete this activity?
        </p>
      </Modal>
    </>
  );
}
