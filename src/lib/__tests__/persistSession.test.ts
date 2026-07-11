// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
}));

vi.mock("@/lib/capacitor/preferencesStorage", () => ({
  preferencesGet: storageMocks.get,
  preferencesSet: storageMocks.set,
}));

async function loadPersistSession() {
  return import("@/lib/persistSession");
}

describe("persist session preference", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    storageMocks.set.mockResolvedValue(undefined);
  });

  it("defaults to persisting the session before hydration", async () => {
    const { getPersistSession } = await loadPersistSession();

    expect(getPersistSession()).toBe(true);
  });

  it.each([
    [null, true],
    ["true", true],
    ["false", false],
    ["unexpected", false],
  ])("hydrates stored value %s as %s", async (stored, expected) => {
    storageMocks.get.mockResolvedValue(stored);
    const { getPersistSession, hydratePersistSessionPreference } =
      await loadPersistSession();

    await hydratePersistSessionPreference();

    expect(storageMocks.get).toHaveBeenCalledWith("orbit_persist_session");
    expect(getPersistSession()).toBe(expected);
  });

  it("falls back to persisting the session when storage cannot be read", async () => {
    storageMocks.get.mockRejectedValue(new Error("storage unavailable"));
    const { getPersistSession, hydratePersistSessionPreference } =
      await loadPersistSession();

    await hydratePersistSessionPreference();

    expect(getPersistSession()).toBe(true);
  });

  it.each([
    [false, "false"],
    [true, "true"],
  ])("updates the cached preference to %s and persists it", async (value, stored) => {
    const { getPersistSession, setPersistSession } = await loadPersistSession();

    setPersistSession(value);

    expect(getPersistSession()).toBe(value);
    await vi.waitFor(() => {
      expect(storageMocks.set).toHaveBeenCalledWith("orbit_persist_session", stored);
    });
  });
});
