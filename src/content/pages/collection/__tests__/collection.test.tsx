import { screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  makeCollectionItem,
  makeCollectionPage,
  mountInBody,
  resetContentDom,
  settleObserver,
} from "@/content/__tests__/dom-fixtures";
import { setupCollectionPage } from "@/content/pages/collection/collection";
import { store } from "@/content/store";

const selectionCheckbox = (item: HTMLElement, id: string) =>
  within(item).getByLabelText(`Select item ${id} for download`);

afterEach(resetContentDom);

describe("setupCollectionPage", () => {
  it("makes every downloadable item selectable", () => {
    const { root, items } = makeCollectionPage([{ id: "111" }, { id: "222" }]);
    mountInBody(root);

    setupCollectionPage();

    expect(selectionCheckbox(items[0]!, "111")).toBeInTheDocument();
    expect(selectionCheckbox(items[1]!, "222")).toBeInTheDocument();
  });

  it("offers a select-all action", () => {
    mountInBody(makeCollectionPage().root);

    setupCollectionPage();

    expect(
      screen.getByRole("button", { name: "Select All" }),
    ).toBeInTheDocument();
  });

  it("surfaces a download action once an item is selected", async () => {
    const user = userEvent.setup();
    const { root, items } = makeCollectionPage([{ id: "111" }]);
    mountInBody(root);
    setupCollectionPage();

    await user.click(selectionCheckbox(items[0]!, "111"));

    expect(
      screen.getByRole("button", { name: "Download 1 release" }),
    ).toBeInTheDocument();
  });

  it("selects every item when the user clicks Select All", async () => {
    const user = userEvent.setup();
    mountInBody(makeCollectionPage([{ id: "111" }, { id: "222" }]).root);
    setupCollectionPage();

    await user.click(screen.getByRole("button", { name: "Select All" }));

    expect(
      await screen.findByRole("button", { name: "Download 2 releases" }),
    ).toBeInTheDocument();
  });

  it("with download history, 'Undownloaded' selects only not-yet-downloaded items", async () => {
    const user = userEvent.setup();
    store.getState().setDownloadedIds(new Set(["111"]));
    mountInBody(makeCollectionPage([{ id: "111" }, { id: "222" }]).root);
    setupCollectionPage();

    await user.click(screen.getByRole("menuitem", { name: "Undownloaded" }));

    expect(
      await screen.findByRole("button", { name: "Download 1 release" }),
    ).toBeInTheDocument();
  });

  it("'Undownloaded' ignores a held shift key and still skips downloaded items", async () => {
    const user = userEvent.setup();
    store.getState().setDownloadedIds(new Set(["111"]));
    mountInBody(
      makeCollectionPage([{ id: "111" }, { id: "222" }, { id: "333" }]).root,
    );
    setupCollectionPage();
    store.setState({ shiftKeyPressed: true, lastClickedIndex: 0 });

    await user.click(screen.getByRole("menuitem", { name: "Undownloaded" }));

    expect(
      await screen.findByRole("button", { name: "Download 2 releases" }),
    ).toBeInTheDocument();
  });

  it("removes the chevron and disables the button while a selection is loading", async () => {
    vi.useFakeTimers();
    try {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      store.getState().setDownloadedIds(new Set(["seed"]));
      mountInBody(makeCollectionPage([{ id: "111" }], { count: 5 }).root);
      setupCollectionPage();

      const selectAll = screen.getByRole("button", { name: "Select All" });
      expect(screen.getByLabelText("Select all options")).toBeInTheDocument();

      void user.click(selectAll);
      await vi.advanceTimersByTimeAsync(0);

      expect(
        screen.queryByLabelText("Select all options"),
      ).not.toBeInTheDocument();
      expect(selectAll).toBeDisabled();

      await vi.advanceTimersByTimeAsync(20_000);

      expect(screen.getByLabelText("Select all options")).toBeInTheDocument();
      expect(selectAll).not.toBeDisabled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("leaves an item without a download link unselectable", () => {
    const { root, grid } = makeCollectionPage([{ id: "111" }]);
    grid.appendChild(makeCollectionItem({ id: "999", withRedownload: false }));
    mountInBody(root);

    setupCollectionPage();

    expect(
      screen.queryByLabelText("Select item 999 for download"),
    ).not.toBeInTheDocument();
  });

  it("makes items that load in after setup selectable too", async () => {
    const { root, grid } = makeCollectionPage([{ id: "111" }]);
    mountInBody(root);
    setupCollectionPage();

    grid.appendChild(makeCollectionItem({ id: "333" }));
    await settleObserver();

    expect(
      screen.getByLabelText("Select item 333 for download"),
    ).toBeInTheDocument();
  });

  it("stops making newly loaded items selectable after teardown", async () => {
    const { root, grid } = makeCollectionPage([{ id: "111" }]);
    mountInBody(root);
    setupCollectionPage();

    resetContentDom();
    mountInBody(grid);

    grid.appendChild(makeCollectionItem({ id: "444" }));
    await settleObserver();

    expect(
      screen.queryByLabelText("Select item 444 for download"),
    ).not.toBeInTheDocument();
  });
});
