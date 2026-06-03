import { type Configuration, DEFAULT_FILENAME_TEMPLATE } from "@/storage";

export const applyTemplate = (template: string, data: Record<string, string>) =>
  template.replace(/\{(\w+)}/g, (match, key) => {
    const value = data[key];
    if (value === undefined) {
      return match;
    }
    return value.replace(/[/\\]/g, "_");
  });

export const splitArtistTitle = (
  full: string,
): { artist?: string; title: string } => {
  const idx = full.indexOf(" - ");
  if (idx === -1) {
    return { title: full };
  }
  return { artist: full.slice(0, idx), title: full.slice(idx + 3) };
};

export const stripArtistPrefix = (title: string, artist?: string): string => {
  if (!artist) {
    return title;
  }
  const prefix = `${artist} - `;
  return title.startsWith(prefix) ? title.slice(prefix.length) : title;
};

export const isFilenameTemplateEnabled = (
  config: Pick<Configuration, "filenameTemplate" | "filenameTemplateEnabled">,
): boolean =>
  config.filenameTemplateEnabled ??
  config.filenameTemplate !== DEFAULT_FILENAME_TEMPLATE;
