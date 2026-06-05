import type {
  BrowserAdapter,
  DownloadDelta,
  DownloadItem,
} from "@/tab/services/browser-adapter";

type MessageSubscriber = (msg: unknown) => void;
type DownloadChangedSubscriber = (delta: DownloadDelta) => void;

type RecordedDownload = {
  url: string;
  filename?: string;
};

export interface TestHarness {
  adapter: BrowserAdapter;
  emitMessage(message: unknown): void;
  emitDownloadChanged(delta: DownloadDelta): void;
  setSearchResults(results: DownloadItem[]): void;
  resolveDownloadIds(ids: number[]): void;
  subscriberCounts: {
    onMessage(): number;
    onDownloadChanged(): number;
  };
  recorded: {
    downloads: RecordedDownload[];
    runtime: { sendMessage: unknown[] };
    pause: number[];
    resume: number[];
    show: number[];
    removeFile: number[];
    erase: number[];
    cancel: number[];
    registeredFilenames: { url: string; filename: string }[];
  };
}

export const createTestHarness = (): TestHarness => {
  const messageSubscribers: MessageSubscriber[] = [];
  const downloadChangedSubscribers: DownloadChangedSubscriber[] = [];
  let searchResults: DownloadItem[] = [];
  let downloadIdQueue: number[] = [];
  let nextDownloadId = 1;

  const recorded: TestHarness["recorded"] = {
    downloads: [],
    runtime: { sendMessage: [] },
    pause: [],
    resume: [],
    show: [],
    removeFile: [],
    erase: [],
    cancel: [],
    registeredFilenames: [],
  };

  const adapter: BrowserAdapter = {
    downloads: {
      async download(options) {
        recorded.downloads.push({
          url: options.url,
          filename: options.filename,
        });
        const id = downloadIdQueue.shift() ?? nextDownloadId++;
        return id;
      },
      async search(query) {
        let results = searchResults;
        if (query?.id != null) {
          results = results.filter((d) => d.id === query.id);
        }
        if (query?.state != null) {
          results = results.filter((d) => d.state === query.state);
        }
        return results;
      },
      async pause(id) {
        recorded.pause.push(id);
      },
      async resume(id) {
        recorded.resume.push(id);
      },
      async cancel(id) {
        recorded.cancel.push(id);
      },
      async show(id) {
        recorded.show.push(id);
      },
      async removeFile(id) {
        recorded.removeFile.push(id);
      },
      async erase({ id }) {
        recorded.erase.push(id);
      },
    },
    runtime: {
      async sendMessage(message) {
        recorded.runtime.sendMessage.push(message);
        if (
          typeof message === "object" &&
          message !== null &&
          (message as { type?: string }).type === "register-filename"
        ) {
          const m = message as { url: string; filename: string };
          recorded.registeredFilenames.push({
            url: m.url,
            filename: m.filename,
          });
        }
        return;
      },
    },
    events: {
      onMessage: {
        subscribe(fn) {
          messageSubscribers.push(fn);
          return () => {
            const i = messageSubscribers.indexOf(fn);
            if (i >= 0) {
              messageSubscribers.splice(i, 1);
            }
          };
        },
      },
      onDownloadChanged: {
        subscribe(fn) {
          downloadChangedSubscribers.push(fn);
          return () => {
            const i = downloadChangedSubscribers.indexOf(fn);
            if (i >= 0) {
              downloadChangedSubscribers.splice(i, 1);
            }
          };
        },
      },
    },
  };

  return {
    adapter,
    emitMessage(message) {
      for (const fn of [...messageSubscribers]) {
        fn(message);
      }
    },
    emitDownloadChanged(delta) {
      for (const fn of [...downloadChangedSubscribers]) {
        fn(delta);
      }
    },
    setSearchResults(results) {
      searchResults = results;
    },
    resolveDownloadIds(ids) {
      downloadIdQueue = ids;
    },
    subscriberCounts: {
      onMessage: () => messageSubscribers.length,
      onDownloadChanged: () => downloadChangedSubscribers.length,
    },
    recorded,
  };
};
