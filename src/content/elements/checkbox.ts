import type { StoreApi } from "zustand/vanilla";

import type { ContentState } from "@/content/store";

let cachedCheckboxes: HTMLInputElement[] | null = null;
let cachedIndexMap = new WeakMap<HTMLInputElement, number>();
let cacheGeneration = 0;
let lastCacheGeneration = -1;
let delegatedHandlerInstalled = false;
let checkboxTemplate: HTMLInputElement | null = null;

const getCheckboxTemplate = (): HTMLInputElement => {
  if (!checkboxTemplate) {
    checkboxTemplate = document.createElement("input");
    checkboxTemplate.type = "checkbox";
    checkboxTemplate.className = "bc-checkbox";
  }
  return checkboxTemplate;
};

export const invalidateCheckboxCache = () => {
  cacheGeneration++;
};

const getCachedCheckboxes = (): HTMLInputElement[] => {
  if (cachedCheckboxes && lastCacheGeneration === cacheGeneration) {
    return cachedCheckboxes;
  }

  const items = document
    .querySelector(".grid.active, .purchases")
    ?.querySelectorAll<HTMLInputElement>(".bc-checkbox");

  if (!items) {
    return [];
  }

  cachedCheckboxes = Array.from(items);
  cachedIndexMap = new WeakMap();
  cachedCheckboxes.forEach((checkbox, i) => {
    cachedIndexMap.set(checkbox, i);
  });
  lastCacheGeneration = cacheGeneration;

  return cachedCheckboxes;
};

let activeStore: StoreApi<ContentState> | null = null;
let activeOnChecked: ((target: HTMLInputElement) => void) | null = null;

const installDelegatedHandler = (
  store: StoreApi<ContentState>,
  onChecked: (target: HTMLInputElement) => void,
) => {
  activeStore = store;
  activeOnChecked = onChecked;
  if (delegatedHandlerInstalled) {
    return;
  }

  const handleClick = (e: Event) => {
    const target = e.target;
    if (
      !(target instanceof HTMLInputElement) ||
      !target.classList.contains("bc-checkbox") ||
      !activeStore ||
      !activeOnChecked
    ) {
      return;
    }
    const onChecked = activeOnChecked;

    const { shiftKeyPressed, lastClickedIndex, setLastClickedIndex } =
      activeStore.getState();
    const checkboxes = getCachedCheckboxes();

    if (checkboxes.length === 0) {
      return;
    }

    const targetIndex = cachedIndexMap.get(target) ?? -1;

    if (shiftKeyPressed && targetIndex >= 0) {
      const start = targetIndex;
      const end = lastClickedIndex;

      for (let i = Math.min(start, end); i <= Math.max(start, end); i++) {
        const checkbox = checkboxes[i];
        if (!checkbox) {
          continue;
        }
        const id = checkbox.getAttribute("data-id");
        if (!id) {
          continue;
        }
        checkbox.checked = target.checked;
        onChecked(checkbox);
      }
    } else {
      onChecked(target);
      setLastClickedIndex(targetIndex);
    }
  };

  document.body.addEventListener("click", handleClick);
  delegatedHandlerInstalled = true;
};

export const createCheckbox = (
  id: string,
  store: StoreApi<ContentState>,
  onChecked: (target: HTMLInputElement) => void,
) => {
  installDelegatedHandler(store, onChecked);

  const template = getCheckboxTemplate();
  const checkbox = template.cloneNode(true) as HTMLInputElement;
  checkbox.setAttribute("data-id", id);
  checkbox.setAttribute("aria-label", `Select item ${id} for download`);

  const { selected, downloadedIds } = store.getState();
  checkbox.checked = Boolean(selected[id]);

  if (downloadedIds.has(id)) {
    checkbox.classList.add("bc-checkbox-downloaded");
  }

  return checkbox;
};
