import { Configuration } from "./storage";

export type DownloadStatus =
  | "pending"
  | "queued"
  | "downloading"
  | "completed"
  | "failed";

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
  | DownloadMessage
  | TabOpenedMessage
  | ConfigurationUpdatedMessage;

export interface DownloadMessage {
  type: "send-downloads-to-background" | "send-downloads-to-tab";
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
  url: string;
}

export interface Download {
  item: Item;
  status: DownloadStatus;
  id?: number;
  progress: number;
}

export interface UseCase<Request, Response> {
  execute(request?: Request): Promise<Response> | Response;
}
