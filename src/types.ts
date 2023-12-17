import { Configuration } from "./storage";

export type DownloadStatus =
  | "pending"
  | "queued"
  | "resolving"
  | "downloading"
  | "completed"
  | "failed";

export type ItemStatus =
  | "pending"
  | "completed"
  | "failed"
  | "resolved"
  | "queued";

export enum FormatEnum {
  "mp3-v0" = "MP3 v0",
  "mp3-320" = "MP3 320",
  "flac" = "FLAC",
  "aac-hi" = "AAC",
  "vorbis" = "Ogg Vorbis",
  "alac" = "ALAC",
  "wav" = "WAV",
  "aiff-lossless" = "AIFF",
}

export type Format = keyof typeof FormatEnum;

export type Message =
  | SendItemsMessage
  | TabOpenedMessage
  | ConfigurationUpdatedMessage;

export interface SendItemsMessage {
  type: "send-items-to-background" | "send-items-to-tab";
  items: Item[];
}

export interface TabOpenedMessage {
  type: "tab-opened";
}

export interface ConfigurationUpdatedMessage {
  type: "configuration-updated";
  configuration: Configuration;
}

export interface Item {
  id: string;
  title: string;
  pageUrl: string;
  status: ItemStatus;
}

export interface Download {
  id: string;
  itemId: string;
  title: string;
  status: DownloadStatus;
  progress: number;
  downloadUrl: string;
  browserId?: number;
}
