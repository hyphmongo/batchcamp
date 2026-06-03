import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";

const mocks = vi.hoisted(() => ({
  set: vi.fn(),
  captureError: vi.fn(),
}));

vi.mock("@/storage", () => ({
  configurationStore: { set: mocks.set },
}));
vi.mock("@/shared/error-handler", () => ({ captureError: mocks.captureError }));

const { persistConfig } = await import("@/shared/persist-config");

const baseConfig: Configuration = {
  format: "mp3-320",
  concurrency: 3,
  hasOnboarded: true,
  downloadArtwork: false,
  filenameTemplate: "{artist} - {title}",
  filenameTemplateEnabled: false,
  analyticsEnabled: true,
  crashReportsEnabled: true,
};

beforeEach(() => {
  mocks.set.mockReset().mockResolvedValue(undefined);
  mocks.captureError.mockReset();
});

describe("persistConfig", () => {
  it("applies the update optimistically and writes it to storage", () => {
    const setConfig = vi.fn();

    persistConfig(baseConfig, { format: "flac" }, setConfig);

    expect(setConfig).toHaveBeenCalledWith(
      expect.objectContaining({ format: "flac" }),
    );
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({ format: "flac" }),
    );
  });

  it("reports a failed persist instead of throwing", async () => {
    mocks.set.mockRejectedValue(new Error("quota exceeded"));
    const setConfig = vi.fn();

    persistConfig(baseConfig, { concurrency: 7 }, setConfig);

    expect(setConfig).toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(mocks.captureError).toHaveBeenCalled();
    });
  });
});
