import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  // chrome.downloads.show is a fire-and-forget void API: it returns
  // undefined, not a promise. Modern Chrome exposes a native `browser`
  // namespace, so webextension-polyfill stops wrapping and this void
  // return surfaces to callers.
  show: vi.fn(() => undefined),
  erase: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("webextension-polyfill", () => ({
  default: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: { addListener: vi.fn(), removeListener: vi.fn() },
    },
    downloads: {
      show: mocks.show,
      erase: mocks.erase,
      onChanged: { addListener: vi.fn(), removeListener: vi.fn() },
    },
  },
}));

const { browserAdapter, resetBrowserAdapter } = await import(
  "@/tab/services/browser-adapter"
);

beforeEach(() => {
  vi.clearAllMocks();
  resetBrowserAdapter();
});

describe("browserAdapter.downloads.show", () => {
  it("resolves when the underlying API returns void (does not call .then on undefined)", async () => {
    await expect(browserAdapter.downloads.show(42)).resolves.toBeUndefined();
    expect(mocks.show).toHaveBeenCalledWith(42);
  });
});
