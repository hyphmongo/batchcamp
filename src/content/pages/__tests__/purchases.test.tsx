import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import {
  makePurchaseItem,
  makePurchasesPage,
  mountInBody,
  resetContentDom,
  settleObserver,
} from "@/content/__tests__/dom-fixtures";
import { parseItemTarget, setupPurchasesPage } from "@/content/pages/purchases";

const selectionCheckbox = (item: HTMLElement, id: string) =>
  within(item).getByLabelText(`Select item ${id} for download`);

afterEach(resetContentDom);

describe("parseItemTarget", () => {
  it("reads a comma-separated total without truncating it", () => {
    expect(parseItemTarget("1-20 of 1,234 items")).toBe(1234);
  });

  it("reads a plain total", () => {
    expect(parseItemTarget("1-20 of 45 items")).toBe(45);
  });

  it("returns 0 when no total is present", () => {
    expect(parseItemTarget("")).toBe(0);
  });
});

describe("setupPurchasesPage", () => {
  it("makes every purchased item selectable", () => {
    const { root, items } = makePurchasesPage([{ id: "1" }, { id: "2" }]);
    mountInBody(root);

    setupPurchasesPage();

    expect(selectionCheckbox(items[0]!, "1")).toBeInTheDocument();
    expect(selectionCheckbox(items[1]!, "2")).toBeInTheDocument();
  });

  it("surfaces a download action once a purchase is selected", async () => {
    const user = userEvent.setup();
    const { root, items } = makePurchasesPage([{ id: "1" }]);
    mountInBody(root);
    setupPurchasesPage();

    await user.click(selectionCheckbox(items[0]!, "1"));

    expect(
      screen.getByRole("button", { name: "Download 1 release" }),
    ).toBeInTheDocument();
  });

  it("makes purchases that load in after setup selectable too", async () => {
    const { root, container } = makePurchasesPage([{ id: "1" }]);
    mountInBody(root);
    setupPurchasesPage();

    container.appendChild(makePurchaseItem({ id: "3" }));
    await settleObserver();

    expect(
      screen.getByLabelText("Select item 3 for download"),
    ).toBeInTheDocument();
  });
});
