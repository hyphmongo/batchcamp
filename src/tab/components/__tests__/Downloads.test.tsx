import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import PQueue from "p-queue";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { backgroundStore, type Configuration } from "@/storage";
import { onboardedConfig } from "@/tab/__tests__/journey-fixtures";
import {
  createTestHarness,
  type TestHarness,
} from "@/tab/__tests__/test-harness";
import { Downloads } from "@/tab/components/Downloads";
import {
  resetBrowserAdapter,
  setBrowserAdapter,
} from "@/tab/services/browser-adapter";
import { useStore } from "@/tab/store";
import type { Item, ResolvedItem } from "@/types";

vi.mock("@/tab/hooks/useDownloadMessageListener", () => ({
  useDownloadMessageListener: vi.fn(),
}));
vi.mock("@/tab/hooks/useDownloadProgressUpdater", () => ({
  useDownloadProgressUpdater: vi.fn(),
}));
vi.mock("@/tab/hooks/useOnTabUnload", () => ({ useOnTabUnload: vi.fn() }));
vi.mock("@/tab/hooks/useOverallProgress", () => ({
  useOverallProgress: () => ({ speed: null, eta: null, bytesReceived: 0 }),
}));

let harness: TestHarness;

const notOnboardedConfig: Configuration = {
  ...onboardedConfig,
  hasOnboarded: false,
};

const makeQueue = () => new PQueue({ concurrency: 3 });

beforeEach(() => {
  harness = createTestHarness();
  setBrowserAdapter(harness.adapter);
  act(() => {
    useStore.setState({
      items: new Map(),
      downloadToItemId: {},
      browserIdToItemId: {},
      pausedItemIds: new Set(),
      downloadsPaused: false,
      downloadHistoryCount: 0,
      historyCleared: false,
    });
  });
});

afterEach(() => {
  resetBrowserAdapter();
});

describe("Downloads", () => {
  it("renders the EmptyState when onboarded with no items and none pending", async () => {
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(
      await screen.findByRole("heading", { name: /awaiting downloads/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/collection or purchases page/i),
    ).toBeInTheDocument();
  });

  it("shows a loading state, not the EmptyState, while pending items are still being delivered", async () => {
    await backgroundStore.set({
      items: [
        {
          id: "pending-1",
          url: "https://bandcamp.com/x",
          title: "Pending",
          status: "pending",
        } as Item,
      ],
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(
      await screen.findByRole("status", { name: /loading downloads/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /awaiting downloads/i }),
    ).not.toBeInTheDocument();
  });

  it("renders Settings (not Onboarding) when view=settings even if not onboarded", () => {
    const originalHash = window.location.hash;
    window.location.hash = "#settings";
    try {
      render(<Downloads config={notOnboardedConfig} queue={makeQueue()} />);

      expect(
        screen.getByLabelText(/collect anonymous usage analytics/i),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole("heading", { name: /initial setup/i }),
      ).not.toBeInTheDocument();
    } finally {
      window.location.hash = originalHash;
    }
  });

  it("renders the Onboarding flow when the user has not onboarded", () => {
    render(<Downloads config={notOnboardedConfig} queue={makeQueue()} />);

    expect(
      screen.getByRole("heading", { name: /initial setup/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /save defaults/i }),
    ).toBeInTheDocument();
  });

  it("keeps the download queue paused until onboarding completes", () => {
    const queue = makeQueue();

    render(<Downloads config={notOnboardedConfig} queue={queue} />);

    expect(queue.isPaused).toBe(true);
  });

  it("toggles to settings view when the settings icon is clicked and back via close", async () => {
    const user = userEvent.setup();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await user.click(screen.getByRole("button", { name: /^settings$/i }));

    expect(
      screen.getByLabelText(/collect anonymous usage analytics/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /close settings/i }));

    expect(
      screen.queryByLabelText(/collect anonymous usage analytics/i),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /awaiting downloads/i }),
    ).toBeInTheDocument();
  });

  it("shows the batchcamp wordmark in the top strip", () => {
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /batchcamp/i,
    );
  });

  it("readout count reflects completed items, not active ones", () => {
    const done: ResolvedItem = {
      id: "c1",
      status: "completed",
      title: "C1",
      download: {
        id: "dl-c1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 100,
        sizeMb: 10,
        browserId: 1,
      },
    };
    const active1: ResolvedItem = {
      id: "a1",
      status: "downloading",
      title: "A1",
      download: {
        id: "dl-a1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 50,
        sizeMb: 10,
        browserId: 2,
      },
    };
    const active2: ResolvedItem = {
      ...active1,
      id: "a2",
      title: "A2",
      download: { ...active1.download, id: "dl-a2", browserId: 3 },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          ["c1", done],
          ["a1", active1],
          ["a2", active2],
        ]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      /downloaded\s*1\s*of\s*3/i,
    );
  });

  it("keeps the queue paused when concurrency changes while paused", async () => {
    const user = userEvent.setup();
    const queue = makeQueue();
    const item: ResolvedItem = {
      id: "p1",
      status: "downloading",
      title: "P1",
      download: {
        id: "dl-p1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 50,
        sizeMb: 10,
        browserId: 1,
      },
    };
    act(() => {
      useStore.setState({ items: new Map<string, Item>([["p1", item]]) });
    });
    const view = render(<Downloads config={onboardedConfig} queue={queue} />);

    await user.click(screen.getByRole("button", { name: "Pause downloads" }));
    await waitFor(() => {
      expect(queue.isPaused).toBe(true);
    });

    view.rerender(
      <Downloads
        config={{ ...onboardedConfig, concurrency: 5 }}
        queue={queue}
      />,
    );

    expect(queue.concurrency).toBe(5);
    expect(queue.isPaused).toBe(true);
  });

  it("readout announces a finished batch with failures", () => {
    const done: ResolvedItem = {
      id: "c1",
      status: "completed",
      title: "C1",
      download: {
        id: "dl-c1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 100,
        browserId: 1,
      },
    };
    const failed: ResolvedItem = {
      ...done,
      id: "f1",
      status: "failed",
      download: { ...done.download, id: "dl-f1", browserId: 2 },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          ["c1", done],
          ["f1", failed],
        ]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.getByRole("status")).toHaveTextContent(/complete.*1 failed/i);
  });

  it("pins the overall bar at 100% when only failures remain", () => {
    const failed: ResolvedItem = {
      id: "f1",
      status: "failed",
      title: "F1",
      download: {
        id: "dl-f1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 0,
        browserId: 2,
      },
    };
    act(() => {
      useStore.setState({ items: new Map<string, Item>([["f1", failed]]) });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    const bar = screen.getByRole("progressbar", {
      name: /overall download progress/i,
    });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
    expect(bar).toHaveAttribute("aria-busy", "false");
  });

  it("readout shows 'paused' when active items are paused", () => {
    const item: ResolvedItem = {
      id: "p1",
      status: "downloading",
      title: "P1",
      download: {
        id: "dl-p1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 50,
        sizeMb: 10,
        browserId: 1,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["p1", item]]),
        pausedItemIds: new Set(["p1"]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
    expect(screen.queryByText(/downloading/i)).not.toBeInTheDocument();
  });

  it("readout shows 'queued' when items exist but none have downloading status", () => {
    const queued: ResolvedItem = {
      id: "q1",
      status: "queued",
      title: "Q1",
      download: {
        id: "dl-q1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 0,
        sizeMb: 10,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["q1", queued]]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.getByRole("status")).toHaveTextContent(/queued/i);
    expect(screen.queryByText(/downloading/i)).not.toBeInTheDocument();
  });

  it("shows the keep-tab-open metadata next to the version in the top strip during active downloads", () => {
    const active: ResolvedItem = {
      id: "item-active",
      status: "downloading",
      title: "Hyph Mngo",
      download: {
        id: "dl-active",
        url: "x",
        artist: "Joy Orbison",
        title: "Hyph Mngo",
        format: "mp3-320",
        progress: 50,
        sizeMb: 12,
        browserId: 1,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["item-active", active]]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    const notice = screen.getByText(/keep tab open/i);
    expect(notice).toBeInTheDocument();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toContainElement(notice);
  });

  it("still shows the keep-tab-open metadata when downloads are paused", async () => {
    const user = userEvent.setup();
    const active: ResolvedItem = {
      id: "item-active",
      status: "downloading",
      title: "Hyph Mngo",
      download: {
        id: "dl-active",
        url: "x",
        artist: "Joy Orbison",
        title: "Hyph Mngo",
        format: "mp3-320",
        progress: 50,
        sizeMb: 12,
        browserId: 1,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["item-active", active]]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    await user.click(
      await screen.findByRole("button", { name: /pause downloads/i }),
    );

    expect(screen.getByText(/keep tab open/i)).toBeInTheDocument();
  });

  it("sets document.title to reflect active download progress", () => {
    const a1: ResolvedItem = {
      id: "a1",
      status: "downloading",
      title: "A",
      download: {
        id: "dl-a1",
        url: "x",
        artist: "x",
        title: "x",
        format: "mp3-320",
        progress: 10,
        sizeMb: 10,
        browserId: 1,
      },
    };
    const a2: ResolvedItem = {
      ...a1,
      id: "a2",
      title: "B",
      download: { ...a1.download, id: "dl-a2", browserId: 2 },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([
          ["a1", a1],
          ["a2", a2],
        ]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(document.title).toMatch(/^Batchcamp · \d+%$/);
  });

  it("restores document.title to 'Batchcamp' when the list is empty", () => {
    document.title = "stale";
    act(() => {
      useStore.setState({ items: new Map<string, Item>() });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(document.title).toBe("Batchcamp");
  });

  it("resumes the queue and clears local pause state when the list empties", async () => {
    const user = userEvent.setup();
    const queue = makeQueue();

    const active: ResolvedItem = {
      id: "item-active",
      status: "downloading",
      title: "Hyph Mngo",
      download: {
        id: "dl-active",
        url: "x",
        artist: "Joy Orbison",
        title: "Hyph Mngo",
        format: "mp3-320",
        progress: 50,
        sizeMb: 12,
        browserId: 1,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["item-active", active]]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={queue} />);

    await user.click(
      await screen.findByRole("button", { name: /pause downloads/i }),
    );
    await waitFor(() => expect(queue.isPaused).toBe(true));

    act(() => {
      useStore.setState({ items: new Map<string, Item>() });
    });

    await waitFor(() => expect(queue.isPaused).toBe(false));
  });

  it("does not show the keep-tab-open metadata when all downloads are complete", () => {
    const done: ResolvedItem = {
      id: "item-done",
      status: "completed",
      title: "Done",
      download: {
        id: "dl-done",
        url: "x",
        artist: "A",
        title: "Done",
        format: "mp3-320",
        progress: 100,
        sizeMb: 10,
        browserId: 2,
      },
    };
    act(() => {
      useStore.setState({
        items: new Map<string, Item>([["item-done", done]]),
      });
    });

    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    expect(screen.queryByText(/keep tab open/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/that's the lot/i)).not.toBeInTheDocument();
  });
});
