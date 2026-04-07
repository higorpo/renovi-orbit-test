import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderProposalPhotoUrls } from "../useProviderProposalPhotoUrls";
import * as providerProposalsApi from "../../api/providerProposals.api";

vi.mock("../../api/providerProposals.api", () => ({
  getProviderProposalPhotoDisplayUrl: vi.fn(),
}));

const getProviderProposalPhotoDisplayUrl = vi.mocked(
  providerProposalsApi.getProviderProposalPhotoDisplayUrl,
);

describe("useProviderProposalPhotoUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty urls and not loading when photos null", async () => {
    const { result } = renderHook(() => useProviderProposalPhotoUrls(null));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual([]);
  });

  it("resolves urls for each photo path", async () => {
    getProviderProposalPhotoDisplayUrl.mockImplementation(async (p) =>
      p === "a" ? "https://a" : "",
    );

    const photos = ["a", "b"];
    const { result } = renderHook(() => useProviderProposalPhotoUrls(photos));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["https://a"]);
  });

  it("drops resolution when photos are cleared before urls resolve", async () => {
    let finish: (v: string) => void = () => {};
    getProviderProposalPhotoDisplayUrl.mockImplementation(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );

    const { result, rerender } = renderHook(
      ({ paths }: { paths: string[] | null }) => useProviderProposalPhotoUrls(paths),
      { initialProps: { paths: ["z"] as string[] | null } },
    );

    await act(async () => {
      rerender({ paths: null });
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      finish("https://stale");
    });
    await waitFor(() => expect(result.current.urls).toEqual([]));
  });
});
