import { useCallback } from "react";
import { toText } from "@shared/utils/formatters.js";
import { updateJobFieldsById } from "@modules/job-records/exports/api.js";
import {
  buildJobLastActionPayload,
  LAST_ACTION_STATUSES,
} from "../shared/jobDetailsWorkflow.js";

export function useJobBooleanToggles({
  effectiveJobId,
  error,
  isMarkComplete,
  isPcaDone,
  isPrestartDone,
  isSavingMarkComplete,
  isSavingPcaDone,
  isSavingPrestartDone,
  isSdkReady,
  pendingMarkCompleteValue,
  plugin,
  setIsMarkComplete,
  setIsMarkCompleteConfirmOpen,
  setIsPcaDone,
  setIsPrestartDone,
  setIsSavingMarkComplete,
  setIsSavingPcaDone,
  setIsSavingPrestartDone,
  setPendingMarkCompleteValue,
  success,
}) {
  const updateJobBooleanField = useCallback(
    async ({ fieldName, value, additionalPayload = null } = {}) => {
      const jobId = toText(effectiveJobId);
      if (!plugin || !isSdkReady) {
        throw new Error("Job context is not ready.");
      }
      if (!jobId) {
        throw new Error("Job ID is missing.");
      }
      await updateJobFieldsById({
        plugin,
        jobId,
        payload: {
          [fieldName]: Boolean(value),
          ...(additionalPayload && typeof additionalPayload === "object" ? additionalPayload : {}),
        },
      });
      return true;
    },
    [effectiveJobId, isSdkReady, plugin]
  );

  const handlePcaDoneToggle = useCallback(
    async (nextValue) => {
      if (isSavingPcaDone) return;
      const previousValue = isPcaDone;
      setIsPcaDone(Boolean(nextValue));
      setIsSavingPcaDone(true);
      try {
        await updateJobBooleanField({
          fieldName: "pca_done",
          value: nextValue,
        });
      } catch (toggleError) {
        setIsPcaDone(previousValue);
        error("Save failed", toggleError?.message || "Unable to update PCA Done.");
      } finally {
        setIsSavingPcaDone(false);
      }
    },
    [error, isPcaDone, isSavingPcaDone, updateJobBooleanField]
  );

  const handlePrestartDoneToggle = useCallback(
    async (nextValue) => {
      if (isSavingPrestartDone) return;
      const previousValue = isPrestartDone;
      setIsPrestartDone(Boolean(nextValue));
      setIsSavingPrestartDone(true);
      try {
        await updateJobBooleanField({
          fieldName: "prestart_done",
          value: nextValue,
        });
      } catch (toggleError) {
        setIsPrestartDone(previousValue);
        error("Save failed", toggleError?.message || "Unable to update Prestart Done.");
      } finally {
        setIsSavingPrestartDone(false);
      }
    },
    [error, isPrestartDone, isSavingPrestartDone, updateJobBooleanField]
  );

  const handleMarkCompleteClick = useCallback(() => {
    if (isSavingMarkComplete) return;
    setPendingMarkCompleteValue(!isMarkComplete);
    setIsMarkCompleteConfirmOpen(true);
  }, [isMarkComplete, isSavingMarkComplete]);

  const handleCloseMarkCompleteConfirm = useCallback(() => {
    if (isSavingMarkComplete) return;
    setIsMarkCompleteConfirmOpen(false);
  }, [isSavingMarkComplete]);

  const handleConfirmMarkComplete = useCallback(async () => {
    if (isSavingMarkComplete) return;
    const previousValue = isMarkComplete;
    const nextValue = Boolean(pendingMarkCompleteValue);
    setIsSavingMarkComplete(true);
    setIsMarkComplete(nextValue);
    try {
      await updateJobBooleanField({
        fieldName: "mark_complete",
        value: nextValue,
        additionalPayload: nextValue
          ? buildJobLastActionPayload({
              type: "job.mark-complete",
              message: "Job marked as complete.",
              status: LAST_ACTION_STATUSES.SUCCEEDED,
            })
          : null,
      });
      success(
        nextValue ? "Complete" : "Incomplete",
        nextValue ? "Job marked as complete." : "Job marked as incomplete."
      );
      setIsMarkCompleteConfirmOpen(false);
    } catch (saveError) {
      setIsMarkComplete(previousValue);
      error("Save failed", saveError?.message || "Unable to update Mark Complete.");
    } finally {
      setIsSavingMarkComplete(false);
    }
  }, [
    error,
    isMarkComplete,
    isSavingMarkComplete,
    pendingMarkCompleteValue,
    success,
    updateJobBooleanField,
  ]);

  return {
    handleCloseMarkCompleteConfirm,
    handleConfirmMarkComplete,
    handleMarkCompleteClick,
    handlePcaDoneToggle,
    handlePrestartDoneToggle,
    updateJobBooleanField,
  };
}
