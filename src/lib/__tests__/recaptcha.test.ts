import { describe, expect, it, vi, beforeEach } from "vitest";
import { executeRecaptcha } from "@/lib/recaptcha";

describe("executeRecaptcha", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    window.grecaptcha = undefined;
    document.head.innerHTML = "";
  });

  it("retorna null quando site key não está configurada", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");
    const token = await executeRecaptcha("request_quote_submit");
    expect(token).toBeNull();
  });

  it("executa o grecaptcha e retorna token", async () => {
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
});
