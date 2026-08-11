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

export interface CartItemSpec {
  itemId?: number;
  title?: string;
  artist?: string;
  artId?: number;
  ready?: boolean;
}

const CART_DEFAULTS: Required<CartItemSpec>[] = [
  {
    itemId: 1000000001,
    title: "Slow Water",
    artist: "Tidal Hum",
    artId: 2000000001,
    ready: true,
  },
  {
    itemId: 1000000002,
    title: "Harbour Dub",
    artist: "Northline",
    artId: 2000000001,
    ready: true,
  },
];

const CART_FALLBACK: Required<CartItemSpec> = {
  itemId: 900000000,
  title: "Untitled",
  artist: "Unknown Artist",
  artId: 111111111,
  ready: true,
};

const cartSpec = (
  spec: CartItemSpec,
  index: number,
): Required<CartItemSpec> => ({
  ...CART_FALLBACK,
  itemId: CART_FALLBACK.itemId + index,
  ...CART_DEFAULTS[index],
  ...spec,
});

export const makeCartBlob = (
  specs: CartItemSpec[],
  { multidownload = true }: { multidownload?: boolean } = {},
): string =>
  JSON.stringify({
    multidownload,
    digital_items: specs.map((raw, index) => {
      const spec = cartSpec(raw, index);
      return {
        item_id: spec.itemId,
        sale_id: spec.itemId + 1,
        item_type: "t",
        title: spec.title,
        artist: spec.artist,
        art_id: spec.artId,
        downloads: {
          "mp3-320": { url: "https://p4.bcbits.com/x", size_mb: "9MB" },
        },
      };
    }),
  });

export const makeCartDownloadPage = (
  specs: CartItemSpec[] = [{}, {}],
  {
    listVisible = true,
    multidownload = true,
    expired = false,
  }: {
    listVisible?: boolean;
    multidownload?: boolean;
    expired?: boolean;
  } = {},
): { root: HTMLElement; list: HTMLElement | null; rows: HTMLElement[] } => {
  const root = document.createElement("div");
  root.innerHTML = `
    <style>
      .bc-hidden { display: none; }
      .download:not(.downloads-visible) .download_list { display: none; }
    </style>
    <div id="pagedata"></div>
    ${expired ? '<div class="email-reauth-error"><div class="error-text">Download expired.</div></div>' : ""}
    <div class="download${listVisible ? " downloads-visible" : ""}">
      <ul class="downloads download_list"></ul>
    </div>
  `;

  const pagedata = root.querySelector("#pagedata");
  pagedata?.setAttribute("data-blob", makeCartBlob(specs, { multidownload }));

  const list = root.querySelector<HTMLElement>(".download_list");
  const rows = specs.map((raw, index) => {
    const spec = cartSpec(raw, index);
    const row = document.createElement("li");
    row.className = "download_list_item";
    row.innerHTML = `
      <a class="art-link download-list-item-artwork"><img class="art" alt="" /></a>
      <div class="download-item-stuff download-list-item-text">
        <div>
          <div class="title">${spec.title}</div>
          <div class="artist">by <span>${spec.artist}</span></div>
        </div>
        <select class="bc-select" id="format-type"><option>MP3 V0 - 9.9MB</option></select>
        <div class="item-button preparing-title">Preparing your download</div>
        ${
          spec.ready
            ? `<span class="download-title"><a class="item-button" href="https://p4.bcbits.com/download/track/hash/mp3-v0/${spec.itemId}?sitem_id=${spec.itemId + 1}">Download</a></span>`
            : ""
        }
      </div>
    `;
    list?.appendChild(row);
    return row;
  });

  return { root, list, rows };
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
    <style>.bc-hidden { display: none; }</style>
    <ol id="grid-tabs">
      <li data-tab="collection" class="active"><span class="count">${count}</span></li>
      <li data-tab="followers"><span class="count">3</span></li>
    </ol>
    <div id="collection-grid" class="grid active"></div>
    <div id="collection-search-grid" class="grid"></div>
    <div id="followers-grid" class="grid"></div>
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

export const activateTab = (tab: string) => {
  for (const item of document.querySelectorAll("#grid-tabs > li")) {
    item.classList.toggle("active", item.getAttribute("data-tab") === tab);
  }
  for (const grid of document.querySelectorAll(".grid")) {
    grid.classList.toggle("active", grid.id === `${tab}-grid`);
  }
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
