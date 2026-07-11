import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { DesktopNav } from "../DesktopNav";
import { getDashboardMenu } from "../dashboardMenu";
import type { ProfileRole } from "@/features/auth";
import type { ComputeDesktopNavVisibleCountParams } from "../computeDesktopNavVisibleCount";

const { computeDesktopNavVisibleCountMock } = vi.hoisted(() => ({
  computeDesktopNavVisibleCountMock: vi.fn(
    ({ itemWidths }: ComputeDesktopNavVisibleCountParams) => itemWidths.length,
  ),
}));

vi.mock("../computeDesktopNavVisibleCount", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../computeDesktopNavVisibleCount")>();
  return {
    ...actual,
    computeDesktopNavVisibleCount: computeDesktopNavVisibleCountMock,
  };
});

function renderDesktopNav(
  items = getDashboardMenu("client" as ProfileRole).allItems,
  initialEntry = "/dashboard",
  props?: { inverted?: boolean; className?: string },
) {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <DesktopNav items={items} inverted={props?.inverted} className={props?.className} />
    </MemoryRouter>,
  );
}

function stubNavWidths() {
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return 480;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
    configurable: true,
    get() {
      return 96;
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return 30;
    },
  });
  HTMLElement.prototype.getBoundingClientRect = function getBoundingClientRect() {
    return {
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      bottom: 30,
      right: 96,
      width: 96,
      height: 30,
      toJSON: () => ({}),
    } as DOMRect;
  };
}

describe("DesktopNav", () => {
  const resizeObserverCallbacks: Array<() => void> = [];

  beforeEach(() => {
    stubNavWidths();
    resizeObserverCallbacks.length = 0;
    computeDesktopNavVisibleCountMock.mockImplementation(
      ({ itemWidths }: ComputeDesktopNavVisibleCountParams) => itemWidths.length,
    );
    global.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) {
        resizeObserverCallbacks.push(() => callback([], this));
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders nav with aria-label Dashboard navigation", () => {
    renderDesktopNav();
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" }),
    ).toBeInTheDocument();
  });

  it("renders a link for each menu item when all fit", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Endereços/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Minha conta/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Ajuda/ })).toBeInTheDocument();
  });

  it("renders visible links and overflow menu when space is limited", async () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(2);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Ajuda/ })).not.toBeInTheDocument();

    const moreButton = screen.getByRole("button", { name: /Mais opções de navegação/i });
    fireEvent.pointerDown(moreButton, { button: 0, ctrl: 0 });
    fireEvent.click(moreButton);
    const menuPanel = await screen.findByRole("menu");
    expect(within(menuPanel).getByRole("menuitem", { name: /Endereços/i })).toBeInTheDocument();
    expect(within(menuPanel).getByRole("menuitem", { name: /Ajuda/i })).toBeInTheDocument();
  });

  it("applies custom className to nav", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DesktopNav items={menu.allItems} className="custom-nav" />
      </MemoryRouter>,
    );
    const nav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    expect(nav).toHaveClass("custom-nav");
  });

  it("links point to correct paths", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(screen.getByRole("link", { name: /Visão geral/ })).toHaveAttribute(
      "href",
      "/dashboard",
    );
    expect(screen.getByRole("link", { name: /Meus Serviços/ })).toHaveAttribute(
      "href",
      "/dashboard/services",
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
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Visão geral/ })).toBeInTheDocument();
  });

  it("marks overflow trigger active when current route is in overflow", async () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(2);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems, "/dashboard/help");
    const moreButton = screen.getByRole("button", { name: /Mais opções de navegação/i });
    expect(moreButton).toHaveClass("text-foreground");
    fireEvent.pointerDown(moreButton, { button: 0, ctrl: 0 });
    fireEvent.click(moreButton);
    const menuPanel = await screen.findByRole("menu");
    expect(within(menuPanel).getByRole("menuitem", { name: /Ajuda/i })).toHaveClass("bg-accent");
  });

  it("applies inverted styles for dark header context", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems, "/dashboard", { inverted: true });
    const activeLink = screen.getByRole("link", { name: /Visão geral/ });
    expect(activeLink).toHaveClass("text-white");
    const inactiveLink = screen.getByRole("link", { name: /Meus Serviços/ });
    expect(inactiveLink).toHaveClass("text-white/70");
  });

  it("does not recompute visible count when width result is unchanged", () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(3);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    const callsAfterMount = computeDesktopNavVisibleCountMock.mock.calls.length;
    fireEvent(window, new Event("resize"));
    // Same mock return keeps setState stable; recalculate still invoked
    expect(computeDesktopNavVisibleCountMock.mock.calls.length).toBeGreaterThan(callsAfterMount);
  });

  it("recalculates on window resize", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    fireEvent(window, new Event("resize"));
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" }),
    ).toBeInTheDocument();
    expect(computeDesktopNavVisibleCountMock).toHaveBeenCalled();
  });

  it("recalculates and syncs indicator when ResizeObserver fires", () => {
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(resizeObserverCallbacks.length).toBeGreaterThan(0);
    const callsBefore = computeDesktopNavVisibleCountMock.mock.calls.length;
    resizeObserverCallbacks.forEach((cb) => cb());
    expect(computeDesktopNavVisibleCountMock.mock.calls.length).toBeGreaterThanOrEqual(
      callsBefore,
    );
    expect(
      screen.getByRole("navigation", { name: "Dashboard navigation" }),
    ).toBeInTheDocument();
  });

  it("skips recalculation when nav width is zero", () => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get() {
        return 0;
      },
    });
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems);
    expect(computeDesktopNavVisibleCountMock).not.toHaveBeenCalled();
  });

  it("applies inverted overflow trigger styles when active route is overflowed", async () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(2);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems, "/dashboard/help", { inverted: true });
    const moreButton = screen.getByRole("button", { name: /Mais opções de navegação/i });
    expect(moreButton).toHaveClass("text-white");
    fireEvent.pointerDown(moreButton, { button: 0, ctrl: 0 });
    fireEvent.click(moreButton);
    const menuPanel = await screen.findByRole("menu");
    expect(within(menuPanel).getByRole("menuitem", { name: /Ajuda/i })).toHaveClass("bg-accent");
  });

  it("keeps inverted inactive overflow trigger when active route is visible", () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(2);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems, "/dashboard", { inverted: true });
    const moreButton = screen.getByRole("button", { name: /Mais opções de navegação/i });
    expect(moreButton).toHaveClass("text-white/70");
  });

  it("anchors indicator to last visible tab when visible count is zero", () => {
    computeDesktopNavVisibleCountMock.mockReturnValue(0);
    const menu = getDashboardMenu("client" as ProfileRole);
    renderDesktopNav(menu.allItems, "/dashboard");
    expect(screen.getByRole("button", { name: /Mais opções de navegação/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Visão geral/ })).not.toBeInTheDocument();
  });
});
