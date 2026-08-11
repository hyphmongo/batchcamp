import {
  createCheckbox,
  invalidateCheckboxCache,
} from "@/content/elements/checkbox";
import { createPageController } from "@/content/shared/page-setup";
import { store } from "@/content/store";
import { addBreadcrumb, captureError } from "@/shared/error-handler";
import type { PendingItem } from "@/types";

const ROW = "li.download_list_item";
const LIST = "ul.download_list";

export const parseCartBlob = (
  raw: string | null,
  pageUrl: string,
): PendingItem[] => {
  if (!raw) {
    return [];
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }

  const blob = data as { digital_items?: unknown };

  if (!Array.isArray(blob.digital_items)) {
    return [];
  }

  return blob.digital_items.flatMap((entry) => {
    const item = entry as Record<string, unknown>;
    const bandcampId = item.item_id ?? item.sale_id;

    if (typeof bandcampId !== "number" && typeof bandcampId !== "string") {
      return [];
    }

    const downloads = item.downloads;

    if (
      typeof downloads !== "object" ||
      downloads === null ||
      Object.keys(downloads).length === 0
    ) {
      return [];
    }

    const id = String(bandcampId);
    const title = typeof item.title === "string" ? item.title : "";
    const artist = typeof item.artist === "string" ? item.artist : "";
    const artId = typeof item.art_id === "number" ? item.art_id : undefined;

    return [
      {
        id,
        itemId: id,
        status: "pending" as const,
        url: pageUrl,
        title: [artist, title].filter(Boolean).join(" - ") || "Unknown",
        artUrl: artId
          ? `https://f4.bcbits.com/img/a${artId}_10.jpg`
          : undefined,
      },
    ];
  });
};

const isLinkExpired = () => {
  const error = document.querySelector(".email-reauth-error");

  return error !== null && error.getClientRects().length > 0;
};

const readBlob = () =>
  document.getElementById("pagedata")?.getAttribute("data-blob") ?? null;

export const readCartItems = (): PendingItem[] =>
  parseCartBlob(readBlob(), window.location.href);

let cartItems = new Map<string, PendingItem>();

const rowItemId = (row: Element, index: number): string | null => {
  const anchor = row.querySelector<HTMLAnchorElement>("a.item-button[href]");

  if (anchor) {
    try {
      const tail = new URL(anchor.href).pathname.split("/").pop();
      if (tail && cartItems.has(tail)) {
        return tail;
      }
    } catch {
      // fall through to positional matching
    }
  }

  return [...cartItems.keys()][index] ?? null;
};

let hasCurated = false;

const onChecked = (target: HTMLInputElement) => {
  const { updateSelected } = store.getState();
  const id = target.getAttribute("data-id");

  if (!id) {
    return;
  }

  hasCurated = true;

  if (!target.checked) {
    updateSelected(id, false, null);
    return;
  }

  const item = cartItems.get(id);

  if (item) {
    updateSelected(id, true, item);
  }
};

const injectCheckboxes = () => {
  document.querySelectorAll(ROW).forEach((row, index) => {
    if (row.querySelector(".bc-checkbox")) {
      return;
    }

    const id = rowItemId(row, index);

    if (!id) {
      return;
    }

    row.appendChild(createCheckbox(id, store, onChecked));
    invalidateCheckboxCache();
  });
};

const mutationHandler = (mutations: MutationRecord[]) => {
  try {
    const relevant = mutations.some((mutation) => {
      if (mutation.type === "attributes") {
        return (mutation.target as Element).classList?.contains("download");
      }

      return [...mutation.addedNodes].some(
        (node) =>
          node.nodeType === 1 &&
          ((node as Element).matches?.(`${ROW}, ${LIST}`) ||
            (node as Element).querySelector?.(ROW)),
      );
    });

    if (relevant) {
      injectCheckboxes();
    }

    return relevant;
  } catch (error) {
    captureError(error, {}, { operation: "cart_download_mutation_observer" });
    return false;
  }
};

const syncCheckboxes = () => {
  const { selected } = store.getState();

  for (const element of document.querySelectorAll<HTMLInputElement>(
    ".bc-checkbox",
  )) {
    const id = element.getAttribute("data-id");
    if (id) {
      element.checked = Boolean(selected[id]);
    }
  }
};

const selectPurchasedItems = async () => {
  const { updateSelected, toggleShiftKey } = store.getState();

  toggleShiftKey(false);

  for (const [id, item] of cartItems) {
    updateSelected(id, true, item);
  }

  syncCheckboxes();
};

export const setupCartDownloadPage = createPageController({
  observeOptions: {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
  },
  createObserver: (syncButtons) =>
    new MutationObserver((mutations) => {
      if (mutationHandler(mutations)) {
        syncButtons();
      }
    }),
  resolve: () => {
    if (isLinkExpired()) {
      addBreadcrumb({
        category: "content.init",
        message: "Download setup bail: link expired, Bandcamp wants re-auth",
        level: "info",
      });
      return null;
    }

    const items = readCartItems();

    if (items.length === 0) {
      addBreadcrumb({
        category: "content.init",
        message: "Cart download setup bail: no multidownload items in pagedata",
        level: "warning",
      });
      return null;
    }

    cartItems = new Map(items.map((item) => [item.id, item]));
    hasCurated = false;

    addBreadcrumb({
      category: "content.init",
      message: `Cart download page with ${items.length} item(s)`,
      level: "info",
    });

    return [document.body];
  },
  injectExistingCheckboxes: injectCheckboxes,
  getSelectAllButton: () => null,
  bulkCount: () => (!hasCurated && cartItems.size > 0 ? cartItems.size : null),
  beforeSend: async () => {
    if (store.getState().selectedCount() === 0) {
      await selectPurchasedItems();
    }
  },
});
