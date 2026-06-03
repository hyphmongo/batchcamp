import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DownloadClient } from "@/tab/services/download-client";
import type { Download } from "@/types";

const browserInfo = vi.hoisted(() => ({ isFirefox: false }));
vi.mock("@/shared/browser-info", () => browserInfo);

const { downloadCoverArt } = await import("@/tab/services/downloader");

type Call = { url: string; filename?: string };

const makeClient = (): {
  client: DownloadClient;
  calls: Call[];
} => {
  const calls: Call[] = [];
  const client: DownloadClient = {
    async startDownload({ url, filename }) {
      calls.push({ url, filename });
      return 1;
    },
    async inferFilenameExtension() {
      return ".zip";
    },
  };
  return { client, calls };
};

const makeDownload = (overrides: Partial<Download> = {}): Download => ({
  id: "dl-1",
  url: "https://bandcamp.com/download/track?token=abc",
  artist: "Joy Orbison",
  title: "Hyph Mngo",
  artUrl: "https://f4.bcbits.com/img/a123456_10.jpg",
  format: "mp3-320",
  progress: 0,
  ...overrides,
});

beforeEach(() => {
  browserInfo.isFirefox = false;
});

describe("downloadCoverArt", () => {
  it("issues a single startDownload with the templated jpg filename", async () => {
    const { client, calls } = makeClient();
    const dl = makeDownload();

    await Effect.runPromise(
      downloadCoverArt(client, dl, "Joy Orbison - Hyph Mngo"),
    );

    expect(calls).toEqual([
      { url: dl.artUrl, filename: "Joy Orbison - Hyph Mngo.jpg" },
    ]);
  });

  it("uses the same call shape regardless of platform (client hides the protocol)", async () => {
    browserInfo.isFirefox = true;
    const { client, calls } = makeClient();
    const dl = makeDownload();

    await Effect.runPromise(
      downloadCoverArt(client, dl, "Joy Orbison - Hyph Mngo"),
    );

    expect(calls).toEqual([
      { url: dl.artUrl, filename: "Joy Orbison - Hyph Mngo.jpg" },
    ]);
  });

  it("does nothing when the download has no artUrl", async () => {
    const { client, calls } = makeClient();
    const dl = makeDownload({ artUrl: undefined });

    await Effect.runPromise(
      downloadCoverArt(client, dl, "Joy Orbison - Hyph Mngo"),
    );

    expect(calls).toEqual([]);
  });

  it("sanitizes the templated filename (illegal chars stripped per path segment)", async () => {
    const { client, calls } = makeClient();
    const dl = makeDownload();

    await Effect.runPromise(downloadCoverArt(client, dl, "Art<ist>/Alb:um"));

    expect(calls[0]).toEqual({
      url: dl.artUrl,
      filename: "Art_ist/Alb_um.jpg",
    });
  });

  it("swallows client errors so a failing art download doesn't break the flow", async () => {
    const failingClient: DownloadClient = {
      async startDownload() {
        throw new Error("boom");
      },
      async inferFilenameExtension() {
        return ".zip";
      },
    };
    const dl = makeDownload();

    await expect(
      Effect.runPromise(
        downloadCoverArt(failingClient, dl, "Joy Orbison - Hyph Mngo"),
      ),
    ).resolves.toBeUndefined();
  });
});
