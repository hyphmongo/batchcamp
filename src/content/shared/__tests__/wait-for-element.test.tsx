import { afterEach, describe, expect, it } from "vitest";

import { waitForElement } from "@/content/shared/wait-for-element";

afterEach(() => {
  document.body.innerHTML = "";
});

describe("waitForElement", () => {
  it("resolves immediately for an element already in the DOM", async () => {
    const el = document.createElement("div");
    el.className = "already-here";
    document.body.appendChild(el);

    await expect(waitForElement(".already-here")).resolves.toBe(el);
  });

  it("resolves when the element appears later", async () => {
    const pending = waitForElement(".late-arrival");
    const el = document.createElement("div");
    el.className = "late-arrival";
    document.body.appendChild(el);

    await expect(pending).resolves.toBe(el);
  });

  it("rejects instead of hanging forever when the element never appears", async () => {
    await expect(
      waitForElement(".never-appears", "missing thing", 50),
    ).rejects.toThrow(/timed out/i);
  });
});
