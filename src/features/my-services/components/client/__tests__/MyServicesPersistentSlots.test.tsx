// @vitest-environment happy-dom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ClientMyServicesPersistentSlot } from "../ClientMyServicesPersistentSlot";
import { ProviderMyServicesPersistentSlot } from "../../provider/ProviderMyServicesPersistentSlot";

const authState = vi.hoisted(() => ({
  profile: { role: "client" as string | undefined },
}));

const modalState = vi.hoisted(() => ({
  isFromClientMyServices: false,
  isFromProviderMyServices: false,
  background: null as { pathname: string } | null,
}));

vi.mock("@/features/auth", () => ({
  useAuth: () => ({ profile: authState.profile }),
}));

vi.mock("@/features/view-services", () => ({
  useServiceDetailModal: () => modalState,
}));

vi.mock("../ClientMyServicesPage", () => ({
  ClientMyServicesPage: () => <div data-testid="client-page" />,
}));

vi.mock("../../provider/ProviderMyServicesPage", () => ({
  ProviderMyServicesPage: () => <div data-testid="provider-page" />,
}));

describe("ClientMyServicesPersistentSlot", () => {
  it("renders the client page on the services route", () => {
    authState.profile = { role: "client" };
    modalState.isFromClientMyServices = false;
    modalState.background = null;

    render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <ClientMyServicesPersistentSlot />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("client-page")).toBeTruthy();
  });

  it("keeps the page mounted when opening a detail sheet from my-services", () => {
    authState.profile = { role: "client" };
    modalState.isFromClientMyServices = true;
    modalState.background = { pathname: "/dashboard/services" };

    render(
      <MemoryRouter initialEntries={["/dashboard/services/sr-1"]}>
        <ClientMyServicesPersistentSlot />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("client-page")).toBeTruthy();
  });

  it("renders nothing for non-client profiles", () => {
    authState.profile = { role: "provider" };
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <ClientMyServicesPersistentSlot />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe("ProviderMyServicesPersistentSlot", () => {
  it("renders the provider page on the services route", () => {
    authState.profile = { role: "provider" };
    modalState.isFromProviderMyServices = false;
    modalState.background = null;

    render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <ProviderMyServicesPersistentSlot />
      </MemoryRouter>,
    );

    expect(screen.getByTestId("provider-page")).toBeTruthy();
  });

  it("renders nothing for non-provider profiles", () => {
    authState.profile = { role: "client" };
    const { container } = render(
      <MemoryRouter initialEntries={["/dashboard/services"]}>
        <ProviderMyServicesPersistentSlot />
      </MemoryRouter>,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
