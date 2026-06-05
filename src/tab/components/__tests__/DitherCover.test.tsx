import { configure, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DitherCover } from "@/tab/components/DitherCover";

const realCreateImageBitmap = globalThis.createImageBitmap;

const makeRealBitmap = async () => {
  const source = document.createElement("canvas");
  source.width = 16;
  source.height = 16;
  return realCreateImageBitmap(source);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("DitherCover resource cleanup", () => {
  it("closes the decoded ImageBitmap after drawing the cover", async () => {
    const bitmap = await makeRealBitmap();
    const close = vi.spyOn(bitmap, "close");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ blob: async () => new Blob() }),
    );
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));

    render(
      <DitherCover artUrl="https://f4.bcbits.com/img/a1_10.jpg" develop={1} />,
    );

    await waitFor(() => {
      expect(close).toHaveBeenCalled();
    });
  });

  it("aborts the in-flight art fetch when unmounted", async () => {
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        capturedSignal = init?.signal;
        return new Promise(() => {});
      }),
    );

    const { unmount } = render(
      <DitherCover artUrl="https://f4.bcbits.com/img/a2_10.jpg" develop={1} />,
    );

    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });
    expect(capturedSignal?.aborted).toBe(false);

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
  });
});

describe("DitherCover animation cost", () => {
  type FrameCallback = (time: number) => void;

  const frameQueue = new Map<number, FrameCallback>();
  let nextFrameId = 1;

  const pumpFrame = (time: number) => {
    const callbacks = [...frameQueue.values()];
    frameQueue.clear();
    for (const callback of callbacks) {
      callback(time);
    }
  };

  const mountWithArt = async (develop: number) => {
    const bitmap = await makeRealBitmap();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ blob: async () => new Blob() }),
    );
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));

    const putImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "putImageData",
    );

    const artUrl = "https://f4.bcbits.com/img/a3_10.jpg";
    const view = render(
      <DitherCover artUrl={artUrl} develop={develop} size={16} />,
    );
    await waitFor(() => {
      expect(putImageData).toHaveBeenCalled();
    });
    pumpFrame(1000);
    pumpFrame(1016);

    return { view, artUrl, putImageData };
  };

  beforeEach(() => {
    configure({ reactStrictMode: false });
    frameQueue.clear();
    nextFrameId = 1;
    vi.stubGlobal("requestAnimationFrame", ((callback: FrameCallback) => {
      frameQueue.set(nextFrameId, callback);
      return nextFrameId++;
    }) as unknown as typeof requestAnimationFrame);
    vi.stubGlobal("cancelAnimationFrame", ((id: number) => {
      frameQueue.delete(id);
    }) as unknown as typeof cancelAnimationFrame);
  });

  afterEach(() => {
    configure({ reactStrictMode: true });
    vi.restoreAllMocks();
  });

  it("ignores develop changes smaller than one visible quantum", async () => {
    const { view, artUrl, putImageData } = await mountWithArt(0.5);
    const settledPaints = putImageData.mock.calls.length;

    view.rerender(<DitherCover artUrl={artUrl} develop={0.496} size={16} />);
    pumpFrame(2000);
    pumpFrame(2016);
    pumpFrame(2032);
    expect(putImageData.mock.calls.length).toBe(settledPaints);

    view.rerender(<DitherCover artUrl={artUrl} develop={0.4} size={16} />);
    pumpFrame(3000);
    pumpFrame(3016);
    expect(putImageData.mock.calls.length).toBeGreaterThan(settledPaints);
  });

  it("reuses one output buffer across animation frames", async () => {
    const { view, artUrl } = await mountWithArt(0.5);
    const createImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "createImageData",
    );

    view.rerender(<DitherCover artUrl={artUrl} develop={0.3} size={16} />);
    for (let frame = 1; frame <= 30; frame++) {
      pumpFrame(4000 + frame * 16);
    }

    expect(createImageData.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
