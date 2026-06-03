import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  dropProgress,
  finalizeBytes,
  getProgress,
  reportBytes,
  resetProgress,
} from "@/tab/services/download-progress";

describe("download-progress rolling window", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-28T00:00:00Z"));
    resetProgress();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetProgress();
  });

  it("reports null bytesPerSecond when no samples have been collected", () => {
    expect(getProgress().bytesPerSecond).toBeNull();
  });

  it("never lets a finalize estimate reduce the bytes already received", () => {
    reportBytes("a", 100);

    finalizeBytes("a", 50);

    expect(getProgress().bytesReceived).toBe(100);
  });

  it("still applies a finalize that increases the byte total", () => {
    reportBytes("a", 100);

    finalizeBytes("a", 150);

    expect(getProgress().bytesReceived).toBe(150);
  });

  it("never reports a negative speed after a mid-download drop", () => {
    reportBytes("a", 1_000_000);
    reportBytes("b", 1_000_000);
    vi.advanceTimersByTime(1000);
    dropProgress("a");
    vi.advanceTimersByTime(1000);
    reportBytes("b", 1_100_000);

    const { bytesPerSecond } = getProgress();
    expect(bytesPerSecond === null || bytesPerSecond >= 0).toBe(true);
  });

  it("computes speed from samples inside the rolling window", () => {
    reportBytes("a", 0);
    vi.advanceTimersByTime(1000);
    reportBytes("a", 1_000_000);

    const { bytesPerSecond } = getProgress();
    expect(bytesPerSecond).not.toBeNull();
    expect(bytesPerSecond!).toBeGreaterThan(900_000);
    expect(bytesPerSecond!).toBeLessThan(1_100_000);
  });

  it("returns null speed after the window goes stale with no new samples", () => {
    reportBytes("a", 0);
    vi.advanceTimersByTime(1000);
    reportBytes("a", 1_000_000);

    vi.advanceTimersByTime(10_000);

    expect(getProgress().bytesPerSecond).toBeNull();
  });

  it("speed after a long gap reflects only the new activity, not lifetime average", () => {
    reportBytes("a", 0);
    vi.advanceTimersByTime(1000);
    reportBytes("a", 10_000_000);

    vi.advanceTimersByTime(60_000);

    reportBytes("b", 0);
    vi.advanceTimersByTime(1000);
    reportBytes("b", 500_000);

    const { bytesPerSecond } = getProgress();
    expect(bytesPerSecond).not.toBeNull();
    expect(bytesPerSecond!).toBeGreaterThan(400_000);
    expect(bytesPerSecond!).toBeLessThan(600_000);
  });

  it("dropProgress removes a single item's bytes from the total", () => {
    reportBytes("a", 1000);
    reportBytes("b", 2000);
    expect(getProgress().bytesReceived).toBe(3000);

    dropProgress("a");

    expect(getProgress().bytesReceived).toBe(2000);
  });

  it("finalizeBytes updates the total without distorting the speed window", () => {
    reportBytes("a", 0);
    vi.advanceTimersByTime(1000);
    reportBytes("a", 1_000_000);

    vi.advanceTimersByTime(100);
    finalizeBytes("a", 100_000_000);

    const { bytesReceived, bytesPerSecond } = getProgress();
    expect(bytesReceived).toBe(100_000_000);
    expect(bytesPerSecond!).toBeLessThan(2_000_000);
  });
});
