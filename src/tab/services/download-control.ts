import { captureError } from "@/shared/error-handler";
import { activeDownloadsSelector } from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import { useStore } from "@/tab/store";
import { type Item, isResolvedItem } from "@/types";

const collectBrowserIds = (item: Item): number[] =>
  isResolvedItem(item) && item.download.browserId != null
    ? [item.download.browserId]
    : [];

type PauseAction = "pause" | "resume";

const applyPauseAction = async (
  action: PauseAction,
  browserIds: number[],
  operation: string,
): Promise<void> => {
  for (const id of browserIds) {
    try {
      const [download] = await browserAdapter.downloads.search({ id });
      const canApply =
        action === "resume"
          ? download?.canResume
          : download?.state === "in_progress";
      if (!canApply) {
        continue;
      }
      await browserAdapter.downloads[action](id);
    } catch (error) {
      captureError(error, { download: { browserId: id } }, { operation });
    }
  }
};

const setItemPauseState = async (
  itemId: string,
  action: PauseAction,
  operation: string,
): Promise<void> => {
  const item = useStore.getState().items.get(itemId);
  if (!item) {
    return;
  }
  useStore.getState().setItemPaused(itemId, action === "pause");
  await applyPauseAction(action, collectBrowserIds(item), operation);
};

export const pauseItem = (itemId: string): Promise<void> =>
  setItemPauseState(itemId, "pause", "pause_item");

export const resumeItem = (itemId: string): Promise<void> =>
  setItemPauseState(itemId, "resume", "resume_item");

const firstAvailableUrl = (item: Item): string | null => {
  if (item.url) {
    return item.url;
  }
  if (isResolvedItem(item)) {
    return item.download.url;
  }
  return null;
};

export const showItemInFolder = async (itemId: string): Promise<void> => {
  const item = useStore.getState().items.get(itemId);
  if (!item) {
    return;
  }
  const browserId = collectBrowserIds(item)[0];
  if (browserId == null) {
    return;
  }
  try {
    await browserAdapter.downloads.show(browserId);
  } catch (error) {
    captureError(
      error,
      { download: { browserId } },
      { operation: "show_in_folder" },
    );
  }
};

export const deleteItemFile = async (itemId: string): Promise<void> => {
  const item = useStore.getState().items.get(itemId);
  if (!item) {
    return;
  }
  const browserIds = collectBrowserIds(item);
  await useStore.getState().cancelDownload(itemId);
  for (const id of browserIds) {
    try {
      await browserAdapter.downloads.removeFile(id);
    } catch (error) {
      captureError(
        error,
        { download: { browserId: id } },
        { operation: "delete_file" },
      );
    }
    try {
      await browserAdapter.downloads.erase({ id });
    } catch (error) {
      captureError(
        error,
        { download: { browserId: id } },
        { operation: "erase_history" },
      );
    }
  }
};

export const copyItemUrl = async (itemId: string): Promise<void> => {
  const item = useStore.getState().items.get(itemId);
  if (!item) {
    return;
  }
  const url = firstAvailableUrl(item);
  if (!url) {
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch (error) {
    captureError(error, { item: { id: itemId } }, { operation: "copy_url" });
  }
};

const applyToActiveDownloads = async (
  action: PauseAction,
  operation: string,
): Promise<void> => {
  const active = activeDownloadsSelector(useStore.getState());
  const { setItemPaused } = useStore.getState();

  for (const { itemId } of active) {
    setItemPaused(itemId, action === "pause");
  }

  await applyPauseAction(
    action,
    active.map(({ browserId }) => browserId),
    operation,
  );
};

export const pauseActiveDownloads = (): Promise<void> =>
  applyToActiveDownloads("pause", "pause_download");

export const resumeActiveDownloads = (): Promise<void> =>
  applyToActiveDownloads("resume", "resume_download");
