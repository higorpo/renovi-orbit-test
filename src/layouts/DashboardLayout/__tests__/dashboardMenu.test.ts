import { describe, it, expect } from "vitest";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";

describe("getDashboardMenu", () => {
  it("returns client menu with 4 main items and 5 all items", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    expect(result.mainItems).toHaveLength(4);
    expect(result.allItems).toHaveLength(5);
    expect(result.mainItems).toEqual(result.allItems.slice(0, 4));
  });

  it("returns client allItems with expected paths and labels", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    const paths = result.allItems.map((i) => i.path);
    const labels = result.allItems.map((i) => i.label);
    expect(paths).toEqual([
      "/dashboard",
      "/dashboard/requests",
      "/dashboard/addresses",
      "/dashboard/settings",
      "/dashboard/help",
    ]);
    expect(labels).toContain("Visão geral");
    expect(labels).toContain("Meus Serviços");
    expect(labels).toContain("Endereços");
    expect(labels).toContain("Configurações");
    expect(labels).toContain("Ajuda");
  });

  it("returns client menu items with icon property", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    result.allItems.forEach((item) => {
      expect(item).toHaveProperty("icon");
      expect(item.icon).toBeDefined();
      expect(typeof item.icon === "function" || typeof item.icon === "object").toBe(true);
    });
  });

  it("returns provider menu with 4 main items and 6 all items", () => {
    const result = getDashboardMenu("provider" as ProfileRole);
    expect(result.mainItems).toHaveLength(4);
    expect(result.allItems).toHaveLength(6);
    expect(result.mainItems).toEqual(result.allItems.slice(0, 4));
  });

  it("returns provider allItems with expected paths and labels", () => {
    const result = getDashboardMenu("provider" as ProfileRole);
    const paths = result.allItems.map((i) => i.path);
    const labels = result.allItems.map((i) => i.label);
    expect(paths).toEqual([
      "/dashboard",
      "/dashboard/requests",
      "/dashboard/jobs",
      "/dashboard/earnings",
      "/dashboard/settings",
      "/dashboard/help",
    ]);
    expect(labels).toContain("Visão geral");
    expect(labels).toContain("Solicitações");
    expect(labels).toContain("Trabalhos");
    expect(labels).toContain("Ganhos");
    expect(labels).toContain("Configurações");
    expect(labels).toContain("Ajuda");
  });

  it("returns provider menu items with icon property", () => {
    const result = getDashboardMenu("provider" as ProfileRole);
    result.allItems.forEach((item) => {
      expect(item).toHaveProperty("icon");
      expect(item.icon).toBeDefined();
      expect(typeof item.icon === "function" || typeof item.icon === "object").toBe(true);
    });
  });
});
