import { describe, it, expect } from "vitest";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";

describe("getDashboardMenu", () => {
  it("returns client menu with 5 main items and 5 all items", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    expect(result.mainItems).toHaveLength(5);
    expect(result.allItems).toHaveLength(5);
    expect(result.mainItems).toEqual(result.allItems.slice(0, 5));
  });

  it("returns client allItems with expected paths and labels", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    const paths = result.allItems.map((i) => i.path);
    const labels = result.allItems.map((i) => i.label);
    expect(paths).toEqual([
      "/dashboard",
      "/dashboard/services",
      "/dashboard/chats",
      "/dashboard/settings",
      "/dashboard/help",
    ]);
    expect(labels).toContain("Visão geral");
    expect(labels).toContain("Meus Serviços");
    expect(labels).toContain("Conversas");
    expect(labels).toContain("Configurações");
    expect(labels).toContain("Ajuda");
    expect(labels).not.toContain("Endereços");
  });

  it("returns client menu items with icon property", () => {
    const result = getDashboardMenu("client" as ProfileRole);
    result.allItems.forEach((item) => {
      expect(item).toHaveProperty("icon");
      expect(item.icon).toBeDefined();
      expect(typeof item.icon === "function" || typeof item.icon === "object").toBe(true);
    });
  });

  it("returns provider menu with 5 main items and 6 all items", () => {
    const result = getDashboardMenu("provider" as ProfileRole);
    expect(result.mainItems).toHaveLength(5);
    expect(result.allItems).toHaveLength(6);
    expect(result.mainItems).toEqual(result.allItems.slice(0, 5));
  });

  it("returns provider allItems with expected paths and labels", () => {
    const result = getDashboardMenu("provider" as ProfileRole);
    const paths = result.allItems.map((i) => i.path);
    const labels = result.allItems.map((i) => i.label);
    expect(paths).toEqual([
      "/dashboard",
      "/dashboard/services",
      "/dashboard/jobs",
      "/dashboard/chats",
      "/dashboard/settings",
      "/dashboard/help",
    ]);
    expect(labels).toContain("Visão geral");
    expect(labels).toContain("Meus Serviços");
    expect(labels).toContain("Trabalhos");
    expect(labels).toContain("Conversas");
    expect(labels).toContain("Configurações");
    expect(labels).toContain("Ajuda");
    expect(labels).not.toContain("Ganhos");
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
