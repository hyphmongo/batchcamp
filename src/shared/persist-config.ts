import { type Configuration, configurationStore } from "@/storage";
import { captureError } from "./error-handler";

export const persistConfig = (
  config: Configuration,
  updates: Partial<Configuration>,
  setConfig: (config: Configuration) => void,
) => {
  const updated = { ...config, ...updates };
  setConfig(updated);
  configurationStore.set(updated).catch((error) => {
    captureError(
      error,
      { config: { format: updated.format, concurrency: updated.concurrency } },
      { operation: "persist_config" },
    );
  });
};
