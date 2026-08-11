export type RetryReason = "rate_limited" | "preparing";

const BACKOFF_STEPS_MS: Record<RetryReason, number[]> = {
  rate_limited: [10_000, 15_000, 30_000, 60_000],
  preparing: [15_000, 30_000, 60_000],
};

const JITTER = 0.3;

export const backoffDelayMs = (
  attempt: number,
  reason: RetryReason = "rate_limited",
): number => {
  const steps = BACKOFF_STEPS_MS[reason];
  const index = Math.min(Math.max(attempt, 1), steps.length) - 1;
  return steps[index]!;
};

export const withJitter = (
  ms: number,
  rand: () => number = Math.random,
): number => {
  const factor = 1 - JITTER + rand() * JITTER * 2;
  return Math.round(ms * factor);
};

export type RetryState = {
  attempt: number;
  startedAt: number;
};

export type RetryPlan = {
  attempt: number;
  startedAt: number;
  delayMs: number;
};

export const planRetry = (
  previous: RetryState | undefined,
  now: number,
  {
    reason = "rate_limited",
    rand = Math.random,
  }: { reason?: RetryReason; rand?: () => number } = {},
): RetryPlan => {
  const startedAt = previous?.startedAt ?? now;
  const attempt = (previous?.attempt ?? 0) + 1;
  return {
    attempt,
    startedAt,
    delayMs: withJitter(backoffDelayMs(attempt, reason), rand),
  };
};
