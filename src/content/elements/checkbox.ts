import { StoreApi } from "zustand/vanilla";

import { ContentState } from "../store";

let lastClickedIndex = 0;

export const createCheckbox = (store: StoreApi<ContentState>) => {
  const onCheckboxClicked = (e: Event) => {
    const eventTarget = e.target;
    const { shiftKeyPressed, setCheckedCount } = store.getState();

    if (eventTarget instanceof HTMLInputElement) {
      const items = document.querySelectorAll(".checkbox");

      if (!items) {
        return;
      }

      const checkboxes = Array.from(items);

      if (shiftKeyPressed) {
        const start = checkboxes.indexOf(eventTarget);
        const end = lastClickedIndex;

        for (let i = Math.min(start, end); i < Math.max(start, end) + 1; i++) {
          (checkboxes[i] as HTMLInputElement).checked = eventTarget.checked;
        }
      } else {
        const index = checkboxes.indexOf(eventTarget);
        lastClickedIndex = index;
      }

      setCheckedCount(document.querySelectorAll("input:checked").length);
    }
  };

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "checkbox checkbox-lg checkbox-primary border-2";
  checkbox.onclick = onCheckboxClicked;

  return checkbox;
};
