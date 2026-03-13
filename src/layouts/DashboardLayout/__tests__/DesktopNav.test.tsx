import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    expect(screen.getByRole("link", { name: /Meus pedidos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Endereços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurações/ })).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: /Meus pedidos/ })).toHaveAttribute(
      "href",
      "/dashboard/requests"
    );
  });

  it("renders with provider menu items when given provider items", () => {
    const menu = getDashboardMenu("provider" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Solicitações/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trabalhos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ganhos/ })).toBeInTheDocument();
  });

  it("renders with empty items array", () => {
    renderDesktopNav([]);
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("responds to mouse enter and leave on nav items", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    const link = screen.getByRole("link", { name: /Visão geral/ });
    const wrapper = link.closest("div.flex.items-center");
    expect(wrapper).toBeInTheDocument();
    if (wrapper) {
      fireEvent.mouseEnter(wrapper);
      fireEvent.mouseLeave(wrapper);
    }
    expect(link).toBeInTheDocument();
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
