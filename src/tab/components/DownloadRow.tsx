import { ArrowCounterClockwise as RetryIcon } from "@phosphor-icons/react";

import { splitArtistTitle, stripArtistPrefix } from "@/shared/filename-utils";
import { formatSizeMb } from "@/shared/format-utils";
import { IconButton } from "@/shared/IconButton";
import { calculateProgress, getStatus } from "@/tab/selectors";
import { useStore } from "@/tab/store";
import {
  FORMAT_LABELS,
  type Format,
  type Item,
  type ItemStatus,
  isResolvedItem,
} from "@/types";
import { DitherCover } from "./DitherCover";
import type { RowActions } from "./download-types";
import { RowActionsMenu } from "./RowActionsMenu";

interface DownloadRowProps {
  item: Item;
  paused?: boolean;
  actions: RowActions;
}

type RowMeta = {
  title: string;
  artist?: string;
  artUrl?: string;
  format?: Format;
  sizeMb?: number;
};

const getRowMeta = (item: Item): RowMeta => {
  if (isResolvedItem(item)) {
    return {
      title: stripArtistPrefix(item.download.title, item.download.artist),
      artist: item.download.artist,
      artUrl: item.download.artUrl,
      format: item.download.format ?? item.format,
      sizeMb: item.download.sizeMb,
    };
  }
  return {
    ...splitArtistTitle(item.title),
    artUrl: item.artUrl,
    format: item.format,
  };
};

const developFor = (status: ItemStatus, progress: number): number => {
  if (status === "completed") {
    return 0;
  }
  if (status === "failed") {
    return 0.82;
  }
  if (status === "downloading" || status === "resolving") {
    return 1 - progress / 100;
  }
  return 1;
};

const ArtThumb = ({
  artUrl,
  status,
  progress,
  alt,
}: {
  artUrl?: string;
  status: ItemStatus;
  progress: number;
  alt?: string;
}) => (
  <div className="shrink-0 w-14 h-14 bg-base-200">
    <DitherCover
      artUrl={artUrl}
      develop={developFor(status, progress)}
      size={56}
      alt={alt}
    />
  </div>
);

const formatSize = (sizeMb?: number): string | undefined =>
  !sizeMb || sizeMb <= 0 ? undefined : formatSizeMb(sizeMb);

const StatusPill = ({ label }: { label: string }) => (
  <span
    className="font-mono text-caption leading-none px-2 py-1 bg-base-content/[0.07] text-base-content/70"
    aria-label={`Status: ${label}`}
  >
    {label}
  </span>
);

const RightCell = ({
  status,
  progress,
  paused,
  onRetry,
}: {
  status: ItemStatus;
  progress: number;
  paused: boolean;
  onRetry: () => void;
}) => {
  if ((status === "downloading" || status === "resolving") && paused) {
    return <StatusPill label="paused" />;
  }
  if (status === "downloading" || status === "resolving") {
    const pct = Math.round(progress);
    return (
      <div
        className="flex flex-col items-end gap-1.5 whitespace-nowrap"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Status: ${status}, ${pct}%`}
      >
        <span className="text-accent font-mono tabular-nums font-medium text-body">
          {pct}%
        </span>
        <span className="hidden min-[520px]:block w-[5.75rem] h-[3px] bg-base-300 overflow-hidden">
          {pct === 0 ? (
            <span className="block h-full bg-accent animate-indeterminate" />
          ) : (
            <span
              className="block h-full w-full origin-left bg-accent transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]"
              style={{ transform: `scaleX(${pct / 100})` }}
            />
          )}
        </span>
      </div>
    );
  }
  if (status === "completed") {
    return <StatusPill label="done" />;
  }
  if (status === "failed") {
    return (
      <div className="flex items-center gap-2">
        <span
          className="font-mono text-caption leading-none px-2 py-1 bg-error-ink/[0.07] text-error-ink"
          aria-label="Status: failed"
        >
          failed
        </span>
        <IconButton
          icon={RetryIcon}
          label="Retry"
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        />
      </div>
    );
  }
  return <StatusPill label="queued" />;
};

const titleColor = (status: ItemStatus): string => {
  if (status === "completed") {
    return "text-base-content/70";
  }
  if (status === "failed") {
    return "text-base-content/85";
  }
  return "text-base-content";
};

type RowAction = {
  label: string;
  onSelect: () => void;
  destructive?: boolean;
};

const buildRowActions = (
  itemId: string,
  state: {
    isFailed: boolean;
    isCompleted: boolean;
    paused: boolean;
    canPause: boolean;
  },
  h: RowActions,
): RowAction[] => {
  const actions: RowAction[] = [];
  if (state.isFailed) {
    actions.push({ label: "Retry", onSelect: () => h.retry(itemId) });
  }
  if (state.paused) {
    actions.push({ label: "Resume", onSelect: () => h.resume(itemId) });
  } else if (state.canPause) {
    actions.push({ label: "Pause", onSelect: () => h.pause(itemId) });
  }
  if (state.isCompleted) {
    actions.push({
      label: "Show in folder",
      onSelect: () => h.showInFolder(itemId),
    });
  }
  actions.push({
    label: "Copy Bandcamp URL",
    onSelect: () => h.copyUrl(itemId),
  });
  actions.push({
    label: state.isCompleted ? "Remove from list" : "Cancel",
    onSelect: () => void h.cancel(itemId),
    destructive: true,
  });
  if (state.isCompleted) {
    actions.push({
      label: "Delete file from disk",
      onSelect: () => h.requestDelete(itemId),
      destructive: true,
    });
  }
  return actions;
};

const DownloadRow = ({ item, paused, actions }: DownloadRowProps) => {
  const status = getStatus(item);
  const isFailed = status === "failed";
  const isCompleted = status === "completed";
  const isDownloading = status === "downloading" || status === "resolving";
  const canPause = isDownloading;
  const progress = useStore((s) =>
    Math.round(calculateProgress(item, s.progress)),
  );
  const meta = getRowMeta(item);

  const formatLabel = meta.format ? FORMAT_LABELS[meta.format] : undefined;
  const sizeLabel = formatSize(meta.sizeMb);
  const metaParts: string[] = [];
  if (formatLabel) {
    metaParts.push(formatLabel);
  }
  if (sizeLabel) {
    metaParts.push(sizeLabel);
  }
  const metaLine = metaParts.join(" · ");

  const menuActions = buildRowActions(
    item.id,
    {
      isFailed,
      isCompleted,
      paused: paused ?? false,
      canPause,
    },
    actions,
  );

  return (
    <div className="group/row relative border-b border-base-300/50 hover:bg-base-200/40 transition-colors">
      <div className="flex items-center gap-4 px-5 py-3">
        <ArtThumb
          artUrl={meta.artUrl}
          status={status}
          progress={progress}
          alt={meta.title}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span
              className={`font-semibold text-title tracking-tight truncate ${titleColor(status)}`}
              title={meta.title}
            >
              {meta.title}
            </span>
            {meta.artist ? (
              <span
                className="text-base-content/70 text-body truncate shrink min-w-0"
                title={meta.artist}
              >
                {meta.artist}
              </span>
            ) : null}
          </div>
          <div className="mt-[3px] text-[0.7188rem] text-base-content/70 font-mono tabular-nums truncate lowercase">
            {metaLine}
          </div>
        </div>

        <div className="shrink-0 flex items-center justify-end">
          <RightCell
            status={status}
            progress={progress}
            paused={paused ?? false}
            onRetry={() => actions.retry(item.id)}
          />
        </div>

        <div className="shrink-0 w-7 flex items-center justify-end">
          <RowActionsMenu
            actions={menuActions}
            ariaLabel={`Actions for ${meta.title}`}
          />
        </div>
      </div>
    </div>
  );
};

export { DownloadRow };
