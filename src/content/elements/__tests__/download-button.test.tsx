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
