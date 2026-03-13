import {
  EditActionIcon as EditIcon,
  TrashActionIcon as TrashIcon,
} from "@modules/details-workspace/exports/components.js";
import { Button } from "@shared/components/ui/Button.jsx";
import { Modal } from "@shared/components/ui/Modal.jsx";
import { formatDate, formatRelativeTime, toText } from "@shared/utils/formatters.js";
import {
  useJobNotes,
  NOTE_FILTER_OPTIONS,
  NOTE_TYPE_OPTIONS,
  getTypePillClass,
  parseNoteAuthor,
  stripNoteAuthor,
} from "../../hooks/useJobNotes.js";

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
  const {
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
  } = useJobNotes({ plugin, jobId, inquiryId, contextType });

  return (
    <section className={`flex flex-col rounded border border-slate-200 bg-white ${panelClassName}`}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
        <div className="text-sm font-semibold text-slate-800">Notes</div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* Author filter */}
          <select
            value={authorFilter}
            onChange={(event) => setAuthorFilter(event.target.value)}
            className="h-8 rounded border border-slate-300 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none focus:border-slate-400"
          >
            <option value="">All Authors</option>
            {authorFilterOptions.map((sp) => (
              <option key={sp.id} value={sp.id}>
                {sp.label}
              </option>
            ))}
          </select>
          {/* Type filter */}
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
            const rawNote = toText(item?.note);
            const parsedAuthor = parseNoteAuthor(rawNote);
            const displayNote = stripNoteAuthor(rawNote);
            const isEditing = editingNoteId === noteId;
            const isBusy = busyNoteId === noteId;

            return (
              <article
                key={noteId || `${toText(item?.date_created)}-${rawNote}`}
                className="rounded border border-slate-200 bg-white px-2.5 py-2 shadow-sm"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Author line parsed from note text */}
                      {parsedAuthor ? (
                        <div className="truncate text-xs font-semibold text-slate-800">
                          {parsedAuthor.name}
                        </div>
                      ) : null}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${getTypePillClass(item?.type)}`}
                      >
                        {toText(item?.type) || "Manual"}
                      </span>
                      {parsedAuthor ? (
                        <div className="text-[10px] text-slate-500" title={parsedAuthor.dateStr}>
                          {parsedAuthor.dateStr}
                        </div>
                      ) : (
                        <div
                          className="text-[10px] text-slate-500"
                          title={formatDate(item?.date_created)}
                        >
                          {formatRelativeTime(item?.date_created)}
                        </div>
                      )}
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
                          {displayNote || "-"}
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
