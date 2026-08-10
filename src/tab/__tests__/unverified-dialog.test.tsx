import { render, screen } from "@testing-library/react";
import { act } from "react";
import { describe, expect, it } from "vitest";

import { Downloads } from "@/tab/components/Downloads";
import { useStore } from "@/tab/store";
import {
  makeQueue,
  onboardedConfig,
  setupJourneyHarness,
} from "./journey-fixtures";

const topmostAt = (element: Element) => {
  const box = element.getBoundingClientRect();
  return document.elementFromPoint(
    box.left + box.width / 2,
    box.top + box.height / 2,
  );
};

describe("the verify-your-email dialog", () => {
  it("covers the rest of the page so no controls stay clickable behind it", async () => {
    setupJourneyHarness();
    render(<Downloads config={onboardedConfig} queue={makeQueue()} />);

    const settings = screen.getByRole("button", { name: /settings/i });
    expect(topmostAt(settings)?.closest("button")).toBe(settings);

    await act(async () => {
      useStore.getState().setAccountUnverified(true);
    });

    const dialog = await screen.findByRole("dialog");
    expect(topmostAt(settings)?.closest("button")).not.toBe(settings);
    expect(dialog.contains(topmostAt(settings))).toBe(true);
  });
});
