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

  it("adds neighborhoods after selecting a city from search", async () => {
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const n1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Blumenau", state_abbreviation: "SC" }],
      error: null,
    });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: n1,
          name: "Velha",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    getNeighborhoodsByIds.mockImplementation(async (ids: string[]) => ({
      neighborhoods: ids.map((id) => ({
        id,
        name: "Velha",
        city_id: cityId,
        city_name: "Blumenau",
        state_abbreviation: "SC",
      })),
      error: null,
    }));

    function WrapperAddFlow() {
      const form = useForm<ProviderAccountFormData>({ defaultValues });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">{form.watch("service_area_neighborhood_ids").join(",")}</div>
        </Form>
      );
    }

    render(<WrapperAddFlow />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));

    const input = screen.getByPlaceholderText("Digite o nome da cidade...");
    fireEvent.change(input, { target: { value: "Blu" } });

    const cityOption = await screen.findByText("Blumenau, SC");
    fireEvent.pointerDown(cityOption);
    fireEvent.click(cityOption);

    await waitFor(() => {
      expect(listNeighborhoodsByCity).toHaveBeenCalledWith(cityId);
    });

    // CommandInput DOM can be reused across the city→neighborhood switch; clear filter.
    const neighborhoodSearch = screen.getByPlaceholderText("Buscar bairro...");
    fireEvent.change(neighborhoodSearch, { target: { value: "" } });

    const neighborhoodOption = await screen.findByText("Velha");
    fireEvent.pointerDown(neighborhoodOption);
    fireEvent.click(neighborhoodOption);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar 1 bairro/ }));

    await waitFor(() => {
      expect(screen.getByTestId("ids")).toHaveTextContent(n1);
    });
  });

  it("saves edited neighborhoods for an existing city", async () => {
    const neighborhoodId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const extraId = "ffffffff-ffff-4fff-8fff-ffffffffffff";
    const cityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
        {
          id: extraId,
          name: "Leste",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    getNeighborhoodsByIds.mockImplementation(async (ids: string[]) => ({
      neighborhoods: ids.map((id) => ({
        id,
        name: id === neighborhoodId ? "Centro" : "Leste",
        city_id: cityId,
        city_name: "Joinville",
        state_abbreviation: "SC",
      })),
      error: null,
    }));

    function WrapperEditSave() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">{form.watch("service_area_neighborhood_ids").join(",")}</div>
        </Form>
      );
    }

    render(<WrapperEditSave />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Joinville, SC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alterar bairros/ }));
    expect(await screen.findByText("Leste")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Leste"));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    await waitFor(() => {
      expect(screen.getByTestId("ids").textContent).toContain(extraId);
    });
  });

  it("cancels neighborhood edit without changing form values", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    const cityId = "22222222-2222-4222-8222-222222222222";

    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
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

    function WrapperCancel() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">{form.watch("service_area_neighborhood_ids").join(",")}</div>
        </Form>
      );
    }

    render(<WrapperCancel />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Floripa, SC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alterar bairros/ }));
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/ }));

    expect(screen.getByTestId("ids")).toHaveTextContent(neighborhoodId);
  });

  it("resets add-city sheet state when closed on mobile", async () => {
    breakpointState.isMd = false;
    searchCities.mockResolvedValue({
      cities: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Itajaí",
          state_abbreviation: "SC",
        },
      ],
      error: null,
    });

    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Ita" },
    });
    expect(await within(sheet).findByText("Itajaí, SC")).toBeInTheDocument();

    fireEvent.keyDown(sheet, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    expect(
      within(screen.getByRole("dialog")).getByPlaceholderText("Digite o nome da cidade...")
    ).toHaveValue("");
  });

  it("allows changing city after one was selected in the add flow", async () => {
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Blumenau", state_abbreviation: "SC" }],
      error: null,
    });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          name: "Velha",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Blu" },
    });
    const cityOption = await screen.findByText("Blumenau, SC");
    fireEvent.pointerDown(cityOption);
    fireEvent.click(cityOption);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Trocar cidade/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Trocar cidade/ }));
    expect(screen.getByPlaceholderText("Digite o nome da cidade...")).toBeInTheDocument();
  });

  it("renders city name without state abbreviation when missing", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    const cityId = "22222222-2222-4222-8222-222222222222";

    function WrapperNoAbbr() {
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
          city_name: "Cidade Sem UF",
          state_abbreviation: "",
        },
      ],
      error: null,
    });

    render(<WrapperNoAbbr />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Cidade Sem UF")).toBeInTheDocument();
    });
    expect(screen.queryByText(/Cidade Sem UF,/)).not.toBeInTheDocument();
  });

  it("toggles neighborhoods on and off in the add flow and skips empty adds", async () => {
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const n1 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Gaspar", state_abbreviation: null as unknown as string }],
      error: null,
    });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: n1,
          name: "Centro",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });

    function WrapperToggle() {
      const form = useForm<ProviderAccountFormData>({ defaultValues });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">{form.watch("service_area_neighborhood_ids").join(",")}</div>
        </Form>
      );
    }

    render(<WrapperToggle />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Gas" },
    });
    const cityOption = await screen.findByText("Gaspar");
    fireEvent.pointerDown(cityOption);
    fireEvent.click(cityOption);

    const neighborhoodSearch = screen.getByPlaceholderText("Buscar bairro...");
    fireEvent.change(neighborhoodSearch, { target: { value: "" } });
    const neighborhoodOption = await screen.findByText("Centro");
    fireEvent.pointerDown(neighborhoodOption);
    fireEvent.click(neighborhoodOption);
    // Toggle off
    fireEvent.pointerDown(neighborhoodOption);
    fireEvent.click(neighborhoodOption);
    fireEvent.click(screen.getByRole("button", { name: /Adicionar 0 bairro/ }));
    expect(screen.getByTestId("ids")).toHaveTextContent("");
  });

  it("resets desktop add popover state when closed", async () => {
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Brusque", state_abbreviation: "SC" }],
      error: null,
    });

    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Bru" },
    });
    expect(await screen.findByText("Brusque, SC")).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Digite o nome da cidade...")).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    expect(screen.getByPlaceholderText("Digite o nome da cidade...")).toHaveValue("");
  });

  it("shows Selecionar bairros sheet title after choosing a city on mobile", async () => {
    breakpointState.isMd = false;
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Itajaí", state_abbreviation: "SC" }],
      error: null,
    });
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [],
      error: null,
    });

    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    const sheet = screen.getByRole("dialog");
    fireEvent.change(within(sheet).getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Ita" },
    });
    const cityOption = await within(sheet).findByText("Itajaí, SC");
    fireEvent.pointerDown(cityOption);
    fireEvent.click(cityOption);

    await waitFor(() => {
      expect(within(screen.getByRole("dialog")).getByText("Selecionar bairros")).toBeInTheDocument();
    });
  });

  it("resets edit popover state when closed without saving", async () => {
    const neighborhoodId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
    const cityId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
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

    function WrapperEditClose() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">{form.watch("service_area_neighborhood_ids").join(",")}</div>
        </Form>
      );
    }

    render(<WrapperEditClose />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(screen.getByText("Joinville, SC")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /Alterar bairros/ }));
    expect(await screen.findByPlaceholderText("Buscar bairro...")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByPlaceholderText("Buscar bairro...")).not.toBeInTheDocument();
    });
    expect(screen.getByTestId("ids")).toHaveTextContent(neighborhoodId);
  });

  it("does not search cities while the add popover is closed", async () => {
    vi.useFakeTimers();
    render(<TestWrapper />, { wrapper: createWrapper() });

    await vi.advanceTimersByTimeAsync(400);

    expect(searchCities).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("shows the empty city search state on desktop without opening a sheet", async () => {
    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));

    expect(
      screen.queryByRole("heading", { name: "Adicionar cidade" })
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Cidade inexistente" },
    });

    expect(
      await screen.findByText("Nenhuma cidade encontrada.")
    ).toBeInTheDocument();
  });

  it("filters a city that is already represented in the form", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    const cityId = "22222222-2222-4222-8222-222222222222";
    getNeighborhoodsByIds.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          city_name: "Florianópolis",
          state_abbreviation: "SC",
        },
      ],
      error: null,
    });
    searchCities.mockResolvedValue({
      cities: [
        { id: cityId, name: "Florianópolis", state_abbreviation: "SC" },
      ],
      error: null,
    });

    function ExistingCityWrapper() {
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

    render(<ExistingCityWrapper />, { wrapper: createWrapper() });
    await screen.findByText("Florianópolis, SC");
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Flor" },
    });
    await waitFor(() => expect(searchCities).toHaveBeenCalled());

    expect(screen.getAllByText("Florianópolis, SC")).toHaveLength(1);
  });

  it("shows a loading state while neighborhoods are fetched", async () => {
    const cityId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    searchCities.mockResolvedValue({
      cities: [{ id: cityId, name: "Blumenau", state_abbreviation: "SC" }],
      error: null,
    });
    listNeighborhoodsByCity.mockReturnValue(new Promise(() => {}));
    render(<TestWrapper />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /Adicionar cidade/ }));
    fireEvent.change(screen.getByPlaceholderText("Digite o nome da cidade..."), {
      target: { value: "Blu" },
    });
    const city = await screen.findByText("Blumenau, SC");
    fireEvent.pointerDown(city);
    fireEvent.click(city);

    expect(await screen.findByText("Carregando...")).toBeInTheDocument();
  });

  it("does not remove a neighborhood while disabled", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    getNeighborhoodsByIds.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: "22222222-2222-4222-8222-222222222222",
          city_name: "Floripa",
          state_abbreviation: "SC",
        },
      ],
      error: null,
    });

    function DisabledNeighborhoodWrapper() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} disabled />
          <div data-testid="ids">
            {form.watch("service_area_neighborhood_ids").join(",")}
          </div>
        </Form>
      );
    }

    render(<DisabledNeighborhoodWrapper />, { wrapper: createWrapper() });
    const remove = await screen.findByRole("button", { name: /Remover Centro/ });
    expect(remove).toBeDisabled();
    fireEvent.click(remove);
    expect(screen.getByTestId("ids")).toHaveTextContent(neighborhoodId);
  });

  it("does not load neighborhood details for an empty selection", async () => {
    render(<TestWrapper />, { wrapper: createWrapper() });
    await waitFor(() => {
      expect(getNeighborhoodsByIds).not.toHaveBeenCalled();
    });
  });

  it("falls back to an empty selection when the watched form value is undefined", () => {
    function UndefinedSelectionWrapper() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: undefined,
        } as unknown as ProviderAccountFormData,
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
        </Form>
      );
    }

    render(<UndefinedSelectionWrapper />, { wrapper: createWrapper() });

    expect(
      screen.getByRole("button", { name: /Adicionar cidade/ })
    ).toBeInTheDocument();
    expect(getNeighborhoodsByIds).not.toHaveBeenCalled();
  });

  it("removes a selected neighborhood while editing a city", async () => {
    const neighborhoodId = "11111111-1111-4111-8111-111111111111";
    const cityId = "22222222-2222-4222-8222-222222222222";
    listNeighborhoodsByCity.mockResolvedValue({
      neighborhoods: [
        {
          id: neighborhoodId,
          name: "Centro",
          city_id: cityId,
          is_active: true,
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      ],
      error: null,
    });
    getNeighborhoodsByIds.mockImplementation(async (ids: string[]) => ({
      neighborhoods: ids.map((id) => ({
        id,
        name: "Centro",
        city_id: cityId,
        city_name: "Florianópolis",
        state_abbreviation: "SC",
      })),
      error: null,
    }));

    function EditRemovalWrapper() {
      const form = useForm<ProviderAccountFormData>({
        defaultValues: {
          ...defaultValues,
          service_area_neighborhood_ids: [neighborhoodId],
        },
      });
      return (
        <Form {...form}>
          <ServiceAreaField form={form} />
          <div data-testid="ids">
            {form.watch("service_area_neighborhood_ids").join(",")}
          </div>
        </Form>
      );
    }

    render(<EditRemovalWrapper />, { wrapper: createWrapper() });
    await screen.findByText("Florianópolis, SC");
    fireEvent.click(screen.getByRole("button", { name: /Alterar bairros/ }));
    const option = await screen.findByText("Centro", {
      selector: "[cmdk-item] *",
    }).catch(() => screen.getAllByText("Centro").at(-1)!);
    fireEvent.click(option);
    fireEvent.click(screen.getByRole("button", { name: /^Salvar$/ }));

    await waitFor(() => {
      expect(screen.getByTestId("ids")).toHaveTextContent("");
    });
  });
});
