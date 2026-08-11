const SVG_NS = "http://www.w3.org/2000/svg";

interface DropdownParts {
  dropdown: HTMLElement;
  trigger: HTMLElement;
  menu: HTMLElement;
  returnFocusTo: HTMLElement;
}

export const wireDropdown = ({
  dropdown,
  trigger,
  menu,
  returnFocusTo,
}: DropdownParts) => {
  trigger.setAttribute("aria-expanded", "false");

  const items = () => [
    ...menu.querySelectorAll<HTMLElement>('[role="menuitem"]'),
  ];

  const close = () => {
    (document.activeElement as HTMLElement)?.blur();
    returnFocusTo.focus();
  };

  const step = (offset: number) => {
    const all = items();
    const from = all.indexOf(document.activeElement as HTMLElement);
    const next = from === -1 ? 0 : (from + offset + all.length) % all.length;
    all[next]?.focus();
  };

  trigger.addEventListener("mousedown", (event) => {
    if (dropdown.contains(document.activeElement)) {
      event.preventDefault();
      (document.activeElement as HTMLElement).blur();
    }
  });

  dropdown.addEventListener("focusin", () =>
    trigger.setAttribute("aria-expanded", "true"),
  );

  dropdown.addEventListener("focusout", (event) => {
    if (!dropdown.contains(event.relatedTarget as Node)) {
      trigger.setAttribute("aria-expanded", "false");
    }
  });

  dropdown.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      step(event.key === "ArrowDown" ? 1 : -1);
    }
  });
};

export const createChevron = (): SVGSVGElement => {
  const chevron = document.createElementNS(SVG_NS, "svg");
  chevron.setAttribute("width", "12");
  chevron.setAttribute("height", "12");
  chevron.setAttribute("viewBox", "0 0 24 24");
  chevron.setAttribute("fill", "none");
  chevron.setAttribute("stroke", "currentColor");
  chevron.setAttribute("stroke-width", "3");
  chevron.setAttribute("stroke-linecap", "round");
  chevron.setAttribute("stroke-linejoin", "round");

  const chevronPath = document.createElementNS(SVG_NS, "path");
  chevronPath.setAttribute("d", "M6 9l6 6 6-6");
  chevron.appendChild(chevronPath);

  return chevron;
};
