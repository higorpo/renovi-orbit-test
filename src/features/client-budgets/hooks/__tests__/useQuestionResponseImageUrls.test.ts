import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestionResponseImageUrls } from "../useQuestionResponseImageUrls";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  getQuestionResponseImageUrl: vi.fn(),
}));

const getQuestionResponseImageUrl = vi.mocked(clientBudgetsApi.getQuestionResponseImageUrl);

describe("useQuestionResponseImageUrls", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getQuestionResponseImageUrl.mockImplementation(async (path) => `https://signed/${path}`);
  });

  it("returns empty and not loading when paths missing", () => {
    const { result } = renderHook(() => useQuestionResponseImageUrls(null));
    expect(result.current.urls).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("resolves urls for paths", async () => {
    const { result } = renderHook(() =>
      useQuestionResponseImageUrls(["a/b.jpg", "c/d.jpg"]),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["https://signed/a/b.jpg", "https://signed/c/d.jpg"]);
  });

  it("filters falsy url results", async () => {
    getQuestionResponseImageUrl.mockResolvedValueOnce("https://ok").mockResolvedValueOnce("");
    const { result } = renderHook(() => useQuestionResponseImageUrls(["p1", "p2"]));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.urls).toEqual(["https://ok"]);
  });
});
