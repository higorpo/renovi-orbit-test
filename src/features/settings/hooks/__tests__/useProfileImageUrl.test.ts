// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useProfileImageUrl } from "../useProfileImageUrl";
import * as profileImageStorageApi from "../../api/profileImageStorage.api";

vi.mock("../../api/profileImageStorage.api", () => ({
  getProfileImageSignedUrl: vi.fn(),
}));

const getProfileImageSignedUrl = vi.mocked(
  profileImageStorageApi.getProfileImageSignedUrl
);

describe("useProfileImageUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty url and not loading when path is null", () => {
    const { result } = renderHook(() => useProfileImageUrl(null));
    expect(result.current.url).toBe("");
    expect(result.current.isLoading).toBe(false);
    expect(getProfileImageSignedUrl).not.toHaveBeenCalled();
  });

  it("returns empty url and not loading when path is undefined", () => {
    const { result } = renderHook(() => useProfileImageUrl(undefined));
    expect(result.current.url).toBe("");
    expect(result.current.isLoading).toBe(false);
  });

  it("resolves path to signed URL and sets loading then false", async () => {
    getProfileImageSignedUrl.mockResolvedValue("https://signed.url/avatar.jpg");

    const { result } = renderHook(() => useProfileImageUrl("users/u1/profile/avatar.jpg"));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.url).toBe("");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toBe("https://signed.url/avatar.jpg");
    expect(getProfileImageSignedUrl).toHaveBeenCalledWith("users/u1/profile/avatar.jpg");
  });

  it("refetches signed URL when the storage path changes after a replacement upload", async () => {
    getProfileImageSignedUrl
      .mockResolvedValueOnce("https://signed.url/old.jpg")
      .mockResolvedValueOnce("https://signed.url/new.jpg");

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useProfileImageUrl(path),
      { initialProps: { path: "users/u1/profile/avatar-old.jpg" } },
    );

    await waitFor(() => {
      expect(result.current.url).toBe("https://signed.url/old.jpg");
    });

    rerender({ path: "users/u1/profile/avatar-new.jpg" });

    await waitFor(() => {
      expect(result.current.url).toBe("https://signed.url/new.jpg");
    });

    expect(getProfileImageSignedUrl).toHaveBeenCalledTimes(2);
    expect(getProfileImageSignedUrl).toHaveBeenLastCalledWith("users/u1/profile/avatar-new.jpg");
  });

  it("sets url to empty when getProfileImageSignedUrl returns empty", async () => {
    getProfileImageSignedUrl.mockResolvedValue("");

    const { result } = renderHook(() => useProfileImageUrl("users/u1/profile/avatar.jpg"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toBe("");
  });

  it("ignores result when path changes before promise resolves", async () => {
    let resolveFirst: (value: string) => void;
    const firstPromise = new Promise<string>((r) => {
      resolveFirst = r;
    });
    getProfileImageSignedUrl.mockReturnValue(firstPromise);

    const { result, rerender } = renderHook(
      ({ path }: { path: string | null }) => useProfileImageUrl(path),
      { initialProps: { path: "path1" } as { path: string | null } }
    );

    rerender({ path: null });
    resolveFirst!("https://first.url");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.url).toBe("");
  });
});
