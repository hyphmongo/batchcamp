import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RowActionsMenu } from "@/tab/components/RowActionsMenu";

vi.mock("@/shared/analytics", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  track: vi.fn(),
}));

const action = (label: string) => ({ label, onSelect: () => {} });

const labels = () =>
  screen.getAllByRole("menuitem").map((item) => item.textContent);

describe("the row action menu while it is open", () => {
  it("keeps the items it opened with when the download changes underneath", async () => {
    const user = userEvent.setup();
    const downloading = [action("Pause"), action("Copy Bandcamp URL")];
    const completed = [
      action("Show in folder"),
      action("Copy Bandcamp URL"),
      action("Delete file from disk"),
    ];

    const { rerender } = render(<RowActionsMenu actions={downloading} />);
    await user.click(screen.getByRole("button", { name: /row actions/i }));

    expect(labels()).toEqual(["Pause", "Copy Bandcamp URL"]);

    rerender(<RowActionsMenu actions={completed} />);

    expect(labels()).toEqual(["Pause", "Copy Bandcamp URL"]);
  });

  it("picks up the new items the next time it is opened", async () => {
    const user = userEvent.setup();
    const downloading = [action("Pause"), action("Copy Bandcamp URL")];
    const completed = [action("Show in folder"), action("Copy Bandcamp URL")];

    const { rerender } = render(<RowActionsMenu actions={downloading} />);
    const trigger = screen.getByRole("button", { name: /row actions/i });

    await user.click(trigger);
    rerender(<RowActionsMenu actions={completed} />);
    await user.keyboard("{Escape}");
    await user.click(trigger);

    expect(labels()).toEqual(["Show in folder", "Copy Bandcamp URL"]);
  });
});
