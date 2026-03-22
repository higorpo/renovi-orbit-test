import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderJobQuestions } from "../useProviderJobQuestions";
import * as providerJobQuestionsApi from "../../api/providerJobQuestions.api";

vi.mock("../../api/providerJobQuestions.api", () => ({
  listProviderJobQuestions: vi.fn(),
}));

const listProviderJobQuestions = vi.mocked(
  providerJobQuestionsApi.listProviderJobQuestions,
);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useProviderJobQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch when serviceRequestId is undefined", () => {
    const { result } = renderHook(() => useProviderJobQuestions(undefined), {
      wrapper: wrapper(),
    });
    expect(listProviderJobQuestions).not.toHaveBeenCalled();
    expect(result.current.items).toEqual([]);
  });

  it("returns items on success", async () => {
    const rows = [{ id: "q1", question: "Hi" } as never];
    listProviderJobQuestions.mockResolvedValue({ data: rows, error: null });

    const { result } = renderHook(() => useProviderJobQuestions("sr-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.items).toEqual(rows));
  });

  it("isError when API fails", async () => {
    listProviderJobQuestions.mockResolvedValue({ data: null, error: "x" });

    const { result } = renderHook(() => useProviderJobQuestions("sr-1"), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
