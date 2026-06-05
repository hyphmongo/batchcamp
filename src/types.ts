export type ItemStatus =
  | "pending"
  | "queued"
  | "resolving"
  | "resolved"
  | "downloading"
  | "completed"
  | "failed";

export const FORMAT_LABELS = {
  "mp3-v0": "MP3 v0",
  "mp3-320": "MP3 320",
  flac: "FLAC",
  "aac-hi": "AAC",
  vorbis: "Ogg Vorbis",
  alac: "ALAC",
  wav: "WAV",
  "aiff-lossless": "AIFF",
} as const;

export type Format = keyof typeof FORMAT_LABELS;

type SendItemsMessage = {
  type: "send-items-to-background" | "send-items-to-tab";
  items: Item[];
};

type TabOpenedMessage = {
  type: "tab-opened";
};

type RegisterFilenameMessage = {
  type: "register-filename";
  url: string;
  filename: string;
};

type UnregisterFilenameMessage = {
  type: "unregister-filename";
  url: string;
};

type ShowSettingsMessage = {
  type: "show-settings";
};

type ItemsDeliveredMessage = {
  type: "items-delivered";
};

type Message =
  | SendItemsMessage
  | TabOpenedMessage
  | RegisterFilenameMessage
  | UnregisterFilenameMessage
  | ShowSettingsMessage
  | ItemsDeliveredMessage;

export const isMessage = (msg: unknown): msg is Message => {
  if (typeof msg !== "object" || msg === null || !("type" in msg)) {
    return false;
  }
  const candidate = msg as Record<string, unknown>;
  switch (candidate.type) {
    case "send-items-to-background":
    case "send-items-to-tab":
      return Array.isArray(candidate.items);
    case "register-filename":
      return (
        typeof candidate.url === "string" &&
        typeof candidate.filename === "string"
      );
    case "unregister-filename":
      return typeof candidate.url === "string";
    case "tab-opened":
    case "show-settings":
    case "items-delivered":
      return true;
    default:
      return false;
  }
};

type BaseItem = {
  id: string;
  title: string;
  status: ItemStatus;
  format?: Format;
};

export type PendingItem = BaseItem & {
  status: "pending";
  url: string;
  artUrl?: string;
};

export type ResolvedItem = BaseItem & {
  url?: string;
  download: Download;
};

export type Item = PendingItem | ResolvedItem;

export type Download = {
  id: string;
  title: string;
  artist: string;
  date?: string;
  artUrl?: string;
  sizeMb?: number;
  progress: number;
  url: string;
  browserId?: number;
  format: Format;
};

export const isPendingItem = (item: Item): item is PendingItem =>
  item.status === "pending";

export const isResolvedItem = (item: Item): item is ResolvedItem =>
  "download" in item;
