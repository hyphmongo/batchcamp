import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  makePurchaseItem,
  makePurchasesPage,
  mountInBody,
  resetContentDom,
  settleObserver,
} from "@/content/__tests__/dom-fixtures";
import { resetMissingMarkupReports } from "@/content/bandcamp-dom";
import { parseItemTarget, setupPurchasesPage } from "@/content/pages/purchases";
import { addBreadcrumb } from "@/shared/error-handler";

const selectionCheckbox = (item: HTMLElement, id: string) =>
  within(item).getByLabelText(`Select item ${id} for download`);

vi.mock("@/shared/error-handler", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  addBreadcrumb: vi.fn(),
}));

beforeEach(() => {
  vi.mocked(addBreadcrumb).mockClear();
  resetMissingMarkupReports();
});

afterEach(resetContentDom);

const markupWarnings = () =>
  vi
    .mocked(addBreadcrumb)
    .mock.calls.filter(([c]) => c?.category === "content.markup");

describe("noticing that bandcamp changed its markup", () => {
  it("says so when the page claims purchases but no item matches", async () => {
    const { root, items } = makePurchasesPage([{ id: "1" }, { id: "2" }]);
    for (const item of items) {
      item.className = "purchases-item-renamed";
    }
    mountInBody(root);

    setupPurchasesPage();
    await settleObserver();

    expect(markupWarnings()).not.toHaveLength(0);
  });

  it("stays quiet while the markup still matches", async () => {
    mountInBody(makePurchasesPage().root);

    setupPurchasesPage();
    await settleObserver();

    expect(markupWarnings()).toHaveLength(0);
  });

  it("stays quiet on a genuinely empty purchases page", async () => {
    mountInBody(makePurchasesPage([]).root);

    setupPurchasesPage();
    await settleObserver();

    expect(markupWarnings()).toHaveLength(0);
  });
});

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
