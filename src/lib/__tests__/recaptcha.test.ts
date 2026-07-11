// @vitest-environment happy-dom
import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  getSupabaseAnonKey: vi.fn(() => "anon-key"),
}));

vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn() },
}));

import { executeRecaptcha, verifyRecaptchaToken } from "@/lib/recaptcha";
import { logger } from "@/lib/logger";

describe("executeRecaptcha", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.grecaptcha = undefined;
    document.head.innerHTML = "";
  });

  it("returns null when the site key is not configured", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    const token = await executeRecaptcha("request_quote_submit");
    expect(token).toBeNull();
  });

  it("executes grecaptcha and returns its token", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    const execute = vi.fn().mockResolvedValue("token-123");
    window.grecaptcha = {
      ready: (cb: () => void) => cb(),
      execute,
    } as any;

    const token = await executeRecaptcha("request_quote_submit");

    expect(execute).toHaveBeenCalledWith("site-key", {
      action: "request_quote_submit",
    });
    expect(token).toBe("token-123");
  });

  it("loads the Google script before executing recaptcha", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site key");
    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node) => node);

    const pending = executeRecaptcha("client_signup_submit");
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement;
    expect(script.src).toContain("render=site%20key");

    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockResolvedValue("loaded-token"),
    };
    script.onload?.(new Event("load"));

    await expect(pending).resolves.toBe("loaded-token");
    expect(appendSpy).toHaveBeenCalledWith(script);
  });

  it("returns null and logs a warning when script loading fails", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    const appendSpy = vi
      .spyOn(document.head, "appendChild")
      .mockImplementation((node) => node);

    const pending = executeRecaptcha("provider_signup_submit");
    const script = appendSpy.mock.calls[0][0] as HTMLScriptElement;
    script.onerror?.(new Event("error"));

    await expect(pending).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "recaptcha_execute_failed",
      expect.objectContaining({ action: "provider_signup_submit" }),
    );
  });

  it("returns null when grecaptcha does not return a token", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockResolvedValue(""),
    };

    await expect(executeRecaptcha("request_quote_submit")).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("waits for an existing script tag before executing", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    const existing = document.createElement("script");
    existing.id = "google-recaptcha-script";
    document.head.appendChild(existing);

    const pending = executeRecaptcha("client_signup_submit");
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockResolvedValue("existing-script-token"),
    };
    existing.dispatchEvent(new Event("load"));

    await expect(pending).resolves.toBe("existing-script-token");
  });

  it("returns null when an existing script fails to load", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    const existing = document.createElement("script");
    existing.id = "google-recaptcha-script";
    document.head.appendChild(existing);

    const pending = executeRecaptcha("client_signup_submit");
    existing.dispatchEvent(new Event("error"));

    await expect(pending).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("returns null when grecaptcha.execute throws an Error", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "site-key");
    window.grecaptcha = {
      ready: (callback) => callback(),
      execute: vi.fn().mockRejectedValue(new Error("execute failed")),
    };

    await expect(executeRecaptcha("request_quote_submit")).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      "recaptcha_execute_failed",
      expect.objectContaining({
        action: "request_quote_submit",
        error: "execute failed",
      }),
    );
  });
});

describe("verifyRecaptchaToken", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co/");
  });

  it("posts the token and returns a successful verification", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      verifyRecaptchaToken("token-123", "client_signup_submit"),
    ).resolves.toEqual({ success: true, message: undefined });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://project.supabase.co/functions/v1/verify-recaptcha",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer anon-key" }),
        body: JSON.stringify({
          token: "token-123",
          action: "client_signup_submit",
        }),
      }),
    );
  });

  it("returns the server message for a rejected verification", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockResolvedValue({ message: "Invalid token" }),
      }),
    );

    await expect(
      verifyRecaptchaToken("bad", "request_quote_submit"),
    ).resolves.toEqual({ success: false, message: "Invalid token" });
  });

  it("returns a fallback message when the response body is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: vi.fn().mockRejectedValue(new Error("invalid json")),
      }),
    );

    await expect(
      verifyRecaptchaToken("bad", "request_quote_submit"),
    ).resolves.toEqual({
      success: false,
      message: "Não foi possível validar o reCAPTCHA.",
    });
  });

  it("logs and returns a safe failure when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue("offline"));

    await expect(
      verifyRecaptchaToken("token", "provider_signup_submit"),
    ).resolves.toEqual({
      success: false,
      message: "Não foi possível validar o reCAPTCHA.",
    });
    expect(logger.error).toHaveBeenCalledWith("recaptcha_verify_failed", {
      action: "provider_signup_submit",
      error: "offline",
    });
  });

  it("throws when VITE_SUPABASE_URL is missing", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_SUPABASE_URL", "");
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      verifyRecaptchaToken("token", "client_signup_submit"),
    ).resolves.toEqual({
      success: false,
      message: "Não foi possível validar o reCAPTCHA.",
    });
    expect(logger.error).toHaveBeenCalled();
  });

  it("returns success false when the API responds ok with success=false", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: false, message: "score too low" }),
      }),
    );

    await expect(
      verifyRecaptchaToken("token", "request_quote_submit"),
    ).resolves.toEqual({ success: false, message: "score too low" });
  });
});
