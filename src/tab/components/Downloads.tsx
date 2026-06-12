import { useVirtualizer } from "@tanstack/react-virtual";
import type PQueue from "p-queue";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { track } from "@/shared/analytics";
import { ConfirmDialog } from "@/shared/ConfirmDialog";
import { captureError } from "@/shared/error-handler";
import { persistConfig } from "@/shared/persist-config";
import type { Configuration } from "@/storage";
import { useAwaitingInitialItems } from "@/tab/hooks/useAwaitingInitialItems";
import { useDownloadMessageListener } from "@/tab/hooks/useDownloadMessageListener";
import { useDownloadProgressUpdater } from "@/tab/hooks/useDownloadProgressUpdater";
import { useOnTabUnload } from "@/tab/hooks/useOnTabUnload";
import { useQueueController } from "@/tab/hooks/useQueueController";
import { useViewRouting } from "@/tab/hooks/useViewRouting";
import {
  completedItemsSelector,
  derivedItemsSelector,
  downloadingItemsSelector,
  failedItemsSelector,
  getStatus,
  overallPercentSelector,
  sizeEstimateSelector,
  totalItemCountSelector,
} from "@/tab/selectors";
import { browserAdapter } from "@/tab/services/browser-adapter";
import {
  copyItemUrl,
  deleteItemFile,
  pauseItem,
  resumeItem,
  showItemInFolder,
} from "@/tab/services/download-control";
import { useStore } from "@/tab/store";
import { DownloadRow } from "./DownloadRow";
import type { DownloadListProps, RowActions } from "./download-types";
import { EmptyState } from "./EmptyState";
import { ListReadout } from "./ListReadout";
import { Onboarding } from "./Onboarding";
import { Settings } from "./Settings";
import { TopStrip } from "./TopStrip";

interface DownloadsProps {
  config: Configuration;
  queue: PQueue;
}

const Downloads = ({ config, queue }: DownloadsProps) => {
  const items = useStore(derivedItemsSelector);
  const totalCount = useStore(totalItemCountSelector);
  const completedCount = useStore(completedItemsSelector).length;
  const downloadingItems = useStore(downloadingItemsSelector);
  const pausedItemIds = useStore((state) => state.pausedItemIds);
  const isAllComplete = completedCount === totalCount && totalCount > 0;
  const activeCount = downloadingItems.filter(
    (item) => !pausedItemIds.has(item.id),
  ).length;
  const hasPausedItem = downloadingItems.length > 0 && activeCount === 0;
  const sizeEstimate = useStore(sizeEstimateSelector);
  const setConfig = useStore((state) => state.setConfig);
  const applyFormatToPending = useStore((state) => state.applyFormatToPending);
  const retryDownload = useStore((state) => state.retryDownload);
  const cancelDownload = useStore((state) => state.cancelDownload);
  const retryAllFailed = useStore((state) => state.retryAllFailed);
  const clearAllCompleted = useStore((state) => state.clearAllCompleted);
  const failedCount = useStore(failedItemsSelector).length;
  const accountUnverified = useStore((state) => state.accountUnverified);
  const setAccountUnverified = useStore((state) => state.setAccountUnverified);

  const { view, openSettings, backToDownloads } = useViewRouting();
  const { paused, togglePause } = useQueueController(queue, config);
  const awaitingInitialItems = useAwaitingInitialItems(totalCount);
  const [pendingDelete, setPendingDelete] = useState<{
    itemId: string;
    title: string;
  } | null>(null);

  const rowActions: RowActions = {
    retry: (id) => {
      track("item_retried");
      retryDownload(id);
    },
    cancel: (id) => {
      const item = useStore.getState().items.get(id);
      track("item_cancelled", item ? { status: getStatus(item) } : undefined);
      return cancelDownload(id);
    },
    pause: (id) => {
      track("item_paused");
      void pauseItem(id);
    },
    resume: (id) => {
      track("item_resumed");
      void resumeItem(id);
    },
    showInFolder: (id) => {
      track("item_shown_in_folder");
      void showItemInFolder(id);
    },
    copyUrl: (id) => {
      track("item_url_copied");
      void copyItemUrl(id);
    },
    requestDelete: (id) => {
      const item = useStore.getState().items.get(id);
      if (!item) {
        return;
      }
      setPendingDelete({ itemId: id, title: item.title });
    },
  };

  const handleRetryAllFailed = () => {
    track("failed_retried", { count: failedCount });
    retryAllFailed();
  };
  const handleClearAllCompleted = () => {
    track("completed_cleared", { count: completedCount });
    clearAllCompleted();
  };
  const handleConfirmDelete = async () => {
    if (!pendingDelete) {
      return;
    }
    const { itemId } = pendingDelete;
    setPendingDelete(null);
    track("item_file_deleted");
    await deleteItemFile(itemId);
  };

  useEffect(() => {
    browserAdapter.runtime
      .sendMessage({ type: "tab-opened" })
      .catch((error) =>
        captureError(error, {}, { operation: "tab_opened_message" }),
      );
  }, []);

  useDownloadMessageListener({ queue });
  useDownloadProgressUpdater();
  useOnTabUnload();

  const handleStartDownloads = () => {
    track("onboarding_completed", {
      format: config.format,
      concurrency: config.concurrency,
    });
    persistConfig(config, { hasOnboarded: true }, setConfig);
    applyFormatToPending(config.format);
  };

  const isEmpty = totalCount === 0;

  let topStripMode: "onboarding" | "downloads" | "settings";
  if (view === "settings") {
    topStripMode = "settings";
  } else if (!config.hasOnboarded) {
    topStripMode = "onboarding";
  } else {
    topStripMode = "downloads";
  }

  const showTabNotice = config.hasOnboarded && totalCount > 0 && !isAllComplete;

  let middle: ReactNode;
  if (view === "settings") {
    middle = (
      <CenteredPane>
        <Settings config={config} />
      </CenteredPane>
    );
  } else if (!config.hasOnboarded) {
    middle = (
      <CenteredPane>
        <Onboarding config={config} onStart={handleStartDownloads} />
      </CenteredPane>
    );
  } else if (isEmpty && awaitingInitialItems) {
    middle = (
      <div
        className="flex-1 min-h-0 flex items-center justify-center"
        role="status"
        aria-label="Loading downloads"
      >
        <span className="loading loading-lg"></span>
      </div>
    );
  } else if (isEmpty) {
    middle = (
      <div className="flex-1 min-h-0 flex items-center justify-center px-8 animate-view-fade">
        <EmptyState />
      </div>
    );
  } else {
    middle = (
      <div className="flex-1 min-h-0 flex flex-col animate-view-fade">
        <ListReadout
          totalCount={totalCount}
          completedCount={completedCount}
          activeCount={activeCount}
          failedCount={failedCount}
          paused={paused}
          isAllComplete={isAllComplete}
          sizeEstimate={sizeEstimate}
          onTogglePause={togglePause}
          onRetryAllFailed={handleRetryAllFailed}
          onClearAllCompleted={handleClearAllCompleted}
        />
        <DownloadList
          items={items}
          pausedItemIds={pausedItemIds}
          actions={rowActions}
        />
      </div>
    );
  }

  return (
    <div className="bc-desk h-screen p-4 sm:p-6 flex flex-col overflow-hidden">
      <DownloadsTitle
        activeCount={activeCount}
        paused={paused}
        hasPausedItem={hasPausedItem}
      />
      <div aria-live="polite" className="sr-only">
        {totalCount > 0
          ? `${completedCount} of ${totalCount} complete${failedCount > 0 ? `, ${failedCount} failed` : ""}`
          : ""}
      </div>
      <div className="flex-1 w-full max-w-5xl mx-auto flex flex-col bg-base-100 border border-base-300 min-h-0">
        <TopStrip
          mode={topStripMode}
          showTabNotice={showTabNotice}
          onSettingsClick={openSettings}
          onBackClick={backToDownloads}
        />
        <main className="contents">{middle}</main>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="delete from disk"
        description="Permanently removes this file from your computer and clears it from the list. This can't be undone."
        detail={pendingDelete?.title}
        confirmLabel="delete"
        cancelLabel="cancel"
        destructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={accountUnverified}
        title="verify your bandcamp email"
        description={
          <>
            <span className="block">
              Bandcamp won't let you download until you do.
            </span>
            <span className="mt-2 block">
              Check your email, verify, then come back here.
            </span>
          </>
        }
        confirmLabel="i've verified"
        hideCancel
        onConfirm={() => setAccountUnverified(false)}
        onCancel={() => setAccountUnverified(false)}
      />
    </div>
  );
};

const CenteredPane = ({ children }: { children: ReactNode }) => (
  <div className="flex-1 min-h-0 overflow-y-auto">
    <div className="mx-auto w-full max-w-md px-6 pt-[clamp(2.5rem,10vh,6.5rem)] pb-10 animate-view-fade">
      {children}
    </div>
  </div>
);

const DownloadsTitle = ({
  activeCount,
  paused,
  hasPausedItem,
}: {
  activeCount: number;
  paused: boolean;
  hasPausedItem: boolean;
}) => {
  const percent = useStore((state) =>
    Math.round(overallPercentSelector(state)),
  );

  useEffect(() => {
    if (activeCount > 0) {
      document.title = `Batchcamp · ${percent}%`;
    } else if (paused || hasPausedItem) {
      document.title = `Batchcamp · ${percent}% paused`;
    } else {
      document.title = "Batchcamp";
    }
  }, [activeCount, percent, paused, hasPausedItem]);

  return null;
};

const DownloadList = ({ items, pausedItemIds, actions }: DownloadListProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 84,
    overscan: 10,
    getItemKey: (index) => items[index]!.id,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const item = items[virtualRow.index];
          if (!item) {
            return null;
          }
          return (
            <div
              key={item.id}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              className="transition-transform duration-[var(--duration-base)] ease-[var(--ease-out-quart)]"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <DownloadRow
                item={item}
                paused={pausedItemIds.has(item.id)}
                actions={actions}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { Downloads };
