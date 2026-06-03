// @vitest-environment happy-dom
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProposalPhotoUrls } from "../useProposalPhotoUrls";
import * as proposalComposerSupportApi from "../../api/proposalComposerSupport.api";

vi.mock("../../api/proposalComposerSupport.api", () => ({
  getProposalPhotoDisplayUrl: vi.fn(),
}));

const getProposalPhotoDisplayUrl = vi.mocked(
  proposalComposerSupportApi.getProposalPhotoDisplayUrl,
);

describe("useProposalPhotoUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty urls when photos is null", () => {
    const { result } = renderHook(() => useProposalPhotoUrls(null));
    expect(result.current.urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("resolves signed URLs for storage paths", async () => {
    const photos = ["providers/u1/a.jpg", "https://cdn.example.com/x.jpg"];
    getProposalPhotoDisplayUrl.mockImplementation(async (p) =>
      p.startsWith("http") ? p : `signed:${p}`,
    );

    const { result } = renderHook(() => useProposalPhotoUrls(photos));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual([
      "signed:providers/u1/a.jpg",
      "https://cdn.example.com/x.jpg",
    ]);
  });

  it("filters out empty resolved URLs", async () => {
    getProposalPhotoDisplayUrl.mockImplementation(
      async (p) => (p === "bad" ? "" : `ok:${p}`),
    );

    const { result, rerender } = renderHook(
      ({ paths }: { paths: string[] | null }) => useProposalPhotoUrls(paths),
      { initialProps: { paths: ["good", "bad"] as string[] | null } },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["ok:good"]);

    rerender({ paths: null });
    expect(result.current.urls).toEqual([]);
  });
});
