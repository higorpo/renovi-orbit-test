// @vitest-environment happy-dom
import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useQuestionResponseComposer } from "../useQuestionResponseComposer";
import * as clientBudgetsApi from "../../api/clientBudgets.api";

vi.mock("../../api/clientBudgets.api", () => ({
  uploadQuestionResponseImages: vi.fn(),
  respondClientBudgetQuestion: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

const uploadQuestionResponseImages = vi.mocked(clientBudgetsApi.uploadQuestionResponseImages);
const respondClientBudgetQuestion = vi.mocked(clientBudgetsApi.respondClientBudgetQuestion);

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

describe("useQuestionResponseComposer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadQuestionResponseImages.mockResolvedValue({ paths: [], error: null });
    respondClientBudgetQuestion.mockResolvedValue({ error: null, data: null });
  });

  it("canSubmit requires non-empty trimmed text", () => {
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    expect(result.current.canSubmit).toBe(false);
    act(() => {
      result.current.setResponseText("   ");
    });
    expect(result.current.canSubmit).toBe(false);
    act(() => {
      result.current.setResponseText("ok");
    });
    expect(result.current.canSubmit).toBe(true);
  });

  it("onSelectImages no-ops for null or empty file list", () => {
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    act(() => {
      result.current.onSelectImages(null);
    });
    expect(result.current.selectedImages).toHaveLength(0);
    act(() => {
      const dt = new DataTransfer();
      result.current.onSelectImages(dt.files);
    });
    expect(result.current.selectedImages).toHaveLength(0);
  });

  it("onSelectImages appends files up to max", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    const files = Array.from({ length: 6 }, (_, i) => new File([`${i}`], `p${i}.png`, { type: "image/png" }));
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    act(() => {
      result.current.onSelectImages(dt.files);
    });
    expect(toast.error).toHaveBeenCalled();
    expect(result.current.selectedImages.length).toBe(0);

    const dt2 = new DataTransfer();
    dt2.items.add(files[0]);
    act(() => {
      result.current.onSelectImages(dt2.files);
    });
    expect(result.current.selectedImages).toHaveLength(1);
  });

  it("removeImage drops index", () => {
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    const f1 = new File(["a"], "a.png", { type: "image/png" });
    const f2 = new File(["b"], "b.png", { type: "image/png" });
    act(() => {
      result.current.onSelectImages(
        (() => {
          const d = new DataTransfer();
          d.items.add(f1);
          d.items.add(f2);
          return d.files;
        })(),
      );
    });
    act(() => {
      result.current.removeImage(0);
    });
    expect(result.current.selectedImages).toHaveLength(1);
  });

  it("submit returns false when upload fails", async () => {
    const { toast } = await import("sonner");
    uploadQuestionResponseImages.mockResolvedValue({ paths: [], error: "upload bad" });
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    act(() => {
      result.current.setResponseText("hello");
    });
    let ok: boolean;
    await act(async () => {
      ok = await result.current.submit();
    });
    expect(ok!).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("upload bad");
  });

  it("submit succeeds and clears state", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    act(() => {
      result.current.setResponseText("answer");
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(respondClientBudgetQuestion).toHaveBeenCalledWith({
      questionId: "q-1",
      response: "answer",
      imagePaths: [],
    });
    expect(toast.success).toHaveBeenCalled();
    expect(result.current.responseText).toBe("");
    expect(result.current.selectedImages).toEqual([]);
  });

  it("submit returns false when respond API errors", async () => {
    const { toast } = await import("sonner");
    respondClientBudgetQuestion.mockResolvedValue({ error: "rpc fail", data: null });
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    act(() => {
      result.current.setResponseText("x");
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(toast.error).toHaveBeenCalledWith("rpc fail");
  });

  it("submit shows toast when text empty", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    await act(async () => {
      await result.current.submit();
    });
    expect(toast.error).toHaveBeenCalled();
  });

  it("submit shows toast when text too long", async () => {
    const { toast } = await import("sonner");
    const { result } = renderHook(
      () => useQuestionResponseComposer("sr-1", "q-1"),
      { wrapper: wrapper() },
    );
    act(() => {
      result.current.setResponseText("x".repeat(1001));
    });
    await act(async () => {
      await result.current.submit();
    });
    expect(toast.error).toHaveBeenCalled();
  });
});
