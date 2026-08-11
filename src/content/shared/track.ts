import browser from "webextension-polyfill";

import type { ContentEvent } from "@/messages";

export const trackFromContent = (
  event: ContentEvent,
  properties?: Record<string, string | number | boolean>,
) => {
  void browser.runtime
    .sendMessage({ type: "track-content-event", event, properties })
    .catch(() => {
      // the background worker may be asleep; telemetry is never worth surfacing
    });
};
