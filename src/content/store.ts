import { produce } from "immer";
import create from "zustand/vanilla";
import { Item } from "../types";

export interface ContentState {
  selected: Record<string, Item | null>;
  shiftKeyPressed: boolean;
  lastClickedIndex: number;
  updateSelected: (id: string, isSelected: boolean, item: Item) => void;
  resetSelected: () => void;
  selectedCount: () => number;
  toggleShiftKey: (shift: boolean) => void;
  setLastClickedIndex: (index: number) => void;
}

const INITIAL_STATE = {
  selected: {},
  shiftKeyPressed: false,
  lastClickedIndex: 0,
};

export const store = create<ContentState>((set, get) => ({
  ...INITIAL_STATE,
  updateSelected: (id: string, isSelected: boolean, item: Item) => {
    set(
      produce((draft: ContentState) => {
        draft.selected[id] = isSelected ? item : null;
      })
    );
  },

  resetSelected: () => {
    set(
      produce((draft: ContentState) => {
        for (const id of Object.keys(draft.selected)) {
          draft.selected[id] = null;
        }
      })
    );
  },

  selectedCount: () =>
    Object.values(get().selected).filter((x) => Boolean(x)).length,

  toggleShiftKey: (shift) =>
    set(
      produce((draft: ContentState) => {
        draft.shiftKeyPressed = shift;
      })
    ),

  setLastClickedIndex: (index) => {
    set(
      produce((draft: ContentState) => {
        draft.lastClickedIndex = index;
      })
    );
  },
}));
