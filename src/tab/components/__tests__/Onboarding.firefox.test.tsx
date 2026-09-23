import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";

vi.mock("@/shared/browser-info", () => ({
  isFirefox: true,
  browserName: "Firefox",
  browserVersion: "143",
}));

const { Onboarding } = await import("@/tab/components/Onboarding");

describe("Onboarding on Firefox", () => {
  it("hides the save prompt tip, since downloads skip the prompt already", () => {
    render(
      <Onboarding
        config={{ ...onboardedConfig, hasOnboarded: false }}
        onStart={vi.fn()}
      />,
    );

    expect(screen.queryByText(/download smoothly/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^download settings$/i }),
    ).not.toBeInTheDocument();
  });
});
