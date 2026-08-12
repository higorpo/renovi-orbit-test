import { describe, expect, it } from "vitest";
import { resolveMobileChrome } from "../mobileNavigation.config";

function location(pathname: string, state: unknown = null) {
  return {
    pathname,
    search: "",
    hash: "",
    state,
    key: "test",
  };
}

describe("resolveMobileChrome", () => {
  it("returns tab-root for dashboard services list path", () => {
    const chrome = resolveMobileChrome("/dashboard/services", location("/dashboard/services"));
    expect(chrome.mode).toBe("tab-root");
    expect(chrome.showTabHeader).toBe(true);
    expect(chrome.showBottomNav).toBe(true);
  });

  it("returns custom chrome for chat conversation", () => {
    const chrome = resolveMobileChrome(
      "/dashboard/chats/chat-1",
      location("/dashboard/chats/chat-1"),
    );
    expect(chrome.mode).toBe("custom");
    expect(chrome.showTabHeader).toBe(false);
    expect(chrome.showBottomNav).toBe(false);
    expect(chrome.mainOverflowHidden).toBe(true);
  });

  it("returns tab-root when service detail opens as sheet", () => {
    const chrome = resolveMobileChrome(
      "/dashboard/services/sr-1",
      location("/dashboard/services/sr-1", {
        serviceDetailPresentation: "sheet",
        background: { pathname: "/dashboard/services" },
      }),
    );
    expect(chrome.mode).toBe("tab-root");
    expect(chrome.showStackHeader).toBe(false);
  });

  it("returns stack chrome for full-page service detail", () => {
    const chrome = resolveMobileChrome(
      "/dashboard/services/sr-1",
      location("/dashboard/services/sr-1"),
    );
    expect(chrome.mode).toBe("stack");
    expect(chrome.showStackHeader).toBe(true);
    expect(chrome.stackTitle).toBe("Detalhes do serviço");
    expect(chrome.backFallback).toBe("/dashboard/services");
    expect(chrome.enableStackTransition).toBe(true);
  });

  it("returns stack chrome for help route", () => {
    const chrome = resolveMobileChrome("/dashboard/help", location("/dashboard/help"));
    expect(chrome.mode).toBe("stack");
    expect(chrome.stackTitle).toBe("Ajuda");
    expect(chrome.showBottomNav).toBe(false);
  });

  it.each([
    {
      pathname: "/dashboard/settings",
      stackTitle: "Configurações",
      backFallback: "/dashboard",
    },
    {
      pathname: "/dashboard/services/calendar",
      stackTitle: "Calendário",
      backFallback: "/dashboard/services",
    },
  ])(
    "returns stack chrome with transition for $pathname",
    ({ pathname, stackTitle, backFallback }) => {
      const chrome = resolveMobileChrome(pathname, location(pathname));
      expect(chrome.mode).toBe("stack");
      expect(chrome.stackTitle).toBe(stackTitle);
      expect(chrome.backFallback).toBe(backFallback);
      expect(chrome.enableStackTransition).toBe(true);
      expect(chrome.showBottomNav).toBe(false);
    },
  );

  it("returns tab-root for chats list path", () => {
    const chrome = resolveMobileChrome("/dashboard/chats", location("/dashboard/chats"));
    expect(chrome.mode).toBe("tab-root");
    expect(chrome.showTabHeader).toBe(true);
    expect(chrome.showBottomNav).toBe(true);
    expect(chrome.enableStackTransition).toBe(false);
  });

  it("returns tab-root for account hub index", () => {
    const chrome = resolveMobileChrome("/dashboard/account", location("/dashboard/account"));
    expect(chrome.mode).toBe("tab-root");
    expect(chrome.showBottomNav).toBe(true);
  });

  it("returns stack chrome for account section pages", () => {
    const chrome = resolveMobileChrome(
      "/dashboard/account/personal-info",
      location("/dashboard/account/personal-info"),
    );
    expect(chrome.mode).toBe("stack");
    expect(chrome.stackTitle).toBe("Informações pessoais");
    expect(chrome.backFallback).toBe("/dashboard/account");
    expect(chrome.showBottomNav).toBe(false);
  });

  it("returns hidden chrome outside dashboard", () => {
    const chrome = resolveMobileChrome("/login", location("/login"));
    expect(chrome.mode).toBe("hidden");
    expect(chrome.showTabHeader).toBe(false);
    expect(chrome.showStackHeader).toBe(false);
    expect(chrome.showBottomNav).toBe(false);
  });
});
