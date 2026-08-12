import { describe, expect, it } from "vitest";
import { getSettingsNavItems, isSettingsNavLink } from "../settingsNav";

describe("getSettingsNavItems", () => {
  it("puts Conta after Privacidade and logout in the footer for both roles", () => {
    for (const role of ["client", "provider"] as const) {
      const items = getSettingsNavItems(role);
      const labels = items.map((item) => item.label);
      expect(labels.indexOf("Privacidade")).toBeLessThan(labels.indexOf("Conta"));
      expect(labels.indexOf("Conta")).toBeLessThan(labels.indexOf("Sair da conta"));

      const conta = items.find((item) => isSettingsNavLink(item) && item.slug === "session");
      expect(conta?.footer).toBeFalsy();
      expect(conta && isSettingsNavLink(conta) ? conta.icon.displayName : null).toBe("UserCog");

      const logout = items.find((item) => item.kind === "logout");
      expect(logout?.footer).toBe(true);
      expect(logout?.label).toBe("Sair da conta");
    }
  });
});
