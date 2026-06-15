import { describe, expect, it } from "vitest";

import { parseMessage } from "@/messages";

describe("parseMessage — runtime validation of cross-context messages", () => {
  it.each([
    { type: "send-items-to-background", items: [] },
    { type: "send-items-to-tab", items: [] },
    { type: "tab-opened" },
    { type: "register-filename", url: "u", filename: "f" },
    { type: "unregister-filename", url: "u" },
    { type: "show-settings" },
    { type: "items-delivered" },
  ])("accepts valid message of type $type", (msg) => {
    expect(parseMessage(msg)).not.toBeNull();
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
    expect(parseMessage(input)).toBeNull();
  });

  it.each([
    [{ type: "send-items-to-tab" }, "send-items without items"],
    [{ type: "send-items-to-background", items: "nope" }, "non-array items"],
    [{ type: "register-filename", url: 1, filename: "x" }, "non-string url"],
    [{ type: "register-filename", url: "u" }, "missing filename"],
    [{ type: "unregister-filename" }, "missing url"],
  ])("rejects a malformed payload: %s (%s)", (input, _label) => {
    expect(parseMessage(input)).toBeNull();
  });

  it("rejects send-items carrying a malformed item", () => {
    expect(
      parseMessage({ type: "send-items-to-background", items: [{}] }),
    ).toBeNull();
  });

  it("returns the validated message for a well-formed pending item", () => {
    const result = parseMessage({
      type: "send-items-to-background",
      items: [
        { id: "a", title: "t", status: "pending", url: "u", format: "flac" },
      ],
    });

    expect(result?.type).toBe("send-items-to-background");
  });
});
