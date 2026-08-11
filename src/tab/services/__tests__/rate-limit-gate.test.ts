import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearedForTakeoff,
  rateLimited,
  releaseProbe,
  resetGate,
  succeeded,
} from "@/tab/services/rate-limit-gate";

const settled = async (promise: Promise<unknown>) => {
  let done = false;
  void promise.then(() => {
    done = true;
  });
  await Promise.resolve();
  await Promise.resolve();
  return done;
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  resetGate();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("waiting for a turn while bandcamp is refusing", () => {
  it("lets everything through while nothing has been refused", async () => {
    expect(await settled(clearedForTakeoff())).toBe(true);
    expect(await settled(clearedForTakeoff())).toBe(true);
  });

  it("holds everyone back once bandcamp refuses", async () => {
    rateLimited();

    expect(await settled(clearedForTakeoff())).toBe(false);
  });

  it("waits longer each time the refusal repeats", async () => {
    rateLimited();
    await vi.advanceTimersByTimeAsync(10_000);
    const first = await settled(clearedForTakeoff());

    resetGate();
    rateLimited();
    rateLimited();
    await vi.advanceTimersByTimeAsync(10_000);
    const second = await settled(clearedForTakeoff());

    expect(first).toBe(true);
    expect(second).toBe(false);
  });

  it("sends one caller to test the water, not the whole queue", async () => {
    rateLimited();
    const probe = clearedForTakeoff();
    const follower = clearedForTakeoff();

    await vi.advanceTimersByTimeAsync(60_000);

    expect(await settled(probe)).toBe(true);
    expect(await settled(follower)).toBe(false);
  });

  it("opens up for everyone within a poll of the probe getting through", async () => {
    rateLimited();
    const probe = clearedForTakeoff();
    const follower = clearedForTakeoff();
    await vi.advanceTimersByTimeAsync(60_000);
    await probe;

    succeeded();
    await vi.advanceTimersByTimeAsync(250);

    expect(await settled(follower)).toBe(true);
    expect(await settled(clearedForTakeoff())).toBe(true);
  });

  it("shuts again, for longer, when the probe is refused too", async () => {
    rateLimited();
    const probe = clearedForTakeoff();
    await vi.advanceTimersByTimeAsync(60_000);
    await probe;

    rateLimited();
    const afterSecond = clearedForTakeoff();

    await vi.advanceTimersByTimeAsync(10_000);

    expect(await settled(afterSecond)).toBe(false);
  });

  it("does not strand the queue when a probe reports neither outcome", async () => {
    rateLimited();
    const probe = clearedForTakeoff();
    const follower = clearedForTakeoff();
    await vi.advanceTimersByTimeAsync(60_000);
    await probe;

    releaseProbe();
    await vi.advanceTimersByTimeAsync(250);

    expect(await settled(follower)).toBe(true);
  });

  it("makes one attempt per window no matter how many items are waiting", async () => {
    rateLimited();
    const waiting = Array.from({ length: 50 }, () => clearedForTakeoff());

    await vi.advanceTimersByTimeAsync(60_000);

    const through = await Promise.all(waiting.map((p) => settled(p)));
    expect(through.filter(Boolean)).toHaveLength(1);
  });
});
