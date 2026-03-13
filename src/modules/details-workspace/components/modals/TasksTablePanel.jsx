import { Button } from "../../../../shared/components/ui/Button.jsx";
import {
  JobDirectEmptyTableRow,
  JobDirectIconActionButton,
  JobDirectStatusBadge,
  JobDirectTable,
} from "../primitives/WorkspaceTablePrimitives.jsx";
import {
  JobDirectPlainPanel,
} from "../primitives/WorkspaceLayoutPrimitives.jsx";
import {
  CheckActionIcon,
  EditActionIcon,
} from "../icons/ActionIcons.jsx";
import {
  formatDateForDisplay,
  parseAssignedTo,
  statusBadgeClass,
  stripAssignedTo,
  toString,
} from "./tasksModalUtils.js";

export function TasksTablePanel({
  isLoadingTasks,
  visibleTasks,
  filteredTasks,
  hasMoreTasks,
  remainingTasksCount,
  isTasksWindowed,
  showMoreTasks,
  isSubmitting,
  activeTaskId,
  taskFilter,
  setTaskFilter,
  assigneeFilter,
  setAssigneeFilter,
  assigneeOptions,
  onEditTask,
  onMarkComplete,
  emptyMessage,
}) {
  return (
    <JobDirectPlainPanel>
      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {/* Status tabs */}
        {[
          { id: "all", label: "All" },
          { id: "open", label: "Open" },
          { id: "completed", label: "Completed" },
        ].map((tab) => {
          const isActive = taskFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTaskFilter(tab.id)}
              className={`rounded px-3 py-1.5 text-sm font-medium ${
                isActive
                  ? "bg-[#003882] text-white"
                  : "border border-slate-300 bg-white text-slate-600 hover:border-slate-400"
              }`}
            >
              {tab.label}
            </button>
          );
        })}

        {/* Assignee filter */}
        <div className="ml-auto">
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="">All Assignees</option>
            {assigneeOptions.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <JobDirectTable minWidthClass="min-w-[700px]">
        <thead className="border-b border-slate-200 text-slate-500">
          <tr>
            <th className="px-2 py-2">Subject</th>
            <th className="px-2 py-2">Due Date</th>
            <th className="px-2 py-2">Assignee</th>
            <th className="px-2 py-2">Details</th>
            <th className="px-2 py-2">Status</th>
            <th className="px-2 py-2 text-right">Action</th>
          </tr>
        </thead>
        <tbody>
          {isLoadingTasks ? (
            <JobDirectEmptyTableRow colSpan={6} message="Loading tasks..." />
          ) : visibleTasks.length ? (
            visibleTasks.map((task) => {
              const taskId = toString(task?.id);
              const isBusy = Boolean(taskId) && activeTaskId === taskId;
              const isCompleted = toString(task?.status).toLowerCase() === "completed";
              const parsed = parseAssignedTo(toString(task?.details));
              const assigneeName = parsed?.name || "-";

              return (
                <tr key={taskId || `${task.subject}-${task.date_due}`} className="border-b border-slate-100">
                  <td className="px-2 py-3 align-middle text-slate-700">{toString(task?.subject) || "-"}</td>
                  <td className="px-2 py-3 align-middle">{formatDateForDisplay(task?.date_due)}</td>
                  <td className="px-2 py-3 align-middle">{assigneeName}</td>
                  <td className="px-2 py-3 align-middle">{stripAssignedTo(toString(task?.details)) || "-"}</td>
                  <td className="px-2 py-3 align-middle">
                    <JobDirectStatusBadge
                      className={statusBadgeClass(task?.status)}
                      label={toString(task?.status) || "Pending"}
                    />
                  </td>
                  <td className="px-2 py-3 align-middle">
                    <div className="flex flex-wrap justify-end gap-1">
                      <JobDirectIconActionButton
                        onClick={() => onEditTask(task)}
                        disabled={isSubmitting || isBusy || !taskId || isCompleted}
                        aria-label="Edit task"
                        title="Edit Task"
                      >
                        <EditActionIcon />
                      </JobDirectIconActionButton>
                      <JobDirectIconActionButton
                        variant="success"
                        onClick={() => onMarkComplete(task)}
                        disabled={isSubmitting || isBusy || isCompleted || !taskId}
                        aria-label="Mark task complete"
                        title={isCompleted ? "Already completed" : "Mark Complete"}
                      >
                        {isBusy ? (
                          <span className="inline-flex h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        ) : (
                          <CheckActionIcon />
                        )}
                      </JobDirectIconActionButton>
                    </div>
                  </td>
                </tr>
              );
            })
          ) : (
            <JobDirectEmptyTableRow colSpan={6} message={emptyMessage} />
          )}
        </tbody>
      </JobDirectTable>
      {hasMoreTasks ? (
        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-slate-500">
          <span>
            Showing {visibleTasks.length} of {filteredTasks.length} tasks
          </span>
          <Button type="button" variant="outline" onClick={showMoreTasks}>
            Load {Math.min(remainingTasksCount, 100)} more
          </Button>
        </div>
      ) : isTasksWindowed ? (
        <div className="mt-3 text-xs text-slate-500">
          Showing all {filteredTasks.length} tasks.
        </div>
      ) : null}
    </JobDirectPlainPanel>
  );
}
