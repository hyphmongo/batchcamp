import { afterEach, describe, expect, it, vi } from "vitest";

import {
  parseCartBlob,
  setupCartDownloadPage,
} from "@/content/pages/cart-download";
import { store } from "@/content/store";
import {
  makeCartBlob,
  makeCartDownloadPage,
  mountInBody,
  resetContentDom,
  settleObserver,
} from "./dom-fixtures";

const PAGE_URL = "https://bandcamp.com/download?cart_id=24681012&sig=abc";

afterEach(() => {
  resetContentDom();
});

const sentItems = (spy: ReturnType<typeof vi.spyOn>) => {
  const call = spy.mock.calls.find(
    (args: unknown[]) =>
      (args[0] as { type?: string })?.type === "send-items-to-background",
  );
  return (call?.[0] as unknown as { items?: unknown[] })?.items;
};

describe("parseCartBlob", () => {
  it("returns nothing when there is no blob", () => {
    expect(parseCartBlob(null, PAGE_URL)).toEqual([]);
  });

  it("returns nothing for malformed json", () => {
    expect(parseCartBlob("{not json", PAGE_URL)).toEqual([]);
  });

  it("handles single-item download pages, which are not flagged multidownload", () => {
    const blob = makeCartBlob([{}], { multidownload: false });
    expect(parseCartBlob(blob, PAGE_URL)).toHaveLength(1);
  });

  it("ignores items with no downloads, as on an expired link", () => {
    const blob = JSON.stringify({
      multidownload: true,
      digital_items: [
        { item_id: 1, title: "Gone", downloads: {} },
        { item_id: 2, title: "Also gone" },
      ],
    });

    expect(parseCartBlob(blob, PAGE_URL)).toEqual([]);
  });

  it("builds one pending item per purchased release", () => {
    const items = parseCartBlob(makeCartBlob([{}, {}]), PAGE_URL);

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      id: "1000000001",
      itemId: "1000000001",
      status: "pending",
      url: PAGE_URL,
      title: "Tidal Hum - Slow Water",
      artUrl: "https://f4.bcbits.com/img/a2000000001_10.jpg",
    });
  });

  it("falls back to a placeholder title when the blob has neither field", () => {
    const blob = JSON.stringify({
      multidownload: true,
      digital_items: [{ item_id: 7, downloads: { flac: { url: "u" } } }],
    });

    expect(parseCartBlob(blob, PAGE_URL)[0]).toMatchObject({
      id: "7",
      title: "Unknown",
    });
  });

  it("skips entries with no usable id", () => {
    const blob = JSON.stringify({
      multidownload: true,
      digital_items: [
        { title: "Orphan", downloads: { flac: { url: "u" } } },
        { item_id: 9, title: "Keeper", downloads: { flac: { url: "u" } } },
      ],
    });

    expect(parseCartBlob(blob, PAGE_URL).map((i) => i.id)).toEqual(["9"]);
  });
});

describe("cart download page", () => {
  it("puts a checkbox in each row's own gutter, not over the artwork", async () => {
    const { root } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    const checkboxes = root.querySelectorAll<HTMLInputElement>(
      "li.download_list_item > .bc-checkbox",
    );

    expect(checkboxes).toHaveLength(2);
    expect(root.querySelectorAll("a.art-link .bc-checkbox")).toHaveLength(0);
    expect([...checkboxes].map((c) => c.getAttribute("data-id"))).toEqual([
      "1000000001",
      "1000000002",
    ]);
  });

  it("selects the matching blob item when a checkbox is ticked", async () => {
    const { root } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    root
      .querySelector<HTMLInputElement>('.bc-checkbox[data-id="1000000002"]')
      ?.click();

    expect(store.getState().selected["1000000002"]).toMatchObject({
      itemId: "1000000002",
      title: "Northline - Harbour Dub",
      status: "pending",
    });
  });

  it("matches rows by their download link rather than position", async () => {
    const { root, rows } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    const list = root.querySelector(".download_list");
    const [first, second] = rows;
    if (list && first && second) {
      list.insertBefore(second, first);
    }

    setupCartDownloadPage();
    await settleObserver();

    const ids = [...root.querySelectorAll(".bc-checkbox")].map((c) =>
      c.getAttribute("data-id"),
    );

    expect(ids).toEqual(["1000000002", "1000000001"]);
  });

  it("does not inject twice when the observer fires again", async () => {
    const { root, list } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    list?.appendChild(document.createElement("li"));
    await settleObserver();

    expect(root.querySelectorAll(".bc-checkbox")).toHaveLength(2);
  });

  it("stays out of the way when the link has expired", async () => {
    const { root } = makeCartDownloadPage([{}, {}], { expired: true });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    expect(root.querySelectorAll(".bc-checkbox")).toHaveLength(0);
    expect(document.querySelector(".bc-download-wrapper")).toBeNull();
  });

  it("still offers the download on a single-item page with no list", async () => {
    const { root, list } = makeCartDownloadPage([{}], {
      multidownload: false,
      listVisible: false,
    });
    list?.remove();
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    expect(root.querySelectorAll(".bc-checkbox")).toHaveLength(0);
    expect(document.querySelector(".bc-split-btn-main")?.textContent).toBe(
      "Download 1 release",
    );
  });

  it("offers the whole order in one click, with no Select All to wade through", async () => {
    const { root } = makeCartDownloadPage([{}, {}, {}], { listVisible: false });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    expect(
      document.querySelector(".bc-download-wrapper")?.classList,
    ).not.toContain("bc-hidden");
    expect(document.querySelector(".bc-split-btn-main")?.textContent).toBe(
      "Download all 3 releases",
    );
    expect(document.querySelector(".bc-select-all-btn")).toBeNull();
  });

  it("keeps offering the download when the list is opened", async () => {
    const { root } = makeCartDownloadPage([{}, {}], { listVisible: false });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    const main = document.querySelector(".bc-split-btn-main");
    expect(main?.textContent).toBe("Download all 2 releases");

    root.querySelector(".download")?.classList.add("downloads-visible");
    await settleObserver();

    expect(
      document.querySelector(".bc-download-wrapper")?.classList,
    ).not.toContain("bc-hidden");
    expect(main?.textContent).toBe("Download all 2 releases");
  });

  it("narrows to the ticked items once the user picks some", async () => {
    const { root } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    root.querySelector<HTMLInputElement>(".bc-checkbox")?.click();
    await settleObserver();

    expect(document.querySelector(".bc-split-btn-main")?.textContent).toBe(
      "Download 1 release",
    );
  });

  it("does not say 'all' when the order is a single release", async () => {
    const { root } = makeCartDownloadPage([{}], { listVisible: false });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    expect(document.querySelector(".bc-split-btn-main")?.textContent).toBe(
      "Download 1 release",
    );
  });

  it("respects an empty selection once the user has started picking", async () => {
    const { root } = makeCartDownloadPage([{}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    const checkbox = root.querySelector<HTMLInputElement>(".bc-checkbox");
    checkbox?.click();
    await settleObserver();
    checkbox?.click();
    await settleObserver();

    expect(store.getState().selectedCount()).toBe(0);
    expect(document.querySelector(".bc-download-wrapper")?.classList).toContain(
      "bc-hidden",
    );
  });

  it("sends every purchased item when nothing was ticked", async () => {
    const sendMessage = vi.spyOn(chrome.runtime, "sendMessage");
    const { root } = makeCartDownloadPage([{}, {}, {}], { listVisible: false });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    document.querySelector<HTMLElement>(".bc-split-btn-main")?.click();

    await vi.waitFor(() => {
      expect(sentItems(sendMessage)).toHaveLength(3);
    });

    sendMessage.mockRestore();
  });

  it("sends only the ticked items when the user picked some", async () => {
    const sendMessage = vi.spyOn(chrome.runtime, "sendMessage");
    const { root } = makeCartDownloadPage([{}, {}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    root
      .querySelector<HTMLInputElement>('.bc-checkbox[data-id="1000000002"]')
      ?.click();
    document.querySelector<HTMLElement>(".bc-split-btn-main")?.click();

    await vi.waitFor(() => {
      expect(sentItems(sendMessage)).toHaveLength(1);
    });

    sendMessage.mockRestore();
  });

  it("sends every purchased item even when the page renders fewer rows", async () => {
    const sendMessage = vi.spyOn(chrome.runtime, "sendMessage");
    const { root } = makeCartDownloadPage([{}, {}, {}]);
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    root.querySelectorAll(".download_list_item")[2]?.remove();
    await settleObserver();

    expect(root.querySelectorAll(".bc-checkbox")).toHaveLength(2);

    document.querySelector<HTMLElement>(".bc-split-btn-main")?.click();

    await vi.waitFor(() => {
      expect(sentItems(sendMessage)).toHaveLength(3);
    });

    sendMessage.mockRestore();
  });

  it("injects checkboxes before the list is ever opened", async () => {
    const { root } = makeCartDownloadPage([{}, {}], { listVisible: false });
    mountInBody(root);

    setupCartDownloadPage();
    await settleObserver();

    expect(root.querySelectorAll(".bc-checkbox")).toHaveLength(2);
  });
});
