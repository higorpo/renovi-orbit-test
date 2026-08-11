// @vitest-environment happy-dom
import { describe, expect, it, beforeEach } from "vitest";
import {
  resolveAudienceTheme,
  syncAudienceTheme,
} from "../audienceTheme";

describe("resolveAudienceTheme", () => {
  it("maps provider to provider", () => {
    expect(resolveAudienceTheme("provider")).toBe("provider");
  });

  it("maps client and admin to client", () => {
    expect(resolveAudienceTheme("client")).toBe("client");
    expect(resolveAudienceTheme("admin")).toBe("client");
  });

  it("defaults null/undefined to client", () => {
    expect(resolveAudienceTheme(null)).toBe("client");
    expect(resolveAudienceTheme(undefined)).toBe("client");
  });
});

describe("syncAudienceTheme", () => {
  beforeEach(() => {
    delete document.documentElement.dataset.audience;
  });

  it("sets data-audience=provider for providers", () => {
    syncAudienceTheme("provider");
    expect(document.documentElement.dataset.audience).toBe("provider");
  });

  it("sets data-audience=client for clients and when logged out", () => {
    syncAudienceTheme("client");
    expect(document.documentElement.dataset.audience).toBe("client");
    syncAudienceTheme(null);
    expect(document.documentElement.dataset.audience).toBe("client");
  });
});
