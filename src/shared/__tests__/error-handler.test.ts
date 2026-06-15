import { afterEach, describe, expect, it, vi } from "vitest";

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
  withScope: vi.fn(),
}));
const getContentScope = vi.hoisted(() => vi.fn());

vi.mock("@sentry/browser", () => sentry);
vi.mock("@/shared/sentry", () => ({ getContentScope }));

const { captureError, addBreadcrumb } = await import("@/shared/error-handler");

const makeScope = () => ({
  setExtras: vi.fn(),
  setContext: vi.fn(),
  setTag: vi.fn(),
  setFingerprint: vi.fn(),
  captureException: vi.fn(),
  addBreadcrumb: vi.fn(),
});

afterEach(() => {
  vi.clearAllMocks();
  getContentScope.mockReset();
  sentry.withScope.mockReset();
  sentry.addBreadcrumb.mockReset();
});

describe("captureError stays resilient so reporting never crashes the caller", () => {
  it("does not throw when the global Sentry scope itself throws", () => {
    getContentScope.mockReturnValue(null);
    sentry.withScope.mockImplementation(() => {
      throw new Error("sentry unavailable");
    });

    expect(() => captureError(new Error("boom"))).not.toThrow();
  });

  it("does not throw when the content scope itself throws", () => {
    const scope = makeScope();
    scope.captureException.mockImplementation(() => {
      throw new Error("scope blew up");
    });
    getContentScope.mockReturnValue(scope);

    expect(() => captureError(new Error("boom"))).not.toThrow();
  });

  it("still reports an error given no context, tags, or fingerprint", () => {
    getContentScope.mockReturnValue(null);
    const scope = makeScope();
    sentry.withScope.mockImplementation((cb: (s: typeof scope) => void) =>
      cb(scope),
    );
    const err = new Error("bare");

    captureError(err);

    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });
});

describe("captureError routes to the right sink and enriches it", () => {
  it("reports a content-script error through the content scope with its tags and fingerprint", () => {
    const scope = makeScope();
    getContentScope.mockReturnValue(scope);
    const err = new Error("parse failed");

    captureError(
      err,
      { parser: { url: "u" } },
      { operation: "parse_bandcamp_data" },
      ["parse-bandcamp-data"],
    );

    expect(scope.captureException).toHaveBeenCalledWith(err);
    expect(scope.setTag).toHaveBeenCalledWith(
      "operation",
      "parse_bandcamp_data",
    );
    expect(scope.setFingerprint).toHaveBeenCalledWith(["parse-bandcamp-data"]);
    expect(sentry.withScope).not.toHaveBeenCalled();
  });

  it("reports a background error through the global scope with context, tags, and fingerprint", () => {
    getContentScope.mockReturnValue(null);
    const scope = makeScope();
    sentry.withScope.mockImplementation((cb: (s: typeof scope) => void) =>
      cb(scope),
    );
    const err = new Error("shutdown");

    captureError(err, { tab: { tabId: 1 } }, { operation: "tab_removed" }, [
      "fp",
    ]);

    expect(scope.setContext).toHaveBeenCalledWith("tab", { tabId: 1 });
    expect(scope.setTag).toHaveBeenCalledWith("operation", "tab_removed");
    expect(scope.setFingerprint).toHaveBeenCalledWith(["fp"]);
    expect(sentry.captureException).toHaveBeenCalledWith(err);
  });
});

describe("addBreadcrumb stays resilient and routes correctly", () => {
  it("does not throw when Sentry throws", () => {
    getContentScope.mockReturnValue(null);
    sentry.addBreadcrumb.mockImplementation(() => {
      throw new Error("down");
    });

    expect(() => addBreadcrumb({ message: "x" })).not.toThrow();
  });

  it("routes through the content scope when one is present", () => {
    const scope = makeScope();
    getContentScope.mockReturnValue(scope);

    addBreadcrumb({ message: "hello" });

    expect(scope.addBreadcrumb).toHaveBeenCalledWith({ message: "hello" });
    expect(sentry.addBreadcrumb).not.toHaveBeenCalled();
  });
});
