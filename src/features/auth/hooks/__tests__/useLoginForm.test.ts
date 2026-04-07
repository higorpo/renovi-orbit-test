import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLoginForm } from "../useLoginForm";

vi.mock("../../utils/persistSession", () => ({
  getPersistSession: vi.fn(() => true),
  setPersistSession: vi.fn(),
}));

const { getPersistSession, setPersistSession } = await import(
  "../../utils/persistSession"
);

describe("useLoginForm", () => {
  const signIn = vi.fn().mockResolvedValue(undefined);
  const signInWithGoogle = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPersistSession).mockReturnValue(true);
    signIn.mockResolvedValue(undefined);
    signInWithGoogle.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads rememberMe from persist session on mount", () => {
    vi.mocked(getPersistSession).mockReturnValue(false);
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    expect(result.current.rememberMe).toBe(false);
  });

  it("sets field errors when validation fails on submit", async () => {
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(signIn).not.toHaveBeenCalled();
    expect(result.current.errors.email).toBeDefined();
    expect(result.current.submitting).toBe(false);
  });

  it("calls setPersistSession and signIn on valid submit", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    act(() => {
      result.current.setFormData({
        email: "a@b.com",
        password: "secret123",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(setPersistSession).toHaveBeenCalledWith(true);
    expect(signIn).toHaveBeenCalledWith("a@b.com", "secret123");
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(result.current.submitting).toBe(false);
  });

  it("sets submitting false when signIn throws", async () => {
    signIn.mockRejectedValueOnce(new Error("bad"));
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    act(() => {
      result.current.setFormData({
        email: "a@b.com",
        password: "secret123",
      });
    });
    await act(async () => {
      await result.current.handleSubmit({
        preventDefault: vi.fn(),
      } as unknown as React.FormEvent);
    });
    expect(result.current.submitting).toBe(false);
  });

  it("calls signInWithGoogle and setPersistSession on handleGoogleLogin", async () => {
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    await act(async () => {
      await result.current.handleGoogleLogin();
    });
    expect(setPersistSession).toHaveBeenCalled();
    expect(signInWithGoogle).toHaveBeenCalled();
  });

  it("sets submitting false when signInWithGoogle throws", async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error("oauth"));
    const { result } = renderHook(() =>
      useLoginForm({ signIn, signInWithGoogle })
    );
    await act(async () => {
      await result.current.handleGoogleLogin();
    });
    expect(result.current.submitting).toBe(false);
  });
});
