import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useForgotPasswordForm } from "../useForgotPasswordForm";

const resetPasswordForEmail = vi.fn();

vi.mock("../../api/auth.api", () => ({
  authApi: {
    resetPasswordForEmail: (...args: unknown[]) =>
      resetPasswordForEmail(...args),
  },
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

describe("useForgotPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        origin: "https://app.test",
      },
      writable: true,
    });
  });

  it("sets email error when validation fails", async () => {
    const { result } = renderHook(() => useForgotPasswordForm());
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(resetPasswordForEmail).not.toHaveBeenCalled();
    expect(result.current.errors.email).toBeDefined();
  });

  it("sets API error message when resetPasswordForEmail returns error", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { message: "rate limit" },
    });
    const { result } = renderHook(() => useForgotPasswordForm());
    act(() => {
      result.current.setFormData({ email: "u@test.com" });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(result.current.errors.email).toContain("Não foi possível enviar");
    expect(result.current.sent).toBe(false);
  });

  it("sets sent true on success", async () => {
    resetPasswordForEmail.mockResolvedValue({ error: null });
    const { result } = renderHook(() => useForgotPasswordForm());
    act(() => {
      result.current.setFormData({ email: "u@test.com" });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(result.current.sent).toBe(true);
    expect(resetPasswordForEmail).toHaveBeenCalledWith(
      "u@test.com",
      "https://app.test/recuperar-senha"
    );
  });
});
