import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MobileNav } from "../MobileNav";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";

function renderMobileNav(
  role: ProfileRole = "client",
  title?: string,
  initialEntry = "/dashboard"
) {
  const menu = getDashboardMenu(role);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileNav menu={menu} title={title} />
    </MemoryRouter>
  );
}

describe("MobileNav", () => {
  it("renders with Renovi logo in the top bar", () => {
    renderMobileNav("client");
    const logo = screen.getByRole("img", { name: "Renovi" });
    expect(logo).toBeInTheDocument();
    const logoLink = screen.getByRole("link", { name: "Renovi" });
    expect(logoLink.getAttribute("href")).toMatch(/^\/(dashboard)?$/);
  });

  it("renders with default title in sheet when title is not passed", () => {
    renderMobileNav("client");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders with custom title in sheet when title prop is passed", () => {
    renderMobileNav("client", "Área do cliente");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    expect(screen.getByText("Área do cliente")).toBeInTheDocument();
  });

  it("renders hamburger button with accessible label", () => {
    renderMobileNav("client");
    expect(
      screen.getByRole("button", { name: "Abrir menu" })
    ).toBeInTheDocument();
  });

  it("renders bottom nav with aria-label", () => {
    renderMobileNav("client");
    expect(
      screen.getByRole("navigation", { name: "Navegação principal" })
    ).toBeInTheDocument();
  });

  it("renders main items in bottom nav (client: first 4)", () => {
    renderMobileNav("client");
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Endereços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Configurações/ })).toBeInTheDocument();
  });

  it("opens sheet when hamburger is clicked and shows all menu items", async () => {
    renderMobileNav("client");
    const button = screen.getByRole("button", { name: "Abrir menu" });
    fireEvent.click(button);
    await screen.findByRole("dialog");
    expect(screen.getByRole("link", { name: /Ajuda/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
  });

  it("renders provider main items in bottom nav", () => {
    renderMobileNav("provider");
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Solicitações/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Trabalhos/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ganhos/ })).toBeInTheDocument();
  });

  it("sheet shows SheetTitle with passed title when open", async () => {
    renderMobileNav("client", "Minha Área");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Minha Área");
  });

  it("renders menu principal nav inside sheet when open", async () => {
    renderMobileNav("client");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await screen.findByRole("dialog");
    expect(
      screen.getByRole("navigation", { name: "Menu principal" })
    ).toBeInTheDocument();
  });
});
