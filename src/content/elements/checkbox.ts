import { StoreApi } from "zustand/vanilla";

import { ContentState } from "../store";

let cachedCheckboxes: HTMLInputElement[] | null = null;
let cacheVersion = 0;
let delegatedHandlerInstalled = false;
let checkboxTemplate: HTMLInputElement | null = null;

const getCheckboxTemplate = (): HTMLInputElement => {
  if (!checkboxTemplate) {
    checkboxTemplate = document.createElement("input");
    checkboxTemplate.type = "checkbox";
    checkboxTemplate.className = "bc-checkbox checkbox checkbox-lg checkbox-primary border-2 select-none";
  }
  return checkboxTemplate;
};

const getCachedCheckboxes = (): HTMLInputElement[] => {
  const items = document
    .querySelector(".grid.active, .purchases")
    ?.getElementsByClassName("bc-checkbox");

  if (!items) {
    return [];
  }

  const currentVersion = items.length;
  if (!cachedCheckboxes || cacheVersion !== currentVersion) {
    cachedCheckboxes = Array.from(items) as HTMLInputElement[];
    cacheVersion = currentVersion;
  }

  return cachedCheckboxes;
};

const installDelegatedHandler = (store: StoreApi<ContentState>, onChecked: (target: HTMLInputElement) => void) => {
  if (delegatedHandlerInstalled) return;

  const handleClick = (e: Event) => {
    const target = e.target;
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('bc-checkbox')) {
      return;
    }

    const { shiftKeyPressed, lastClickedIndex, setLastClickedIndex } = store.getState();
    const checkboxes = getCachedCheckboxes();

    if (checkboxes.length === 0) {
      return;
    }

    if (shiftKeyPressed) {
      const start = checkboxes.indexOf(target);
      const end = lastClickedIndex;

      for (let i = Math.min(start, end); i < Math.max(start, end) + 1; i++) {
        const checkbox = checkboxes[i];
        const id = checkbox.getAttribute("data-id");

        if (!id) {
          continue;
        }

        checkbox.checked = target.checked;
        onChecked(checkbox);
      }
    } else {
      const index = checkboxes.indexOf(target);
      onChecked(target);
      setLastClickedIndex(index);
    }
  };

  document.body.addEventListener('click', handleClick);
  delegatedHandlerInstalled = true;
};

export const createCheckbox = (
  id: string,
  store: StoreApi<ContentState>,
  onChecked: (target: HTMLInputElement) => void
) => {
  installDelegatedHandler(store, onChecked);

  const template = getCheckboxTemplate();
  const checkbox = template.cloneNode(true) as HTMLInputElement;
  checkbox.setAttribute("data-id", id);

  const selected = store.getState().selected;
  checkbox.checked = Boolean(selected[id]);

  return checkbox;
};
