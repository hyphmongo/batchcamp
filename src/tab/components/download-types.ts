import type { Item } from "@/types";

export type SizeEstimate = {
  knownSizeMb: number;
  knownCount: number;
  totalCount: number;
};

export type ListReadoutProps = {
  isAllComplete: boolean;
  totalCount: number;
  completedCount: number;
  activeCount: number;
  failedCount: number;
  paused: boolean;
  sizeEstimate: SizeEstimate;
  onTogglePause: () => void;
  onRetryAllFailed: () => void;
  onClearAllCompleted: () => void;
};

export type RowActions = {
  retry: (id: string) => void;
  cancel: (id: string) => Promise<void>;
  pause: (id: string) => void;
  resume: (id: string) => void;
  showInFolder: (id: string) => void;
  copyUrl: (id: string) => void;
  requestDelete: (id: string) => void;
};

export type DownloadListProps = {
  items: Item[];
  pausedItemIds: Set<string>;
  actions: RowActions;
};
