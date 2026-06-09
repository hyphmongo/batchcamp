import { describe, expect, it } from "vitest";

import {
  backoffDelayMs,
  hasExceededRetryWindow,
  planRetry,
  RATE_LIMIT_MAX_ELAPSED_MS,
  withJitter,
} from "@/tab/services/rate-limit";

describe("backoffDelayMs", () => {
  it("ramps 10s → 15s → 30s → 60s across attempts", () => {
    expect(backoffDelayMs(1)).toBe(10_000);
    expect(backoffDelayMs(2)).toBe(15_000);
    expect(backoffDelayMs(3)).toBe(30_000);
    expect(backoffDelayMs(4)).toBe(60_000);
  });

  it("caps at 60s for later attempts", () => {
    expect(backoffDelayMs(5)).toBe(60_000);
    expect(backoffDelayMs(20)).toBe(60_000);
  });

  it("clamps an out-of-range attempt to the first step", () => {
    expect(backoffDelayMs(0)).toBe(10_000);
    expect(backoffDelayMs(-3)).toBe(10_000);
  });
});

describe("withJitter", () => {
  it("returns the base delay when rand is 0.5 (no offset)", () => {
    expect(withJitter(10_000, () => 0.5)).toBe(10_000);
  });

  it("spreads within ±30% of the base delay", () => {
    expect(withJitter(10_000, () => 0)).toBe(7_000);
    expect(withJitter(10_000, () => 1)).toBe(13_000);
  });

  it("stays within bounds for arbitrary rand values", () => {
    for (const r of [0.1, 0.37, 0.62, 0.88]) {
      const v = withJitter(30_000, () => r);
      expect(v).toBeGreaterThanOrEqual(21_000);
      expect(v).toBeLessThanOrEqual(39_000);
    }
  });
});

describe("hasExceededRetryWindow", () => {
  it("is false before the 5-minute window", () => {
    expect(hasExceededRetryWindow(0)).toBe(false);
    expect(hasExceededRetryWindow(RATE_LIMIT_MAX_ELAPSED_MS - 1)).toBe(false);
  });

  it("is true once the window is reached", () => {
    expect(hasExceededRetryWindow(RATE_LIMIT_MAX_ELAPSED_MS)).toBe(true);
    expect(hasExceededRetryWindow(RATE_LIMIT_MAX_ELAPSED_MS + 1)).toBe(true);
  });

  it("uses a 5 minute window", () => {
    expect(RATE_LIMIT_MAX_ELAPSED_MS).toBe(5 * 60_000);
  });
});

describe("planRetry", () => {
  const noJitter = () => 0.5;

  it("plans the first attempt with a fresh start time", () => {
    const plan = planRetry(undefined, 1000, noJitter);
    expect(plan).toEqual({
      kind: "retry",
      attempt: 1,
      startedAt: 1000,
      delayMs: 10_000,
    });
  });

  it("lengthens the delay and preserves startedAt on later attempts", () => {
    const plan = planRetry({ attempt: 1, startedAt: 1000 }, 11_000, noJitter);
    expect(plan).toEqual({
      kind: "retry",
      attempt: 2,
      startedAt: 1000,
      delayMs: 15_000,
    });
  });

  it("gives up once the retry window is exceeded", () => {
    const plan = planRetry(
      { attempt: 4, startedAt: 0 },
      RATE_LIMIT_MAX_ELAPSED_MS,
      noJitter,
    );
    expect(plan).toEqual({ kind: "give_up" });
  });
});
