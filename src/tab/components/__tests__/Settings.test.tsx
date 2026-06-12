import { fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { act } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAnalyticsEnabled, track } from "@/shared/analytics";
import { setCrashReportsEnabled } from "@/shared/sentry";
import type { Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import { Settings } from "@/tab/components/Settings";
import { useDataCollectionGranted } from "@/tab/hooks/useDataCollectionGranted";
import { useStore } from "@/tab/store";

vi.mock("@/tab/hooks/useDataCollectionGranted", () => ({
  useDataCollectionGranted: vi.fn(() => true),
}));

vi.mock("@/shared/analytics", async () => {
  const actual =
    await vi.importActual<typeof import("@/shared/analytics")>(
      "@/shared/analytics",
    );
  return { ...actual, track: vi.fn(), setAnalyticsEnabled: vi.fn() };
});

vi.mock("@/shared/sentry", async () => {
  const actual =
    await vi.importActual<typeof import("@/shared/sentry")>("@/shared/sentry");
  return { ...actual, setCrashReportsEnabled: vi.fn() };
});

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
  vi.mocked(track).mockClear();
  vi.mocked(setAnalyticsEnabled).mockClear();
  vi.mocked(setCrashReportsEnabled).mockClear();
  vi.mocked(useDataCollectionGranted).mockReturnValue(true);
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

  it("records turning analytics on via the opt-in event", async () => {
    const user = userEvent.setup();
    render(<Settings config={{ ...baseConfig, analyticsEnabled: false }} />);

    await user.click(screen.getByLabelText(/usage analytics/i));

    expect(setAnalyticsEnabled).toHaveBeenCalledWith(true, {
      name: "setting_changed",
      properties: { setting: "analyticsEnabled", value: true },
    });
  });

  it("records turning analytics off before opting out", async () => {
    const user = userEvent.setup();
    render(<Settings config={{ ...baseConfig, analyticsEnabled: true }} />);

    await user.click(screen.getByLabelText(/usage analytics/i));

    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting: "analyticsEnabled",
      value: false,
    });
    expect(setAnalyticsEnabled).toHaveBeenCalledWith(false);
    const trackOrder = vi.mocked(track).mock.invocationCallOrder[0] ?? 0;
    const optOutOrder =
      vi.mocked(setAnalyticsEnabled).mock.invocationCallOrder[0] ??
      Number.POSITIVE_INFINITY;
    expect(trackOrder).toBeLessThan(optOutOrder);
  });

  it("records toggling crash reports", async () => {
    const user = userEvent.setup();
    render(<Settings config={{ ...baseConfig, crashReportsEnabled: true }} />);

    await user.click(screen.getByLabelText(/crash reports/i));

    expect(track).toHaveBeenCalledWith("setting_changed", {
      setting: "crashReportsEnabled",
      value: false,
    });
    expect(setCrashReportsEnabled).toHaveBeenCalledWith(false);
  });

  it("disables the data toggles and shows a notice when Firefox data collection is off", () => {
    vi.mocked(useDataCollectionGranted).mockReturnValue(false);
    render(
      <Settings
        config={{
          ...baseConfig,
          analyticsEnabled: true,
          crashReportsEnabled: true,
        }}
      />,
    );

    const analytics = screen.getByLabelText(/usage analytics/i);
    const crashReports = screen.getByLabelText(/crash reports/i);

    expect(analytics).toBeDisabled();
    expect(analytics).not.toBeChecked();
    expect(crashReports).toBeDisabled();
    expect(crashReports).not.toBeChecked();
    expect(
      screen.getByText(/firefox's extension settings/i),
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
