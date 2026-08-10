import {
  render,
  screen,
  waitForElementToBeRemoved,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { ConfirmDialog } from "@/shared/ConfirmDialog";

const Harness = () => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        delete file
      </button>
      <ConfirmDialog
        open={open}
        title="delete from disk"
        confirmLabel="delete"
        cancelLabel="cancel"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </>
  );
};

describe("a confirmation dialog keeps the keyboard inside it", () => {
  it("moves focus into the dialog, cycles within it, and restores focus on close", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const opener = screen.getByRole("button", { name: /delete file/i });
    await user.click(opener);

    const cancel = await screen.findByRole("button", { name: "cancel" });
    const confirm = screen.getByRole("button", { name: "delete" });
    expect(cancel).toHaveFocus();

    await user.tab();
    expect(confirm).toHaveFocus();

    await user.tab();
    expect(cancel).toHaveFocus();

    await user.tab({ shift: true });
    expect(confirm).toHaveFocus();

    await user.keyboard("{Escape}");

    await waitForElementToBeRemoved(() =>
      screen.queryByRole("button", { name: "cancel" }),
    );
    expect(opener).toHaveFocus();
  });
});
