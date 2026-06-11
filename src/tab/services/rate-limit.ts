const BACKOFF_STEPS_MS = [10_000, 15_000, 30_000, 60_000];

const JITTER = 0.3;

export const backoffDelayMs = (attempt: number): number => {
  const index = Math.min(Math.max(attempt, 1), BACKOFF_STEPS_MS.length) - 1;
  return BACKOFF_STEPS_MS[index]!;
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
  rand: () => number = Math.random,
): RetryPlan => {
  const startedAt = previous?.startedAt ?? now;
  const attempt = (previous?.attempt ?? 0) + 1;
  return {
    attempt,
    startedAt,
    delayMs: withJitter(backoffDelayMs(attempt), rand),
  };
};
