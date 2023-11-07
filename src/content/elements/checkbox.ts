import { StoreApi } from "zustand/vanilla";
import { ContentState } from "../store";

export const createCheckbox = (
  id: string,
  store: StoreApi<ContentState>,
  onChecked: (target: HTMLInputElement) => void
) => {
  const onCheckboxClicked = (e: Event) => {
    const eventTarget = e.target;
    const { shiftKeyPressed, lastClickedIndex, setLastClickedIndex } =
      store.getState();

    if (eventTarget instanceof HTMLInputElement) {
      const items = document
        .querySelector(".grid.active, .purchases")
        ?.getElementsByClassName("bc-checkbox");

      if (!items) {
        return;
      }

      const checkboxes = Array.from(items);

      if (shiftKeyPressed) {
        const start = checkboxes.indexOf(eventTarget);
        const end = lastClickedIndex;

        for (let i = Math.min(start, end); i < Math.max(start, end) + 1; i++) {
          const checkbox = checkboxes[i] as HTMLInputElement;
          const id = checkbox.getAttribute("data-id");

          if (!id) {
            continue;
          }

          checkbox.checked = eventTarget.checked;
          onChecked(checkbox);
        }
      } else {
        const index = checkboxes.indexOf(eventTarget);
        onChecked(eventTarget);
        setLastClickedIndex(index);
      }
    }
  };

  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.className =
    "bc-checkbox checkbox checkbox-lg checkbox-primary border-2 select-none";
  checkbox.setAttribute("data-id", id);
  checkbox.onclick = onCheckboxClicked;

  const selected = store.getState().selected;
  checkbox.checked = Boolean(selected[id]);

  return checkbox;
};
