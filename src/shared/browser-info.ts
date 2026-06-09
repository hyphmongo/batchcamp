import { detect } from "detect-browser";

const detected = detect();
const rawName = detected?.name ?? "unknown";

const DISPLAY_NAMES: Record<string, string> = {
  firefox: "Firefox",
  chrome: "Chrome",
  safari: "Safari",
  edge: "Edge",
  "edge-chromium": "Edge",
  opera: "Opera",
};

export const browserName = DISPLAY_NAMES[rawName] ?? rawName;
export const browserVersion = detected?.version ?? "unknown";
export const isFirefox = rawName === "firefox";
