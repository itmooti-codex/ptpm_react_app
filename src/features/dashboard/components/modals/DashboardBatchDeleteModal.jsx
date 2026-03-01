import { Modal } from "../../../../shared/components/ui/Modal.jsx";
import { Button } from "../../../../shared/components/ui/Button.jsx";

export function DashboardBatchDeleteModal({
  open,
  count = 0,
  onClose,
  onConfirm,
  isProcessing = false,
}) {
  return (
    <Modal
      open={open}
      title="Cancel Selected Records"
      onClose={onClose}
      widthClass="max-w-sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={isProcessing}>
            Cancel
          </Button>
          <Button
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-50"
            onClick={onConfirm}
            disabled={isProcessing}
          >
            {isProcessing ? "Cancelling..." : `Delete ${count > 0 ? `(${count})` : ""}`}
          </Button>
        </div>
      }
    >
      <p className="text-sm text-slate-600">
        Are you sure you want to cancel{" "}
        <span className="font-semibold text-slate-800">
          {count} selected record{count !== 1 ? "s" : ""}
        </span>
        ? This will mark them as Cancelled.
      </p>
    </Modal>
  );
}
