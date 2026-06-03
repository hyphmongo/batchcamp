import { beforeEach, describe, expect, it, vi } from "vitest";

const { store, storageState } = vi.hoisted(() => ({
  store: new Map<string, unknown>(),
  storageState: { failSnapshot: false, failRemoveItems: false },
}));

vi.mock("@wxt-dev/storage", () => ({
  storage: {
    defineItem: (key: string, opts?: { fallback?: unknown }) => ({
      key,
      fallback: opts?.fallback,
      getValue: async () => (store.has(key) ? store.get(key) : opts?.fallback),
      setValue: async (value: unknown) => {
        store.set(key, value);
      },
      watch: () => () => {},
    }),
    snapshot: async (area: string) => {
      if (storageState.failSnapshot) {
        throw new Error("storage unavailable");
      }
      const prefix = `${area}:`;
      const result: Record<string, unknown> = {};
      for (const [key, value] of store) {
        if (key.startsWith(prefix)) {
          result[key.slice(prefix.length)] = value;
        }
      }
      return result;
    },
    removeItems: async (keys: string[]) => {
      if (storageState.failRemoveItems) {
        throw new Error("remove failed");
      }
      for (const key of keys) {
        store.delete(key);
      }
    },
  },
}));

const { configurationStore, DEFAULT_CONFIG, migrateLegacyStorage } =
  await import("@/storage");

const LEGACY = "local:extend-chrome/storage__";

const seedLegacyConfig = (format: string, concurrency: number) => {
  store.set(`${LEGACY}configuration_keys`, ["format", "concurrency"]);
  store.set(`${LEGACY}configuration--format`, format);
  store.set(`${LEGACY}configuration--concurrency`, concurrency);
};

const remainingLegacyKeys = () =>
  [...store.keys()].filter((key) => key.includes("extend-chrome/storage__"));

beforeEach(() => {
  store.clear();
  storageState.failSnapshot = false;
  storageState.failRemoveItems = false;
});

describe("migrateLegacyStorage", () => {
  it("carries format + concurrency from 1.4.x storage into the new config", async () => {
    seedLegacyConfig("flac", 5);

    await migrateLegacyStorage();

    const config = await configurationStore.get();
    expect(config.format).toBe("flac");
    expect(config.concurrency).toBe(5);
  });

  it("treats a migrated 1.4.x user as already onboarded", async () => {
    seedLegacyConfig("wav", 2);

    await migrateLegacyStorage();

    expect((await configurationStore.get()).hasOnboarded).toBe(true);
  });

  it("fills the v2-only fields with their defaults", async () => {
    seedLegacyConfig("flac", 4);

    await migrateLegacyStorage();

    const config = await configurationStore.get();
    expect(config.downloadArtwork).toBe(DEFAULT_CONFIG.downloadArtwork);
    expect(config.filenameTemplate).toBe(DEFAULT_CONFIG.filenameTemplate);
    expect(config.filenameTemplateEnabled).toBe(
      DEFAULT_CONFIG.filenameTemplateEnabled,
    );
  });

  it("removes the legacy keys so the migration only runs once", async () => {
    seedLegacyConfig("flac", 5);

    await migrateLegacyStorage();

    expect(remainingLegacyKeys()).toEqual([]);
  });

  it("is a no-op on a fresh v2 install with no legacy keys", async () => {
    await migrateLegacyStorage();

    expect(await configurationStore.get()).toEqual(DEFAULT_CONFIG);
  });

  it("falls back to the default format for an unrecognized legacy value", async () => {
    seedLegacyConfig("super-audio", 4);

    await migrateLegacyStorage();

    const config = await configurationStore.get();
    expect(config.format).toBe(DEFAULT_CONFIG.format);
    expect(config.concurrency).toBe(4);
    expect(config.hasOnboarded).toBe(true);
  });

  it("resolves instead of throwing when storage is unavailable", async () => {
    storageState.failSnapshot = true;

    await expect(migrateLegacyStorage()).resolves.toBeUndefined();
  });

  it("does not clobber config on a second run after migration", async () => {
    seedLegacyConfig("flac", 5);
    await migrateLegacyStorage();
    await configurationStore.set({ format: "wav" });

    await migrateLegacyStorage();

    expect((await configurationStore.get()).format).toBe("wav");
  });

  it("does not re-apply legacy values when only the cleanup failed", async () => {
    seedLegacyConfig("flac", 5);
    storageState.failRemoveItems = true;
    await migrateLegacyStorage();
    storageState.failRemoveItems = false;
    await configurationStore.set({ format: "wav" });

    await migrateLegacyStorage();

    expect((await configurationStore.get()).format).toBe("wav");
    expect(remainingLegacyKeys()).toEqual([]);
  });

  it("keeps an onboarded v2 config when stale legacy keys coexist", async () => {
    await configurationStore.set({ format: "wav", hasOnboarded: true });
    seedLegacyConfig("flac", 5);

    await migrateLegacyStorage();

    expect((await configurationStore.get()).format).toBe("wav");
    expect(remainingLegacyKeys()).toEqual([]);
  });

  it("drops an out-of-range legacy concurrency", async () => {
    seedLegacyConfig("flac", 0);

    await migrateLegacyStorage();

    expect((await configurationStore.get()).concurrency).toBe(
      DEFAULT_CONFIG.concurrency,
    );
  });

  it("rejects inherited object property names as legacy formats", async () => {
    seedLegacyConfig("toString", 4);

    await migrateLegacyStorage();

    expect((await configurationStore.get()).format).toBe(DEFAULT_CONFIG.format);
  });
});

describe("bucket set", () => {
  it("preserves both fields when two partial sets race", async () => {
    await Promise.all([
      configurationStore.set({ format: "wav" }),
      configurationStore.set({ concurrency: 7 }),
    ]);

    const config = await configurationStore.get();
    expect(config.format).toBe("wav");
    expect(config.concurrency).toBe(7);
  });
});
