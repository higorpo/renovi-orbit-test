// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const preferences = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/capacitor/preferencesStorage", () => ({
  preferencesGet: preferences.get,
  preferencesSet: preferences.set,
  preferencesRemove: preferences.remove,
}));

import {
  cacheGet,
  cachePersistGet,
  cachePersistRemove,
  cachePersistSet,
  cacheRemove,
  cacheSet,
} from "../cache";

const PERSISTED_KEY = "orbit.cache.persist.v1:profile_user-1";

describe("memory cache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T15:00:00.000Z"));
    cacheRemove("test-key");
  });

  afterEach(() => {
    cacheRemove("test-key");
    vi.useRealTimers();
  });

  it("returns cached data before its TTL expires", async () => {
    const value = { id: "user-1" };
    cacheSet("test-key", value, 1_000);

    vi.advanceTimersByTime(1_000);

    await expect(cacheGet("test-key")).resolves.toBe(value);
  });

  it("returns null after its TTL expires", async () => {
    cacheSet("test-key", { id: "user-1" }, 1_000);

    vi.advanceTimersByTime(1_001);

    await expect(cacheGet("test-key")).resolves.toBeNull();
  });

  it("removes cached data", async () => {
    cacheSet("test-key", "value");

    cacheRemove("test-key");

    await expect(cacheGet("test-key")).resolves.toBeNull();
  });
});

describe("persistent cache", () => {
  beforeEach(() => {
    preferences.get.mockReset();
    preferences.set.mockReset();
    preferences.remove.mockReset();
  });

  it("serializes values under the versioned storage key", async () => {
    await cachePersistSet("profile_user-1", { id: "user-1", active: true });

    expect(preferences.set).toHaveBeenCalledWith(
      PERSISTED_KEY,
      '{"id":"user-1","active":true}',
    );
  });

  it("restores a serialized value", async () => {
    preferences.get.mockResolvedValue('{"id":"user-1","active":true}');

    await expect(
      cachePersistGet<{ id: string; active: boolean }>("profile_user-1"),
    ).resolves.toEqual({ id: "user-1", active: true });
    expect(preferences.get).toHaveBeenCalledWith(PERSISTED_KEY);
  });

  it.each([
    ["a missing value", null],
    ["invalid JSON", "{invalid"],
  ])("returns null for %s", async (_description, storedValue) => {
    preferences.get.mockResolvedValue(storedValue);

    await expect(cachePersistGet("profile_user-1")).resolves.toBeNull();
  });

  it("returns null when persistent storage cannot be read", async () => {
    preferences.get.mockRejectedValue(new Error("storage unavailable"));

    await expect(cachePersistGet("profile_user-1")).resolves.toBeNull();
  });

  it("removes the versioned storage key", async () => {
    await cachePersistRemove("profile_user-1");

    expect(preferences.remove).toHaveBeenCalledWith(PERSISTED_KEY);
  });

  it("does not reject when persistent storage writes or removals fail", async () => {
    preferences.set.mockRejectedValue(new Error("quota exceeded"));
    preferences.remove.mockRejectedValue(new Error("storage unavailable"));

    await expect(
      cachePersistSet("profile_user-1", { id: "user-1" }),
    ).resolves.toBeUndefined();
    await expect(cachePersistRemove("profile_user-1")).resolves.toBeUndefined();
  });
});
