import {
  BrowserClient,
  defaultStackParser,
  type ErrorEvent,
  getDefaultIntegrations,
  init,
  makeFetchTransport,
  Scope,
  setTag,
} from "@sentry/browser";
import browser from "webextension-polyfill";

import { configurationStore } from "@/storage";

import { browserName, browserVersion } from "./browser-info";
import { scrubUrls } from "./sanitize";

const DSN =
  "https://e745cbdff7424075b8bbb1bd27a480cf@o1332246.ingest.sentry.io/6596634";

type SentryContext = "tab" | "popup" | "content" | "background";

const GLOBAL_STATE_INTEGRATIONS = [
  "BrowserApiErrors",
  "BrowserSession",
  "Breadcrumbs",
  "ConversationId",
  "GlobalHandlers",
  "FunctionToString",
];

const rewriteExtensionUrls = (event: ErrorEvent): ErrorEvent => {
  for (const exception of event.exception?.values ?? []) {
    for (const frame of exception.stacktrace?.frames ?? []) {
      if (frame.filename) {
        frame.filename = frame.filename.replace(
          /^(chrome|moz)-extension:\/\/[^/]+\//,
          "~/",
        );
      }
    }
  }
  return event;
};

export const sanitizeEvent = (event: ErrorEvent): ErrorEvent => {
  const rewritten = rewriteExtensionUrls(event);
  if (rewritten.user) {
    rewritten.user.ip_address = undefined;
  }
  return scrubUrls(rewritten) as ErrorEvent;
};

let crashReportsEnabled = true;

export const setCrashReportsEnabled = (enabled: boolean) => {
  crashReportsEnabled = enabled;
};

const beforeSend = (event: ErrorEvent): ErrorEvent | null =>
  crashReportsEnabled ? sanitizeEvent(event) : null;

let contentScope: Scope | null = null;

export const getContentScope = () => contentScope;

const initContentSentry = () => {
  const integrations = getDefaultIntegrations({}).filter(
    (i) => !GLOBAL_STATE_INTEGRATIONS.includes(i.name),
  );

  const client = new BrowserClient({
    dsn: DSN,
    transport: makeFetchTransport,
    stackParser: defaultStackParser,
    integrations,
    sendDefaultPii: false,
    beforeSend,
    release: `batchcamp@${browser.runtime.getManifest().version}`,
    environment:
      import.meta.env.MODE === "production" ? "production" : "development",
  });

  contentScope = new Scope();
  contentScope.setClient(client);
  client.init();

  const scope = contentScope;
  applyContextTags((key, value) => scope.setTag(key, value), "content");
};

const applyContextTags = (
  set: (key: string, value: string) => void,
  context: SentryContext,
) => {
  set("context", context);
  set("browser", browserName);
  set("browser_version", browserVersion);
  set("extension_version", browser.runtime.getManifest().version);
};

const initIsolatedSentry = (context: SentryContext) => {
  init({
    dsn: DSN,
    sendDefaultPii: false,
    beforeSend,
    release: `batchcamp@${browser.runtime.getManifest().version}`,
    environment:
      import.meta.env.MODE === "production" ? "production" : "development",
  });

  applyContextTags(setTag, context);
};

export const initSentry = async (context: SentryContext) => {
  try {
    crashReportsEnabled = (await configurationStore.get()).crashReportsEnabled;
    configurationStore.watch((config) => {
      setCrashReportsEnabled(config.crashReportsEnabled);
    });

    if (context === "content") {
      initContentSentry();
    } else {
      initIsolatedSentry(context);
    }
  } catch {}
};
