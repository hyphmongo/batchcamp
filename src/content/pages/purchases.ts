import { BANDCAMP, reportMissingMarkup } from "@/content/bandcamp-dom";
import { invalidateCheckboxCache } from "@/content/elements/checkbox";
import { createSelectAllButton } from "@/content/elements/select-all-button";
import {
  injectCheckbox,
  PURCHASE_CHECKBOX,
} from "@/content/shared/inject-checkbox";
import { createCollect, createOnChecked } from "@/content/shared/on-checked";
import { createPageController } from "@/content/shared/page-setup";
import { store } from "@/content/store";
import { addBreadcrumb, captureError } from "@/shared/error-handler";

const onChecked = createOnChecked("purchase");
const collect = createCollect("purchase");

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

const expectedItemCount = () =>
  parseItemTarget(
    document.querySelector(BANDCAMP.purchasesCount)?.parentElement
      ?.textContent || "",
  );

const getSelectAllButton = () => {
  const target = parseItemTarget(
    document.querySelector(BANDCAMP.purchasesCount)?.parentElement
      ?.textContent || "",
  );

  const showMore = document.querySelector(
    ".view-all-button",
  ) as HTMLElement | null;

  const container = document.querySelector<HTMLElement>(BANDCAMP.purchases);

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
    collect,
  );
};

export const setupPurchasesPage = createPageController({
  source: "purchases",
  observeOptions: { childList: true, subtree: true },
  createObserver: () => new MutationObserver(mutationHandler),
  resolve: () => {
    const container = document.getElementById(BANDCAMP.purchasesContainer);

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
    const items = document.getElementsByClassName(BANDCAMP.purchasesItem);

    if (items.length === 0 && expectedItemCount() > 0) {
      reportMissingMarkup("purchases", BANDCAMP.purchasesItem, {
        expected: expectedItemCount(),
      });
    }

    for (const item of items) {
      addCheckbox(item);
    }
  },
  getSelectAllButton,
});
