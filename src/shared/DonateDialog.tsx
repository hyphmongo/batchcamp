import { X as CloseIcon } from "@phosphor-icons/react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { track } from "@/shared/analytics";
import { IconButton } from "@/shared/IconButton";
import { useExitTransition } from "@/shared/useExitTransition";
import { useFocusTrap } from "@/shared/useFocusTrap";

type DonateDialogProps = {
  open: boolean;
  href: string;
  onClose: () => void;
};

const DonateDialog = ({ open, href, onClose }: DonateDialogProps) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { present, closing } = useExitTransition(open);
  useFocusTrap(open, dialogRef);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!present) {
    return null;
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="donate-dialog-title"
      className={`font-sans fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center px-4 ${closing ? "pointer-events-none" : ""}`}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        className={`absolute inset-0 bg-base-content/35 backdrop-blur-[2px] ${closing ? "animate-dialog-fade-out" : "animate-dialog-fade"}`}
      />
      <div
        ref={dialogRef}
        className={`relative w-full max-w-sm bg-base-100 border border-base-300 shadow-dialog p-6 ${closing ? "animate-dialog-pop-out" : "animate-dialog-pop"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <h2
            id="donate-dialog-title"
            className="text-stat font-semibold tracking-tight text-base-content lowercase"
          >
            support batchcamp
          </h2>
          <IconButton icon={CloseIcon} label="Close" onClick={onClose} />
        </div>

        <p className="mt-5 text-body text-base-content/75 leading-normal tracking-[-0.01em]">
          hey, thanks for using the extension. i build and develop small
          music-related tools and release them for free to the community.
        </p>
        <p className="mt-3 text-body text-base-content/75 leading-normal tracking-[-0.01em]">
          if batchcamp's saved you a bunch of time and headaches, a donation
          would help me keep building this and more like it in the future. thank
          you :)
        </p>

        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            track("donate_link_clicked");
            onClose();
          }}
          className="mt-6 flex items-center justify-center min-h-11 bg-accent text-accent-content text-title font-semibold tracking-tight hover:brightness-95 transition-[filter] cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          continue
        </a>
      </div>
    </div>,
    document.body,
  );
};

export { DonateDialog };
