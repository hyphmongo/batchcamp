export type Rgb = [number, number, number];

// biome-ignore format: 8x8 grid
const BAYER_8X8 = new Uint8Array([
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21,
]);

export const bayerThreshold = (x: number, y: number): number =>
  (BAYER_8X8[((y & 7) << 3) | (x & 7)]! + 0.5) / 64;

let parserCtx: CanvasRenderingContext2D | null = null;

const getParserContext = (): CanvasRenderingContext2D | null => {
  if (!parserCtx) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    parserCtx = canvas.getContext("2d", { willReadFrequently: true });
  }
  return parserCtx;
};

export const readThemeRgb = (varName: string, fallback: Rgb): Rgb => {
  if (typeof document === "undefined") {
    return fallback;
  }
  const ctx = getParserContext();
  if (!ctx) {
    return fallback;
  }
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  if (!raw) {
    return fallback;
  }
  try {
    ctx.fillStyle = raw;
  } catch {
    return fallback;
  }
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0]!, data[1]!, data[2]!];
};
