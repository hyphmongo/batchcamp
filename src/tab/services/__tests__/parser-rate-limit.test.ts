import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/analytics", () => ({ track: vi.fn() }));
vi.mock("@/shared/error-handler", () => ({
  addBreadcrumb: vi.fn(),
  captureError: vi.fn(),
}));

import { parse } from "@/tab/services/parser";
import { resetGate } from "@/tab/services/rate-limit-gate";

const item = (id: string) => ({
  url: `https://bandcamp.com/download?id=${id}`,
});

const refuseEverything = () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 429 });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  resetGate();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("a large batch meeting a rate limit", () => {
  it("holds the rest of the batch back once the first item is refused", async () => {
    const fetchMock = refuseEverything();

    expect(await parse(item("first"))).toEqual({ kind: "rateLimited" });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const waiting = Array.from({ length: 40 }, (_, i) =>
      parse(item(String(i))),
    );

    await vi.advanceTimersByTimeAsync(9_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock.mock.calls.length).toBeLessThan(6);

    void Promise.allSettled(waiting);
  });

  it("reports the refusal so the item is retried, never dropped", async () => {
    refuseEverything();

    const result = await parse(item("1"));

    expect(result).toEqual({ kind: "rateLimited" });
  });
});
