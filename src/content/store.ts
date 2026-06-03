import { enableMapSet, produce } from "immer";
import { subscribeWithSelector } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

enableMapSet();

import type { Item } from "@/types";

export interface ContentState {
  selected: Record<string, Item>;
  downloadedIds: Set<string>;
  shiftKeyPressed: boolean;
  lastClickedIndex: number;
  updateSelected: (id: string, isSelected: boolean, item: Item | null) => void;
  resetSelected: () => void;
  selectedCount: () => number;
  toggleShiftKey: (shift: boolean) => void;
  setLastClickedIndex: (index: number) => void;
  setDownloadedIds: (ids: Set<string>) => void;
}

const INITIAL_STATE: Pick<
  ContentState,
  "selected" | "downloadedIds" | "shiftKeyPressed" | "lastClickedIndex"
> = {
  selected: {},
  downloadedIds: new Set<string>(),
  shiftKeyPressed: false,
  lastClickedIndex: 0,
};

export const store = createStore<ContentState>()(
  subscribeWithSelector((set, get) => ({
    ...INITIAL_STATE,
    updateSelected: (id: string, isSelected: boolean, item: Item | null) => {
      set(
        produce((draft: ContentState) => {
          if (isSelected && item) {
            draft.selected[id] = item;
          } else {
            delete draft.selected[id];
          }
        }),
      );
    },

    resetSelected: () =>
      set(
        produce((draft: ContentState) => {
          draft.selected = {};
        }),
      ),

    selectedCount: () => Object.keys(get().selected).length,

    toggleShiftKey: (shift) =>
      set(
        produce((draft: ContentState) => {
          draft.shiftKeyPressed = shift;
        }),
      ),

    setLastClickedIndex: (index) =>
      set(
        produce((draft: ContentState) => {
          draft.lastClickedIndex = index;
        }),
      ),

    setDownloadedIds: (ids) =>
      set(
        produce((draft: ContentState) => {
          draft.downloadedIds = ids;
        }),
      ),
  })),
);
