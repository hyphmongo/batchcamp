import { X } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FieldLabel } from "@/shared/FieldLabel";
import { IconButton } from "@/shared/IconButton";
import { textLinkClass } from "@/shared/text-link";
import { useExitTransition } from "@/shared/useExitTransition";
import { useFocusTrap } from "@/shared/useFocusTrap";
import { type Configuration, DEFAULT_FILENAME_TEMPLATE } from "@/storage";
import type { Format } from "@/types";
import { applyTemplate, isFilenameTemplateEnabled } from "./filename-utils";

type FilenameTemplateProps = {
  config: Configuration;
  onUpdate: (updates: Partial<Configuration>) => void;
  idPrefix?: string;
};

const SAMPLE_DATA: Record<string, string> = {
  artist: "Joy Orbison",
  title: "Hyph Mngo",
  year: "2009",
  date: "2009-08-31",
};

const TOKEN_HELP = [
  { token: "{artist}", description: "artist name" },
  { token: "{title}", description: "album or track title" },
  { token: "{date}", description: "release date" },
  { token: "{format}", description: "audio format" },
  { token: "/", description: "folder separator" },
] as const;

const buildPreview = (template: string, format: Format): string => {
  const sampleData: Record<string, string> = {
    ...SAMPLE_DATA,
    format,
  };
  return `${applyTemplate(template, sampleData)}.zip`;
};

const FilenameTemplate = ({
  config,
  onUpdate,
  idPrefix = "",
}: FilenameTemplateProps) => {
  const toggleId = `${idPrefix}customize-filename`;
  const template = config.filenameTemplate ?? DEFAULT_FILENAME_TEMPLATE;
  const enabled = isFilenameTemplateEnabled(config);
  const [isEditing, setIsEditing] = useState(false);
  const editor = useExitTransition(isEditing);

  const handleToggle = (on: boolean) => {
    onUpdate({ filenameTemplateEnabled: on });
    if (on) {
      setIsEditing(true);
    }
  };

  return (
    <div className={enabled ? "py-1.5" : undefined}>
      <div className="flex items-center justify-between gap-3">
        <FieldLabel htmlFor={toggleId}>Customize filename</FieldLabel>
        <input
          id={toggleId}
          type="checkbox"
          className="toggle toggle-sm"
          checked={enabled}
          onChange={(e) => handleToggle(e.target.checked)}
        />
      </div>

      {enabled && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="font-mono text-xs text-base-content/70 truncate">
            {template}
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className={`shrink-0 text-xs ${textLinkClass}`}
            aria-label="Edit filename template"
          >
            edit
          </button>
        </div>
      )}

      {editor.present && (
        <FilenameTemplateModal
          template={template}
          format={config.format}
          closing={editor.closing}
          onUpdate={(newTemplate) =>
            onUpdate({ filenameTemplate: newTemplate })
          }
          onClose={() => setIsEditing(false)}
        />
      )}
    </div>
  );
};

type ModalProps = {
  template: string;
  format: Format;
  closing: boolean;
  onUpdate: (template: string) => void;
  onClose: () => void;
};

const FilenameTemplateModal = ({
  template,
  format,
  closing,
  onUpdate,
  onClose,
}: ModalProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(template);
  const preview = buildPreview(draft, format);

  const flushDraft = () => {
    if (draft !== template) {
      onUpdate(draft);
    }
  };
  const commitAndClose = () => {
    flushDraft();
    onClose();
  };
  const commitRef = useRef({ flushDraft, commitAndClose });
  commitRef.current = { flushDraft, commitAndClose };

  useFocusTrap(true, modalRef, inputRef);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        commitRef.current.commitAndClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      commitRef.current.flushDraft();
    };
  }, []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="filename-modal-title"
      className={`font-sans fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center px-4 ${closing ? "pointer-events-none" : ""}`}
    >
      <div
        aria-hidden="true"
        onClick={commitAndClose}
        className={`absolute inset-0 bg-base-content/35 backdrop-blur-[2px] ${closing ? "animate-dialog-fade-out" : "animate-dialog-fade"}`}
      />
      <div
        ref={modalRef}
        className={`relative w-full max-w-md bg-base-100 border border-base-300 shadow-dialog ${closing ? "animate-dialog-pop-out" : "animate-dialog-pop"}`}
      >
        <div className="min-h-12 px-4 border-b border-base-300 flex items-center justify-between">
          <h2
            id="filename-modal-title"
            className="text-title font-semibold tracking-tight text-base-content"
          >
            Filename Template
          </h2>
          <IconButton
            icon={X}
            label="Close"
            variant="lg"
            onClick={commitAndClose}
          />
        </div>

        <div className="p-5 space-y-4">
          <input
            ref={inputRef}
            type="text"
            className="w-full text-sm font-mono px-3 py-2 border border-base-300 bg-base-100 text-base-content focus:outline-2 focus:outline-accent focus:outline-offset-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            aria-label="Filename template"
          />
          <p className="text-xs text-base-content/70 truncate">
            <span className="text-base-content/40 mr-1.5">e.g.</span>
            <span className="font-mono">{preview}</span>
          </p>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs pt-3 border-t border-base-300/40">
            {TOKEN_HELP.map(({ token, description }) => (
              <div key={token} className="contents">
                <dt className="font-mono text-base-content/70">{token}</dt>
                <dd className="text-base-content/70">{description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export { FilenameTemplate };
