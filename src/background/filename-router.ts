import browser from "webextension-polyfill";

type FilenameSuggestion = {
  filename: string;
  conflictAction?: "uniquify" | "overwrite" | "prompt";
};

type IncomingDownload = {
  url: string;
  filename: string;
};

type FilenameRouter = {
  register(url: string, filename: string): void;
  unregister(url: string): void;
  route(
    item: IncomingDownload,
    suggest: (s?: FilenameSuggestion) => void,
  ): boolean;
  size(): number;
};

const DEFAULT_MAX_PENDING = 200;
const SESSION_KEY = "pendingFilenames";

type SessionArea = {
  get(key: string): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
};

const sessionArea = () =>
  (browser.storage as { session?: SessionArea } | undefined)?.session;

export const createFilenameRouter = (
  maxPending = DEFAULT_MAX_PENDING,
): FilenameRouter => {
  const pending = new Map<string, string>();
  const session = sessionArea();

  const persist = () => {
    void session
      ?.set({ [SESSION_KEY]: Object.fromEntries(pending) })
      .catch(() => {});
  };

  let hydrated = !session;
  const hydration = session
    ? session
        .get(SESSION_KEY)
        .then((stored) => {
          const saved = (stored?.[SESSION_KEY] ?? {}) as Record<string, string>;
          for (const [url, filename] of Object.entries(saved)) {
            if (!pending.has(url)) {
              pending.set(url, filename);
            }
          }
        })
        .catch(() => {})
        .finally(() => {
          hydrated = true;
        })
    : Promise.resolve();

  const deliver = (
    url: string,
    suggest: (s?: FilenameSuggestion) => void,
  ): boolean => {
    const customName = pending.get(url);
    if (!customName) {
      return false;
    }
    pending.delete(url);
    persist();
    suggest({ filename: customName, conflictAction: "uniquify" });
    return true;
  };

  return {
    register(url, filename) {
      pending.delete(url);
      pending.set(url, filename);
      while (pending.size > maxPending) {
        const oldest = pending.keys().next().value;
        if (oldest === undefined) {
          break;
        }
        pending.delete(oldest);
      }
      persist();
    },
    unregister(url) {
      pending.delete(url);
      persist();
    },
    route({ url }, suggest) {
      if (hydrated) {
        return deliver(url, suggest);
      }
      void hydration.then(() => {
        if (!deliver(url, suggest)) {
          suggest();
        }
      });
      return true;
    },
    size: () => pending.size,
  };
};
