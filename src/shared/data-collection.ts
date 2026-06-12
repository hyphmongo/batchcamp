import browser from "webextension-polyfill";

import { dataCollectionStore } from "@/storage";

const TECHNICAL_AND_INTERACTION = "technicalAndInteraction";

type DataCollectionPermissions = { data_collection?: string[] };

const permissionsAvailable = (): boolean =>
  typeof browser.permissions?.getAll === "function";

const involvesTechnical = (permissions: unknown): boolean =>
  Boolean(
    (permissions as DataCollectionPermissions).data_collection?.includes(
      TECHNICAL_AND_INTERACTION,
    ),
  );

const readFromPermissions = async (): Promise<boolean> => {
  const all =
    (await browser.permissions.getAll()) as unknown as DataCollectionPermissions;
  if (!all.data_collection) {
    return true;
  }
  return all.data_collection.includes(TECHNICAL_AND_INTERACTION);
};

export const isDataCollectionGranted = async (): Promise<boolean> => {
  try {
    if (permissionsAvailable()) {
      const granted = await readFromPermissions();
      await dataCollectionStore.set({ granted });
      return granted;
    }
    return (await dataCollectionStore.get()).granted;
  } catch {
    return true;
  }
};

export const watchDataCollection = (
  callback: (granted: boolean) => void,
): void => {
  try {
    if (permissionsAvailable()) {
      const update = (granted: boolean) => {
        void dataCollectionStore.set({ granted });
        callback(granted);
      };
      browser.permissions.onAdded.addListener((permissions) => {
        if (involvesTechnical(permissions)) {
          update(true);
        }
      });
      browser.permissions.onRemoved.addListener((permissions) => {
        if (involvesTechnical(permissions)) {
          update(false);
        }
      });
      return;
    }
    dataCollectionStore.watch((value) => {
      callback(value.granted);
    });
  } catch {}
};
