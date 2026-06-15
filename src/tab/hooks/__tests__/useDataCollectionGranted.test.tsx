import { renderHook, waitFor } from "@testing-library/react";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isGranted: vi.fn(),
  storeWatchers: [] as Array<(value: { granted: boolean }) => void>,
}));

vi.mock("@/shared/data-collection", () => ({
  isDataCollectionGranted: mocks.isGranted,
}));

vi.mock("@/storage", () => ({
  dataCollectionStore: {
    watch: (cb: (value: { granted: boolean }) => void) => {
      mocks.storeWatchers.push(cb);
      return () => {};
    },
  },
}));

const { useDataCollectionGranted } = await import(
  "@/tab/hooks/useDataCollectionGranted"
);

beforeEach(() => {
  mocks.isGranted.mockReset().mockResolvedValue(true);
  mocks.storeWatchers.length = 0;
});

describe("useDataCollectionGranted", () => {
  it("reflects the initial permission state", async () => {
    mocks.isGranted.mockResolvedValue(false);

    const { result } = renderHook(() => useDataCollectionGranted());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("updates when the mirrored consent changes at runtime", async () => {
    const { result } = renderHook(() => useDataCollectionGranted());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    await act(() => {
      for (const watcher of mocks.storeWatchers) {
        watcher({ granted: false });
      }
    });

    expect(result.current).toBe(false);
  });
});
