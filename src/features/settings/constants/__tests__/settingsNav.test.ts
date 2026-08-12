import { describe, expect, it } from "vitest";
import { getSettingsNavItems, isSettingsNavLink } from "../settingsNav";

describe("getSettingsNavItems", () => {
  it("puts Jurídico after Privacidade, Conta after Jurídico, and logout in the footer", () => {
    for (const role of ["client", "provider"] as const) {
      const items = getSettingsNavItems(role);
      const labels = items.map((item) => item.label);
      expect(labels.indexOf("Privacidade")).toBeLessThan(labels.indexOf("Jurídico"));
      expect(labels.indexOf("Jurídico")).toBeLessThan(labels.indexOf("Conta"));
      expect(labels.indexOf("Conta")).toBeLessThan(labels.indexOf("Sair da conta"));

      const juridico = items.find((item) => isSettingsNavLink(item) && item.slug === "legal");
      expect(juridico && isSettingsNavLink(juridico) ? juridico.icon.displayName : null).toBe(
        "Scale",
      );

      const conta = items.find((item) => isSettingsNavLink(item) && item.slug === "session");
      expect(conta?.footer).toBeFalsy();
      expect(conta && isSettingsNavLink(conta) ? conta.icon.displayName : null).toBe("UserCog");

      const logout = items.find((item) => item.kind === "logout");
      expect(logout?.footer).toBe(true);
      expect(logout?.label).toBe("Sair da conta");
    }
  });

  it("keeps a single Ganhos item for providers and omits Recebimentos", () => {
    const labels = getSettingsNavItems("provider")
      .filter(isSettingsNavLink)
      .map((item) => item.label);

    expect(labels).toContain("Ganhos");
    expect(labels).not.toContain("Recebimentos");
    expect(labels.filter((label) => label === "Ganhos")).toHaveLength(1);
  });

  it("lists Dados bancários for providers only, before Ganhos", () => {
    const providerLabels = getSettingsNavItems("provider")
      .filter(isSettingsNavLink)
      .map((item) => item.label);
    const clientLabels = getSettingsNavItems("client")
      .filter(isSettingsNavLink)
      .map((item) => item.label);

    expect(providerLabels).toContain("Dados bancários");
    expect(clientLabels).not.toContain("Dados bancários");
    expect(providerLabels.indexOf("Dados bancários")).toBeLessThan(providerLabels.indexOf("Ganhos"));

    const payout = getSettingsNavItems("provider").find(
      (item) => isSettingsNavLink(item) && item.slug === "payout-methods",
    );
    expect(payout && isSettingsNavLink(payout) ? payout.path : null).toBe(
      "/dashboard/settings/payout-methods",
    );
  });
});
