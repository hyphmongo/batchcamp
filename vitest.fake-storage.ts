type StorageCallback = (items: Record<string, unknown>) => void;

export interface FakeStorageArea {
  get: (
    keys?: unknown,
    cb?: StorageCallback,
  ) => Promise<Record<string, unknown>>;
  set: (items: Record<string, unknown>, cb?: () => void) => Promise<void>;
  remove: (keys: string | string[], cb?: () => void) => Promise<void>;
  clear: (cb?: () => void) => Promise<void>;
  onChanged: { addListener: () => void; removeListener: () => void };
}

export const createFakeStorageArea = (): {
  area: FakeStorageArea;
  reset: () => void;
} => {
  const data: Record<string, unknown> = {};

  const area: FakeStorageArea = {
    get: (keys, cb) => {
      const result: Record<string, unknown> = {};
      if (keys === null || keys === undefined) {
        Object.assign(result, data);
      } else if (typeof keys === "string") {
        if (keys in data) {
          result[keys] = data[keys];
        }
      } else if (Array.isArray(keys)) {
        for (const key of keys) {
          if (key in data) {
            result[key] = data[key];
          }
        }
      } else if (typeof keys === "object") {
        Object.assign(result, keys, data);
      }
      cb?.(result);
      return Promise.resolve(result);
    },
    set: (items, cb) => {
      Object.assign(data, items);
      cb?.();
      return Promise.resolve();
    },
    remove: (keys, cb) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) {
        delete data[key];
      }
      cb?.();
      return Promise.resolve();
    },
    clear: (cb) => {
      for (const key of Object.keys(data)) {
        delete data[key];
      }
      cb?.();
      return Promise.resolve();
    },
    onChanged: { addListener: () => {}, removeListener: () => {} },
  };

  const reset = () => {
    for (const key of Object.keys(data)) {
      delete data[key];
    }
  };

  return { area, reset };
};
