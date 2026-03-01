import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { ToastViewport } from "../components/ui/ToastViewport.jsx";

const ToastContext = createContext(null);
const DEFAULT_DURATION = 3500;
const MAX_TOASTS = 5;

function createToastId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `toast_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function normalizeToast(input, forcedType) {
  if (typeof input === "string") {
    return {
      type: forcedType || "info",
      title: input,
      description: "",
    };
  }

  return {
    type: forcedType || input?.type || "info",
    title: input?.title || "",
    description: input?.description || input?.message || "",
    duration:
      typeof input?.duration === "number" && Number.isFinite(input.duration)
        ? input.duration
        : DEFAULT_DURATION,
  };
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clear = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback((input) => {
    const normalized = normalizeToast(input);
    const nextToast = {
      id: createToastId(),
      duration:
        typeof normalized.duration === "number" ? normalized.duration : DEFAULT_DURATION,
      ...normalized,
    };

    setToasts((prev) => [...prev, nextToast].slice(-MAX_TOASTS));
    return nextToast.id;
  }, []);

  const typedToast = useCallback(
    (type, input, description) => {
      if (typeof input === "string") {
        return toast({ type, title: input, description: description || "" });
      }
      return toast({ ...input, type });
    },
    [toast]
  );

  const value = useMemo(
    () => ({
      toast,
      success: (input, description) => typedToast("success", input, description),
      error: (input, description) => typedToast("error", input, description),
      warning: (input, description) => typedToast("warning", input, description),
      info: (input, description) => typedToast("info", input, description),
      dismiss,
      clear,
    }),
    [clear, dismiss, toast, typedToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
