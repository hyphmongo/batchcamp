import type { PendingItem } from "@/types";

interface PageSelectors {
  container: string;
  idAttribute: string;
  downloadLink: string;
  titleElement: string;
  artistElement?: string;
  artImage: string;
}

const COLLECTION_SELECTORS: PageSelectors = {
  container: ".collection-item-container",
  idAttribute: "data-tralbumid",
  downloadLink: ".redownload-item a",
  titleElement: ".collection-item-title",
  artistElement: ".collection-item-artist",
  artImage: ".collection-item-art-container img",
};

const PURCHASE_SELECTORS: PageSelectors = {
  container: ".purchases-item",
  idAttribute: "sale_item_id",
  downloadLink: '[data-tid="download"]',
  titleElement: ".purchases-item-title",
  artImage: ".purchases-item-art-container img",
};

export const extractDownloadItem = (
  eventTarget: HTMLInputElement,
  pageType: "collection" | "purchase",
): PendingItem | null => {
  const selectors =
    pageType === "collection" ? COLLECTION_SELECTORS : PURCHASE_SELECTORS;

  const container = eventTarget.closest(selectors.container);
  if (!container) {
    return null;
  }

  const id = container.getAttribute(selectors.idAttribute);
  if (!id) {
    return null;
  }

  const downloadElement = container.querySelector(selectors.downloadLink);

  if (!(downloadElement instanceof HTMLAnchorElement)) {
    return null;
  }

  let title: string;

  if (pageType === "collection") {
    const titleText = container
      .querySelector(selectors.titleElement)
      ?.textContent?.split("\n")[0]
      ?.trim();

    const artistText = selectors.artistElement
      ? container
          .querySelector(selectors.artistElement)
          ?.textContent?.replace("by ", "")
          .trim()
      : undefined;

    title = [artistText, titleText].filter(Boolean).join(" - ") || "Unknown";
  } else {
    const text = container.querySelector(selectors.titleElement)?.textContent;

    if (!text) {
      return null;
    }

    const splitAt = text.lastIndexOf(" by ");
    const titlePart = (splitAt === -1 ? text : text.slice(0, splitAt)).trim();
    const artistPart = splitAt === -1 ? "" : text.slice(splitAt + 4).trim();
    title = artistPart ? `${artistPart} - ${titlePart}` : titlePart;
  }

  const url =
    pageType === "purchase"
      ? new URL(downloadElement.href).toString()
      : downloadElement.href;

  const artImg = container.querySelector<HTMLImageElement>(selectors.artImage);
  const artUrl = artImg?.src || undefined;

  return {
    id,
    status: "pending",
    url,
    title,
    artUrl,
  };
};
