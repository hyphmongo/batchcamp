import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useQueue } from "@/tab/hooks/useQueue";

describe("useQueue", () => {
  it("starts paused so nothing can download before configuration applies", () => {
    const { result } = renderHook(() => useQueue());

    expect(result.current.isPaused).toBe(true);
  });
});
