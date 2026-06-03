import { detect } from "detect-browser";

const detected = detect();

export const browserName = detected?.name ?? "unknown";
export const browserVersion = detected?.version ?? "unknown";
export const isFirefox = browserName === "firefox";
