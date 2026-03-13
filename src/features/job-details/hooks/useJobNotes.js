import { useCallback, useEffect, useMemo, useState } from "react";
import assigneesJson from "../../../../assignees.json";
import { useAdminProviderLookup } from "@modules/details-workspace/exports/hooks.js";
import { useToast } from "@shared/providers/ToastProvider.jsx";
import { toText } from "@shared/utils/formatters.js";
import { useCurrentUserServiceProvider } from "@shared/hooks/useCurrentUserServiceProvider.js";
import {
  createNoteForDetails,
  deleteNoteForDetails,
  fetchNotesForDetails,
  updateNoteForDetails,
} from "@modules/job-records/exports/api.js";

export const NOTE_FILTER_OPTIONS = ["All", "Manual", "Form", "Phone Call", "API"];
const NOTE_TYPE_OPTIONS = NOTE_FILTER_OPTIONS.filter((value) => value !== "All");
export { NOTE_TYPE_OPTIONS };

const EMPTY_NOTE_DRAFT = {
  note: "",
  type: "Manual",
};

const NOTE_TYPE_STYLES = {
  Manual: "bg-slate-100 text-slate-700",
  Form: "bg-emerald-100 text-emerald-700",
  "Phone Call": "bg-amber-100 text-amber-700",
  API: "bg-sky-100 text-sky-700",
};

export function getTypePillClass(type) {
  return NOTE_TYPE_STYLES[toText(type)] || "bg-slate-100 text-slate-700";
}

function getDefaultNoteAuthorId(rawAssignees) {
  const source = Array.isArray(rawAssignees)
    ? rawAssignees
    : Array.isArray(rawAssignees?.assignees)
      ? rawAssignees.assignees
      : [];
  return toText(source?.[0]?.id ?? source?.[0]?.ID ?? source?.[0]?.assignee_id);
}

// Formats a date like "13 Mar 2026 3:35 PM"
function formatNoteTimestamp() {
  const now = new Date();
  const day = now.getDate();
  const month = now.toLocaleString("en-AU", { month: "short" });
  const year = now.getFullYear();
  const time = now
    .toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit", hour12: true })
    .toUpperCase();
  return `${day} ${month} ${year} ${time}`;
}

// Parses "\n\nNote added by: John Doe | 5 | 13 Mar 2026 3:35 PM" from end of note
export function parseNoteAuthor(noteText) {
  const match = String(noteText || "").match(
    /\n\nNote added by: (.+?) \| (\w+) \| (.+?)\s*$/
  );
  if (!match) return null;
  return { name: match[1], id: match[2], dateStr: match[3] };
}

export function stripNoteAuthor(noteText) {
  return String(noteText || "").replace(/\n\nNote added by: .+$/s, "").trimEnd();
}

export function useJobNotes({
  plugin = null,
  jobId = "",
  inquiryId = "",
  contextType = "job",
}) {
  const { success, error } = useToast();
  const normalizedJobId = toText(jobId);
  const normalizedInquiryId = toText(inquiryId);
  const normalizedContextType = toText(contextType).toLowerCase() || "job";
  const defaultNoteAuthorId = useMemo(() => getDefaultNoteAuthorId(assigneesJson), []);

  // Current user's service provider (for appending to notes)
  const { spId: currentSpId, spName: currentSpName } = useCurrentUserServiceProvider(plugin);

  // Admin service providers for the author filter dropdown
  const { records: adminProviders } = useAdminProviderLookup({
    plugin,
    isSdkReady: Boolean(plugin),
  });
  const authorFilterOptions = useMemo(
    () =>
      adminProviders
        .map((sp) => ({
          id: toText(sp.id),
          label:
            [toText(sp.first_name), toText(sp.last_name)].filter(Boolean).join(" ") ||
            `SP #${sp.id}`,
        }))
        .filter((item) => item.id),
    [adminProviders]
  );

  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [authorFilter, setAuthorFilter] = useState("");
  const [draft, setDraft] = useState(EMPTY_NOTE_DRAFT);
  const [editingNoteId, setEditingNoteId] = useState("");
  const [editingDraft, setEditingDraft] = useState(EMPTY_NOTE_DRAFT);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [busyNoteId, setBusyNoteId] = useState("");
  const [deleteNoteTarget, setDeleteNoteTarget] = useState(null);

  const hasNoteContext =
    normalizedContextType === "inquiry"
      ? Boolean(normalizedInquiryId)
      : Boolean(normalizedJobId || normalizedInquiryId);

  const loadNotes = useCallback(async () => {
    if (!plugin || !hasNoteContext) {
      setNotes([]);
      setLoadError("");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setLoadError("");
    try {
      const rows = await fetchNotesForDetails({
        plugin,
        jobId: normalizedJobId,
        inquiryId: normalizedInquiryId,
        contextType: normalizedContextType,
        limit: 200,
      });
      setNotes(Array.isArray(rows) ? rows : []);
    } catch (loadNotesError) {
      console.error("[JobNotesPanel] Failed loading notes", loadNotesError);
      setNotes([]);
      setLoadError(loadNotesError?.message || "Unable to load notes.");
    } finally {
      setIsLoading(false);
    }
  }, [hasNoteContext, normalizedContextType, normalizedInquiryId, normalizedJobId, plugin]);

  useEffect(() => {
    void loadNotes();
  }, [loadNotes]);

  const filteredNotes = useMemo(() => {
    return notes.filter((item) => {
      if (typeFilter !== "All" && toText(item?.type) !== typeFilter) return false;
      if (authorFilter) {
        const parsed = parseNoteAuthor(toText(item?.note));
        if (!parsed || parsed.id !== authorFilter) return false;
      }
      return true;
    });
  }, [notes, typeFilter, authorFilter]);

  const handleCreateNote = useCallback(async () => {
    const noteText = toText(draft.note);
    const noteType = toText(draft.type) || "Manual";

    if (!noteText) {
      error("Create failed", "Note text is required.");
      return;
    }
    if (!defaultNoteAuthorId) {
      error("Create failed", "No note author was found in assignees.json.");
      return;
    }
    if (!normalizedJobId && !normalizedInquiryId) {
      error("Create failed", "Notes are available when the record is loaded.");
      return;
    }
    if (isSubmitting) return;

    // Append "Note added by:" line if we know the current user's SP
    const authorSuffix =
      currentSpId && currentSpName
        ? `\n\nNote added by: ${currentSpName} | ${currentSpId} | ${formatNoteTimestamp()}`
        : "";

    const createPayload = {
      note: `${noteText}${authorSuffix}`,
      type: noteType,
      author_id: defaultNoteAuthorId,
      date_created: Math.floor(Date.now() / 1000),
    };

    if (normalizedJobId) createPayload.Job_id = normalizedJobId;
    if (normalizedInquiryId) createPayload.Deal_id = normalizedInquiryId;

    setIsSubmitting(true);
    try {
      await createNoteForDetails({
        plugin,
        payload: createPayload,
      });
      setDraft(EMPTY_NOTE_DRAFT);
      await loadNotes();
      success("Note added", "The note was saved.");
    } catch (createError) {
      console.error("[JobNotesPanel] Failed creating note", createError);
      error("Create failed", createError?.message || "Unable to save note.");
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentSpId,
    currentSpName,
    defaultNoteAuthorId,
    draft,
    error,
    isSubmitting,
    loadNotes,
    normalizedInquiryId,
    normalizedJobId,
    plugin,
    success,
  ]);

  const handleStartEdit = useCallback((note) => {
    setEditingNoteId(toText(note?.id));
    // Edit the raw stored note (including author suffix) so it's preserved on save
    setEditingDraft({
      note: toText(note?.note),
      type: toText(note?.type) || "Manual",
    });
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingNoteId("");
    setEditingDraft(EMPTY_NOTE_DRAFT);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const normalizedNoteId = toText(editingNoteId);
    const noteText = toText(editingDraft.note);
    const noteType = toText(editingDraft.type) || "Manual";

    if (!normalizedNoteId) return;
    if (!noteText) {
      error("Update failed", "Note text is required.");
      return;
    }
    if (busyNoteId) return;

    setBusyNoteId(normalizedNoteId);
    try {
      await updateNoteForDetails({
        plugin,
        noteId: normalizedNoteId,
        payload: {
          note: noteText,
          type: noteType,
        },
      });
      setEditingNoteId("");
      setEditingDraft(EMPTY_NOTE_DRAFT);
      await loadNotes();
      success("Note updated", "The note changes were saved.");
    } catch (updateError) {
      console.error("[JobNotesPanel] Failed updating note", updateError);
      error("Update failed", updateError?.message || "Unable to update note.");
    } finally {
      setBusyNoteId("");
    }
  }, [busyNoteId, editingDraft, editingNoteId, error, loadNotes, plugin, success]);

  const handleOpenDeleteModal = useCallback((note) => {
    if (busyNoteId) return;
    setDeleteNoteTarget(note || null);
  }, [busyNoteId]);

  const handleCloseDeleteModal = useCallback(() => {
    if (busyNoteId) return;
    setDeleteNoteTarget(null);
  }, [busyNoteId]);

  const handleConfirmDeleteNote = useCallback(async () => {
    const normalizedNoteId = toText(deleteNoteTarget?.id);
    if (!normalizedNoteId || busyNoteId) return;

    setBusyNoteId(normalizedNoteId);
    try {
      await deleteNoteForDetails({
        plugin,
        noteId: normalizedNoteId,
      });
      if (editingNoteId === normalizedNoteId) {
        setEditingNoteId("");
        setEditingDraft(EMPTY_NOTE_DRAFT);
      }
      setDeleteNoteTarget(null);
      await loadNotes();
      success("Note deleted", "The note was removed.");
    } catch (deleteError) {
      console.error("[JobNotesPanel] Failed deleting note", deleteError);
      error("Delete failed", deleteError?.message || "Unable to delete note.");
    } finally {
      setBusyNoteId("");
    }
  }, [busyNoteId, deleteNoteTarget, editingNoteId, error, loadNotes, plugin, success]);

  return {
    authorFilterOptions,
    authorFilter,
    setAuthorFilter,
    typeFilter,
    setTypeFilter,
    draft,
    setDraft,
    editingNoteId,
    editingDraft,
    setEditingDraft,
    isSubmitting,
    busyNoteId,
    deleteNoteTarget,
    hasNoteContext,
    isLoading,
    loadError,
    filteredNotes,
    handleCreateNote,
    handleStartEdit,
    handleCancelEdit,
    handleSaveEdit,
    handleOpenDeleteModal,
    handleCloseDeleteModal,
    handleConfirmDeleteNote,
  };
}
