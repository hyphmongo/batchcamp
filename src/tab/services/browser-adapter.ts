import browser from "webextension-polyfill";

type DownloadOptions = {
  url: string;
  filename?: string;
  conflictAction?: "uniquify" | "overwrite" | "prompt";
};

export type DownloadDelta = browser.Downloads.OnChangedDownloadDeltaType;
export type DownloadItem = browser.Downloads.DownloadItem;
type DownloadSearchQuery = browser.Downloads.DownloadQuery;

type Unsubscribe = () => void;

export interface BrowserAdapter {
  downloads: {
    download(options: DownloadOptions): Promise<number>;
    search(query: DownloadSearchQuery): Promise<DownloadItem[]>;
    pause(id: number): Promise<void>;
    resume(id: number): Promise<void>;
    cancel(id: number): Promise<void>;
    show(id: number): Promise<void>;
    removeFile(id: number): Promise<void>;
    erase(query: { id: number }): Promise<void>;
  };
  runtime: {
    sendMessage(message: unknown): Promise<unknown>;
  };
  events: {
    onMessage: { subscribe(fn: (msg: unknown) => void): Unsubscribe };
    onDownloadChanged: {
      subscribe(fn: (delta: DownloadDelta) => void): Unsubscribe;
    };
  };
}

const realAdapter: BrowserAdapter = {
  downloads: {
    download: (opts) => browser.downloads.download(opts),
    search: (q) => browser.downloads.search(q),
    pause: (id) => browser.downloads.pause(id),
    resume: (id) => browser.downloads.resume(id),
    cancel: (id) => browser.downloads.cancel(id),
    show: (id) => browser.downloads.show(id).then(() => undefined),
    removeFile: (id) => browser.downloads.removeFile(id),
    erase: (q) => browser.downloads.erase(q).then(() => undefined),
  },
  runtime: {
    sendMessage: (message) => browser.runtime.sendMessage(message),
  },
  events: {
    onMessage: {
      subscribe(fn) {
        browser.runtime.onMessage.addListener(fn);
        return () => browser.runtime.onMessage.removeListener(fn);
      },
    },
    onDownloadChanged: {
      subscribe(fn) {
        browser.downloads.onChanged.addListener(fn);
        return () => browser.downloads.onChanged.removeListener(fn);
      },
    },
  },
};

let currentAdapter: BrowserAdapter = realAdapter;

export const setBrowserAdapter = (adapter: BrowserAdapter) => {
  currentAdapter = adapter;
};

export const resetBrowserAdapter = () => {
  currentAdapter = realAdapter;
};

export const browserAdapter: BrowserAdapter = new Proxy({} as BrowserAdapter, {
  get(_, prop: keyof BrowserAdapter) {
    return currentAdapter[prop];
  },
});
