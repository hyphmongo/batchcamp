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

const makePurchaseRow = () => {
  const list = document.createElement("div");
  list.className = "purchases";
  const item = document.createElement("div");
  item.className = "purchases-item";
  const art = document.createElement("div");
  art.className = "purchases-item-art-container";
  art.style.position = "relative";
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "bc-checkbox";

  art.appendChild(checkbox);
  item.appendChild(art);
  list.appendChild(item);
  document.body.appendChild(list);

  return { item, checkbox };
};

afterEach(() => {
  document.body.replaceChildren();
});

describe("one checkbox, three pages", () => {
  const boxIn = (containerClass: string, wrapperClass?: string) => {
    const wrapper = document.createElement("div");
    wrapper.className = wrapperClass ?? "";
    const container = document.createElement("div");
    container.className = containerClass;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "bc-checkbox";
    container.appendChild(checkbox);
    wrapper.appendChild(container);
    document.body.appendChild(wrapper);

    return getComputedStyle(checkbox);
  };

  it("draws the same unchecked box everywhere", () => {
    const fills = [
      boxIn("collection-item-art-container").backgroundColor,
      boxIn("purchases-item-art-container", "purchases").backgroundColor,
      boxIn("download_list_item").backgroundColor,
    ];

    expect(new Set(fills).size).toBe(1);
  });

  it("lifts the box off the artwork only where it sits on artwork", () => {
    const shadowed = boxIn("collection-item-art-container").boxShadow;
    const flat = boxIn("purchases-item-art-container", "purchases").boxShadow;

    expect(shadowed).not.toBe("none");
    expect(flat).toBe("none");
  });
});

describe("selecting on the purchases page", () => {
  it("puts the checkbox beside the artwork, in room the row makes for it", () => {
    const { item, checkbox } = makePurchaseRow();

    expect(Number.parseFloat(getComputedStyle(checkbox).left)).toBeLessThan(0);
    expect(
      Number.parseFloat(getComputedStyle(item).paddingLeft),
    ).toBeGreaterThan(0);
  });
});

describe("a ticked checkbox looks ticked", () => {
  it.each(CONTEXTS)(
    "fills the box on %s, so the tick drawn on it is visible",
    (_label, container) => {
      expect(fillOf(container, true)).not.toBe(fillOf(container, false));
    },
  );
});
