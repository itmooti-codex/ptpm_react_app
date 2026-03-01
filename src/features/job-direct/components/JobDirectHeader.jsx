import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../shared/components/ui/Button.jsx";
import { useToast } from "../../../shared/providers/ToastProvider.jsx";
import { SECTION_LABELS } from "../constants/navigation.js";
import { showMutationErrorToast } from "../utils/mutationFeedback.js";
import {
  HeaderBackIcon,
  HeaderNextIcon,
  HeaderResetIcon,
  HeaderSaveIcon,
  TitleBackIcon,
} from "./icons/JobDirectIcons.jsx";

export function JobDirectHeader({
  navState,
  onBack,
  onNext,
  onSave,
  hasUnsavedChanges = false,
}) {
  const { success, error } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const nextLabel = navState.next ? `Next: ${SECTION_LABELS[navState.next]}` : "Next";
  const backLabel = navState.previous ? `Back: ${SECTION_LABELS[navState.previous]}` : "Back";

  const handleResetForm = () => {
    const root = document.querySelector('[data-page="new-direct-job"]');
    if (!root) return;

    const fields = root.querySelectorAll("input, textarea, select");
    fields.forEach((field) => {
      if (field.disabled) return;

      if (field.tagName === "SELECT") {
        field.value = "";
        if (field.value !== "") field.selectedIndex = -1;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      const inputType = field.type?.toLowerCase();
      if (inputType === "button" || inputType === "submit" || inputType === "reset") return;
      if (inputType === "checkbox" || inputType === "radio") {
        field.checked = false;
        field.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      field.value = "";
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    });

    success("Form reset", "All fields on this page were cleared.");
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (typeof onSave !== "function") {
      error("Save failed", "Save action is not available.");
      return;
    }

    setIsSaving(true);
    try {
      await onSave();
      success("Saved", "Job updated successfully.");
    } catch (saveError) {
      showMutationErrorToast(error, {
        title: "Save failed",
        error: saveError,
        fallbackMessage: "Unable to save job right now.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <header className="border-b border-slate-300 bg-brand-primary px-6 py-4 text-white">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
        <div className="justify-self-start">
          <Link to="/" className="type-headline inline-flex items-center gap-3">
            <TitleBackIcon className="h-6 w-6 text-white" />
            <span>New Job Direct</span>
          </Link>
        </div>

        <div className="justify-self-center text-xs font-medium text-amber-100">
          {hasUnsavedChanges ? "Unsaved changes" : ""}
        </div>

        <div className="flex items-center justify-self-end gap-2">
          <Button variant="ghost" className="border border-white text-white" onClick={handleResetForm}>
            <HeaderResetIcon className="h-3.5 w-3.5 text-white" />
            Reset Form
          </Button>
          <Button
            variant="ghost"
            className="border border-white text-white disabled:cursor-not-allowed disabled:opacity-70"
            onClick={handleSave}
            disabled={isSaving}
          >
            <HeaderSaveIcon className="h-3.5 w-3.5 text-white" />
            {isSaving ? "Saving..." : "Save"}
          </Button>
          <Button variant="secondary" disabled={!navState.canGoBack} onClick={onBack}>
            <HeaderBackIcon className="h-3.5 w-3.5 text-brand-primary" />
            {backLabel}
          </Button>
          <Button variant="secondary" disabled={!navState.canGoNext} onClick={onNext}>
            {nextLabel}
            <HeaderNextIcon className="h-3.5 w-3.5 text-brand-primary" />
          </Button>
        </div>
      </div>
    </header>
  );
}
