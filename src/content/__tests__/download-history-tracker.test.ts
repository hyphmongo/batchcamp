import { describe, expect, it, vi } from "vitest";

import { DownloadHistoryTracker } from "@/content/download-history-tracker";

describe("DownloadHistoryTracker", () => {
  it("notifies onChange with the release-id set whenever history updates", () => {
    const onChange = vi.fn();
    const tracker = new DownloadHistoryTracker(onChange);

    tracker.updateHistory(["123:flac", "123:mp3-320", "456"]);

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(new Set(["123", "456"]));
  });

  it("emits a fresh set on each update, reflecting the latest entries", () => {
    const onChange = vi.fn();
    const tracker = new DownloadHistoryTracker(onChange);

    tracker.updateHistory(["123:flac"]);
    tracker.updateHistory(["123:flac", "789:wav"]);

    expect(onChange).toHaveBeenLastCalledWith(new Set(["123", "789"]));
  });

  it("emits an empty set when history is empty", () => {
    const onChange = vi.fn();
    const tracker = new DownloadHistoryTracker(onChange);

    tracker.updateHistory([]);

    expect(onChange).toHaveBeenLastCalledWith(new Set());
  });
});
