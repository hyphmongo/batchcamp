import {
  ArrowsClockwise as ClearIcon,
  Pause as PauseIcon,
  Play as PlayIcon,
  ArrowCounterClockwise as RetryIcon,
} from "@phosphor-icons/react";
import type { ReactNode } from "react";

import { formatSizeMb } from "@/shared/format-utils";
import { IconButton } from "@/shared/IconButton";
import { useOverallProgress } from "@/tab/hooks/useOverallProgress";
import { overallPercentSelector } from "@/tab/selectors";
import { useStore } from "@/tab/store";
import type { ListReadoutProps, SizeEstimate } from "./download-types";

const formatTotalSize = (estimate: SizeEstimate): string => {
  const { knownSizeMb, knownCount, totalCount } = estimate;
  const value = formatSizeMb(knownSizeMb);
  return knownCount < totalCount ? `~${value}` : value;
};

const ReadoutActions = ({
  isAllComplete,
  paused,
  failedCount,
  completedCount,
  onTogglePause,
  onRetryAllFailed,
  onClearAllCompleted,
}: Pick<
  ListReadoutProps,
  | "isAllComplete"
  | "paused"
  | "failedCount"
  | "completedCount"
  | "onTogglePause"
  | "onRetryAllFailed"
  | "onClearAllCompleted"
>) => {
  const showRetry = !isAllComplete && failedCount > 0;
  const showPause = !isAllComplete;
  const showClear = completedCount > 0;
  if (!showRetry && !showPause && !showClear) {
    return null;
  }
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {showRetry && (
        <IconButton
          icon={RetryIcon}
          label="Retry failed"
          onClick={onRetryAllFailed}
        />
      )}
      {showPause && (
        <IconButton
          icon={paused ? PlayIcon : PauseIcon}
          label={paused ? "Resume downloads" : "Pause downloads"}
          title={paused ? "Resume" : "Pause"}
          onClick={onTogglePause}
        />
      )}
      {showClear && (
        <IconButton
          icon={ClearIcon}
          label="Clear completed downloads"
          title="Clear done"
          onClick={onClearAllCompleted}
        />
      )}
    </div>
  );
};

const readoutHeading = (
  props: Pick<
    ListReadoutProps,
    | "isAllComplete"
    | "paused"
    | "activeCount"
    | "completedCount"
    | "totalCount"
    | "failedCount"
  >,
): ReactNode => {
  if (
    props.activeCount === 0 &&
    props.failedCount > 0 &&
    props.completedCount + props.failedCount === props.totalCount
  ) {
    return (
      <>
        downloads <b className="text-accent">complete</b> ·{" "}
        <b className="text-error-ink">{props.failedCount} failed</b>
      </>
    );
  }
  if (props.isAllComplete) {
    return (
      <>
        downloads <b className="text-accent">complete</b>
      </>
    );
  }
  if (props.paused) {
    return <>downloads paused</>;
  }
  if (props.activeCount > 0 || props.completedCount > 0) {
    return (
      <>
        downloaded <b className="text-accent">{props.completedCount}</b> of{" "}
        {props.totalCount}
      </>
    );
  }
  return <>queued</>;
};

export const ListReadout = ({
  totalCount,
  completedCount,
  activeCount,
  failedCount,
  paused,
  isAllComplete,
  sizeEstimate,
  onTogglePause,
  onRetryAllFailed,
  onClearAllCompleted,
}: ListReadoutProps) => {
  const percent = useStore(overallPercentSelector);
  const { speed, eta, bytesReceived } = useOverallProgress();
  const settledWithFailures =
    activeCount === 0 &&
    failedCount > 0 &&
    completedCount + failedCount === totalCount;
  const isIndeterminate =
    !isAllComplete &&
    !settledWithFailures &&
    percent === 0 &&
    completedCount === 0;

  const stats: string[] = [];
  if (sizeEstimate.knownSizeMb > 0) {
    stats.push(
      `${formatSizeMb(bytesReceived / (1024 * 1024))} / ${formatTotalSize(sizeEstimate)}`,
    );
  }
  if (speed) {
    stats.push(speed);
  }
  if (eta) {
    stats.push(`${eta} left`);
  }
  const fillWidth =
    isAllComplete || settledWithFailures ? 100 : isIndeterminate ? 0 : percent;
  const headingNode = readoutHeading({
    isAllComplete,
    paused,
    activeCount,
    completedCount,
    totalCount,
    failedCount,
  });

  return (
    <div className="shrink-0 px-5 pt-4 pb-4 border-b border-base-300/50">
      <div className="flex items-center gap-3">
        <span role="status" className="text-stat font-semibold tracking-tight">
          {headingNode}
        </span>
        <div className="ml-auto flex items-center gap-3">
          {!isAllComplete && stats.length > 0 && (
            <span className="text-body text-base-content/70 font-mono tabular-nums">
              {stats.join(" · ")}
            </span>
          )}
          <ReadoutActions
            isAllComplete={isAllComplete}
            paused={paused}
            failedCount={failedCount}
            completedCount={completedCount}
            onTogglePause={onTogglePause}
            onRetryAllFailed={onRetryAllFailed}
            onClearAllCompleted={onClearAllCompleted}
          />
        </div>
      </div>
      <div
        className="relative mt-3 h-1.5 bg-base-300 overflow-hidden"
        role="progressbar"
        aria-busy={isIndeterminate}
        aria-valuenow={
          isIndeterminate && !isAllComplete ? undefined : Math.round(fillWidth)
        }
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Overall download progress"
      >
        {isIndeterminate ? (
          <span
            aria-hidden="true"
            className="block h-full bg-accent animate-indeterminate"
          />
        ) : (
          <span
            aria-hidden="true"
            className="block h-full w-full origin-left bg-accent transition-transform duration-[var(--duration-slow)] ease-[var(--ease-out-quart)]"
            style={{ transform: `scaleX(${fillWidth / 100})` }}
          />
        )}
      </div>
    </div>
  );
};
