import { type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useExitTransition } from "@/shared/useExitTransition";
import { useFocusTrap } from "@/shared/useFocusTrap";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: ReactNode;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const ConfirmDialog = ({
  open,
  title,
  description,
  detail,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  hideCancel,
  destructive,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { present, closing } = useExitTransition(open);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onCancel]);

  if (!present) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className={`font-sans fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center px-4 ${closing ? "pointer-events-none" : ""}`}
    >
      <div
        aria-hidden="true"
        onClick={onCancel}
        className={`absolute inset-0 bg-base-content/35 backdrop-blur-[2px] ${closing ? "animate-dialog-fade-out" : "animate-dialog-fade"}`}
      />
      <div
        ref={dialogRef}
        className={`relative w-full max-w-sm bg-base-100 border border-base-300 shadow-dialog p-6 ${closing ? "animate-dialog-pop-out" : "animate-dialog-pop"}`}
      >
        <h2
          id="confirm-dialog-title"
          className="text-stat font-semibold tracking-tight text-base-content lowercase"
        >
          {title}
        </h2>
        {description && (
          <p className="mt-3 text-body text-base-content/75 leading-normal tracking-[-0.01em]">
            {description}
          </p>
        )}
        {detail && (
          <p className="mt-3 truncate bg-base-content/[0.05] px-2.5 py-2 font-mono text-meta text-base-content/70">
            {detail}
          </p>
        )}
        <div className="mt-6 flex items-center justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-body text-base-content/70 hover:text-base-content transition-colors cursor-pointer focus-ring focus-visible:outline-offset-2"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onConfirm}
            className={`px-3 py-1.5 text-body font-medium transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 ${
              destructive
                ? "bg-error text-error-content hover:brightness-95 focus-visible:outline-error"
                : "bg-accent text-accent-content hover:brightness-95 focus-visible:outline-accent"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export { ConfirmDialog };
