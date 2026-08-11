import { addBreadcrumb } from "@/shared/error-handler";
import { backoffDelayMs, withJitter } from "./rate-limit";

let refusals = 0;
let openAt = 0;
let probing = false;
let opening: ReturnType<typeof setTimeout> | null = null;
let waiting: Array<() => void> = [];

const wakeAll = () => {
  const sleepers = waiting;
  waiting = [];
  for (const wake of sleepers) {
    wake();
  }
};

const openWhenDue = () => {
  if (opening) {
    clearTimeout(opening);
  }
  opening = setTimeout(
    () => {
      opening = null;
      wakeAll();
    },
    Math.max(0, openAt - Date.now()),
  );
};

const untilSomethingChanges = () => {
  if (!opening && Date.now() < openAt) {
    openWhenDue();
  }
  return new Promise<void>((resolve) => {
    waiting.push(resolve);
  });
};

export const clearedForTakeoff = async (): Promise<void> => {
  while (refusals > 0) {
    if (!probing && Date.now() >= openAt) {
      probing = true;
      return;
    }
    await untilSomethingChanges();
  }
};

export const rateLimited = (): void => {
  refusals += 1;
  probing = false;
  openAt = Date.now() + withJitter(backoffDelayMs(refusals, "rate_limited"));
  openWhenDue();

  addBreadcrumb({
    message: "Bandcamp is rate limiting; holding the whole queue back",
    data: { refusals, waitMs: openAt - Date.now() },
    level: "warning",
  });
};

export const succeeded = (): void => {
  if (refusals === 0) {
    return;
  }
  refusals = 0;
  openAt = 0;
  probing = false;
  wakeAll();
};

export const releaseProbe = (): void => {
  if (!probing) {
    return;
  }
  probing = false;
  wakeAll();
};

export const resetGate = (): void => {
  refusals = 0;
  openAt = 0;
  probing = false;
  if (opening) {
    clearTimeout(opening);
    opening = null;
  }
  wakeAll();
};
