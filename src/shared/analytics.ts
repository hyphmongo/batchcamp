import {
  type CaptureResult,
  PostHog,
} from "posthog-js/dist/module.no-external";
import browser from "webextension-polyfill";

import { analyticsStore, configurationStore } from "@/storage";

import { browserName, browserVersion } from "./browser-info";
import { scrubUrls } from "./sanitize";

const API_KEY = "phc_r2UNPMJpq77KRYvcp8ZqjQLWxseY6xKFPmJX89dv6bgV";
const API_HOST = "https://eu.i.posthog.com";

type AnalyticsContext = "tab" | "background";

let client: PostHog | null = null;

const sanitizeEvent = (event: CaptureResult | null): CaptureResult | null => {
  if (!event) {
    return null;
  }
  if (event.properties) {
    event.properties = scrubUrls(event.properties) as Record<string, unknown>;
  }
  if (event.$set) {
    event.$set = scrubUrls(event.$set) as Record<string, unknown>;
  }
  if (event.$set_once) {
    event.$set_once = scrubUrls(event.$set_once) as Record<string, unknown>;
  }
  return event;
};

const getDistinctId = async (): Promise<string> => {
  const existing = (await analyticsStore.get()).distinctId;
  if (existing) {
    return existing;
  }
  const distinctId = crypto.randomUUID();
  await analyticsStore.set({ distinctId });
  return (await analyticsStore.get()).distinctId ?? distinctId;
};

let activeContext: AnalyticsContext = "tab";
let appliedEnabled: boolean | null = null;

const createClient = async (context: AnalyticsContext) => {
  const isTab = context === "tab";
  const distinctID = await getDistinctId();

  const posthog = new PostHog();
  posthog.init(API_KEY, {
    api_host: API_HOST,
    persistence: isTab ? "localStorage" : "memory",
    autocapture: isTab,
    capture_pageview: isTab,
    capture_pageleave: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_external_dependency_loading: true,
    enable_heatmaps: false,
    capture_performance: false,
    capture_dead_clicks: false,
    respect_dnt: true,
    opt_out_useragent_filter: true,
    mask_all_text: true,
    mask_all_element_attributes: true,
    person_profiles: "never",
    before_send: sanitizeEvent,
    debug: import.meta.env.DEV,
    bootstrap: { distinctID },
  });

  posthog.register({
    context,
    browser: browserName,
    browser_version: browserVersion,
    extension_version: browser.runtime.getManifest().version,
  });

  client = posthog;
};

export const initAnalytics = async (context: AnalyticsContext) => {
  try {
    activeContext = context;
    const enabled = (await configurationStore.get()).analyticsEnabled;
    appliedEnabled = enabled;
    configurationStore.watch((config) => {
      setAnalyticsEnabled(config.analyticsEnabled);
    });
    if (!enabled) {
      return;
    }
    await createClient(context);
  } catch (error) {
    console.error("[analytics] init failed", error);
  }
};

export const track = (event: string, properties?: Record<string, unknown>) => {
  try {
    client?.capture(event, properties);
  } catch (error) {
    console.error("[analytics] capture failed", event, error);
  }
};

export const setAnalyticsEnabled = (
  enabled: boolean,
  optInEvent?: { name: string; properties?: Record<string, unknown> },
) => {
  if (appliedEnabled === enabled) {
    return;
  }
  appliedEnabled = enabled;
  if (!enabled) {
    client?.opt_out_capturing();
    return;
  }
  void (async () => {
    try {
      if (!client) {
        await createClient(activeContext);
      }
      client?.opt_in_capturing(
        optInEvent
          ? {
              captureEventName: optInEvent.name,
              captureProperties: optInEvent.properties,
            }
          : { captureEventName: false },
      );
    } catch (error) {
      console.error("[analytics] enable failed", error);
    }
  })();
};
