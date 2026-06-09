import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  analyticsGet: vi.fn(),
  analyticsSet: vi.fn(),
}));

vi.mock("@/storage", () => ({
  analyticsStore: { get: mocks.analyticsGet, set: mocks.analyticsSet },
}));

const { getInstallId } = await import("@/shared/install-id");

beforeEach(() => {
  mocks.analyticsGet.mockReset();
  mocks.analyticsSet.mockReset().mockResolvedValue(undefined);
});

describe("getInstallId", () => {
  it("returns the stored id without writing a new one", async () => {
    mocks.analyticsGet.mockResolvedValue({ distinctId: "existing-id" });

    expect(await getInstallId()).toBe("existing-id");
    expect(mocks.analyticsSet).not.toHaveBeenCalled();
  });

  it("mints and persists a uuid when none is stored", async () => {
    let stored: string | null = null;
    mocks.analyticsGet.mockImplementation(async () => ({ distinctId: stored }));
    mocks.analyticsSet.mockImplementation(
      async ({ distinctId }: { distinctId: string }) => {
        stored = distinctId;
      },
    );

    const id = await getInstallId();

    expect(id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(mocks.analyticsSet).toHaveBeenCalledWith({ distinctId: id });
  });

  it("adopts an id written concurrently by another context", async () => {
    mocks.analyticsGet
      .mockResolvedValueOnce({ distinctId: null })
      .mockResolvedValue({ distinctId: "other-context-id" });

    expect(await getInstallId()).toBe("other-context-id");
  });
});
