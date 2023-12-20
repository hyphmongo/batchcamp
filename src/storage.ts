import { getBucket } from "@extend-chrome/storage";

import { Format, Item } from "./types";

interface BackgroundContext {
  tabId: number | null;
  items: Item[];
}

export const backgroundStore = getBucket<BackgroundContext>("background");

export interface Configuration {
  format: Format;
  concurrency: number;
}

export const configurationStore = getBucket<Configuration>("configuration");
