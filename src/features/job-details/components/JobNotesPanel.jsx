import { useCallback, useEffect, useMemo, useState } from "react";
import assigneesJson from "../../../../assignees.json";
import {
  EditActionIcon as EditIcon,
  TrashActionIcon as TrashIcon,
} from "@modules/job-workspace/public/components.js";
import { Button } from "@shared/components/ui/Button.jsx";
import { Modal } from "@shared/components/ui/Modal.jsx";
import { PersonAvatar } from "@shared/components/ui/PersonAvatar.jsx";
import { useToast } from "@shared/providers/ToastProvider.jsx";
import {
  formatDate,
  formatRelativeTime,
  getAuthorName,
  toText,
} from "@shared/utils/formatters.js";
import {
  createNoteForDetails,
  deleteNoteForDetails,
  fetchNotesForDetails,
  updateNoteForDetails,
} from "@modules/job-records/public/sdk.js";

const NOTE_FILTER_OPTIONS = ["All", "Manual", "Form", "Phone Call", "API"];
const NOTE_TYPE_OPTIONS = NOTE_FILTER_OPTIONS.filter((value) => value !== "All");
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

function getTypePillClass(type) {
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

function getNoteAuthorLabel(note = {}) {
  const authorName = getAuthorName(note?.Author || {});
  if (authorName && authorName !== "Unknown") return authorName;
  return toText(note?.author_id) || "Unknown";
}

function NoteEditor({ draft, onChange, onSubmit, onCancel = null, isSaving = false, submitLabel }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <select
          value={draft.type}
          onChange={(event) => onChange((previous) => ({ ...previous, type: event.target.value }))}
          className="h-8 rounded border border-slate-300 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
        >
          {NOTE_TYPE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-2">
          {onCancel ? (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancel
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={onSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : submitLabel}
          </Button>
        </div>
      </div>

      <textarea
        rows={onCancel ? 3 : 2}
        value={draft.note}
        onChange={(event) => onChange((previous) => ({ ...previous, note: event.target.value }))}
        placeholder="Write a note..."
        className="w-full rounded border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
      />
    </div>
  );
}

export function JobNotesPanel({
  plugin = null,
  jobId = "",
  inquiryId = "",
  contextType = "job",
  panelClassName = "",
  listMaxHeightClass = "max-h-[560px]",
}) {
  const { success, error } = useToast();
  const normalizedJobId = toText(jobId);
  const normalizedInquiryId = toText(inquiryId);
  const normalizedContextType = toText(contextType).toLowerCase() || "job";
  const defaultNoteAuthorId = useMemo(() => getDefaultNoteAuthorId(assigneesJson), []);
  const [notes, setNotes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
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
      return typeFilter === "All" || toText(item?.type) === typeFilter;
    });
  }, [notes, typeFilter]);

  const handleCreateNote = useCallback(async () => {
    const noteText = toText(draft.note);
    const noteType = toText(draft.type) || "Manual";
    const createPayload = {
      note: noteText,
      type: noteType,
      author_id: defaultNoteAuthorId,
      date_created: Math.floor(Date.now() / 1000),
    };

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
    if (normalizedJobId) createPayload.Job_id = normalizedJobId;
    if (normalizedInquiryId) createPayload.Deal_id = normalizedInquiryId;
    if (isSubmitting) return;

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
    defaultNoteAuthorId,
    draft,
    error,
    isSubmitting,
    loadNotes,
    normalizedContextType,
    normalizedInquiryId,
    normalizedJobId,
    plugin,
    success,
  ]);

  const handleStartEdit = useCallback((note) => {
    setEditingNoteId(toText(note?.id));
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

  return (
    <section className={`flex flex-col rounded-[4px] border border-[#003882] bg-white ${panelClassName}`}>
      <div className="flex items-center gap-3 rounded-t-[4px] border-b border-[#003882] bg-[#003882] px-2.5 py-1.5">
        <div className="text-[13px] font-semibold text-white">Notes</div>
        <div className="ml-auto flex items-center gap-2">
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
          >
            {NOTE_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="border-b border-slate-200 bg-slate-50/70 px-3 py-2.5">
        <NoteEditor
          draft={draft}
          onChange={setDraft}
          onSubmit={handleCreateNote}
          isSaving={isSubmitting}
          submitLabel="Add Note"
        />
      </div>

      <div className={`${listMaxHeightClass} space-y-1.5 overflow-y-auto p-2.5`}>
        {!hasNoteContext ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            Notes are available when the record is loaded.
          </div>
        ) : isLoading ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            Loading notes...
          </div>
        ) : loadError ? (
          <div className="rounded border border-red-200 bg-red-50 px-3 py-4 text-sm text-red-600">
            {loadError}
          </div>
        ) : !filteredNotes.length ? (
          <div className="rounded border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
            No notes found.
          </div>
        ) : (
          filteredNotes.map((item) => {
            const noteId = toText(item?.id);
            const author = item?.Author || {};
            const authorName = getNoteAuthorLabel(item);
            const isEditing = editingNoteId === noteId;
            const isBusy = busyNoteId === noteId;

            return (
              <article
                key={noteId || `${toText(item?.date_created)}-${toText(item?.note)}`}
                className="rounded border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
              >
                <div className="flex items-start gap-2.5">
                  <PersonAvatar
                    name={authorName}
                    image={toText(author?.profile_image)}
                    className="h-7 w-7 text-[10px]"
                    initialsClassName="text-[10px]"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="truncate text-xs font-semibold text-slate-800">
                        {authorName}
                      </div>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getTypePillClass(item?.type)}`}
                      >
                        {toText(item?.type) || "Manual"}
                      </span>
                      <div
                        className="text-[10px] text-slate-500"
                        title={formatDate(item?.date_created)}
                      >
                        {formatRelativeTime(item?.date_created)}
                      </div>
                      {!isEditing ? (
                        <div className="ml-auto flex items-center gap-1.5">
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleStartEdit(item)}
                            disabled={Boolean(busyNoteId)}
                            aria-label="Edit note"
                            title="Edit"
                          >
                            <EditIcon />
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-slate-300 bg-white text-slate-600 hover:border-red-300 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                            onClick={() => handleOpenDeleteModal(item)}
                            disabled={Boolean(busyNoteId)}
                            aria-label={isBusy ? "Deleting note" : "Delete note"}
                            title={isBusy ? "Deleting..." : "Delete"}
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-2">
                      {isEditing ? (
                        <NoteEditor
                          draft={editingDraft}
                          onChange={setEditingDraft}
                          onSubmit={handleSaveEdit}
                          onCancel={handleCancelEdit}
                          isSaving={isBusy}
                          submitLabel="Save"
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-5 text-slate-700">
                          {toText(item?.note) || "-"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <Modal
        open={Boolean(deleteNoteTarget)}
        onClose={handleCloseDeleteModal}
        title="Delete Note"
        widthClass="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCloseDeleteModal}
              disabled={Boolean(busyNoteId)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={handleConfirmDeleteNote}
              disabled={Boolean(busyNoteId)}
            >
              {busyNoteId === toText(deleteNoteTarget?.id) ? "Deleting..." : "Delete"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          Are you sure you want to delete this note?
        </p>
      </Modal>
    </section>
  );
}
