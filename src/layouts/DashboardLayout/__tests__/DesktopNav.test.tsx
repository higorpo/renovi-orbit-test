import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DesktopNav } from "../DesktopNav";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";

function renderDesktopNav(
  items = getDashboardMenu("client" as ProfileRole).allItems,
  initialEntry = "/dashboard"
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesktopNav items={items} />
    </MemoryRouter>
  );
}

describe("DesktopNav", () => {
  it("renders nav with aria-label Dashboard navigation", () => {
    renderDesktopNav();
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" })
    ).toBeInTheDocument();
  });

  it("renders a link for each menu item", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Endereços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Minha conta/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajuda/ })).toBeInTheDocument();
  });

  it("applies custom className to nav", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DesktopNav items={menu.allItems} className="custom-nav" />
      </MemoryRouter>
    );
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav).toHaveClass("custom-nav");
  });

  it("links point to correct paths", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toHaveAttribute(
      "href",
      "/dashboard"
    );
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toHaveAttribute(
      "href",
      "/dashboard/services"
    );
  });

  it("renders with provider menu items when given provider items", () => {
    const menu = getDashboardMenu("provider" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trabalhos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ganhos/ })).toBeInTheDocument();
  });

  it("renders with empty items array", () => {
    renderDesktopNav([]);
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("uses group-hover for inactive nav link text", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    const link = screen.getByRole("link", { name: /Meus Serviços/ });
    expect(link).toHaveClass("group-hover:text-foreground");
    expect(link.closest(".group")).toBeInTheDocument();
  });

  it("renders when current location does not match any item (resolvedActiveIndex fallback)", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    render(
      <MemoryRouter initialEntries={["/other"]}>
        <DesktopNav items={menu.allItems} />
      </MemoryRouter>
    );
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
  });
});
