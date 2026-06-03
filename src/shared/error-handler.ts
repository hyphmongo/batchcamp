import {
  type Breadcrumb,
  captureException,
  addBreadcrumb as sentryAddBreadcrumb,
  withScope,
} from "@sentry/browser";

import { getContentScope } from "./sentry";

type ErrorContext = Record<string, Record<string, unknown>>;
type ErrorTags = Record<string, string>;

export const captureError = (
  error: unknown,
  context?: ErrorContext,
  tags?: ErrorTags,
): void => {
  if (import.meta.env.MODE === "development") {
    console.error("[batchcamp]", error, context, tags);
  }
  try {
    const contentScope = getContentScope();

    if (contentScope) {
      contentScope.setExtras((context as Record<string, unknown>) ?? {});
      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          contentScope.setTag(key, value);
        }
      }
      contentScope.captureException(error);
      return;
    }

    withScope((scope) => {
      if (context) {
        for (const [key, value] of Object.entries(context)) {
          scope.setContext(key, value);
        }
      }

      if (tags) {
        for (const [key, value] of Object.entries(tags)) {
          scope.setTag(key, value);
        }
      }

      captureException(error);
    });
  } catch {}
};

export const addBreadcrumb = (breadcrumb: Breadcrumb): void => {
  try {
    const contentScope = getContentScope();
    if (contentScope) {
      contentScope.addBreadcrumb(breadcrumb);
      return;
    }
    sentryAddBreadcrumb(breadcrumb);
  } catch {}
};
