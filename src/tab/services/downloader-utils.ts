const ILLEGAL_CHARS = /[<>:"/\\|?*%]/g;
const CONTROL_CHARS = /[\x00-\x1f\x7f]/g;
const RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

const guardReservedName = (name: string): string =>
  RESERVED_NAMES.test(name) ? `_${name}` : name;

export const sanitizeFilename = (filename: string): string => {
  const parts = filename.split(".");
  const extension = parts.pop();
  const name = parts.join(".");

  let cleaned = name
    .replace(ILLEGAL_CHARS, "_")
    .replace(CONTROL_CHARS, "")
    .replace(/[\u00A0\u1680\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, "")
    .replace(/[\u200C-\u200F\u202A-\u202E\u2060-\u206F]/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s.]+|[\s.]+$/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .trim();

  if (!cleaned) {
    cleaned = "download";
  }

  cleaned = guardReservedName(cleaned);

  const cleanedExtension = extension
    ?.replace(ILLEGAL_CHARS, "_")
    .replace(CONTROL_CHARS, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");

  const maxLength = 200;
  const maxNameLength = Math.max(
    1,
    maxLength - (cleanedExtension ? cleanedExtension.length + 1 : 0),
  );

  if (cleaned.length > maxNameLength) {
    cleaned = cleaned.substring(0, maxNameLength);
    if (/[\uD800-\uDBFF]$/.test(cleaned)) {
      cleaned = cleaned.slice(0, -1);
    }
    cleaned = cleaned.replace(/_+$/, "");
  }

  return cleanedExtension ? `${cleaned}.${cleanedExtension}` : cleaned;
};

export const sanitizePath = (filepath: string): string => {
  const trimmed = filepath.replace(/^\/+|\/+$/g, "");
  const segments = trimmed.split("/");
  const lastSegment = segments.pop() ?? "";
  const sanitizedFile = sanitizeFilename(lastSegment);

  const sanitizedDirs = segments
    .filter((s) => s !== "" && s !== "..")
    .map((segment) => {
      const cleaned = segment
        .replace(ILLEGAL_CHARS, "_")
        .replace(CONTROL_CHARS, "")
        .replace(/_{2,}/g, "_")
        .replace(/^[\s._]+|[\s._]+$/g, "")
        .trim();

      if (!cleaned) {
        return "";
      }

      return guardReservedName(cleaned);
    })
    .filter(Boolean);

  if (sanitizedDirs.length === 0) {
    return sanitizedFile;
  }

  return `${sanitizedDirs.join("/")}/${sanitizedFile}`;
};

export const parseContentDispositionFilename = (
  header: string,
): string | null => {
  const extMatch = header.match(/filename\*\s*=\s*UTF-8'[^']*'(.+?)(?:;|$)/i);
  if (extMatch?.[1]) {
    return decodeURIComponent(extMatch[1].trim());
  }

  const match = header.match(/filename\s*=\s*"([^"]*)"/);
  if (match) {
    return match[1] || null;
  }

  const unquoted = header.match(/filename\s*=\s*([^\s;]+)/);
  if (unquoted?.[1]) {
    return unquoted[1];
  }

  return null;
};
