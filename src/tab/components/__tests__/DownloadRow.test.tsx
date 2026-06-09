import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DownloadRow } from "@/tab/components/DownloadRow";
import type { Download, ResolvedItem } from "@/types";

const makeDownload = (overrides: Partial<Download> = {}): Download => ({
  id: "dl-1",
  url: "https://bandcamp.com/download?token=abc",
  artist: "Joy Orbison",
  title: "Joy Orbison - Hyph Mngo",
  format: "mp3-320",
  progress: 0,
  ...overrides,
});

const makeSingle = (overrides: Partial<ResolvedItem> = {}): ResolvedItem => ({
  id: "i:1",
  status: "downloading",
  title: "Joy Orbison - Hyph Mngo",
  download: makeDownload(),
  ...overrides,
});

const makeActions = () => ({
  retry: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  showInFolder: vi.fn(),
  copyUrl: vi.fn(),
  requestDelete: vi.fn(),
});

const renderRow = (
  item: ResolvedItem,
  overrides: Partial<Parameters<typeof DownloadRow>[0]> = {},
) => {
  const actions = makeActions();
  const utils = render(
    <DownloadRow item={item} paused={false} actions={actions} {...overrides} />,
  );
  return { ...utils, ...actions };
};

describe("DownloadRow", () => {
  it("renders the title and artist for a single item", () => {
    renderRow(makeSingle());

    expect(screen.getByText("Hyph Mngo")).toBeInTheDocument();
    expect(screen.getByText("Joy Orbison")).toBeInTheDocument();
  });

  it("labels a failed item with a failed status pill", () => {
    renderRow(makeSingle({ status: "failed" }));

    expect(screen.getByLabelText("Status: failed")).toBeInTheDocument();
  });

  it("renders a rate-limited item as a calm queued chip, not failed or retrying", () => {
    renderRow(makeSingle({ status: "rate_limited" }));

    expect(screen.getByLabelText("Status: queued")).toBeInTheDocument();
    expect(screen.queryByText(/retrying/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Status: failed")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^retry$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows an inline retry button for failed items and fires retry on click", async () => {
    const user = userEvent.setup();
    const { retry } = renderRow(makeSingle({ status: "failed" }));

    const retryButton = screen.getByRole("button", { name: /^retry$/i });
    await user.click(retryButton);

    expect(retry).toHaveBeenCalledWith("i:1");
  });

  it("opens an action menu and shows Pause for a downloading item", async () => {
    const user = userEvent.setup();
    renderRow(makeSingle({ status: "downloading" }));

    await user.click(
      screen.getByRole("button", { name: /actions for hyph mngo/i }),
    );

    expect(
      screen.getByRole("menuitem", { name: /^pause$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /show in folder/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Resume in the action menu when the item is paused", async () => {
    const user = userEvent.setup();
    renderRow(makeSingle({ status: "downloading" }), { paused: true });

    await user.click(
      screen.getByRole("button", { name: /actions for hyph mngo/i }),
    );

    expect(
      screen.getByRole("menuitem", { name: /^resume$/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("menuitem", { name: /^pause$/i }),
    ).not.toBeInTheDocument();
  });

  it("shows Show in folder and Delete file in the menu for completed items", async () => {
    const user = userEvent.setup();
    const { showInFolder, requestDelete } = renderRow(
      makeSingle({
        status: "completed",
        download: makeDownload({ progress: 100 }),
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /actions for hyph mngo/i }),
    );

    await user.click(screen.getByRole("menuitem", { name: /show in folder/i }));
    expect(showInFolder).toHaveBeenCalledWith("i:1");

    await user.click(
      screen.getByRole("button", { name: /actions for hyph mngo/i }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: /delete file from disk/i }),
    );
    expect(requestDelete).toHaveBeenCalledWith("i:1");
  });
});
