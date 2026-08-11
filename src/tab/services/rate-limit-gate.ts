import { addBreadcrumb } from "@/shared/error-handler";
import { backoffDelayMs, withJitter } from "./rate-limit";

const POLL_MS = 250;

let refusals = 0;
let openAt = 0;
let probing = false;

const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export const clearedForTakeoff = async (): Promise<void> => {
  while (refusals > 0) {
    const wait = openAt - Date.now();

    if (wait > 0) {
      await sleep(wait);
      continue;
    }

    if (probing) {
      await sleep(POLL_MS);
      continue;
    }

    probing = true;
    return;
  }
};

export const rateLimited = (): void => {
  refusals += 1;
  probing = false;
  openAt = Date.now() + withJitter(backoffDelayMs(refusals, "rate_limited"));

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
};

export const resetGate = (): void => {
  refusals = 0;
  openAt = 0;
  probing = false;
};
