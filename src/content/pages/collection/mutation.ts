import { createCheckbox } from "../../elements/checkbox";
import { store } from "../../store";

export const createMutationObserver = (
  onChecked: (target: HTMLInputElement) => void
) => {
  let activeSection = "collection-grid";

  const handleGridChange = (node: Element) => {
    const targets = ["collection-grid", "collection-search-grid"];
    const hasChanged = node.id !== activeSection && targets.includes(node.id);

    if (node.classList.contains("active") && hasChanged) {
      activeSection = node.id;
      store.getState().setLastClickedIndex(0);
    }
  };

  const handleItemAddition = (node: Element) => {
    if (
      node.nodeType === 1 &&
      node.classList.contains("collection-item-container")
    ) {
      const id = node.getAttribute("data-tralbumid");

      if (id && node.querySelector(".redownload-item")) {
        node.appendChild(createCheckbox(id, store, onChecked));
      }
    }
  };

  const mutationHandler = (mutations: MutationRecord[]) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === "class") {
        handleGridChange(mutation.target as Element);
      }

      for (const item of mutation.addedNodes) {
        handleItemAddition(item as Element);
      }
    }
  };

  return new MutationObserver(mutationHandler);
};
