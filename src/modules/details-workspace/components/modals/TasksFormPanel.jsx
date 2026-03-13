import { Button } from "../../../../shared/components/ui/Button.jsx";
import { InputField } from "../../../../shared/components/ui/InputField.jsx";
import { TextareaField } from "../../../../shared/components/ui/TextareaField.jsx";
import {
  JobDirectFormActionsRow,
  JobDirectMutedPanel,
} from "../primitives/WorkspaceLayoutPrimitives.jsx";
import { AssigneeSearchField } from "./AssigneeSearchField.jsx";

export function TasksFormPanel({
  form,
  setForm,
  isSubmitting,
  isEditing,
  hasContextIds,
  assigneeOptions,
  isLoadingAssignees,
  onSubmit,
  onClear,
}) {
  return (
    <JobDirectMutedPanel>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <InputField
            label="Subject"
            value={form.subject}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                subject: event.target.value,
              }))
            }
            placeholder="Task subject"
            disabled={isSubmitting}
          />

          <InputField
            label="Due Date"
            type="date"
            value={form.dueDate}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                dueDate: event.target.value,
              }))
            }
            disabled={isSubmitting}
          />

          <AssigneeSearchField
            label="Assignee"
            options={assigneeOptions}
            selectedId={form.spId}
            onSelect={(spId, spName) =>
              setForm((prev) => ({
                ...prev,
                spId,
                spName,
              }))
            }
            disabled={isSubmitting}
            isLoading={isLoadingAssignees}
          />

          <TextareaField
            label="Details"
            rows={3}
            value={form.details}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                details: event.target.value,
              }))
            }
            placeholder="Task details"
            disabled={isSubmitting}
          />
        </div>

        <JobDirectFormActionsRow className="mt-4 flex-wrap">
          <Button type="button" variant="ghost" onClick={onClear} disabled={isSubmitting}>
            Clear
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting || !hasContextIds}>
            {isSubmitting ? "Saving..." : isEditing ? "Update Task" : "Add Task"}
          </Button>
        </JobDirectFormActionsRow>
      </form>
    </JobDirectMutedPanel>
  );
}
