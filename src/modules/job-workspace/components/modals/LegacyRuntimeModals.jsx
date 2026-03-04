import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { DealInformationModal } from "./DealInformationModal.jsx";
import { TasksModal } from "./TasksModal.jsx";

function PlaceholderModal({ open, onClose, title, body }) {
  return (
    <Modal open={open} onClose={onClose} title={title} widthClass="max-w-xl">
      <p className="text-sm text-slate-600">{body}</p>
    </Modal>
  );
}

export function LegacyRuntimeModals({
  modals,
  onClose,
  plugin,
  jobData,
  tasksModalProps = null,
}) {
  return (
    <>
      <DealInformationModal
        open={modals["deal-information"]}
        onClose={() => onClose("deal-information")}
        plugin={plugin}
        jobData={jobData}
      />
      <PlaceholderModal
        open={modals["quote-documents"]}
        onClose={() => onClose("quote-documents")}
        title="Quote / Job Documents"
        body="Legacy modal from createViewJobDocumentsModal()."
      />
      <PlaceholderModal
        open={modals["activity-list"]}
        onClose={() => onClose("activity-list")}
        title="Activity List"
        body="Legacy modal from createActivityListModal()."
      />
      <PlaceholderModal
        open={modals["wildlife-report"]}
        onClose={() => onClose("wildlife-report")}
        title="Wildlife Report"
        body="Legacy modal from createWildlifeReportModal()."
      />
      <TasksModal
        open={modals.tasks}
        onClose={() => onClose("tasks")}
        plugin={plugin}
        jobData={jobData}
        {...(tasksModalProps && typeof tasksModalProps === "object"
          ? tasksModalProps
          : {})}
      />
    </>
  );
}
