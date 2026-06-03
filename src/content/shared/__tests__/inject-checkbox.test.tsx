import { within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  makeCollectionItem,
  makePurchaseItem,
  mountInBody,
  resetContentDom,
} from "@/content/__tests__/dom-fixtures";
import {
  COLLECTION_CHECKBOX,
  injectCheckbox,
  PURCHASE_CHECKBOX,
} from "@/content/shared/inject-checkbox";

const noop = () => {};

afterEach(resetContentDom);

describe("injectCheckbox", () => {
  it("gives a downloadable collection item a selection checkbox the user can find", () => {
    const item = mountInBody(makeCollectionItem({ id: "111" }));

    expect(injectCheckbox(item, COLLECTION_CHECKBOX, noop)).toBe(true);
    expect(
      within(item).getByLabelText("Select item 111 for download"),
    ).toBeInTheDocument();
  });

  it("gives a purchase item a selection checkbox", () => {
    const item = mountInBody(makePurchaseItem({ id: "222" }));

    expect(injectCheckbox(item, PURCHASE_CHECKBOX, noop)).toBe(true);
    expect(
      within(item).getByLabelText("Select item 222 for download"),
    ).toBeInTheDocument();
  });

  it("does not make an item selectable when it has no download link", () => {
    const item = mountInBody(
      makeCollectionItem({ id: "111", withRedownload: false }),
    );

    expect(injectCheckbox(item, COLLECTION_CHECKBOX, noop)).toBe(false);
    expect(
      within(item).queryByLabelText(/select item/i),
    ).not.toBeInTheDocument();
  });

  it("does not inject a second checkbox when the item already has one", () => {
    const item = mountInBody(makePurchaseItem({ id: "222" }));

    injectCheckbox(item, PURCHASE_CHECKBOX, noop);
    injectCheckbox(item, PURCHASE_CHECKBOX, noop);

    expect(
      within(item).getAllByLabelText("Select item 222 for download"),
    ).toHaveLength(1);
  });

  it("does not make a deleted or refunded purchase selectable", () => {
    const item = makePurchaseItem({ id: "333" });
    item.querySelector('[data-tid="links"]')?.classList.add("deleted-badge");
    mountInBody(item);

    expect(injectCheckbox(item, PURCHASE_CHECKBOX, noop)).toBe(false);
    expect(
      within(item).queryByLabelText(/select item/i),
    ).not.toBeInTheDocument();
  });

  it("does not make an item selectable when it has no id", () => {
    const item = makeCollectionItem({ id: "111" });
    item.removeAttribute("data-tralbumid");
    mountInBody(item);

    expect(injectCheckbox(item, COLLECTION_CHECKBOX, noop)).toBe(false);
    expect(
      within(item).queryByLabelText(/select item/i),
    ).not.toBeInTheDocument();
  });
});
