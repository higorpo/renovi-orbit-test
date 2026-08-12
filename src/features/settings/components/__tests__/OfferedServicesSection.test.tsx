import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { OfferedServicesSection } from "../OfferedServicesSection";

const searchServices = vi.fn();
const getServicesByIds = vi.fn();

vi.mock("../../api/providerProfile.api", () => ({
  searchServices: (...args: unknown[]) => searchServices(...args),
  getServicesByIds: (...args: unknown[]) => getServicesByIds(...args),
}));

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: vi.fn(() => ({
    Icon: () => <span data-testid="service-icon">Icon</span>,
  })),
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("OfferedServicesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchServices.mockResolvedValue({
      services: [
        { id: "s1", title: "Pintura", icon_key: null, color_key: null },
        { id: "s2", title: "Encanamento", icon_key: null, color_key: null },
      ],
      error: null,
    });
    getServicesByIds.mockResolvedValue({
      services: [
        { id: "s1", title: "Pintura", icon_key: null, color_key: null },
      ],
      error: null,
    });
  });

  it("renders section title and search placeholder", () => {
    render(
      <OfferedServicesSection
        selectedServiceIds={[]}
        onSelectedChange={vi.fn()}
        setServiceIdsAsync={vi.fn().mockResolvedValue(undefined)}
        isUpdating={false}
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByText("Serviços oferecidos")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Buscar serviços...")
    ).toBeInTheDocument();
  });

  it("renders selected services as badges when selectedServiceIds has items", async () => {
    render(
      <OfferedServicesSection
        selectedServiceIds={["s1"]}
        onSelectedChange={vi.fn()}
        setServiceIdsAsync={vi.fn().mockResolvedValue(undefined)}
        isUpdating={false}
      />,
      { wrapper: createWrapper() }
    );
    await vi.waitFor(() => {
      expect(screen.getByText("Pintura")).toBeInTheDocument();
    });
  });

  it("calls onSelectedChange and setServiceIdsAsync when removing a service", async () => {
    const onSelectedChange = vi.fn();
    const setServiceIdsAsync = vi.fn().mockResolvedValue(undefined);
    render(
      <OfferedServicesSection
        selectedServiceIds={["s1"]}
        onSelectedChange={onSelectedChange}
        setServiceIdsAsync={setServiceIdsAsync}
        isUpdating={false}
      />,
      { wrapper: createWrapper() }
    );
    await vi.waitFor(() => {
      expect(screen.getByText("Pintura")).toBeInTheDocument();
    });
    const removeBtn = screen.getByRole("button", { name: /Remover Pintura/ });
    fireEvent.click(removeBtn);
    expect(onSelectedChange).toHaveBeenCalledWith([]);
    expect(setServiceIdsAsync).toHaveBeenCalledWith([]);
  });

  it("disables input when disabled is true", () => {
    render(
      <OfferedServicesSection
        selectedServiceIds={[]}
        onSelectedChange={vi.fn()}
        setServiceIdsAsync={vi.fn().mockResolvedValue(undefined)}
        isUpdating={false}
        disabled
      />,
      { wrapper: createWrapper() }
    );
    expect(screen.getByPlaceholderText("Buscar serviços...")).toBeDisabled();
  });

  it("shows loading state while search query is resolving", async () => {
    searchServices.mockImplementation(
      () => new Promise(() => {
        /* intentionally unresolved */
      })
    );

    render(
      <OfferedServicesSection
        selectedServiceIds={[]}
        onSelectedChange={vi.fn()}
        setServiceIdsAsync={vi.fn().mockResolvedValue(undefined)}
        isUpdating={false}
      />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText("Buscar serviços...");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "Pint" } });

    expect(await screen.findByText("Buscando…")).toBeInTheDocument();
  });

  it("adds a service when user picks a search result", async () => {
    const onSelectedChange = vi.fn();
    const setServiceIdsAsync = vi.fn().mockResolvedValue(undefined);

    render(
      <OfferedServicesSection
        selectedServiceIds={[]}
        onSelectedChange={onSelectedChange}
        setServiceIdsAsync={setServiceIdsAsync}
        isUpdating={false}
      />,
      { wrapper: createWrapper() }
    );

    const input = screen.getByPlaceholderText("Buscar serviços...");
    fireEvent.focus(input);

    await vi.waitFor(() => {
      expect(screen.getByRole("option", { name: "Pintura" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("option", { name: "Pintura" }));

    expect(onSelectedChange).toHaveBeenCalledWith(["s1"]);
    expect(setServiceIdsAsync).toHaveBeenCalledWith(["s1"]);
  });
});
