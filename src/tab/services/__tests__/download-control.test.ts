import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useStore } from "@/tab/store";
import type { Download, ResolvedItem } from "@/types";

const mocks = vi.hoisted(() => ({
  pause: vi.fn().mockResolvedValue(undefined),
  resume: vi.fn().mockResolvedValue(undefined),
  show: vi.fn().mockResolvedValue(undefined),
  removeFile: vi.fn().mockResolvedValue(undefined),
  erase: vi.fn().mockResolvedValue([]),
  download: vi.fn().mockResolvedValue(0),
  search: vi.fn().mockResolvedValue([]),
  cancel: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      sendMessage: vi.fn().mockResolvedValue(undefined),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    downloads: {
      pause: mocks.pause,
      resume: mocks.resume,
      show: mocks.show,
      removeFile: mocks.removeFile,
      erase: mocks.erase,
      download: mocks.download,
      search: mocks.search,
      cancel: mocks.cancel,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

vi.mock("@/shared/error-handler", () => ({
  captureError: vi.fn(),
  addBreadcrumb: vi.fn(),
}));

const { captureError } = await import("@/shared/error-handler");
const {
  pauseItem,
  resumeItem,
  showItemInFolder,
  copyItemUrl,
  deleteItemFile,
  pauseActiveDownloads,
} = await import("@/tab/services/download-control");

const makeDownload = (overrides: Partial<Download> = {}): Download => ({
  id: "dl-1",
  url: "https://bandcamp.com/download?token=abc",
  artist: "Test",
  title: "Test",
  format: "mp3-320",
  progress: 0,
  browserId: 42,
  ...overrides,
});

const makeResolvedItem = (
  overrides: Partial<ResolvedItem> = {},
): ResolvedItem => ({
  id: "i:1",
  status: "downloading" as const,
  title: "Test Item",
  download: makeDownload(),
  ...overrides,
});

const seedItem = (item: ResolvedItem) => {
  useStore.setState({
    items: new Map([[item.id, item]]),
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  useStore.setState({
    items: new Map(),
    pausedItemIds: new Set(),
    browserIdToItemId: {},
    downloadToItemId: {},
  });
});

describe("pauseItem", () => {
  it("calls browser.downloads.pause with the item's browserId and marks the item paused", async () => {
    seedItem(makeResolvedItem());
    mocks.search.mockResolvedValue([{ id: 42, state: "in_progress" }]);

    await pauseItem("i:1");

    expect(mocks.pause).toHaveBeenCalledWith(42);
    expect(useStore.getState().pausedItemIds.has("i:1")).toBe(true);
  });

  it("skips pause for a download that is not in progress (no spurious error)", async () => {
    seedItem(makeResolvedItem());
    mocks.search.mockResolvedValue([{ id: 42, state: "complete" }]);

    await pauseItem("i:1");

    expect(mocks.pause).not.toHaveBeenCalled();
    expect(useStore.getState().pausedItemIds.has("i:1")).toBe(true);
  });

  it("does nothing for a nonexistent item", async () => {
    await pauseItem("missing");

    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it("does not call browser.downloads.pause when the item has no browserId", async () => {
    seedItem(
      makeResolvedItem({ download: makeDownload({ browserId: undefined }) }),
    );

    await pauseItem("i:1");

    expect(mocks.pause).not.toHaveBeenCalled();
    expect(useStore.getState().pausedItemIds.has("i:1")).toBe(true);
  });
});

describe("resumeItem", () => {
  it("calls browser.downloads.resume and clears the paused flag", async () => {
    seedItem(makeResolvedItem());
    useStore.setState({ pausedItemIds: new Set(["i:1"]) });
    mocks.search.mockResolvedValue([{ id: 42, canResume: true }]);

    await resumeItem("i:1");

    expect(mocks.resume).toHaveBeenCalledWith(42);
    expect(useStore.getState().pausedItemIds.has("i:1")).toBe(false);
  });

  it("skips resume for a download that is not resumable (no spurious error)", async () => {
    seedItem(makeResolvedItem());
    useStore.setState({ pausedItemIds: new Set(["i:1"]) });
    mocks.search.mockResolvedValue([{ id: 42, canResume: false }]);

    await resumeItem("i:1");

    expect(mocks.resume).not.toHaveBeenCalled();
    expect(useStore.getState().pausedItemIds.has("i:1")).toBe(false);
  });
});

describe("showItemInFolder", () => {
  it("calls browser.downloads.show with the first available browserId", async () => {
    seedItem(makeResolvedItem());

    await showItemInFolder("i:1");

    expect(mocks.show).toHaveBeenCalledWith(42);
  });

  it("does nothing when the item has no browserId", async () => {
    seedItem(
      makeResolvedItem({ download: makeDownload({ browserId: undefined }) }),
    );

    await showItemInFolder("i:1");

    expect(mocks.show).not.toHaveBeenCalled();
  });
});

describe("copyItemUrl", () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(
    navigator,
    "clipboard",
  );

  afterEach(() => {
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });

  it("writes the item url to the clipboard", async () => {
    seedItem(makeResolvedItem());
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await copyItemUrl("i:1");

    expect(writeText).toHaveBeenCalledWith(
      "https://bandcamp.com/download?token=abc",
    );
  });
});

describe("deleteItemFile resilience", () => {
  it("continues erasing history when removing the file fails", async () => {
    seedItem(makeResolvedItem());
    mocks.removeFile.mockRejectedValue(new Error("file already gone"));

    await expect(deleteItemFile("i:1")).resolves.toBeUndefined();

    expect(mocks.erase).toHaveBeenCalledWith({ id: 42 });
  });
});

describe("deleteItemFile ordering", () => {
  it("cancels the live download before removing its file and history", async () => {
    seedItem(makeResolvedItem());
    mocks.search.mockResolvedValue([{ id: 42, state: "in_progress" }]);
    const order: string[] = [];
    mocks.cancel.mockImplementation(async () => {
      order.push("cancel");
    });
    mocks.removeFile.mockImplementation(async () => {
      order.push("removeFile");
    });
    mocks.erase.mockImplementation(async () => {
      order.push("erase");
      return [];
    });

    await deleteItemFile("i:1");

    expect(order[0]).toBe("cancel");
    expect(order).toContain("removeFile");
    expect(order).toContain("erase");
  });
});

describe("deleteItemFile", () => {
  it("calls removeFile then erase for each browserId", async () => {
    seedItem(makeResolvedItem());

    await deleteItemFile("i:1");

    expect(mocks.removeFile).toHaveBeenCalledWith(42);
    expect(mocks.erase).toHaveBeenCalledWith({ id: 42 });
  });

  it("removes the item from the store after deletion", async () => {
    seedItem(makeResolvedItem());

    await deleteItemFile("i:1");

    expect(useStore.getState().items.has("i:1")).toBe(false);
  });
});

describe("showItemInFolder when the file is gone", () => {
  it("reports the failure without crashing", async () => {
    seedItem(makeResolvedItem());
    mocks.show.mockRejectedValue(new Error("file no longer exists"));

    await expect(showItemInFolder("i:1")).resolves.toBeUndefined();

    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { download: { browserId: 42 } },
      { operation: "show_in_folder" },
    );
  });
});

describe("deleteItemFile under a double failure", () => {
  it("reports both the removeFile and erase failures and still removes the item", async () => {
    seedItem(makeResolvedItem());
    mocks.removeFile.mockRejectedValue(new Error("file gone"));
    mocks.erase.mockRejectedValue(new Error("erase failed"));

    await expect(deleteItemFile("i:1")).resolves.toBeUndefined();

    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { download: { browserId: 42 } },
      { operation: "delete_file" },
    );
    expect(captureError).toHaveBeenCalledWith(
      expect.any(Error),
      { download: { browserId: 42 } },
      { operation: "erase_history" },
    );
    expect(useStore.getState().items.has("i:1")).toBe(false);
  });
});

describe("pauseActiveDownloads", () => {
  it("pauses in-progress downloads and skips ones that already finished", async () => {
    const active = makeResolvedItem({
      id: "i:active",
      download: makeDownload({ id: "dl-a", browserId: 1 }),
    });
    const finished = makeResolvedItem({
      id: "i:finished",
      download: makeDownload({ id: "dl-f", browserId: 2 }),
    });
    useStore.setState({
      items: new Map([
        [active.id, active],
        [finished.id, finished],
      ]),
    });
    mocks.search.mockImplementation(async (query: { id: number }) =>
      query.id === 1
        ? [{ id: 1, state: "in_progress" }]
        : [{ id: 2, state: "complete" }],
    );

    await pauseActiveDownloads();

    expect(mocks.pause).toHaveBeenCalledWith(1);
    expect(mocks.pause).not.toHaveBeenCalledWith(2);
  });
});
