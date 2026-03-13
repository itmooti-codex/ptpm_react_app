import { useUploadsPending } from "./useUploadsPending.js";
import { useUploadsActions } from "./useUploadsActions.js";

export function useUploadsSection({
  plugin,
  jobData,
  additionalCreatePayload,
  uploadsMode,
  inquiryId,
  inquiryUid,
  linkedJobId,
  highlightUploadId,
  enableFormUploads,
}) {
  const pendingState = useUploadsPending({
    plugin,
    jobData,
    additionalCreatePayload,
    uploadsMode,
    inquiryId,
    inquiryUid,
    linkedJobId,
    highlightUploadId,
    enableFormUploads,
  });

  const actions = useUploadsActions({ ...pendingState, plugin });

  return {
    ...pendingState,
    ...actions,
  };
}
