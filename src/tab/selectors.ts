import {
  type Item,
  type ItemStatus,
  isResolvedItem,
  type ResolvedItem,
} from "@/types";
import type { State } from "./store";

const liveProgress = (
  item: ResolvedItem,
  progress: Record<string, number>,
): number => progress[item.id] ?? item.download.progress;

export const calculateProgress = (
  item: Item,
  progress: Record<string, number>,
): number => (isResolvedItem(item) ? liveProgress(item, progress) : 0);

export const getStatus = (item: Item): ItemStatus => item.status;

export const shallowArrayEqual = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
};

let cachedItemsRef: Map<string, Item> | undefined;
let cachedItemsArray: Item[] = [];

const selectItems = (state: State): Item[] => {
  if (state.items === cachedItemsRef) {
    return cachedItemsArray;
  }
  cachedItemsRef = state.items;
  cachedItemsArray = Array.from(state.items.values());
  return cachedItemsArray;
};

const memoize = <T extends unknown[]>(
  fn: (state: State) => T,
): ((state: State) => T) => {
  let lastItems: Map<string, Item> | undefined;
  let lastResult: T;
  return (state: State) => {
    if (state.items === lastItems) {
      return lastResult;
    }
    lastItems = state.items;
    const newResult = fn(state);
    if (lastResult && shallowArrayEqual(lastResult, newResult)) {
      return lastResult;
    }
    lastResult = newResult;
    return lastResult;
  };
};

const createStatusSelector = (...statuses: ItemStatus[]) =>
  memoize((state: State) =>
    selectItems(state).filter((item) => statuses.includes(item.status)),
  );

export const totalItemCountSelector = (state: State): number =>
  selectItems(state).length;

export const totalSizeMbSelector = (state: State): number =>
  sizeEstimateSelector(state).knownSizeMb;

let lastEstItems: Map<string, Item> | undefined;
let lastEstResult = { knownSizeMb: 0, knownCount: 0, totalCount: 0 };

export const sizeEstimateSelector = (
  state: State,
): { knownSizeMb: number; knownCount: number; totalCount: number } => {
  if (state.items === lastEstItems) {
    return lastEstResult;
  }
  lastEstItems = state.items;
  let knownSizeMb = 0;
  let knownCount = 0;
  let total = 0;
  for (const item of state.items.values()) {
    total++;
    if (isResolvedItem(item) && item.download.sizeMb) {
      knownSizeMb += item.download.sizeMb;
      knownCount++;
    }
  }
  lastEstResult = { knownSizeMb, knownCount, totalCount: total };
  return lastEstResult;
};

export const overallPercentSelector = (state: State): number => {
  const items = selectItems(state);
  if (items.length === 0) {
    return 0;
  }

  const sliceSize = 100 / items.length;
  let percent = 0;

  for (const item of items) {
    if (item.status === "completed") {
      percent += sliceSize;
    } else if (isResolvedItem(item) && item.status === "downloading") {
      percent += sliceSize * (liveProgress(item, state.progress) / 100);
    }
  }

  return Math.min(percent, 100);
};

export const completedItemsSelector = createStatusSelector("completed");
export const failedItemsSelector = createStatusSelector("failed");
export const downloadingItemsSelector = createStatusSelector("downloading");

type ActiveDownload = { itemId: string; browserId: number };

export const activeDownloadsSelector = (state: State): ActiveDownload[] => {
  const active: ActiveDownload[] = [];
  for (const item of state.items.values()) {
    if (
      item.status === "downloading" &&
      isResolvedItem(item) &&
      item.download.browserId != null
    ) {
      active.push({ itemId: item.id, browserId: item.download.browserId });
    }
  }
  return active;
};

export const pendingItemsSelector = createStatusSelector("pending");
export const resolvedItemsSelector = createStatusSelector("resolved");

export const derivedItemsSelector = (state: State): Item[] =>
  selectItems(state);
