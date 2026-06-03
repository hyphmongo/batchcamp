import { useCallback, useEffect, useRef, useState } from "react";

import { bayerThreshold, type Rgb, readThemeRgb } from "./dither";

type Tones = { ink: Rgb; paper: Rgb };

const FALLBACK: Tones = { ink: [18, 38, 43], paper: [247, 241, 229] };

const lumaOf = (c: Rgb) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];

const readTones = (): Tones => {
  const surface = readThemeRgb("--bc-base-100", FALLBACK.paper);
  const content = readThemeRgb("--bc-base-content", FALLBACK.ink);
  return lumaOf(content) <= lumaOf(surface)
    ? { ink: content, paper: surface }
    : { ink: surface, paper: content };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const quantize = (value: number, levels: number, threshold: number) => {
  const scaled = value * (levels - 1);
  const lower = Math.floor(scaled);
  return (threshold < scaled - lower ? lower + 1 : lower) / (levels - 1);
};

const render = (
  ctx: CanvasRenderingContext2D,
  src: ImageData,
  develop: number,
  size: number,
  tones: Tones,
  out: ImageData | null,
) => {
  if (develop <= 0 || !out) {
    ctx.putImageData(src, 0, 0);
    return;
  }
  const { ink, paper } = tones;
  const colourMix = 1 - develop;
  const levels = Math.max(2, Math.round(lerp(40, 2, develop)));
  const srcData = src.data;
  const outData = out.data;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const threshold = bayerThreshold(x, y);
      const r = srcData[i]! / 255;
      const g = srcData[i + 1]! / 255;
      const b = srcData[i + 2]! / 255;
      const luma = 0.299 * r + 0.587 * g + 0.114 * b;
      const inkMix = quantize(luma, levels, threshold);
      outData[i] = lerp(
        lerp(ink[0], paper[0], inkMix),
        quantize(r, levels, threshold) * 255,
        colourMix,
      );
      outData[i + 1] = lerp(
        lerp(ink[1], paper[1], inkMix),
        quantize(g, levels, threshold) * 255,
        colourMix,
      );
      outData[i + 2] = lerp(
        lerp(ink[2], paper[2], inkMix),
        quantize(b, levels, threshold) * 255,
        colourMix,
      );
      outData[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
};

type DitherCoverProps = {
  artUrl?: string;
  develop: number;
  size?: number;
  alt?: string;
};

const MIN_REVEAL_MS = 2_000;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const hiResArt = (url?: string): string | undefined =>
  url?.replace(/_\d+(\.\w+)$/, "_7$1");

const DitherCover = ({ artUrl, develop, size = 48, alt }: DitherCoverProps) => {
  const developQ = Math.round(develop * 100) / 100;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const srcRef = useRef<ImageData | null>(null);
  const outRef = useRef<ImageData | null>(null);
  const tonesRef = useRef<Tones>(readTones());
  const targetRef = useRef(developQ);
  const shownRef = useRef(developQ);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const px = Math.round(size * dpr);

  const [resolved, setResolved] = useState(develop <= 0);

  const draw = useCallback(
    (value: number) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !srcRef.current) {
        return;
      }
      if (value > 0 && outRef.current?.width !== px) {
        outRef.current = ctx.createImageData(px, px);
      }
      render(ctx, srcRef.current, value, px, tonesRef.current, outRef.current);
    },
    [px],
  );

  const ensureAnimating = useCallback(() => {
    if (rafRef.current != null) {
      return;
    }
    if (prefersReducedMotion()) {
      shownRef.current = targetRef.current;
      draw(shownRef.current);
      setResolved(targetRef.current <= 0);
      return;
    }
    lastTsRef.current = null;
    const tick = (now: number) => {
      const last = lastTsRef.current ?? now;
      lastTsRef.current = now;
      const target = targetRef.current;
      const cur = shownRef.current;
      const maxStep = Math.max(now - last, 0) / MIN_REVEAL_MS;
      const diff = target - cur;
      const next =
        Math.abs(diff) <= maxStep ? target : cur + Math.sign(diff) * maxStep;
      shownRef.current = next;
      draw(next);
      if (next !== target) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastTsRef.current = null;
        setResolved(target <= 0);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [draw]);

  useEffect(
    () => () => {
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      tonesRef.current = readTones();
      draw(shownRef.current);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [draw]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) {
      return;
    }

    if (!artUrl) {
      srcRef.current = null;
      ctx.clearRect(0, 0, px, px);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const drawCropped = (
      target: CanvasRenderingContext2D,
      img: CanvasImageSource,
      w: number,
      h: number,
    ) => {
      const s = Math.min(w, h);
      target.drawImage(img, (w - s) / 2, (h - s) / 2, s, s, 0, 0, px, px);
    };

    void (async () => {
      try {
        const res = await fetch(hiResArt(artUrl) ?? artUrl, {
          signal: controller.signal,
        });
        const bitmap = await createImageBitmap(await res.blob());
        if (cancelled) {
          bitmap.close();
          return;
        }
        const off = document.createElement("canvas");
        off.width = px;
        off.height = px;
        const offCtx = off.getContext("2d", { willReadFrequently: true });
        if (!offCtx) {
          bitmap.close();
          return;
        }
        drawCropped(offCtx, bitmap, bitmap.width, bitmap.height);
        bitmap.close();
        srcRef.current = offCtx.getImageData(0, 0, px, px);
        draw(shownRef.current);
        ensureAnimating();
      } catch {
        if (cancelled) {
          return;
        }
        const img = new Image();
        img.onload = () => {
          if (cancelled) {
            return;
          }
          srcRef.current = null;
          ctx.clearRect(0, 0, px, px);
          drawCropped(ctx, img, img.width, img.height);
        };
        img.onerror = () => {
          if (!cancelled) {
            srcRef.current = null;
            ctx.clearRect(0, 0, px, px);
          }
        };
        img.src = artUrl;
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [artUrl, px, draw, ensureAnimating]);

  useEffect(() => {
    targetRef.current = developQ;
    if (developQ > 0) {
      setResolved(false);
    }
    ensureAnimating();
  }, [developQ, ensureAnimating]);

  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <canvas
        ref={canvasRef}
        width={px}
        height={px}
        role={alt ? "img" : undefined}
        aria-label={alt}
        aria-hidden={alt ? undefined : true}
        style={{
          width: `${size}px`,
          height: `${size}px`,
          imageRendering: "pixelated",
          display: "block",
          background: "var(--color-base-300)",
        }}
      />
      {resolved && artUrl && (
        <img
          src={hiResArt(artUrl) ?? artUrl}
          alt=""
          aria-hidden="true"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: `${size}px`,
            height: `${size}px`,
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
    </div>
  );
};

export { DitherCover };
