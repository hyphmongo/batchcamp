import { analyticsStore } from "@/storage";

export const getInstallId = async (): Promise<string> => {
  const existing = (await analyticsStore.get()).distinctId;
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  await analyticsStore.set({ distinctId: id });
  return (await analyticsStore.get()).distinctId ?? id;
};
