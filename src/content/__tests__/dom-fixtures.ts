import { store } from "@/content/store";

interface CollectionItemSpec {
  id?: string;
  title?: string;
  artist?: string;
  href?: string;
  artUrl?: string;
  withRedownload?: boolean;
}

export const makeCollectionItem = (
  spec: CollectionItemSpec = {},
): HTMLElement => {
  const {
    id = "123456",
    title = "OK Computer",
    artist = "Radiohead",
    href = "https://bandcamp.com/download?id=123456",
    artUrl = "https://f4.bcbits.com/img/a123_10.jpg",
    withRedownload = true,
  } = spec;

  const el = document.createElement("li");
  el.className = "collection-item-container";
  el.id = `collection-item-container_${id}`;
  el.setAttribute("data-tralbumid", id);
  el.innerHTML = `
    <div class="collection-item-art-container"><img src="${artUrl}" alt="" /></div>
    <div class="collection-item-title">${title}</div>
    <div class="collection-item-artist">by ${artist}</div>
    ${withRedownload ? `<div class="redownload-item"><a href="${href}">download</a></div>` : ""}
  `;
  return el;
};

interface PurchaseItemSpec {
  id?: string;
  title?: string;
  artist?: string;
  href?: string;
  artUrl?: string;
  withLinks?: boolean;
}

export const makePurchaseItem = (spec: PurchaseItemSpec = {}): HTMLElement => {
  const {
    id = "67890",
    title = "Hyph Mngo",
    artist = "Joy Orbison",
    href = "https://bandcamp.com/download?sale=67890",
    artUrl = "https://f4.bcbits.com/img/a456_10.jpg",
    withLinks = true,
  } = spec;

  const el = document.createElement("div");
  el.className = "purchases-item";
  el.setAttribute("sale_item_id", id);
  el.innerHTML = `
    <div class="purchases-item-art-container"><img src="${artUrl}" alt="" /></div>
    <div class="purchases-item-title">${title} by ${artist}</div>
    ${
      withLinks
        ? `<div data-tid="links"><a data-tid="download" href="${href}">download</a></div>`
        : ""
    }
  `;
  return el;
};

export const appendCheckboxInput = (item: HTMLElement): HTMLInputElement => {
  const input = document.createElement("input");
  input.type = "checkbox";
  item.appendChild(input);
  return input;
};

export const mountInBody = (el: HTMLElement): HTMLElement => {
  document.body.appendChild(el);
  return el;
};

export const resetContentDom = () => {
  window.dispatchEvent(new Event("pagehide"));
  document.body.innerHTML = "";
  store.getState().resetSelected();
  store.getState().setDownloadedIds(new Set());
};

const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

export const settleObserver = async () => {
  await nextFrame();
  await nextFrame();
};

export const makeCollectionPage = (
  itemSpecs: CollectionItemSpec[] = [{ id: "111" }, { id: "222" }],
  { count = itemSpecs.length }: { count?: number } = {},
): { root: HTMLElement; grid: HTMLElement; items: HTMLElement[] } => {
  const root = document.createElement("div");
  root.innerHTML = `
    <div id="grid-tabs"><div class="active"><span class="count">${count}</span></div></div>
    <div id="collection-grid" class="grid active"></div>
    <div id="collection-search-grid" class="grid"></div>
    <input id="collection-search" />
  `;
  const grid = root.querySelector<HTMLElement>("#collection-grid");
  if (!grid) {
    throw new Error("collection-grid fixture missing");
  }
  const items = itemSpecs.map((spec) => {
    const item = makeCollectionItem(spec);
    grid.appendChild(item);
    return item;
  });
  return { root, grid, items };
};

export const makePurchasesPage = (
  itemSpecs: PurchaseItemSpec[] = [{ id: "67890" }, { id: "67891" }],
): { root: HTMLElement; container: HTMLElement; items: HTMLElement[] } => {
  const root = document.createElement("div");
  root.id = "oh-container";
  root.innerHTML = `
    <div class="page-items-number-wrap"><span class="page-items-number">1-${itemSpecs.length}</span> of ${itemSpecs.length}</div>
    <div class="purchases"></div>
  `;
  const container = root.querySelector<HTMLElement>(".purchases");
  if (!container) {
    throw new Error("purchases container fixture missing");
  }
  const items = itemSpecs.map((spec) => {
    const item = makePurchaseItem(spec);
    container.appendChild(item);
    return item;
  });
  return { root, container, items };
};
