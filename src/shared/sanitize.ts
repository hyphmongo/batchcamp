const REDACTED = "<redacted>";

const sanitizeUrl = (value: string): string =>
  value
    .replace(/\b(?:chrome|moz)-extension:\/\/[^/\s"'<>]+\/?/g, "~/")
    .replace(/\bhttps?:\/\/[^\s"'<>]+/g, (match) => {
      try {
        return `${new URL(match).origin}/${REDACTED}`;
      } catch {
        return REDACTED;
      }
    });

export const scrubUrls = (value: unknown, depth = 0): unknown => {
  if (typeof value === "string") {
    return sanitizeUrl(value);
  }
  if (depth >= 6 || value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => scrubUrls(entry, depth + 1));
  }
  const record = value as Record<string, unknown>;
  const scrubbed: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    scrubbed[key] = scrubUrls(record[key], depth + 1);
  }
  return scrubbed;
};
