import { afterEach, describe, expect, it } from "vitest";

import {
  appendCheckboxInput,
  makePurchaseItem,
  mountInBody,
  resetContentDom,
} from "@/content/__tests__/dom-fixtures";
import { createOnChecked } from "@/content/shared/on-checked";
import { store } from "@/content/store";

afterEach(resetContentDom);

describe("createOnChecked", () => {
  it("selects the item when a checkbox with a data-id is checked", () => {
    const item = makePurchaseItem({ id: "42" });
    const input = appendCheckboxInput(item);
    input.setAttribute("data-id", "42");
    input.checked = true;
    mountInBody(item);

    createOnChecked("purchase")(input);

    expect(store.getState().selected["42"]).toBeDefined();
  });

  it("unselects the item when the checkbox is unchecked", () => {
    const item = makePurchaseItem({ id: "42" });
    const input = appendCheckboxInput(item);
    input.setAttribute("data-id", "42");
    input.checked = true;
    mountInBody(item);
    const onChecked = createOnChecked("purchase");
    onChecked(input);
    expect(store.getState().selected["42"]).toBeDefined();

    input.checked = false;
    onChecked(input);

    expect(store.getState().selected["42"]).toBeUndefined();
  });

  it("ignores a checkbox without a data-id", () => {
    const item = makePurchaseItem({ id: "42" });
    const input = appendCheckboxInput(item);
    input.checked = true;
    mountInBody(item);

    createOnChecked("purchase")(input);

    expect(store.getState().selectedCount()).toBe(0);
  });

  it("does not select when the item details cannot be extracted", () => {
    const item = makePurchaseItem({ id: "42", withLinks: false });
    const input = appendCheckboxInput(item);
    input.setAttribute("data-id", "42");
    input.checked = true;
    mountInBody(item);

    createOnChecked("purchase")(input);

    expect(store.getState().selectedCount()).toBe(0);
  });
});
