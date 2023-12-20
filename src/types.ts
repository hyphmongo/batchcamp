import { Configuration } from "./storage";

export type ItemStatus =
  | "pending"
  | "queued"
  | "resolving"
  | "resolved"
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

export type SendItemsMessage = {
  type: "send-items-to-background" | "send-items-to-tab";
  items: Item[];
};

export type TabOpenedMessage = {
  type: "tab-opened";
};

export type ConfigurationUpdatedMessage = {
  type: "configuration-updated";
  configuration: Configuration;
};

export type Message =
  | SendItemsMessage
  | TabOpenedMessage
  | ConfigurationUpdatedMessage;

export type ItemType = "single" | "multiple";

type BaseItem = {
  id: string;
  title: string;
  type?: ItemType;
  status: ItemStatus;
  parentId?: string;
};

export type PendingItem = BaseItem & {
  status: "pending";
  url: string;
};

export type SingleItem = BaseItem & {
  type: "single";
  download: Download;
};

export type MultipleItemWithChildren = BaseItem & {
  type: "multiple";
  progress: number;
  children: SingleItem[];
};

export type MultipleItemWithIds = BaseItem & {
  type: "multiple";
  progress: number;
  children: string[];
};

export type MultipleItem = MultipleItemWithChildren | MultipleItemWithIds;

export type Item = PendingItem | SingleItem | MultipleItem;

export interface Download {
  id: string;
  title: string;
  progress: number;
  url: string;
  browserId?: number;
}

export const isPendingItem = (item: Item): item is PendingItem => {
  return (item as PendingItem).status === "pending";
};

export const isSingleItem = (item: Item): item is SingleItem => {
  return (item as SingleItem).type === "single";
};

export const isMultipleItem = (item: Item): item is MultipleItem => {
  return (item as MultipleItem).type === "multiple";
};

export const isMultipleItemWithChildren = (
  item: Item
): item is MultipleItemWithChildren =>
  isMultipleItem(item) && item.children[0] instanceof Object;

export const isMultipleItemWithIds = (
  item: Item
): item is MultipleItemWithIds =>
  isMultipleItem(item) && typeof item.children[0] === "string";
