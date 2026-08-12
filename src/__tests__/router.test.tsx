import { beforeAll, describe, expect, it, vi } from "vitest";
import type { RouteObject } from "react-router";

const { lazyFactories } = vi.hoisted(() => ({
  lazyFactories: [] as Array<() => Promise<{ default: React.ComponentType }>>,
}));

vi.mock("react", async (importOriginal) => {
  const React = await importOriginal<typeof import("react")>();
  return {
    ...React,
    // Execute lazy factories eagerly so route module loaders are covered.
    lazy: (factory: () => Promise<{ default: React.ComponentType }>) => {
      lazyFactories.push(factory);
      return function LazyStub() {
        return null;
      };
    },
  };
});

vi.mock("@/layouts/RootLayout", () => ({
  RootLayout: () => null,
}));

vi.mock("@/components/RouterErrorBoundary", () => ({
  RouterErrorBoundary: () => null,
}));

vi.mock("@/features/auth", () => ({
  GuestOnlyRoute: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  ProtectedRoute: ({
    children,
    allowedRoles,
  }: {
    children: React.ReactNode;
    allowedRoles?: string[];
  }) => (
    <div data-testid="protected-route" data-roles={(allowedRoles ?? []).join(",")}>
      {children}
    </div>
  ),
}));

vi.mock("@/features/my-services/components/client/ClientServiceCardShowcasePage", () => ({
  ClientServiceCardShowcasePage: () => null,
}));

vi.mock("@/features/my-services/components/provider/ProviderServiceCardShowcasePage", () => ({
  ProviderServiceCardShowcasePage: () => null,
}));

vi.mock("@/features/dynamic-form", () => ({
  FormDemoPage: () => null,
}));

// Lightweight stubs for other lazy route modules so factories resolve in tests.
vi.mock("./App", () => ({ default: () => null }));
vi.mock("./features/auth/components/Login/Login", () => ({ default: () => null }));
vi.mock("./features/auth/components/ClientSignup/ClientSignup", () => ({ default: () => null }));
vi.mock("./features/auth/components/ProviderSignup/ProviderSignup", () => ({ default: () => null }));
vi.mock("./features/auth/components/ForgotPassword/ForgotPassword", () => ({ default: () => null }));
vi.mock("./features/auth/components/ResetPassword/ResetPassword", () => ({ default: () => null }));
vi.mock("@/features/request-quote/components/RequestQuote/RequestQuote", () => ({
  RequestQuote: () => null,
}));
vi.mock("@/layouts/DashboardLayout/DashboardLayout", () => ({ DashboardLayout: () => null }));
vi.mock("@/layouts/DashboardLayout/DashboardFakePage", () => ({ DashboardFakePage: () => null }));
vi.mock("@/features/my-services/components/MyServicesRouteSlot", () => ({
  MyServicesRouteSlot: () => null,
}));
vi.mock("@/features/view-services/components/ServiceDetailShell", () => ({
  ServiceDetailShell: () => null,
}));
vi.mock("@/features/settings/components/SettingsLayout", () => ({
  SettingsLayout: () => null,
}));
vi.mock("@/features/settings/components/SettingsIndexPage", () => ({
  SettingsIndexPage: () => null,
}));
vi.mock("@/features/settings/components/sections/PersonalInfoPage", () => ({
  PersonalInfoPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ClientAddressesPage", () => ({
  ClientAddressesPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ClientPaymentsPage", () => ({
  ClientPaymentsPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ProviderLegalIdentityPage", () => ({
  ProviderLegalIdentityPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ProviderProfessionalProfilePage", () => ({
  ProviderProfessionalProfilePage: () => null,
}));
vi.mock("@/features/settings/components/sections/ProviderReceivablesPage", () => ({
  ProviderReceivablesPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ProviderEarningsSectionPage", () => ({
  ProviderEarningsSectionPage: () => null,
}));
vi.mock("@/features/settings/components/sections/ProviderPayoutMethodsPage", () => ({
  ProviderPayoutMethodsPage: () => null,
}));
vi.mock("@/features/settings/components/sections/AccountPrivacyPage", () => ({
  AccountPrivacyPage: () => null,
}));
vi.mock("@/features/settings/components/sections/AccountSessionPage", () => ({
  AccountSessionPage: () => null,
}));
vi.mock("@/features/provider-profile/components/ProviderProfilePage", () => ({
  ProviderProfilePage: () => null,
}));
vi.mock("@/features/provider-jobs/components/ProviderJobsRouteSlot", () => ({
  ProviderJobsRouteSlot: () => null,
}));
vi.mock("@/features/provider-calendar/components/ProviderCalendarPage", () => ({
  ProviderCalendarPage: () => null,
}));
vi.mock("@/features/chats/components/ChatsLayout/ChatsLayout", () => ({ ChatsLayout: () => null }));
vi.mock("@/features/chats/components/ChatsLayout/ChatsConversationRoute", () => ({
  ChatsConversationRoute: () => null,
}));

import { router } from "../router";

beforeAll(async () => {
  const results = await Promise.allSettled(lazyFactories.map((factory) => factory()));
  const rejected = results.filter((r) => r.status === "rejected");
  expect(rejected).toHaveLength(0);
});

function collectPaths(routes: RouteObject[], parentPath = ""): string[] {
  const paths: string[] = [];
  for (const route of routes) {
    const segment = route.path ?? "";
    const fullPath =
      segment.startsWith("/") || parentPath === ""
        ? segment || parentPath || "/"
        : `${parentPath.replace(/\/$/, "")}/${segment}`;

    if (route.index) {
      paths.push(parentPath || "/");
    } else if (route.path) {
      paths.push(fullPath.startsWith("/") ? fullPath : `/${fullPath}`);
    }

    if (route.children?.length) {
      const childParent = route.index ? parentPath || "/" : fullPath || parentPath;
      paths.push(
        ...collectPaths(route.children, childParent.startsWith("/") ? childParent : `/${childParent}`),
      );
    }
  }
  return paths;
}

describe("router", () => {
  it("registers public guest and recovery routes", () => {
    const paths = collectPaths(router.routes);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/",
        "/login",
        "/cadastro/cliente",
        "/cadastro/profissional",
        "/esqueceu-senha",
        "/recuperar-senha",
      ]),
    );
  });

  it("registers request quote and public provider profile routes", () => {
    const paths = collectPaths(router.routes);
    expect(paths).toEqual(expect.arrayContaining(["/pedir-orcamento", "/perfil/:slug"]));
  });

  it("registers dashboard routes with role-scoped children", () => {
    const paths = collectPaths(router.routes);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/dashboard/services",
        "/dashboard/services/calendar",
        "/dashboard/services/:id",
        "/dashboard/settings",
        "/dashboard/settings/personal-info",
        "/dashboard/settings/addresses",
        "/dashboard/settings/payments",
        "/dashboard/settings/legal-identity",
        "/dashboard/settings/professional-profile",
        "/dashboard/settings/receivables",
        "/dashboard/settings/earnings",
        "/dashboard/settings/payout-methods",
        "/dashboard/settings/privacy",
        "/dashboard/settings/legal",
        "/dashboard/settings/session",
        "/dashboard/jobs",
        "/dashboard/chats",
        "/dashboard/chats/:chatId",
        "/example",
      ]),
    );
    expect(paths).not.toContain("/dashboard/help");
  });

  it("wraps the tree with RootLayout and an error boundary", () => {
    const root = router.routes[0];
    expect(root?.path).toBe("/");
    expect(root?.errorElement).toBeTruthy();
    expect(root?.element).toBeTruthy();
  });

  it("includes DEV showcase routes in test environment", () => {
    const paths = collectPaths(router.routes);
    expect(paths).toEqual(
      expect.arrayContaining([
        "/dev/demo/form",
        "/dev/demo/provider-service-card-showcase",
        "/dev/demo/client-service-card-showcase",
        "/dev/demo/prestway-icon-showcase",
      ]),
    );
  });

  it("scopes provider-only dashboard children with ProtectedRoute roles", () => {
    const dashboard = router.routes[0]?.children?.find((route) => route.path === "dashboard");
    const jobs = dashboard?.children?.find((route) => route.path === "jobs");
    const settings = dashboard?.children?.find((route) => route.path === "settings");
    expect(jobs?.element).toBeTruthy();
    expect(settings?.element).toBeTruthy();
    expect(settings?.children?.some((route) => route.path === "earnings")).toBe(true);
    expect(settings?.children?.some((route) => route.path === "payout-methods")).toBe(true);
  });
});
