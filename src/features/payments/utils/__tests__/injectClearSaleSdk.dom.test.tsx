// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { injectClearSaleSdk } from "../injectClearSaleSdk";

describe("injectClearSaleSdk browser defaults", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    delete (window as Window & { csdp?: unknown }).csdp;
  });

  it("uses document/window defaults and cleans up", () => {
    const csdp = vi.fn();
    (window as Window & { csdp?: typeof csdp }).csdp = csdp;

    const cleanup = injectClearSaleSdk({
      sessionId: "session-dom",
      appKey: "app-key",
    });

    const script = document.head.querySelector("script");
    expect(script?.src).toContain("device.clearsale.com.br/p/fp.js");

    script?.dispatchEvent(new Event("load"));
    expect(csdp).toHaveBeenCalledWith("app", "app-key");
    expect(csdp).toHaveBeenCalledWith("sessionid", "session-dom");

    cleanup();
    expect(document.head.querySelector("script")).toBeNull();
  });
});
