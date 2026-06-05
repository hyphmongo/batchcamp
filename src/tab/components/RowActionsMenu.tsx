import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { track } from "@/shared/analytics";
import { useExitTransition } from "@/shared/useExitTransition";

type Action = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

type RowActionsMenuProps = {
  actions: Action[];
  ariaLabel?: string;
};

const MENU_WIDTH = 168;
const MENU_GAP = 6;
const VIEWPORT_PAD = 8;

const RowActionsMenu = ({
  actions,
  ariaLabel = "Row actions",
}: RowActionsMenuProps) => {
  const [open, setOpen] = useState(false);
  const { present, closing } = useExitTransition(open);
  const [position, setPosition] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      return;
    }
    const updatePosition = () => {
      if (!triggerRef.current) {
        return;
      }
      const rect = triggerRef.current.getBoundingClientRect();
      const left = Math.max(
        VIEWPORT_PAD,
        Math.min(
          rect.right - MENU_WIDTH,
          window.innerWidth - MENU_WIDTH - VIEWPORT_PAD,
        ),
      );
      setPosition({ top: rect.bottom + MENU_GAP, left });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    menuRef.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
      ?.focus();
  }, [open]);

  if (actions.length === 0) {
    return null;
  }

  const constructive = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (!open) {
            track("row_menu_opened");
          }
          setOpen(!open);
        }}
        className="relative after:absolute after:-inset-2 after:content-[''] inline-flex items-center justify-center w-7 h-7 text-base-content/70 hover:text-base-content hover:bg-base-200 transition-colors cursor-pointer focus-ring focus-visible:outline-offset-1"
      >
        <span aria-hidden="true" className="leading-none">
          ⋯
        </span>
      </button>
      {present &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={ariaLabel}
            style={{
              position: "fixed",
              top: position.top,
              left: position.left,
              width: MENU_WIDTH,
            }}
            className={`font-sans z-[var(--z-menu)] bg-neutral text-neutral-content shadow-menu py-1 origin-top-right ${closing ? "animate-menu-pop-out pointer-events-none" : "animate-menu-pop"}`}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key !== "ArrowDown" && e.key !== "ArrowUp") {
                return;
              }
              e.preventDefault();
              const items = Array.from(
                menuRef.current?.querySelectorAll<HTMLButtonElement>(
                  '[role="menuitem"]',
                ) ?? [],
              );
              if (items.length === 0) {
                return;
              }
              const idx = items.indexOf(
                document.activeElement as HTMLButtonElement,
              );
              const next =
                e.key === "ArrowDown"
                  ? (idx + 1) % items.length
                  : (idx - 1 + items.length) % items.length;
              items[next]?.focus();
            }}
          >
            {constructive.map((action) => (
              <MenuItem
                key={action.label}
                action={action}
                onSelect={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              />
            ))}
            {constructive.length > 0 && destructive.length > 0 && (
              <div
                aria-hidden="true"
                className="my-1 border-t border-neutral-content/15"
              />
            )}
            {destructive.map((action) => (
              <MenuItem
                key={action.label}
                action={action}
                onSelect={() => {
                  setOpen(false);
                  triggerRef.current?.focus();
                }}
              />
            ))}
          </div>,
          document.body,
        )}
    </>
  );
};

const MenuItem = ({
  action,
  onSelect,
}: {
  action: Action;
  onSelect: () => void;
}) => (
  <button
    type="button"
    role="menuitem"
    onClick={(e) => {
      e.stopPropagation();
      onSelect();
      action.onSelect();
    }}
    className="w-full text-left px-3 py-1.5 text-body text-neutral-content hover:bg-neutral-content/10 cursor-pointer focus-ring focus-visible:outline-offset-[-2px]"
  >
    {action.label}
  </button>
);

export { RowActionsMenu };
