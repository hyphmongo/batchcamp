import { useEffect, useRef } from "react";

import {
  BRAND_MARK_HEIGHT,
  BRAND_MARK_OFFSETS,
  BRAND_MARK_PATH,
  BRAND_MARK_WIDTH,
} from "@/shared/brand-mark";
import { bayerThreshold, type Rgb, readThemeRgb } from "./dither";

const FALLBACK_CARD: Rgb = [247, 241, 229];
const FALLBACK_TEAL: Rgb = [38, 122, 130];
const FALLBACK_AMBER: Rgb = [196, 138, 79];

const LAYER_TONE = [0.3, 0.7, 0.84];

const PERIOD_MS = 3200;

const readColours = (): LayerColours => ({
  card: readThemeRgb("--bc-base-100", FALLBACK_CARD),
  teal: readThemeRgb("--bc-accent", FALLBACK_TEAL),
  amber: readThemeRgb("--bc-secondary", FALLBACK_AMBER),
});

const buildLayerMasks = (w: number, h: number): Uint8Array[] => {
  const masks: Uint8Array[] = [];
  const scale = Math.min(w / BRAND_MARK_WIDTH, h / BRAND_MARK_HEIGHT);
  const ox = (w - BRAND_MARK_WIDTH * scale) / 2;
  const oy = (h - BRAND_MARK_HEIGHT * scale) / 2;
  const path = new Path2D(BRAND_MARK_PATH);
  for (const offset of BRAND_MARK_OFFSETS) {
    const mask = new Uint8Array(w * h);
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      masks.push(mask);
      continue;
    }
    ctx.translate(ox, oy);
    ctx.scale(scale, scale);
    ctx.translate(offset.dx, offset.dy);
    ctx.fillStyle = "#fff";
    ctx.fill(path);
    const data = ctx.getImageData(0, 0, w, h).data;
    for (let i = 0; i < mask.length; i++) {
      mask[i] = data[i * 4]! > 128 ? 1 : 0;
    }
    masks.push(mask);
  }
  return masks;
};

type LayerMasks = { back: Uint8Array; middle: Uint8Array; front: Uint8Array };
type LayerColours = { card: Rgb; teal: Rgb; amber: Rgb };
type LayerTones = { back: number; middle: number; front: number };

const layerColourAt = (
  idx: number,
  threshold: number,
  masks: LayerMasks,
  tones: LayerTones,
  colours: LayerColours,
): Rgb => {
  if (masks.front[idx] && tones.front > threshold) {
    return colours.teal;
  }
  if (masks.middle[idx] && tones.middle > threshold) {
    return colours.amber;
  }
  if (masks.back[idx] && tones.back > threshold) {
    return colours.teal;
  }
  return colours.card;
};

type IdleDitherProps = { size?: number };

const IdleDither = ({ size = 180 }: IdleDitherProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const width = size;
  const height = Math.round((size * BRAND_MARK_HEIGHT) / BRAND_MARK_WIDTH);

  const dpr =
    typeof window !== "undefined" && window.devicePixelRatio
      ? window.devicePixelRatio
      : 1;
  const pw = Math.round(width * dpr);
  const ph = Math.round(height * dpr);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) {
      return;
    }
    let colours = readColours();
    const [backMask, middleMask, frontMask] = buildLayerMasks(pw, ph);
    const masks: LayerMasks = {
      back: backMask!,
      middle: middleMask!,
      front: frontMask!,
    };
    const out = ctx.createImageData(pw, ph);
    const od = out.data;

    const draw = (gain: number) => {
      const breath = 0.88 + 0.12 * gain;
      const tones: LayerTones = {
        front: LAYER_TONE[2]! * breath,
        middle: LAYER_TONE[1]! * breath,
        back: LAYER_TONE[0]! * breath,
      };
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const idx = y * pw + x;
          const colour = layerColourAt(
            idx,
            bayerThreshold(x, y),
            masks,
            tones,
            colours,
          );
          const o = idx * 4;
          od[o] = colour[0];
          od[o + 1] = colour[1];
          od[o + 2] = colour[2];
          od[o + 3] = 255;
        }
      }
      ctx.putImageData(out, 0, 0);
    };

    const frameKey = (gain: number) => {
      const breath = 0.88 + 0.12 * gain;
      return LAYER_TONE.map((tone) => Math.round(tone * breath * 64)).join();
    };

    let lastKey = "";
    const renderFrame = (gain: number) => {
      const key = frameKey(gain);
      if (key === lastKey) {
        return;
      }
      lastKey = key;
      draw(gain);
    };

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const phase = ((now - start) % PERIOD_MS) / PERIOD_MS;
      const gain = (1 - Math.cos(phase * 2 * Math.PI)) / 2;
      renderFrame(gain);
      raf = requestAnimationFrame(tick);
    };
    const startLoop = () => {
      if (!raf) {
        raf = requestAnimationFrame(tick);
      }
    };
    const stopLoop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const applyMotionPreference = () => {
      if (motionQuery.matches) {
        stopLoop();
        renderFrame(0.5);
      } else if (!document.hidden) {
        startLoop();
      }
    };
    const onVisibility = () => {
      if (document.hidden) {
        stopLoop();
      } else {
        applyMotionPreference();
      }
    };

    const schemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      colours = readColours();
      lastKey = "";
      if (motionQuery.matches) {
        renderFrame(0.5);
      }
    };

    schemeQuery.addEventListener("change", onScheme);
    motionQuery.addEventListener("change", applyMotionPreference);
    document.addEventListener("visibilitychange", onVisibility);
    applyMotionPreference();

    return () => {
      stopLoop();
      schemeQuery.removeEventListener("change", onScheme);
      motionQuery.removeEventListener("change", applyMotionPreference);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pw, ph]);

  return (
    <canvas
      ref={canvasRef}
      width={pw}
      height={ph}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        imageRendering: "pixelated",
        display: "block",
      }}
    />
  );
};

export { IdleDither };
