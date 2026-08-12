import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { MobileTabHeader } from "../MobileTabHeader";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";

function renderHeader(
  props?: { title?: string; isOffline?: boolean },
  initialEntry = "/dashboard"
) {
  const menu = getDashboardMenu("client" as ProfileRole);
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <MobileTabHeader menu={menu} title={props?.title} isOffline={props?.isOffline} />
    </MemoryRouter>
  );
}

describe("MobileTabHeader", () => {
  it("renders sticky header with Prestway logo link", () => {
    renderHeader();
    expect(screen.getByTestId("mobile-tab-header")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prestway" })).toHaveAttribute("href", "/dashboard");
  });

  it("uses the client logo palette by default", () => {
    renderHeader();
    const paths = screen.getByRole("img", { name: "Prestway" }).querySelectorAll("path");
    expect(paths[0]).toHaveAttribute("fill", "#2D89F0");
    expect(paths[1]).toHaveAttribute("fill", "#2563EB");
  });

  it("uses the provider logo palette when logoVariant is provider", () => {
    const menu = getDashboardMenu("provider" as ProfileRole);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <MobileTabHeader menu={menu} logoVariant="provider" />
      </MemoryRouter>
    );
    const paths = screen.getByRole("img", { name: "Prestway" }).querySelectorAll("path");
    expect(paths[0]).toHaveAttribute("fill", "#FA8432");
    expect(paths[1]).toHaveAttribute("fill", "#F97316");
  });

  it("offsets sticky top when offline banner is present", () => {
    renderHeader({ isOffline: true });
    expect(screen.getByTestId("mobile-tab-header")).toHaveClass("top-11");
  });

  it("uses top-0 when online", () => {
    renderHeader({ isOffline: false });
    expect(screen.getByTestId("mobile-tab-header")).toHaveClass("top-0");
  });

  it("opens sheet with custom title and closes after nav click", async () => {
    renderHeader({ title: "Área do cliente" });
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Área do cliente");
    expect(screen.getByRole("navigation", { name: "Menu principal" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: /Configurações/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("highlights active dashboard link with end match", async () => {
    renderHeader(undefined, "/dashboard");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await screen.findByRole("dialog");
    const overview = screen.getByRole("link", { name: /Visão geral/ });
    expect(overview).toHaveClass("bg-primary/10");
  });

  it("keeps inactive sheet links without primary highlight", async () => {
    renderHeader(undefined, "/dashboard/settings");
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    await screen.findByRole("dialog");
    const overview = screen.getByRole("link", { name: /Visão geral/ });
    expect(overview).toHaveClass("text-foreground");
    expect(overview).not.toHaveClass("bg-primary/10");
    expect(screen.getByRole("link", { name: /Configurações/ })).toHaveClass("bg-primary/10");
  });

  it("uses default Dashboard sheet title when title prop is omitted", async () => {
    renderHeader();
    fireEvent.click(screen.getByRole("button", { name: "Abrir menu" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent("Dashboard");
  });
});
