import { describe, expect, it } from "vitest";

import {
  type BrowserAdapter,
  browserAdapter,
  resetBrowserAdapter,
  setBrowserAdapter,
} from "@/tab/services/browser-adapter";

describe("setBrowserAdapter", () => {
  it("makes the browserAdapter proxy delegate to the new instance", () => {
    const fake: BrowserAdapter = {
      downloads: {
        download: async () => 42,
        search: async () => [],
        pause: async () => {},
        resume: async () => {},
        cancel: async () => {},
        show: async () => {},
        removeFile: async () => {},
        erase: async () => {},
      },
      runtime: { sendMessage: async () => undefined },
      events: {
        onMessage: { subscribe: () => () => {} },
        onDownloadChanged: { subscribe: () => () => {} },
      },
    };

    setBrowserAdapter(fake);
    try {
      expect(browserAdapter.downloads).toBe(fake.downloads);
      expect(browserAdapter.events.onMessage).toBe(fake.events.onMessage);
    } finally {
      resetBrowserAdapter();
    }
  });
});
