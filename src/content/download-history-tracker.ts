import { releaseIdSet } from "@/shared/id";

export class DownloadHistoryTracker {
  private history: string[] = [];
  private onChange: (ids: Set<string>) => void;

  constructor(onChange: (ids: Set<string>) => void) {
    this.onChange = onChange;
  }

  updateHistory(entries: string[]) {
    this.history = entries;
    this.onChange(releaseIdSet(this.history));
  }
}
