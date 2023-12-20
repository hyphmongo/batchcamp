import { Item, ItemStatus, SingleItem, isMultipleItemWithIds } from "../types";
import { State } from "./store";

const QUEUED_STATUSES: ItemStatus[] = ["queued", "resolving", "downloading"];

const selectItems = (state: State) => Object.values(state.items);

const createStatusSelector =
  (...statuses: ItemStatus[]) =>
  (state: State) =>
    selectItems(state).filter((item) => statuses.includes(item.status));

export const pendingItemsSelector = createStatusSelector("pending");
export const resolvedItemsSelector = createStatusSelector("resolved");
export const downloadingItemsSelector = createStatusSelector("downloading");
export const queuedItemsSelector = createStatusSelector(...QUEUED_STATUSES);

export const failedItemsSelector = (state: State) =>
  selectItems(state).filter(
    (item) => item.status === "failed" && !item.parentId
  );

export const derivedItemsSelector = (state: State): Item[] =>
  selectItems(state)
    .filter((item) => !item.parentId)
    .map((item) => {
      if (isMultipleItemWithIds(item)) {
        return {
          ...item,
          children: item.children
            .map<SingleItem>((child) => state.items[child] as SingleItem)
            .filter((x) => x),
        };
      }

      return item;
    });
