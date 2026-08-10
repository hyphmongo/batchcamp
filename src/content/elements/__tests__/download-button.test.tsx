import { waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import browser from "webextension-polyfill";
import { createStore } from "zustand/vanilla";

import { createDownloadButton } from "@/content/elements/download-button";
import type { ContentState } from "@/content/store";
import { configurationStore } from "@/storage";
import type { Item } from "@/types";

const makeContentStore = (selected: Record<string, Item>) =>
  createStore<ContentState>()(() => ({
    selected,
    downloadedIds: new Set(),
    shiftKeyPressed: false,
    lastClickedIndex: 0,
    updateSelected: () => {},
    resetSelected: () => {},
    selectedCount: () => Object.keys(selected).length,
    toggleShiftKey: () => {},
    setLastClickedIndex: () => {},
    setDownloadedIds: () => {},
  }));

describe("createDownloadButton format dropdown", () => {
  let setSpy: ReturnType<typeof vi.spyOn>;
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setSpy = vi.spyOn(configurationStore, "set");
    sendMessageSpy = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    setSpy.mockRestore();
    sendMessageSpy.mockRestore();
  });

  it("does NOT mutate configurationStore when a per-batch format is picked", async () => {
    const user = userEvent.setup();
    const item = {
      id: "1",
      title: "Test",
      status: "pending",
      url: "https://bc.com/track/1",
    } as Item;
    const store = makeContentStore({ "1": item });

    const button = createDownloadButton(store);
    document.body.appendChild(button);

    await user.click(within(button).getByRole("menuitem", { name: "WAV" }));

    await waitFor(() => expect(sendMessageSpy).toHaveBeenCalled());
    expect(setSpy).not.toHaveBeenCalled();
    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: "send-items-to-background",
      items: [expect.objectContaining({ id: "1", format: "wav" })],
    });

    button.remove();
  });
});

describe("createDownloadButton send behaviour", () => {
  let sendMessageSpy: ReturnType<typeof vi.spyOn>;

  const makeItem = () =>
    ({
      id: "1",
      title: "Test",
      status: "pending",
      url: "https://bc.com/track/1",
    }) as Item;

  afterEach(() => {
    sendMessageSpy.mockRestore();
  });

  it("sends one batch when the button is clicked twice in quick succession", async () => {
    const user = userEvent.setup();
    let release: (() => void) | undefined;
    sendMessageSpy = vi.spyOn(browser.runtime, "sendMessage").mockReturnValue(
      new Promise<void>((resolve) => {
        release = () => resolve();
      }),
    );

    const button = createDownloadButton(makeContentStore({ "1": makeItem() }));
    button.setLabel("Download 1 release");
    document.body.appendChild(button);

    const main = within(button).getByRole("button", {
      name: /download 1 release/i,
    });
    await user.click(main);
    await user.click(main);

    expect(sendMessageSpy).toHaveBeenCalledTimes(1);

    release?.();
    button.remove();
  });

  it("keeps the selection when the background never receives the batch", async () => {
    const user = userEvent.setup();
    sendMessageSpy = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockRejectedValue(new Error("no receiving end"));

    let resetCalls = 0;
    const store = makeContentStore({ "1": makeItem() });
    store.setState({ resetSelected: () => resetCalls++ });

    const button = createDownloadButton(store);
    button.setLabel("Download 1 release");
    document.body.appendChild(button);

    await user.click(
      within(button).getByRole("button", { name: /download 1 release/i }),
    );

    await waitFor(() => expect(sendMessageSpy).toHaveBeenCalled());
    expect(resetCalls).toBe(0);

    button.remove();
  });

  it("opens the format menu from the keyboard and sends the chosen format", async () => {
    const user = userEvent.setup();
    sendMessageSpy = vi
      .spyOn(browser.runtime, "sendMessage")
      .mockResolvedValue(undefined);

    const button = createDownloadButton(makeContentStore({ "1": makeItem() }));
    document.body.appendChild(button);

    const trigger = within(button).getByRole("button", {
      name: /choose download format/i,
    });
    trigger.focus();
    await user.keyboard("{ArrowDown}");

    const firstItem = within(button).getAllByRole("menuitem")[0]!;
    expect(firstItem).toHaveFocus();

    await user.keyboard("{Enter}");

    await waitFor(() => expect(sendMessageSpy).toHaveBeenCalled());
    expect(sendMessageSpy).toHaveBeenCalledWith({
      type: "send-items-to-background",
      items: [expect.objectContaining({ id: "1", format: "mp3-v0" })],
    });

    button.remove();
  });
});
