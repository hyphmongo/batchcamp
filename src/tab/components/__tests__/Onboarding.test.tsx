import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { useStore } from "@/tab/store";

vi.mock("@/storage", async () => {
  const actual = await vi.importActual<typeof import("@/storage")>("@/storage");
  return {
    ...actual,
    migrateLegacyStorage: vi.fn().mockResolvedValue(undefined),
    configurationStore: {
      set: vi.fn().mockResolvedValue(undefined),
      get: vi.fn().mockResolvedValue({}),
      watch: vi.fn(() => () => {}),
    },
  };
});

const { Onboarding } = await import("@/tab/components/Onboarding");

const baseConfig: Configuration = { ...onboardedConfig, hasOnboarded: false };

beforeEach(() => {
  useStore.setState({ items: new Map() });
});

describe("Onboarding", () => {
  it("shows the 'Initial setup' heading and confirm-defaults copy", () => {
    render(<Onboarding config={baseConfig} onStart={vi.fn()} />);

    expect(
      screen.getByRole("heading", { name: /initial setup/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/confirm your download defaults/i),
    ).toBeInTheDocument();
  });

  it("renders the four numbered config fields", () => {
    render(<Onboarding config={baseConfig} onStart={vi.fn()} />);

    expect(screen.getByLabelText(/format/i)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /customize filename/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /download cover art/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/concurrent downloads/i)).toBeInTheDocument();
  });

  it("calls onStart when the user clicks Save defaults (no items queued)", async () => {
    const onStart = vi.fn();
    const user = userEvent.setup();
    render(<Onboarding config={baseConfig} onStart={onStart} />);

    await user.click(screen.getByRole("button", { name: /save defaults/i }));

    expect(onStart).toHaveBeenCalledOnce();
  });

  it("shows 'Start download' button copy when there is one item queued", () => {
    useStore.setState({
      items: new Map([
        [
          "i:1",
          {
            id: "i:1",
            status: "queued" as const,
            url: "https://example.com",
            title: "Test",
            artist: "Test",
            download: {
              id: "i:1",
              url: "https://example.com",
              artist: "Test",
              title: "Test",
              format: "mp3-320",
              progress: 0,
            },
          },
        ],
      ]),
    });

    render(<Onboarding config={baseConfig} onStart={vi.fn()} />);

    expect(
      screen.getByRole("button", { name: /^start download$/i }),
    ).toBeInTheDocument();
  });
});
