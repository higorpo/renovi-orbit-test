import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { DashboardLayout } from "../DashboardLayout";

const useOnlineStatusMock = vi.hoisted(() => vi.fn(() => true));
const useProviderKycBlocksNavMock = vi.hoisted(() => vi.fn(() => false));
const useServiceDetailModalMock = vi.hoisted(() =>
  vi.fn(() => ({
    isOpen: false,
    isFromProviderJobs: false,
    isFromProviderMyServices: false,
    isFromClientMyServices: false,
    serviceRequestId: undefined as string | undefined,
    background: null,
  })),
);
vi.mock("@/features/auth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(),
}));

vi.mock("@/hooks/useOnlineStatus", () => ({
  useOnlineStatus: () => useOnlineStatusMock(),
}));

vi.mock("@/features/provider-jobs", () => ({
  ProviderJobsPersistentSlot: () => <div data-testid="provider-jobs-slot" />,
}));

vi.mock("@/features/my-services", () => ({
  ProviderMyServicesPersistentSlot: () => <div data-testid="provider-my-services-slot" />,
  ClientMyServicesPersistentSlot: () => <div data-testid="client-my-services-slot" />,
}));

vi.mock("@/features/view-services", () => ({
  ServiceDetailSheet: ({ serviceRequestId }: { serviceRequestId: string }) => (
    <div data-testid="service-detail-sheet">{serviceRequestId}</div>
  ),
  useServiceDetailModal: () => useServiceDetailModalMock(),
}));

vi.mock("@/features/provider-kyc", () => ({
  ProviderKycGate: ({ children }: { children: ReactNode }) => (
    <div data-testid="provider-kyc-gate">{children}</div>
  ),
  useProviderKycBlocksNav: () => useProviderKycBlocksNavMock(),
}));

vi.mock("../MobileStackTransition", () => ({
  MobileStackTransition: ({ children }: { children: ReactNode }) => (
    <div data-testid="mobile-stack-transition">{children}</div>
  ),
}));

const useAuth = vi.mocked(await import("@/features/auth").then((m) => m.useAuth));
const useBreakpointMd = vi.mocked(
  await import("@/hooks/useBreakpoint").then((m) => m.useBreakpointMd)
);

describe("DashboardLayout", () => {
  beforeEach(() => {
    useOnlineStatusMock.mockReturnValue(true);
    useProviderKycBlocksNavMock.mockReturnValue(false);
    useServiceDetailModalMock.mockReturnValue({
      isOpen: false,
      isFromProviderJobs: false,
      isFromProviderMyServices: false,
      isFromClientMyServices: false,
      serviceRequestId: undefined,
      background: null,
    });
    useAuth.mockReturnValue({
      profile: { id: "p1", role: "client", full_name: "User" },
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
  });

  it("renders desktop header with Prestway logo when useBreakpointMd is true", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const logo = screen.getByRole("img", { name: "Prestway" });
    expect(logo).toBeInTheDocument();
    const logoLink = screen.getByRole("link", { name: "Prestway" });
    expect(logoLink.getAttribute("href")).toMatch(/^\/(dashboard)?$/);
    expect(screen.getByRole("navigation", { name: "Dashboard navigation" })).toBeInTheDocument();
  });

  it("renders desktop header with logo when role is provider", () => {
    useAuth.mockReturnValue({
      profile: { id: "p1", role: "provider", full_name: "Provider" },
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole("img", { name: "Prestway" })).toBeInTheDocument();
  });

  it("renders desktop header with logo when profile is null", () => {
    useAuth.mockReturnValue({
      profile: null,
      user: null,
      loadingSession: false,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signInWithGoogle: vi.fn(),
      signUp: vi.fn(),
      signOut: vi.fn(),
      refreshProfile: vi.fn(),
      getRedirectPath: vi.fn(),
    } as ReturnType<typeof useAuth>);
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole("img", { name: "Prestway" })).toBeInTheDocument();
  });

  it("renders mobile nav when useBreakpointMd is false", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    expect(screen.getByRole("button", { name: "Abrir menu" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Navegação principal" })).toBeInTheDocument();
  });

  it("renders main with Outlet", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    expect(main.tagName).toBe("MAIN");
  });

  it("wraps provider persistent slots and outlet inside ProviderKycGate", () => {
    useBreakpointMd.mockReturnValue(true);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="/dashboard" element={<DashboardLayout />}>
            <Route index element={<p>Outlet page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    const gate = screen.getByTestId("provider-kyc-gate");
    expect(within(gate).getByTestId("provider-jobs-slot")).toBeInTheDocument();
    expect(within(gate).getByTestId("provider-my-services-slot")).toBeInTheDocument();
    expect(within(gate).getByText("Outlet page")).toBeInTheDocument();
    expect(screen.getByTestId("client-my-services-slot")).toBeInTheDocument();
    expect(within(gate).queryByTestId("client-my-services-slot")).toBeNull();
  });

  it("applies padding bottom to main on mobile so content is not under bottom nav", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>
    );
    const main = screen.getByRole("main");
    expect(main).toHaveClass("pb-20");
  });

  it("hides desktop and mobile navigation while provider KYC blocks nav", () => {
    useProviderKycBlocksNavMock.mockReturnValue(true);

    useBreakpointMd.mockReturnValue(true);
    const { unmount } = render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("navigation", { name: "Dashboard navigation" })).toBeNull();
    unmount();

    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.getByRole("main")).not.toHaveClass("pb-20");
  });

  it("hides mobile nav on a specific chat conversation route", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard/chats/chat-1"]}>
        <Routes>
          <Route path="/dashboard/chats/:chatId" element={<DashboardLayout />}>
            <Route index element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.getByRole("main")).not.toHaveClass("pb-20");
    expect(screen.getByRole("main")).toHaveClass("overflow-hidden");
  });

  it("renders stack header on mobile calendar route", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard/services/calendar"]}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardLayout />}>
            <Route path="services/calendar" element={null} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.queryByRole("button", { name: "Abrir menu" })).toBeNull();
    expect(screen.getByRole("button", { name: "Voltar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendário" })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Navegação principal" })).toBeNull();
    expect(screen.getByRole("main")).not.toHaveClass("pb-20");
  });

  it("offsets desktop header when offline", () => {
    useBreakpointMd.mockReturnValue(true);
    useOnlineStatusMock.mockReturnValue(false);

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );

    const header = screen.getByRole("banner");
    expect(header).toHaveClass("top-11");
    expect(header).not.toHaveClass("top-0");
  });

  it("renders ServiceDetailSheet when modal is open", () => {
    useBreakpointMd.mockReturnValue(true);
    useServiceDetailModalMock.mockReturnValue({
      isOpen: true,
      isFromProviderJobs: false,
      isFromProviderMyServices: false,
      isFromClientMyServices: true,
      serviceRequestId: "sr-42",
      background: null,
    });

    render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <DashboardLayout />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("service-detail-sheet")).toHaveTextContent("sr-42");
  });

  it("wraps outlet in MobileStackTransition on stack routes", () => {
    useBreakpointMd.mockReturnValue(false);
    render(
      <MemoryRouter initialEntries={["/dashboard/services/calendar"]}>
        <Routes>
          <Route path="/dashboard/*" element={<DashboardLayout />}>
            <Route path="services/calendar" element={<p>Calendar page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByTestId("mobile-stack-transition")).toBeInTheDocument();
    expect(screen.getByText("Calendar page")).toBeInTheDocument();
  });
});
