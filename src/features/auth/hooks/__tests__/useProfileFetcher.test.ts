// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useProfileFetcher } from "../useProfileFetcher";
import type { Profile } from "../../types/auth.types";

const getProfile = vi.fn();

vi.mock("../../api/profile.api", () => ({
  profileApi: {
    getProfile: (id: string) => getProfile(id),
  },
}));

vi.mock("@/lib/cache", () => ({
  cacheGet: vi.fn(),
  cachePersistGet: vi.fn(),
  cachePersistSet: vi.fn(),
  cacheSet: vi.fn(),
  cacheRemove: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
  },
}));

const cache = await import("@/lib/cache");

const profile: Profile = {
  id: "u1",
  role: "client",
  full_name: "Test",
};

describe("useProfileFetcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cache.cacheGet).mockResolvedValue(null);
    vi.mocked(cache.cachePersistGet).mockResolvedValue(null);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: true,
      writable: true,
    });
  });

  it("returns profile from API and caches", async () => {
    getProfile.mockResolvedValue({ profile, error: null });
    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toEqual(profile);
    expect(cache.cacheSet).toHaveBeenCalled();
    expect(cache.cachePersistSet).toHaveBeenCalled();
  });

  it("returns persist cache when offline and memory miss", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue(null);
    vi.mocked(cache.cachePersistGet).mockResolvedValue(profile);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
      writable: true,
    });
    getProfile.mockResolvedValue({ profile: null, error: null });

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toEqual(profile);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("returns null offline with no persist cache", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue(null);
    vi.mocked(cache.cachePersistGet).mockResolvedValue(null);
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      value: false,
      writable: true,
    });

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toBeNull();
  });

  it("uses disk fallback when API returns no profile", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue(null);
    getProfile.mockResolvedValue({ profile: null, error: new Error("404") });
    vi.mocked(cache.cachePersistGet).mockResolvedValue(profile);

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toEqual(profile);
  });

  it("returns profile from memory cache without calling API", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue(profile);
    getProfile.mockResolvedValue({ profile: null, error: null });

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toEqual(profile);
    expect(getProfile).not.toHaveBeenCalled();
  });

  it("uses persist fallback when getProfile throws", async () => {
    vi.mocked(cache.cacheGet).mockResolvedValue(null);
    getProfile.mockRejectedValue(new Error("boom"));
    vi.mocked(cache.cachePersistGet).mockResolvedValue(profile);

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toEqual(profile);
  });

  it("refreshProfile clears cache and refetches", async () => {
    getProfile.mockResolvedValue({ profile, error: null });
    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    await act(async () => {
      await result.current.refreshProfile();
    });
    expect(cache.cacheRemove).toHaveBeenCalledWith("profile_u1");
    expect(setProfile).toHaveBeenCalledWith(profile);
  });

  it("refreshProfile no-ops without currentUserId", async () => {
    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, null));

    await act(async () => {
      await result.current.refreshProfile();
    });
    expect(cache.cacheRemove).not.toHaveBeenCalled();
  });

  it("reuses in-flight promise for concurrent fetchProfile calls", async () => {
    let resolveProfile!: (value: { profile: Profile; error: null }) => void;
    getProfile.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProfile = resolve;
        }),
    );
    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let first!: Promise<Profile | null>;
    let second!: Promise<Profile | null>;
    act(() => {
      first = result.current.fetchProfile("u1");
      second = result.current.fetchProfile("u1");
    });

    await vi.waitFor(() => expect(getProfile).toHaveBeenCalledTimes(1));
    resolveProfile({ profile, error: null });

    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(getProfile).toHaveBeenCalledTimes(1);
    expect(await first).toEqual(profile);
    expect(await second).toEqual(profile);
  });

  it("returns null when API has error and no disk fallback", async () => {
    getProfile.mockResolvedValue({ profile: null, error: new Error("404") });
    vi.mocked(cache.cachePersistGet).mockResolvedValue(null);

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toBeNull();
  });

  it("returns null when getProfile throws and no disk fallback", async () => {
    getProfile.mockRejectedValue(new Error("boom"));
    vi.mocked(cache.cachePersistGet).mockResolvedValue(null);

    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    let out: Profile | null = null;
    await act(async () => {
      out = await result.current.fetchProfile("u1");
    });
    expect(out).toBeNull();
  });

  it("does not call setProfile when refresh returns null", async () => {
    getProfile.mockResolvedValue({ profile: null, error: null });
    vi.mocked(cache.cachePersistGet).mockResolvedValue(null);
    const setProfile = vi.fn();
    const { result } = renderHook(() => useProfileFetcher(setProfile, "u1"));

    await act(async () => {
      await result.current.refreshProfile();
    });
    expect(setProfile).not.toHaveBeenCalled();
  });
});
