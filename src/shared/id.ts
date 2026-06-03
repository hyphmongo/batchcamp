import type { Format } from "@/types";

export const makeItemId = (
  bandcampId: string | number,
  format: Format,
): string => `${bandcampId}:${format}`;

export const releaseIdOf = (compositeId: string): string => {
  const colon = compositeId.indexOf(":");
  return colon >= 0 ? compositeId.slice(0, colon) : compositeId;
};

export const releaseIdSet = (entries: string[]): Set<string> =>
  new Set(entries.map(releaseIdOf));
