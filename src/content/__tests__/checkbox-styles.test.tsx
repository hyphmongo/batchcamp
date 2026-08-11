import { afterEach, describe, expect, it } from "vitest";

import "../content-styles.css";

const CONTEXTS = [
  ["a purchase page row", "download_list_item"],
  ["a purchases list row", "purchases"],
  ["a collection grid item", "collection-item-container"],
] as const;

const fillOf = (container: string, checked: boolean) => {
  const row = document.createElement("li");
  row.className = container;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "bc-checkbox";
  row.appendChild(checkbox);
  document.body.appendChild(row);
  checkbox.checked = checked;

  return getComputedStyle(checkbox).backgroundColor;
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("a ticked checkbox looks ticked", () => {
  it.each(CONTEXTS)(
    "fills the box on %s, so the tick drawn on it is visible",
    (_label, container) => {
      expect(fillOf(container, true)).not.toBe(fillOf(container, false));
    },
  );
});
