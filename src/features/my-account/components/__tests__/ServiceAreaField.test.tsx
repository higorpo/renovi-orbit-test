import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceAreaField } from "../ServiceAreaField";
import type { ProviderAccountFormData } from "../../types/providerAccountForm.validation";

const breakpointState = { isMd: true };

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: () => breakpointState.isMd,
}));

vi.mock("@/features/addresses", () => ({
  searchCities: vi.fn(),
  listNeighborhoodsByCity: vi.fn(),
  getNeighborhoodsByIds: vi.fn(),
}));

const searchCities = vi.mocked(
  await import("@/features/addresses").then((m) => m.searchCities)
);
const listNeighborhoodsByCity = vi.mocked(
  await import("@/features/addresses").then((m) => m.listNeighborhoodsByCity)
);
const getNeighborhoodsByIds = vi.mocked(
  await import("@/features/addresses").then((m) => m.getNeighborhoodsByIds)
);

const defaultValues: ProviderAccountFormData = {
  full_name: "Maria",
  phone: "",
  entity_type: "pf",
  profile_visibility: "restricted",
  display_name: "",
  bio: "",
  service_area_neighborhood_ids: [],
};

function TestWrapper({
  disabled,
  children: _children,
}: {
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const form = useForm<ProviderAccountFormData>({ defaultValues });
  return (
    <Form {...form}>
      <ServiceAreaField form={form} disabled={disabled} />
    </Form>
  );
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };
}

describe("ServiceAreaField", () => {
  beforeEach(() => {
    breakpointState.isMd = true;
    vi.clearAllMocks();
    searchCities.mockResolvedValue({ cities: [], error: null });
    listNeighborhoodsByCity.mockResolvedValue({ neighborhoods: [], error: null });
    getNeighborhoodsByIds.mockResolvedValue({ neighborhoods: [], error: null });
  });

  it("renders cidades e bairros label and add button", () => {
    render(<TestWrapper />, { wrapper: createWrapper() });
    expect(screen.getByText(/Cidades e bairros de atuação/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Adicionar cidade/ })).toBeInTheDocument();
  });

  it("renders disabled when disabled prop is true", () => {
    render(<TestWrapper disabled />, { wrapper: createWrapper() });
    expect(screen.getByRole("button", { name: /Adicionar cidade/ })).toBeDisabled();
  });

  it("renders grouped neighborhoods and removes one from the form", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    const cityId = "22222222-2222-4222-8222-222222222222";

    function WrapperWithNeighborhoods() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
        </Form>
      );
    }

    getNeighborhoodsByIds.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          city_name: "Floripa",
          state_abbreviation: "SC",
        },
      ],
      error: null,
    });

    render(<WrapperWithNeighborhoods />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Floripa, SC")).toBeInTheDocument();
    });
    expect(screen.getByText("Centro")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Remover Centro/ }));

    await waitFor(() => {
      expect(screen.queryByText("Floripa, SC")).not.toBeInTheDocument();
    });
  });

  it("removes every neighborhood in a city when Remover todos is clicked", async () => {
    const n1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const n2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const cityId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";

    function WrapperTwoInCity() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [n1, n2],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
        </Form>
      );
    }

    getNeighborhoodsByIds.mockResolvedValue({
      neighborhoods: [
        {
          id: n1,
          name: "Bairro A",
          city_id: cityId,
          city_name: "Cidade X",
          state_abbreviation: "SP",
        },
        {
          id: n2,
          name: "Bairro B",
          city_id: cityId,
          city_name: "Cidade X",
          state_abbreviation: "SP",
        },
      ],
      error: null,
    });

    render(<WrapperTwoInCity />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Cidade X, SP")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Remover todos/ }));

    await waitFor(() => {
      expect(screen.queryByText("Cidade X, SP")).not.toBeInTheDocument();
    });
  });

  it("loads neighborhoods when Alterar bairros is opened for an existing city", async () => {
    const neighborhoodId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const cityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    const nbrRow = (id: string, name: string) => ({
      id,
      name,
      city_id: cityId,
      is_active: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    });

    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [nbrRow(neighborhoodId, "Centro"), nbrRow("ffffffff-ffff-4fff-8fff-ffffffffffff", "Leste")],
      error: null,
    });

    function WrapperOneNbr() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
        </Form>
      );
    }

    getNeighborhoodsByIds.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          city_name: "Joinville",
          state_abbreviation: "SC",
        },
      ],
      error: null,
    });

    render(<WrapperOneNbr />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText("Joinville, SC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alterar bairros/ }));

    await waitFor(() => {
      expect(listNeighborhoodsByCity).toHaveBeenCalledWith(cityId);
    });

    expect(await screen.findByText("Leste")).toBeInTheDocument();
  });

  it("uses sheet layout on small viewports when opening add-city flow", () => {
    breakpointState.isMd = false;
    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    const sheet = screen.getByRole("dialog");
    expect(sheet).toBeInTheDocument();
    expect(
      within(sheet).getByPlaceholderText("Digite o nome da cidade...")
    ).toBeInTheDocument();
  });
});
