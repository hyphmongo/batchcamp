import { invalidateCheckboxCache } from "@/content/elements/checkbox";
import { createSelectAllButton } from "@/content/elements/select-all-button";
import {
  injectCheckbox,
  PURCHASE_CHECKBOX,
} from "@/content/shared/inject-checkbox";
import { createOnChecked } from "@/content/shared/on-checked";
import { createPageController } from "@/content/shared/page-setup";
import { store } from "@/content/store";
import { addBreadcrumb, captureError } from "@/shared/error-handler";

const onChecked = createOnChecked("purchase");

const addCheckbox = (item: Element) => {
  if (injectCheckbox(item, PURCHASE_CHECKBOX, onChecked)) {
    invalidateCheckboxCache();
  }
};

const mutationHandler = (mutations: MutationRecord[]) => {
  try {
    for (const mutation of mutations) {
      for (const item of mutation.addedNodes) {
        const element = item as Element;

        if (
          element.nodeType === 1 &&
          element.classList.contains("purchases-item")
        ) {
          addCheckbox(element);
        }
      }
    }
  } catch (error) {
    captureError(error, {}, { operation: "purchases_mutation_observer" });
  }
};

export const parseItemTarget = (text: string): number => {
  const total = text.match(/of ([\d,]+)/)?.[1];
  return total ? Number.parseInt(total.replace(/,/g, ""), 10) : 0;
};

const getSelectAllButton = () => {
  const target = parseItemTarget(
    document.querySelector(".page-items-number")?.parentElement?.textContent ||
      "",
  );

  const showMore = document.querySelector(
    ".view-all-button",
  ) as HTMLElement | null;

  const container = document.querySelector<HTMLElement>(".purchases");

  if (!container) {
    return null;
  }

  const hasHistory = store.getState().downloadedIds.size > 0;

  return createSelectAllButton(
    target,
    showMore,
    container,
    "purchases-item",
    hasHistory,
  );
};

export const setupPurchasesPage = createPageController({
  observeOptions: { childList: true, subtree: true },
  createObserver: () => new MutationObserver(mutationHandler),
  resolve: () => {
    const container = document.getElementById("oh-container");

    if (!container) {
      addBreadcrumb({
        category: "content.init",
        message: "Purchases setup bail: #oh-container not found",
        level: "warning",
      });
      return null;
    }

    return [container];
  },
  injectExistingCheckboxes: () => {
    for (const item of document.getElementsByClassName("purchases-item")) {
      addCheckbox(item);
    }
  },
  getSelectAllButton,
});
