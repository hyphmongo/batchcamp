import { afterEach, describe, expect, it } from "vitest";

import {
  appendCheckboxInput,
  makeCollectionItem,
  makePurchaseItem,
  mountInBody,
  resetContentDom,
} from "@/content/__tests__/dom-fixtures";
import { extractDownloadItem } from "@/content/shared/item-extractor";

afterEach(resetContentDom);

describe("extractDownloadItem — purchase titles containing ' by '", () => {
  it("splits artist from title at the last ' by ', not the first", () => {
    const item = makePurchaseItem({
      title: "Stand by Me",
      artist: "Ben E. King",
    });
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "purchase")?.title).toBe(
      "Ben E. King - Stand by Me",
    );
  });
});

describe("extractDownloadItem — collection", () => {
  it("extracts a pending item from a collection row", () => {
    const item = makeCollectionItem();
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "collection")).toEqual({
      id: "123456",
      status: "pending",
      url: "https://bandcamp.com/download?id=123456",
      title: "Radiohead - OK Computer",
      artUrl: "https://f4.bcbits.com/img/a123_10.jpg",
    });
  });

  it("returns null when the row has no download link", () => {
    const item = makeCollectionItem({ withRedownload: false });
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "collection")).toBeNull();
  });

  it("returns null when the row has no id attribute", () => {
    const item = makeCollectionItem();
    item.removeAttribute("data-tralbumid");
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "collection")).toBeNull();
  });

  it("returns null when the checkbox is not inside an item container", () => {
    const input = document.createElement("input");
    mountInBody(input);

    expect(extractDownloadItem(input, "collection")).toBeNull();
  });
});

describe("extractDownloadItem — purchase", () => {
  it("extracts a pending item and reorders title to 'artist - title'", () => {
    const item = makePurchaseItem();
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "purchase")).toEqual({
      id: "67890",
      status: "pending",
      url: "https://bandcamp.com/download?sale=67890",
      title: "Joy Orbison - Hyph Mngo",
      artUrl: "https://f4.bcbits.com/img/a456_10.jpg",
    });
  });

  it("returns null when the purchase row has no download link", () => {
    const item = makePurchaseItem({ withLinks: false });
    const input = appendCheckboxInput(item);
    mountInBody(item);

    expect(extractDownloadItem(input, "purchase")).toBeNull();
  });
});
