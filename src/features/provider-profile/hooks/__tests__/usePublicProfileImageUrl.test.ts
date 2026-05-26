// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { usePublicProfileImageUrl } from "../usePublicProfileImageUrl";

const getProfileImageSignedUrlForPublicMock = vi.fn();

vi.mock("../../api/profileImagePublic.api", () => ({
  getProfileImageSignedUrlForPublic: (...args: unknown[]) =>
    getProfileImageSignedUrlForPublicMock(...args),
}));

describe("usePublicProfileImageUrl", () => {
  beforeEach(() => {
    getProfileImageSignedUrlForPublicMock.mockReset();
  });

  it("returns empty url and no loading for null path", () => {
    const { result } = renderHook(() => usePublicProfileImageUrl(null));
    expect(result.current.url).toBe("");
    expect(result.current.isLoading).toBe(false);
  });

  it("returns empty url and no loading for undefined path", () => {
    const { result } = renderHook(() => usePublicProfileImageUrl(undefined));
    expect(result.current.url).toBe("");
    expect(result.current.isLoading).toBe(false);
  });

  it("fetches signed url for valid path", async () => {
    getProfileImageSignedUrlForPublicMock.mockResolvedValue(
      "https://example.com/signed",
    );

    const { result } = renderHook(() =>
      usePublicProfileImageUrl("avatars/test.jpg"),
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.url).toBe("https://example.com/signed");
    expect(getProfileImageSignedUrlForPublicMock).toHaveBeenCalledWith(
      "avatars/test.jpg",
    );
  });

  it("sets empty url when signed url resolves to empty", async () => {
    getProfileImageSignedUrlForPublicMock.mockResolvedValue("");

    const { result } = renderHook(() =>
      usePublicProfileImageUrl("avatars/missing.jpg"),
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.url).toBe("");
  });
});
