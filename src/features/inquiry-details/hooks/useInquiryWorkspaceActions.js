import { useCallback } from "react";
import {
  createCompanyRecord,
  createContactRecord,
  updateContactRecord,
} from "../../../modules/details-workspace/api/core/runtime.js";
import {
  updateCompanyFieldsById,
  updateContactFieldsById,
  updateInquiryFieldsById,
} from "../../../modules/job-records/exports/api.js";
import { compactStringFields, toText } from "@shared/utils/formatters.js";
import { parseListSelectionValue, serializeListSelectionValue } from "../shared/inquiryInformationHelpers.js";
import { fetchJobIdByUniqueId } from "../api/inquiryRelatedRecordsApi.js";

export function useInquiryWorkspaceActions({
  plugin,
  navigate,
  error,
  success,
  trackRecentActivity,
  inquiryNumericId,
  safeUid,
  refreshResolvedInquiry,
  openContactDetailsModal,
  isCompanyAccount,
  inquiry,
  inquiryCompany,
  inquiryPrimaryContact,
  accountEditorCompanyInitialValues,
  accountEditorContactInitialValues,
  setContactModalState,
  listSelectionDesiredRef,
  listSelectionSyncingRef,
  optimisticListSelectionByField,
  setOptimisticListSelectionByField,
  removingListTagKeys,
  setRemovingListTagKeys,
  setIsTasksModalOpen,
  setLinkedJobSelectionOverride,
  setIsSavingLinkedJob,
  isSavingLinkedJob,
  relatedJobIdByUid,
  setRelatedJobIdByUid,
  selectedRelatedJobId,
  setInquiryDetailsForm,
}) {
  const flushQuickListSelectionField = useCallback(
    async (field) => {
      const normalizedField = toText(field);
      if (!normalizedField || !plugin || !inquiryNumericId) return;
      if (listSelectionSyncingRef.current[normalizedField]) return;

      listSelectionSyncingRef.current[normalizedField] = true;
      let lastSyncedSignature = "";
      let didFail = false;
      try {
        while (true) {
          const desiredCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? [...listSelectionDesiredRef.current[normalizedField]]
            : [];
          const desiredSignature = desiredCodes.join("|");
          lastSyncedSignature = desiredSignature;
          await updateInquiryFieldsById({
            plugin,
            inquiryId: inquiryNumericId,
            payload: {
              [normalizedField]: serializeListSelectionValue(desiredCodes),
            },
          });
          const latestCodes = Array.isArray(listSelectionDesiredRef.current[normalizedField])
            ? listSelectionDesiredRef.current[normalizedField]
            : [];
          if (latestCodes.join("|") === desiredSignature) break;
        }

        await refreshResolvedInquiry();
      } catch (removeError) {
        didFail = true;
        console.error("[InquiryDetails] Failed to remove list selection tag", removeError);
        error("Update failed", removeError?.message || "Unable to remove selection.");
        try {
          await refreshResolvedInquiry();
        } catch (refreshError) {
          console.error(
            "[InquiryDetails] Failed refreshing inquiry after list tag failure",
            refreshError
          );
        }
      } finally {
        listSelectionSyncingRef.current[normalizedField] = false;

        const desiredNow = Array.isArray(listSelectionDesiredRef.current[normalizedField])
          ? listSelectionDesiredRef.current[normalizedField].join("|")
          : "";
        const shouldClearFieldState = didFail || desiredNow === lastSyncedSignature;

        if (shouldClearFieldState) {
          delete listSelectionDesiredRef.current[normalizedField];
          setOptimisticListSelectionByField((previous) => {
            if (!(normalizedField in previous)) return previous;
            const next = { ...previous };
            delete next[normalizedField];
            return next;
          });
          setRemovingListTagKeys((previous) => {
            const nextEntries = Object.entries(previous).filter(
              ([key]) => !key.startsWith(`${normalizedField}:`)
            );
            if (nextEntries.length === Object.keys(previous).length) return previous;
            return Object.fromEntries(nextEntries);
          });
        } else {
          void flushQuickListSelectionField(normalizedField);
        }
      }
    },
    [
      error,
      inquiryNumericId,
      listSelectionDesiredRef,
      listSelectionSyncingRef,
      plugin,
      refreshResolvedInquiry,
      setOptimisticListSelectionByField,
      setRemovingListTagKeys,
    ]
  );

  const handleQuickRemoveListSelectionTag = useCallback(
    ({ field, rawValue, options, tag }) => {
      if (!plugin || !inquiryNumericId) {
        error("Update failed", "Inquiry context is not ready.");
        return;
      }
      const normalizedField = toText(field);
      if (!normalizedField) return;

      const tagCode = toText(tag?.code || tag?.key);
      const tagLabel = toText(tag?.label || tagCode) || "value";
      const optimisticCodes = optimisticListSelectionByField[normalizedField];
      const currentCodes = Array.isArray(optimisticCodes)
        ? optimisticCodes
        : parseListSelectionValue(rawValue, options);
      const nextCodes = tagCode
        ? currentCodes.filter((code) => toText(code) !== tagCode)
        : [];
      if (tagCode && nextCodes.length === currentCodes.length) return;

      listSelectionDesiredRef.current[normalizedField] = nextCodes;
      setOptimisticListSelectionByField((previous) => ({
        ...previous,
        [normalizedField]: nextCodes,
      }));
      setRemovingListTagKeys((previous) => ({
        ...previous,
        [`${normalizedField}:${tagCode || tagLabel}`]: true,
      }));

      void flushQuickListSelectionField(normalizedField);
    },
    [
      error,
      flushQuickListSelectionField,
      inquiryNumericId,
      listSelectionDesiredRef,
      optimisticListSelectionByField,
      plugin,
      setOptimisticListSelectionByField,
      setRemovingListTagKeys,
    ]
  );

  const isListSelectionTagRemoving = useCallback(
    (field, tag) =>
      Boolean(
        removingListTagKeys[`${toText(field)}:${toText(tag?.code || tag?.key || tag?.label)}`]
      ),
    [removingListTagKeys]
  );

  const handleOpenAccountEditor = useCallback(() => {
    if (!plugin || !inquiryNumericId) return;
    const currentMode = isCompanyAccount ? "entity" : "individual";

    const handleSaveAccount = async (draftRecord, context = {}) => {
      const mode =
        toText(context?.mode || currentMode).toLowerCase() === "entity"
          ? "entity"
          : "individual";

      if (mode === "entity") {
        const companyName = toText(draftRecord?.name);
        if (!companyName) {
          throw new Error("Company name is required.");
        }
        const companyPayload = {
          ...(draftRecord && typeof draftRecord === "object" ? draftRecord : {}),
          name: companyName,
        };
        delete companyPayload.primary_contact_id;
        delete companyPayload.Primary_Contact_ID;
        if (companyPayload?.Primary_Person && typeof companyPayload.Primary_Person === "object") {
          const compactPrimaryPerson = compactStringFields(companyPayload.Primary_Person);
          if (Object.keys(compactPrimaryPerson).length) {
            companyPayload.Primary_Person = compactPrimaryPerson;
          } else {
            delete companyPayload.Primary_Person;
          }
        }
        const existingCompanyId = toText(
          companyPayload?.id || companyPayload?.ID || companyPayload?.Company_ID
        );

        let companyId = existingCompanyId;
        if (existingCompanyId) {
          await updateCompanyFieldsById({
            plugin,
            companyId: existingCompanyId,
            payload: companyPayload,
          });
        } else {
          const createdCompany = await createCompanyRecord({
            plugin,
            payload: companyPayload,
          });
          companyId = toText(createdCompany?.id || createdCompany?.ID);
        }
        if (!companyId) {
          throw new Error("Unable to resolve company ID.");
        }
        const preservedPrimaryContactId = toText(
          inquiryPrimaryContact?.id ||
            inquiry?.primary_contact_id ||
            inquiry?.Primary_Contact_ID
        );

        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            account_type: "Company",
            Account_Type: "Company",
            company_id: companyId,
            Company_ID: companyId,
            primary_contact_id: preservedPrimaryContactId || null,
            Primary_Contact_ID: preservedPrimaryContactId || null,
          },
        });
        await refreshResolvedInquiry();
        success("Inquiry updated", "Company account was linked and inquiry contact was preserved.");
        return;
      }

      const existingContactId = toText(
        draftRecord?.id || draftRecord?.ID || draftRecord?.Contact_ID
      );
      const savedContact = existingContactId
        ? await updateContactRecord({
            plugin,
            id: existingContactId,
            payload: draftRecord || {},
          })
        : await createContactRecord({
            plugin,
            payload: draftRecord || {},
          });
      const contactId = toText(savedContact?.id || savedContact?.ID || existingContactId);
      if (!contactId) {
        throw new Error("Unable to resolve contact ID.");
      }

      await updateInquiryFieldsById({
        plugin,
        inquiryId: inquiryNumericId,
        payload: {
          account_type: "Contact",
          Account_Type: "Contact",
          primary_contact_id: contactId,
          Primary_Contact_ID: contactId,
          company_id: toText(inquiryCompany?.id) || null,
          Company_ID: toText(inquiryCompany?.id) || null,
        },
      });
      await refreshResolvedInquiry();
      success("Inquiry updated", "Contact account was linked and company was preserved.");
    };

    openContactDetailsModal({
      mode: currentMode,
      onSave: handleSaveAccount,
      allowModeSwitch: true,
      titleVerb: "Update",
      initialValues:
        currentMode === "entity"
          ? accountEditorCompanyInitialValues
          : accountEditorContactInitialValues,
      onModeChange: (nextMode) => {
        const normalizedMode =
          toText(nextMode).toLowerCase() === "entity" ? "entity" : "individual";
        setContactModalState((previous) => ({
          ...previous,
          mode: normalizedMode,
          initialValues:
            normalizedMode === "entity"
              ? accountEditorCompanyInitialValues
              : accountEditorContactInitialValues,
        }));
      },
    });
  }, [
    accountEditorCompanyInitialValues,
    accountEditorContactInitialValues,
    inquiry,
    inquiryCompany,
    inquiryNumericId,
    inquiryPrimaryContact,
    isCompanyAccount,
    openContactDetailsModal,
    plugin,
    refreshResolvedInquiry,
    setContactModalState,
    success,
  ]);

  const handleOpenTasksModal = useCallback(() => {
    if (!inquiryNumericId) return;
    setIsTasksModalOpen(true);
    trackRecentActivity({
      action: "Opened manage tasks",
      pageType: "inquiry-details",
      pageName: "Inquiry Details",
      metadata: {
        inquiry_id: toText(inquiryNumericId),
        inquiry_uid: toText(safeUid),
      },
    });
  }, [inquiryNumericId, safeUid, setIsTasksModalOpen, trackRecentActivity]);

  const handleCloseTasksModal = useCallback(() => setIsTasksModalOpen(false), [setIsTasksModalOpen]);

  const handleCopyUid = useCallback(async () => {
    if (!safeUid) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(safeUid);
      } else {
        throw new Error("Clipboard API is unavailable.");
      }
      success("UID copied", safeUid);
    } catch (copyError) {
      error("Copy failed", copyError?.message || "Unable to copy UID.");
    }
  }, [error, safeUid, success]);

  const handleCopyFieldValue = useCallback(
    async ({ label, value }) => {
      const text = toText(value);
      if (!text) return;
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error("Clipboard API is unavailable.");
        }
        success(`${label} copied`, text);
      } catch (copyError) {
        error("Copy failed", copyError?.message || "Unable to copy value.");
      }
    },
    [error, success]
  );

  const openRelatedRecord = useCallback((uniqueId) => {
    const nextUid = toText(uniqueId);
    if (!nextUid) return;
    navigate(`/job-details/${encodeURIComponent(nextUid)}`);
  }, [navigate]);

  const handleToggleRelatedJobLink = useCallback(
    async (jobRecord = {}) => {
      if (isSavingLinkedJob) return;
      if (!plugin || !inquiryNumericId) {
        error("Save failed", "Inquiry context is not ready.");
        return;
      }
      const jobUniqueId = toText(jobRecord?.unique_id || jobRecord?.Unique_ID);
      let resolvedJobId = toText(
        jobRecord?.id || jobRecord?.ID || (jobUniqueId ? relatedJobIdByUid[jobUniqueId] : "")
      );
      if (!resolvedJobId && jobUniqueId) {
        resolvedJobId = toText(await fetchJobIdByUniqueId({ plugin, uniqueId: jobUniqueId }));
        if (resolvedJobId) {
          setRelatedJobIdByUid((previous) =>
            toText(previous[jobUniqueId]) === resolvedJobId
              ? previous
              : { ...previous, [jobUniqueId]: resolvedJobId }
          );
        }
      }
      if (!resolvedJobId) {
        error("Save failed", "Selected job is missing a record ID.");
        return;
      }

      const currentlySelected = toText(selectedRelatedJobId);
      const shouldUnselect =
        Boolean(currentlySelected) &&
        (currentlySelected === resolvedJobId || (jobUniqueId && currentlySelected === jobUniqueId));
      const nextLinkedJobId = shouldUnselect ? "" : resolvedJobId;

      setLinkedJobSelectionOverride(nextLinkedJobId);
      setIsSavingLinkedJob(true);
      try {
        await updateInquiryFieldsById({
          plugin,
          inquiryId: inquiryNumericId,
          payload: {
            inquiry_for_job_id: nextLinkedJobId,
          },
        });
        await refreshResolvedInquiry();
        if (shouldUnselect) {
          success("Job unlinked", "Inquiry job link was removed.");
        } else {
          success(
            "Job linked",
            `Inquiry linked to ${jobUniqueId || resolvedJobId || "selected job"}.`
          );
        }
      } catch (saveError) {
        console.error("[InquiryDetails] Failed to update inquiry linked job", saveError);
        setLinkedJobSelectionOverride(undefined);
        error("Save failed", saveError?.message || "Unable to update linked job.");
      } finally {
        setIsSavingLinkedJob(false);
      }
    },
    [
      error,
      inquiryNumericId,
      isSavingLinkedJob,
      plugin,
      refreshResolvedInquiry,
      relatedJobIdByUid,
      selectedRelatedJobId,
      setIsSavingLinkedJob,
      setLinkedJobSelectionOverride,
      setRelatedJobIdByUid,
      success,
    ]
  );

  const handleInquiryDetailsTextFieldChange = useCallback(
    (field) => (event) => {
      const nextValue = String(event?.target?.value ?? "");
      setInquiryDetailsForm((previous) =>
        previous[field] === nextValue ? previous : { ...previous, [field]: nextValue }
      );
    },
    [setInquiryDetailsForm]
  );

  return {
    handleQuickRemoveListSelectionTag,
    isListSelectionTagRemoving,
    handleOpenAccountEditor,
    handleOpenTasksModal,
    handleCloseTasksModal,
    handleCopyUid,
    handleCopyFieldValue,
    openRelatedRecord,
    handleToggleRelatedJobLink,
    handleInquiryDetailsTextFieldChange,
  };
}
