import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  setupJourneyHarness,
  teardownJourneyHarness,
} from "@/tab/__tests__/journey-fixtures";
import { useOnTabUnload } from "@/tab/hooks/useOnTabUnload";
import { flushHistory } from "@/tab/services/download-history";
import { useStore } from "@/tab/store";
import type { ResolvedItem } from "@/types";

vi.mock("@/tab/services/download-history", async () => {
  const actual = await vi.importActual<
    typeof import("@/tab/services/download-history")
  >("@/tab/services/download-history");
  return { ...actual, flushHistory: vi.fn() };
});

const makeDownloading = (): ResolvedItem => ({
  id: "item-1",
  status: "downloading",
  title: "Test",
  download: {
    id: "dl-1",
    url: "https://bandcamp.com/dl",
    artist: "Test",
    title: "Test",
    format: "mp3-320",
    progress: 0,
    browserId: 42,
  },
});

const dispatchBeforeUnload = (): {
  event: Event;
  returnValue: () => unknown;
} => {
  const event = new Event("beforeunload", { cancelable: true });
  let assigned: unknown;
  Object.defineProperty(event, "returnValue", {
    configurable: true,
    get: () => assigned,
    set: (value) => {
      assigned = value;
    },
  });
  window.dispatchEvent(event);
  return { event, returnValue: () => assigned };
};

describe("useOnTabUnload", () => {
  beforeEach(() => {
    setupJourneyHarness();
    vi.mocked(flushHistory).mockClear();
  });

  afterEach(() => {
    teardownJourneyHarness();
  });

  it("blocks unload (preventDefault + returnValue) while downloads are active", () => {
    void act(() => {
      useStore.setState({ items: new Map([["item-1", makeDownloading()]]) });
    });
    renderHook(() => useOnTabUnload());

    const { event, returnValue } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(true);
    expect(returnValue()).toBe("");
  });

  it("does not block unload when there are no active downloads", () => {
    void act(() => {
      useStore.setState({ items: new Map() });
    });
    renderHook(() => useOnTabUnload());

    const { event } = dispatchBeforeUnload();

    expect(event.defaultPrevented).toBe(false);
  });

  it("flushes history as soon as the tab is hidden, not only at unload", () => {
    renderHook(() => useOnTabUnload());
    let hidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });

    document.dispatchEvent(new Event("visibilitychange"));

    expect(flushHistory).toHaveBeenCalled();
    hidden = false;
    Reflect.deleteProperty(document, "hidden");
  });

  it("flushes history on pagehide", () => {
    renderHook(() => useOnTabUnload());

    window.dispatchEvent(new Event("pagehide"));

    expect(flushHistory).toHaveBeenCalled();
  });
});
