import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import React from "react";
import { useResetPassword } from "../useResetPassword";

const navigate = vi.fn();
const updateUserPassword = vi.fn();

vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return {
    ...actual,
    useNavigate: () => navigate,
  };
});

vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../api/auth.api", () => ({
  authApi: {
    updateUserPassword: (...args: unknown[]) => updateUserPassword(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("@/lib/sentry", () => ({
  addBreadcrumb: vi.fn(),
  metrics: { count: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));

const { useAuth } = await import("@/features/auth");

function wrapper({ children }: { children: React.ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useResetPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1" } as never,
      profile: { id: "u1", role: "client", full_name: "A" },
      getRedirectPath: () => "/dashboard/client",
    } as never);
    updateUserPassword.mockResolvedValue({ error: null });
  });

  it("recoveryMode is true when user is present", () => {
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    expect(result.current.recoveryMode).toBe(true);
  });

  it("recoveryMode is false when user is null", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      profile: null,
      getRedirectPath: () => "/login",
    } as never);
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    expect(result.current.recoveryMode).toBe(false);
  });

  it("sets errors when schema validation fails", async () => {
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(updateUserPassword).not.toHaveBeenCalled();
    expect(Object.keys(result.current.errors).length).toBeGreaterThan(0);
  });

  it("sets password error when strength invalid", async () => {
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    act(() => {
      result.current.setFormData({
        password: "123",
        confirmPassword: "123",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(result.current.errors.password).toBeDefined();
    expect(updateUserPassword).not.toHaveBeenCalled();
  });

  it("maps new password same as old error", async () => {
    updateUserPassword.mockResolvedValue({
      error: { message: "New password should be different from the old one." },
    });
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    act(() => {
      result.current.setFormData({
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(result.current.errors.password).toContain("diferente");
  });

  it("navigates to getRedirectPath when profile exists on success", async () => {
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    act(() => {
      result.current.setFormData({
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(navigate).toHaveBeenCalledWith("/dashboard/client", { replace: true });
  });

  it("navigates to /login when profile missing on success", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "u1" } as never,
      profile: null,
      getRedirectPath: () => "/x",
    } as never);
    const { result } = renderHook(() => useResetPassword(), { wrapper });
    act(() => {
      result.current.setFormData({
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(navigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
