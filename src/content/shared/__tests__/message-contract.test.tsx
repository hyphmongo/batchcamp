import { describe, expect, it } from "vitest";

import {
  appendCheckboxInput,
  makeCollectionItem,
  makePurchaseItem,
  mountInBody,
  resetContentDom,
} from "@/content/__tests__/dom-fixtures";
import { extractDownloadItem } from "@/content/shared/item-extractor";
import { parseMessage } from "@/messages";

const extract = (pageType: "collection" | "purchase") => {
  const item =
    pageType === "collection" ? makeCollectionItem() : makePurchaseItem();
  const input = appendCheckboxInput(item);
  mountInBody(item);
  const extracted = extractDownloadItem(input, pageType);
  resetContentDom();
  return extracted;
};

describe("items extracted from Bandcamp survive the cross-context message schema", () => {
  it.each(["collection", "purchase"] as const)(
    "accepts a %s item the content script really produces",
    (pageType) => {
      const extracted = extract(pageType);
      expect(extracted).not.toBeNull();

      expect(
        parseMessage({
          type: "send-items-to-background",
          items: [extracted],
        }),
      ).not.toBeNull();
    },
  );
});
