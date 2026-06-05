import { invalidateCheckboxCache } from "@/content/elements/checkbox";
import {
  COLLECTION_CHECKBOX,
  injectCheckbox,
} from "@/content/shared/inject-checkbox";
import { store } from "@/content/store";
import { captureError } from "@/shared/error-handler";

export const createMutationObserver = (
  onChecked: (target: HTMLInputElement) => void,
) => {
  let activeSection = "collection-grid";
  const pendingUpdates = new Set<() => void>();
  let updateScheduled = false;

  const scheduleUpdate = () => {
    if (updateScheduled) {
      return;
    }
    updateScheduled = true;

    requestAnimationFrame(() => {
      for (const update of pendingUpdates) {
        update();
      }
      pendingUpdates.clear();
      updateScheduled = false;
    });
  };

  const handleGridChange = (node: Element) => {
    const targets = ["collection-grid", "collection-search-grid"];
    const hasChanged = node.id !== activeSection && targets.includes(node.id);

    if (node.classList.contains("active") && hasChanged) {
      pendingUpdates.add(() => {
        activeSection = node.id;
        store.getState().setLastClickedIndex(0);
      });
      scheduleUpdate();
    }
  };

  const handleItemAddition = (node: Element) => {
    if (
      node.nodeType === 1 &&
      node.classList.contains("collection-item-container")
    ) {
      pendingUpdates.add(() => {
        if (injectCheckbox(node, COLLECTION_CHECKBOX, onChecked)) {
          invalidateCheckboxCache();
        }
      });
      scheduleUpdate();
    }
  };

  const mutationHandler = (mutations: MutationRecord[]) => {
    try {
      for (const mutation of mutations) {
        if (mutation.attributeName === "class") {
          handleGridChange(mutation.target as Element);
        }

        for (const item of mutation.addedNodes) {
          handleItemAddition(item as Element);
        }
      }
    } catch (error) {
      captureError(error, {}, { operation: "collection_mutation_observer" });
    }
  };

  return new MutationObserver(mutationHandler);
};
