import { Item, ItemStatus, SingleItem, isMultipleItemWithIds } from "../types";
import { State } from "./store";

const QUEUED_STATUSES: ItemStatus[] = ["queued", "resolving", "downloading"];

const selectItems = (state: State) => Array.from(state.items.values());

const createStatusSelector =
  (...statuses: ItemStatus[]) =>
  (state: State) =>
    selectItems(state).filter((item) => statuses.includes(item.status));

export const pendingItemsSelector = createStatusSelector("pending");
export const resolvedItemsSelector = createStatusSelector("resolved");
export const downloadingItemsSelector = createStatusSelector("downloading");
export const failedItemsSelector = createStatusSelector("failed");
export const queuedItemsSelector = createStatusSelector(...QUEUED_STATUSES);

export const derivedItemsSelector = (state: State): Item[] =>
  selectItems(state)
    .filter((item) => !item.parentId)
    .map((item) => {
      if (isMultipleItemWithIds(item)) {
        return {
          ...item,
          children: item.children
            .map<SingleItem>((child) => state.items.get(child) as SingleItem)
            .filter((x) => x),
        };
      }

      return item;
    });
