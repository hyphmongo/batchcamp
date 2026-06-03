import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { Settings } from "@/tab/components/Settings";
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
    downloadHistoryStore: {
      get: vi.fn().mockResolvedValue({ downloadedIds: [] }),
      set: vi.fn().mockResolvedValue(undefined),
      watch: vi.fn(() => () => {}),
    },
  };
});

const baseConfig: Configuration = onboardedConfig;

const setHistory = (count: number, cleared = false) => {
  act(() => {
    useStore.setState({
      downloadHistoryCount: count,
      historyCleared: cleared,
    });
  });
};

beforeEach(() => {
  useStore.setState({
    downloadHistoryCount: 0,
    historyCleared: false,
  });
});

describe("Settings", () => {
  it("persists a format change made from the dropdown", async () => {
    const user = userEvent.setup();
    render(<Settings config={baseConfig} />);

    await user.selectOptions(screen.getByLabelText(/^format$/i), "flac");

    expect(useStore.getState().config.format).toBe("flac");
  });

  it("persists a concurrency change made from the slider", () => {
    render(<Settings config={baseConfig} />);
    const slider = screen.getByLabelText(/concurrent downloads/i);

    act(() => {
      fireEvent.change(slider, { target: { value: "6" } });
    });

    expect(useStore.getState().config.concurrency).toBe(6);
  });

  it("shows the remembered-downloads count from the store", () => {
    setHistory(3);
    render(<Settings config={baseConfig} />);

    expect(screen.getByText(/downloads remembered/i)).toHaveTextContent(
      "3 downloads remembered",
    );
  });

  it("updates the displayed count live when the store updates", () => {
    setHistory(1);
    render(<Settings config={baseConfig} />);

    expect(screen.getByText(/downloads remembered/i)).toHaveTextContent(
      "1 downloads remembered",
    );

    setHistory(4);

    expect(screen.getByText(/downloads remembered/i)).toHaveTextContent(
      "4 downloads remembered",
    );
  });

  it("calls clearDownloadHistory and shows 'cleared' label when the button is clicked", async () => {
    setHistory(2);
    const user = userEvent.setup();
    render(<Settings config={baseConfig} />);

    await user.click(screen.getByRole("button", { name: /^clear$/i }));

    expect(useStore.getState().historyCleared).toBe(true);
    expect(useStore.getState().downloadHistoryCount).toBe(0);
    expect(screen.getByText(/downloads remembered/i)).toHaveTextContent(
      "0 downloads remembered",
    );
    expect(
      screen.getByRole("button", { name: /cleared/i }),
    ).toBeInTheDocument();
  });

  it("hides the history row when there is no history", () => {
    setHistory(0);
    render(<Settings config={baseConfig} />);

    expect(screen.queryByText(/downloads remembered/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^clear$/i }),
    ).not.toBeInTheDocument();
  });
});
