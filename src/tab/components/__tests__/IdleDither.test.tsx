import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { IdleDither } from "@/tab/components/IdleDither";

type FrameCallback = (time: number) => void;
type ChangeListener = (event: { matches: boolean }) => void;

const frameQueue = new Map<number, FrameCallback>();
let nextFrameId = 1;

const pumpFrame = (time: number) => {
  const callbacks = [...frameQueue.values()];
  frameQueue.clear();
  for (const callback of callbacks) {
    callback(time);
  }
};

class FakeMediaQueryList {
  matches = false;
  listeners = new Set<ChangeListener>();

  constructor(public media: string) {}

  addEventListener(_type: string, listener: ChangeListener) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: ChangeListener) {
    this.listeners.delete(listener);
  }

  dispatch() {
    for (const listener of this.listeners) {
      listener({ matches: this.matches });
    }
  }
}

const stubMatchMedia = () => {
  const queries = new Map<string, FakeMediaQueryList>();
  vi.stubGlobal("matchMedia", ((query: string) => {
    let mql = queries.get(query);
    if (!mql) {
      mql = new FakeMediaQueryList(query);
      queries.set(query, mql);
    }
    return mql;
  }) as unknown as typeof window.matchMedia);
  return queries;
};

beforeEach(() => {
  frameQueue.clear();
  nextFrameId = 1;
  vi.stubGlobal("requestAnimationFrame", ((callback: FrameCallback) => {
    frameQueue.set(nextFrameId, callback);
    return nextFrameId++;
  }) as unknown as typeof requestAnimationFrame);
  vi.stubGlobal("cancelAnimationFrame", ((id: number) => {
    frameQueue.delete(id);
  }) as unknown as typeof cancelAnimationFrame);
  vi.spyOn(performance, "now").mockReturnValue(0);
});

afterEach(() => {
  Reflect.deleteProperty(document, "hidden");
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("IdleDither rendering cost", () => {
  it("does not repaint a frame whose dithered output is unchanged", () => {
    const putImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "putImageData",
    );

    render(<IdleDither size={32} />);

    pumpFrame(10);
    const paintsAfterFirstFrame = putImageData.mock.calls.length;
    expect(paintsAfterFirstFrame).toBeGreaterThan(0);

    pumpFrame(26);
    expect(putImageData.mock.calls.length).toBe(paintsAfterFirstFrame);
  });

  it("repaints only the visibly distinct frames of a full breathing cycle", () => {
    const putImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "putImageData",
    );

    render(<IdleDither size={32} />);

    const frames = 192;
    for (let frame = 1; frame <= frames; frame++) {
      pumpFrame((frame * 3200) / frames);
    }

    const paints = putImageData.mock.calls.length;
    expect(paints).toBeGreaterThan(5);
    expect(paints).toBeLessThan(50);
  });

  it("stops painting while the document is hidden and resumes when visible", () => {
    const putImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "putImageData",
    );

    render(<IdleDither size={32} />);
    pumpFrame(10);
    const paintsWhileVisible = putImageData.mock.calls.length;

    let hidden = true;
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => hidden,
    });
    document.dispatchEvent(new Event("visibilitychange"));

    pumpFrame(400);
    expect(putImageData.mock.calls.length).toBe(paintsWhileVisible);

    hidden = false;
    document.dispatchEvent(new Event("visibilitychange"));

    pumpFrame(800);
    expect(putImageData.mock.calls.length).toBeGreaterThan(paintsWhileVisible);
  });

  it("reacts to prefers-reduced-motion changes at runtime", () => {
    const queries = stubMatchMedia();
    const putImageData = vi.spyOn(
      CanvasRenderingContext2D.prototype,
      "putImageData",
    );

    render(<IdleDither size={32} />);
    pumpFrame(10);
    const paintsWhileAnimating = putImageData.mock.calls.length;
    expect(paintsWhileAnimating).toBeGreaterThan(0);

    const motion = queries.get("(prefers-reduced-motion: reduce)");
    expect(motion).toBeDefined();

    motion!.matches = true;
    motion!.dispatch();
    const paintsAfterReduce = putImageData.mock.calls.length;
    expect(paintsAfterReduce).toBeGreaterThan(paintsWhileAnimating);

    pumpFrame(400);
    pumpFrame(800);
    expect(putImageData.mock.calls.length).toBe(paintsAfterReduce);

    motion!.matches = false;
    motion!.dispatch();
    pumpFrame(1600);
    expect(putImageData.mock.calls.length).toBeGreaterThan(paintsAfterReduce);
  });
});
