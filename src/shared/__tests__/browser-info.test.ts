import { describe, expect, it, vi } from "vitest";

vi.mock("detect-browser", () => ({
  detect: () => ({ name: "firefox", version: "150.0.0" }),
}));

const { browserName, browserVersion, isFirefox } = await import(
  "@/shared/browser-info"
);

describe("browser-info", () => {
  it("normalizes the browser name for telemetry while keeping firefox detection", () => {
    expect(browserName).toBe("Firefox");
    expect(browserVersion).toBe("150.0.0");
    expect(isFirefox).toBe(true);
  });
});
