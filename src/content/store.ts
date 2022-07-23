import create from "zustand/vanilla";
import { produce } from "immer";

export interface ContentState {
  checkedCount: number;
  setCheckedCount: (count: number) => void;

  shiftKeyPressed: boolean;
  toggleShiftKey: (shift: boolean) => void;
}

export const store = create<ContentState>((set) => ({
  checkedCount: 0,
  setCheckedCount: (count: number) =>
    set(
      produce((draft: ContentState) => {
        draft.checkedCount = count;
      })
    ),
  shiftKeyPressed: false,
  toggleShiftKey: (shift) =>
    set(
      produce((draft: ContentState) => {
        draft.shiftKeyPressed = shift;
      })
    ),
}));
