import { addBreadcrumb } from "@/shared/error-handler";

export const BANDCAMP = {
  pagedata: "pagedata",
  dataBlob: "data-blob",

  downloadList: "ul.download_list",
  downloadRow: "li.download_list_item",
  itemButton: "a.item-button[href]",
  reauthError: ".email-reauth-error",

  purchases: ".purchases",
  purchasesItem: "purchases-item",
  purchasesCount: ".page-items-number",
  purchasesContainer: "oh-container",

  collectionGrid: "collection-grid",
  collectionItem: "[id*='collection-item-container']",
  collectionSearchGrid: "collection-search-grid",
  collectionSearchInput: "collection-search",
  activeTab: "#grid-tabs>.active",
  activeTabCount: "#grid-tabs>.active .count",
} as const;

const reported = new Set<string>();

export const reportMissingMarkup = (
  where: string,
  selector: string,
  data: Record<string, unknown> = {},
) => {
  const key = `${where}:${selector}`;
  if (reported.has(key)) {
    return;
  }
  reported.add(key);
  addBreadcrumb({
    category: "content.markup",
    message: `Bandcamp markup no longer matches ${selector}`,
    data: { where, selector, ...data },
    level: "warning",
  });
};

export const resetMissingMarkupReports = () => reported.clear();
