import { describe, expect, it } from "vitest";

import { isMessage } from "@/types";

describe("isMessage — runtime validation of cross-context messages", () => {
  it.each([
    { type: "send-items-to-background", items: [] },
    { type: "send-items-to-tab", items: [] },
    { type: "tab-opened" },
    { type: "register-filename", url: "u", filename: "f" },
    { type: "unregister-filename", url: "u" },
    { type: "show-settings" },
    { type: "items-delivered" },
  ])("accepts valid message of type $type", (msg) => {
    expect(isMessage(msg)).toBe(true);
  });

  it.each([
    [null, "null"],
    [undefined, "undefined"],
    ["string", "string"],
    [42, "number"],
    [{ type: "unknown-type" }, "unknown type"],
    [{}, "object without type"],
    [{ type: null }, "null type"],
  ])("rejects %s (%s)", (input, _label) => {
    expect(isMessage(input)).toBe(false);
  });

  it.each([
    [{ type: "send-items-to-tab" }, "send-items without items"],
    [{ type: "send-items-to-background", items: "nope" }, "non-array items"],
    [{ type: "register-filename", url: 1, filename: "x" }, "non-string url"],
    [{ type: "register-filename", url: "u" }, "missing filename"],
    [{ type: "unregister-filename" }, "missing url"],
  ])("rejects a malformed payload: %s (%s)", (input, _label) => {
    expect(isMessage(input)).toBe(false);
  });
});
