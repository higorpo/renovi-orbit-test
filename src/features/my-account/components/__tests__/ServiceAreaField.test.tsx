import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { Form } from "@/components/ui/form";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ServiceAreaField } from "../ServiceAreaField";
import type { ProviderAccountFormData } from "../../schemas/providerAccountForm.validation";

vi.mock("@/hooks/useBreakpoint", () => ({
  useBreakpointMd: vi.fn(() => true),
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
    expect(screen.getByRole("button", { name: /Adicionar cidade/ })).toBeInTheDocument();
  });
});
