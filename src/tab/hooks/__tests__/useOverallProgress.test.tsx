import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  setupJourneyHarness,
  teardownJourneyHarness,
} from "@/tab/__tests__/journey-fixtures";
import { useOverallProgress } from "@/tab/hooks/useOverallProgress";
import { reportBytes, resetProgress } from "@/tab/services/download-progress";
import { useStore } from "@/tab/store";
import type { Item } from "@/types";

const makeItem = (overrides: Partial<Item>): Item =>
  ({
    id: "item-x",
    status: "completed",
    title: "Test",
    download: {
      id: "dl-x",
      url: "https://bandcamp.com/dl",
      artist: "Test",
      title: "Test",
      format: "mp3-320",
      progress: 100,
      sizeMb: 10,
      browserId: 100,
    },
    ...overrides,
  }) as Item;

describe("useOverallProgress", () => {
  beforeEach(() => {
    resetProgress();
    setupJourneyHarness();
  });

  afterEach(() => {
    teardownJourneyHarness();
    resetProgress();
  });

  it("hides speed/eta when no item is currently downloading", () => {
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          [
            "done-1",
            makeItem({
              id: "done-1",
              status: "completed",
              download: {
                id: "dl-done",
                url: "x",
                artist: "a",
                title: "t",
                format: "mp3-320",
                progress: 100,
                sizeMb: 10,
                browserId: 1,
              },
            }),
          ],
          [
            "queued-1",
            makeItem({
              id: "queued-1",
              status: "queued",
              download: {
                id: "dl-queued",
                url: "x",
                artist: "a",
                title: "t",
                format: "mp3-320",
                progress: 0,
                sizeMb: 20,
                browserId: 2,
              },
            }),
          ],
        ]),
      });
    });

    act(() => {
      reportBytes("dl-done", 10 * 1024 * 1024);
    });

    const { result } = renderHook(() => useOverallProgress());

    expect(result.current.speed).toBeNull();
    expect(result.current.eta).toBeNull();
  });

  it("hides speed/eta when the active download is paused by the user", () => {
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          [
            "active-1",
            makeItem({
              id: "active-1",
              status: "downloading",
              download: {
                id: "dl-active",
                url: "x",
                artist: "a",
                title: "t",
                format: "mp3-320",
                progress: 50,
                sizeMb: 20,
                browserId: 1,
              },
            }),
          ],
        ]),
        pausedItemIds: new Set(["active-1"]),
      });
    });

    act(() => {
      reportBytes("dl-active", 5 * 1024 * 1024);
    });

    const { result } = renderHook(() => useOverallProgress());

    expect(result.current.speed).toBeNull();
    expect(result.current.eta).toBeNull();
  });

  it("clears stale speed/eta when byte reports stop arriving", async () => {
    vi.useFakeTimers();
    try {
      act(() => {
        useStore.setState({
          items: new Map<string, Item>([
            [
              "active-1",
              makeItem({
                id: "active-1",
                status: "downloading",
                download: {
                  id: "dl-active",
                  url: "x",
                  artist: "a",
                  title: "t",
                  format: "mp3-320",
                  progress: 50,
                  sizeMb: 20,
                  browserId: 1,
                },
              }),
            ],
          ]),
        });
      });
      act(() => {
        reportBytes("dl-active", 1 * 1024 * 1024);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
      act(() => {
        reportBytes("dl-active", 5 * 1024 * 1024);
      });

      const { result } = renderHook(() => useOverallProgress());
      expect(result.current.speed).not.toBeNull();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(7000);
      });

      expect(result.current.speed).toBeNull();
      expect(result.current.eta).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows speed immediately while downloading, before the eta window warms up", async () => {
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          [
            "active-1",
            makeItem({
              id: "active-1",
              status: "downloading",
              download: {
                id: "dl-active",
                url: "x",
                artist: "a",
                title: "t",
                format: "mp3-320",
                progress: 1,
                sizeMb: 100_000,
                browserId: 1,
              },
            }),
          ],
        ]),
      });
    });

    act(() => {
      reportBytes("dl-active", 1 * 1024 * 1024);
    });
    await new Promise((r) => setTimeout(r, 50));
    act(() => {
      reportBytes("dl-active", 10 * 1024 * 1024);
    });

    const { result } = renderHook(() => useOverallProgress());

    expect(result.current.speed).not.toBeNull();
    expect(result.current.eta).toBeNull();
  });

  it("shows eta once the rate window warms up (~3s), regardless of batch size", async () => {
    vi.useFakeTimers();
    try {
      act(() => {
        useStore.setState({
          items: new Map<string, Item>([
            [
              "active-1",
              makeItem({
                id: "active-1",
                status: "downloading",
                download: {
                  id: "dl-active",
                  url: "x",
                  artist: "a",
                  title: "t",
                  format: "mp3-320",
                  progress: 1,
                  sizeMb: 100_000,
                  browserId: 1,
                },
              }),
            ],
          ]),
        });
      });

      act(() => {
        reportBytes("dl-active", 1 * 1024 * 1024);
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(3500);
      });
      act(() => {
        reportBytes("dl-active", 50 * 1024 * 1024);
      });

      const { result } = renderHook(() => useOverallProgress());

      expect(result.current.speed).not.toBeNull();
      expect(result.current.eta).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });
});
