import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSignupForm } from "../useSignupForm";

const signUp = vi.fn();
const signInWithGoogle = vi.fn();

vi.mock("../useAuth", () => ({
  useAuth: () => ({
    signUp,
    signInWithGoogle,
  }),
}));

const executeRecaptcha = vi.fn();
const verifyRecaptchaToken = vi.fn();

vi.mock("@/lib/recaptcha", () => ({
  executeRecaptcha: (...a: unknown[]) => executeRecaptcha(...a),
  verifyRecaptchaToken: (...a: unknown[]) => verifyRecaptchaToken(...a),
}));

describe("useSignupForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { origin: "https://app.test" },
      writable: true,
    });
    executeRecaptcha.mockResolvedValue("token");
    verifyRecaptchaToken.mockResolvedValue({ success: true });
    signUp.mockResolvedValue({ success: true, userId: "new" });
    signInWithGoogle.mockResolvedValue(undefined);
  });

  it("validateStep 0 fails on invalid full name", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({ ...p, fullName: "A", email: "a@b.com" }));
    });
    act(() => {
      expect(result.current.validateStep(0)).toBe(false);
    });
    expect(result.current.errors.fullName).toBeDefined();
  });

  it("validateStep 0 fails on invalid email", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "not-email",
      }));
    });
    act(() => {
      expect(result.current.validateStep(0)).toBe(false);
    });
    expect(result.current.errors.email).toContain("inválido");
  });

  it("validateStep 1 fails on weak password", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        password: "short",
        confirmPassword: "short",
      }));
    });
    act(() => {
      expect(result.current.validateStep(1)).toBe(false);
    });
    expect(result.current.errors.password).toBeDefined();
  });

  it("validateStep 1 fails when passwords mismatch", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!other",
      }));
    });
    act(() => {
      expect(result.current.validateStep(1)).toBe(false);
    });
    expect(result.current.errors.confirmPassword).toBeDefined();
  });

  it("handleNext advances when validateStep passes", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
      }));
    });
    act(() => {
      result.current.handleNext();
    });
    expect(result.current.currentStep).toBe(1);
  });

  it("handleBack decreases step", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
      }));
    });
    act(() => result.current.handleNext());
    act(() => result.current.handleBack());
    expect(result.current.currentStep).toBe(0);
  });

  it("handleSubmit requires terms", async () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
        termsAccepted: false,
      }));
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.termsAccepted).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("handleSubmit stops when recaptcha token missing", async () => {
    executeRecaptcha.mockResolvedValue("");
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
        termsAccepted: true,
      }));
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.recaptcha).toBeDefined();
    expect(signUp).not.toHaveBeenCalled();
  });

  it("handleSubmit stops when verifyRecaptchaToken fails", async () => {
    verifyRecaptchaToken.mockResolvedValue({
      success: false,
      message: "bot",
    });
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
        termsAccepted: true,
      }));
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.recaptcha).toBe("bot");
  });

  it("handleSubmit calls signUp and sets signupSuccess", async () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "provider",
        onboardingPath: "/onboarding/provider",
        recaptchaAction: "provider_signup_submit",
      })
    );
    act(() => {
      result.current.setFormData((p) => ({
        ...p,
        fullName: "Ab Cd",
        email: "a@b.com",
        password: "Str0ng!pass",
        confirmPassword: "Str0ng!pass",
        termsAccepted: true,
      }));
    });
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(signUp).toHaveBeenCalledWith(
      "a@b.com",
      "Str0ng!pass",
      "Ab Cd",
      "provider",
      { emailRedirectTo: "https://app.test/onboarding/provider" }
    );
    expect(result.current.signupSuccess).toBe(true);
  });

  it("getEmailRedirectTo uses onboarding path", () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/x",
        recaptchaAction: "client_signup_submit",
      })
    );
    expect(result.current.getEmailRedirectTo()).toBe("https://app.test/x");
  });

  it("handleGoogleSignup calls signInWithGoogle with redirect", async () => {
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    await act(async () => {
      await result.current.handleGoogleSignup();
    });
    expect(signInWithGoogle).toHaveBeenCalledWith(
      "https://app.test/onboarding/client"
    );
  });

  it("handleGoogleSignup clears submitting on error", async () => {
    signInWithGoogle.mockRejectedValueOnce(new Error("fail"));
    const { result } = renderHook(() =>
      useSignupForm({
        role: "client",
        onboardingPath: "/onboarding/client",
        recaptchaAction: "client_signup_submit",
      })
    );
    await act(async () => {
      await result.current.handleGoogleSignup();
    });
    expect(result.current.submitting).toBe(false);
  });
});
