import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AddressSelectionStep } from "../AddressSelectionStep";
import * as useAddressSelectionModule from "../../../hooks/useAddressSelection";
import * as usePlatformStatesModule from "../../../hooks/usePlatformStatesAndCities";

vi.mock("../../../hooks/useAddressSelection", () => ({
  useAddressSelection: vi.fn(),
}));

vi.mock("../../../hooks/usePlatformStatesAndCities", () => ({
  usePlatformStates: vi.fn(),
  usePlatformCities: vi.fn(),
  usePlatformNeighborhoods: vi.fn(),
}));

vi.mock("../../../hooks/useAddressMapSync", () => ({
  useAddressMapSync: vi.fn(() => ({
    handleMapDrag: vi.fn(),
    reverseGeocoding: false,
  })),
}));

vi.mock("../../AddressMap/AddressMap", () => ({
  AddressMap: () => <div data-testid="address-map">Map</div>,
}));

const useAddressSelection = vi.mocked(useAddressSelectionModule.useAddressSelection);
const usePlatformStates = vi.mocked(usePlatformStatesModule.usePlatformStates);
const usePlatformCities = vi.mocked(usePlatformStatesModule.usePlatformCities);
const usePlatformNeighborhoods = vi.mocked(usePlatformStatesModule.usePlatformNeighborhoods);

const defaultFormData = {
  address_label: "",
  address_zip: "",
  address_street: "",
  address_number: "",
  address_complement: "",
  address_neighborhood_id: "",
  address_neighborhood: "",
  address_state_id: "",
  address_state: "",
  address_city_id: "",
  address_city: "",
};

const mockStates = [
  {
    id: "s1",
    name: "São Paulo",
    abbreviation: "SP",
    ibge_code: 35,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];
const mockCities = [
  {
    id: "c1",
    name: "São Paulo",
    state_id: "s1",
    ibge_code: 3550308,
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];
const mockNeighborhoods = [
  {
    id: "n1",
    name: "Bela Vista",
    city_id: "c1",
    is_active: true,
    created_at: "",
    updated_at: "",
  },
];

function defaultMocks() {
  useAddressSelection.mockReturnValue({
    formData: defaultFormData,
    setFormData: vi.fn(),
    location: null,
    setLocation: vi.fn(),
    selectedAddressId: null,
    setSelectedAddressId: vi.fn(),
    showNewAddressForm: false,
    setShowNewAddressForm: vi.fn(),
    restoredFromPersisted: false,
    fetchingCep: false,
    addresses: [],
    handleCepBlur: vi.fn(),
  });
  usePlatformStates.mockReturnValue({
    states: mockStates,
    isLoading: false,
    error: null,
  });
  usePlatformCities.mockReturnValue({
    cities: mockCities,
    isLoading: false,
    error: null,
  });
  usePlatformNeighborhoods.mockReturnValue({
    neighborhoods: mockNeighborhoods,
    isLoading: false,
    error: null,
  });
}

describe("AddressSelectionStep", () => {
  const onSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it("renders form with CEP, Estado, Cidade, Bairro, Rua, Número when no addresses or showNewAddressForm", () => {
    render(
      <AddressSelectionStep userId={null} onSelectionChange={onSelectionChange} />
    );
    expect(screen.getByPlaceholderText("00000-000")).toBeInTheDocument();
    expect(screen.getByText("Estado")).toBeInTheDocument();
    expect(screen.getByText("Cidade")).toBeInTheDocument();
    expect(screen.getByText("Bairro")).toBeInTheDocument();
    expect(screen.getByText("Rua")).toBeInTheDocument();
    expect(screen.getByText("Número")).toBeInTheDocument();
    expect(screen.getByText("Complemento")).toBeInTheDocument();
  });

  it("renders default title and subtitle when not provided", () => {
    render(
      <AddressSelectionStep userId={null} onSelectionChange={onSelectionChange} />
    );
    expect(screen.getByText("Endereço do serviço")).toBeInTheDocument();
  });

  it("renders custom title when provided", () => {
    render(
      <AddressSelectionStep
        userId={null}
        onSelectionChange={onSelectionChange}
        title="Endereço de entrega"
      />
    );
    expect(screen.getByText("Endereço de entrega")).toBeInTheDocument();
  });

  it("renders address list and new address button when userId and addresses exist and not showNewAddressForm", () => {
    const setShowNewAddressForm = vi.fn();
    const setSelectedAddressId = vi.fn();
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId,
      showNewAddressForm: false,
      setShowNewAddressForm,
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [
        {
          id: "addr-1",
          street: "Rua A",
          number: "100",
          neighborhood: "Centro",
          platform_cities: { name: "São Paulo" },
          platform_states: { abbreviation: "SP" },
        },
      ] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    expect(screen.getByText(/Rua A.*100/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cadastrar novo endereço/i })).toBeInTheDocument();
  });

  it("clicking new address button calls setShowNewAddressForm and setSelectedAddressId", () => {
    const setShowNewAddressForm = vi.fn();
    const setSelectedAddressId = vi.fn();
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: "addr-1",
      setSelectedAddressId,
      showNewAddressForm: false,
      setShowNewAddressForm,
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [
        {
          id: "addr-1",
          street: "Rua A",
          number: "100",
          neighborhood: "Centro",
          platform_cities: { name: "São Paulo" },
          platform_states: { abbreviation: "SP" },
        },
      ] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Cadastrar novo endereço/i }));
    expect(setShowNewAddressForm).toHaveBeenCalledWith(true);
    expect(setSelectedAddressId).toHaveBeenCalledWith(null);
  });

  it("renders back to addresses button when showNewAddressForm and not restoredFromPersisted and userId and addresses exist", () => {
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: true,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [{ id: "addr-1", street: "Rua A", number: "1", neighborhood: "X", platform_cities: null, platform_states: null }] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    expect(screen.getByRole("button", { name: /Voltar para meus endereços/i })).toBeInTheDocument();
  });

  it("does not render back button when restoredFromPersisted is true", () => {
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: true,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: true,
      fetchingCep: false,
      addresses: [{ id: "addr-1", street: "Rua A", number: "1", neighborhood: "X", platform_cities: null, platform_states: null }] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    expect(screen.queryByRole("button", { name: /Voltar para meus endereços/i })).not.toBeInTheDocument();
  });

  it("calls setFormData when CEP input value changes", () => {
    const setFormData = vi.fn();
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData,
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: false,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId={null} onSelectionChange={onSelectionChange} />
    );
    const cepInput = screen.getByPlaceholderText("00000-000");
    fireEvent.change(cepInput, { target: { value: "01310100" } });
    expect(setFormData).toHaveBeenCalledWith(expect.any(Function));
  });

  it("disables Estado select when fetchingCep is true", () => {
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: false,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: false,
      fetchingCep: true,
      addresses: [],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId={null} onSelectionChange={onSelectionChange} />
    );
    const comboboxes = screen.getAllByRole("combobox");
    const stateCombobox = comboboxes.find(
      (el) => el.textContent?.includes("Selecione o estado")
    );
    expect(stateCombobox).toBeDefined();
    expect(stateCombobox).toBeDisabled();
  });

  it("selects an existing address from the list", () => {
    const setSelectedAddressId = vi.fn();
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId,
      showNewAddressForm: false,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [
        {
          id: "addr-1",
          street: "Rua A",
          number: "100",
          neighborhood: "Centro",
          platform_cities: { name: "São Paulo" },
          platform_states: { abbreviation: "SP" },
        },
      ] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    fireEvent.click(screen.getByText(/Rua A.*100/));
    expect(setSelectedAddressId).toHaveBeenCalledWith("addr-1");
  });

  it("returns to address list when back button is clicked", () => {
    const setShowNewAddressForm = vi.fn();
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: true,
      setShowNewAddressForm,
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [
        {
          id: "addr-1",
          street: "Rua A",
          number: "100",
          neighborhood: "Centro",
          platform_cities: { name: "São Paulo" },
          platform_states: { abbreviation: "SP" },
        },
      ] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep userId="user-1" onSelectionChange={onSelectionChange} />
    );
    fireEvent.click(screen.getByRole("button", { name: /Voltar|endereços cadastrados/i }));
    expect(setShowNewAddressForm).toHaveBeenCalledWith(false);
  });

  it("renders custom choosePrompt on address list view", () => {
    useAddressSelection.mockReturnValue({
      formData: defaultFormData,
      setFormData: vi.fn(),
      location: null,
      setLocation: vi.fn(),
      selectedAddressId: null,
      setSelectedAddressId: vi.fn(),
      showNewAddressForm: false,
      setShowNewAddressForm: vi.fn(),
      restoredFromPersisted: false,
      fetchingCep: false,
      addresses: [
        {
          id: "addr-1",
          street: "Rua A",
          number: "100",
          neighborhood: "Centro",
          platform_cities: { name: "São Paulo" },
          platform_states: { abbreviation: "SP" },
        },
      ] as never[],
      handleCepBlur: vi.fn(),
    });
    render(
      <AddressSelectionStep
        userId="user-1"
        onSelectionChange={onSelectionChange}
        choosePrompt="Escolha um endereço de atendimento"
      />
    );
    expect(screen.getByText("Escolha um endereço de atendimento")).toBeInTheDocument();
  });
});

describe("AddressSelectionStep location selectors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it("updates the state fields and clears the city through the state selector", async () => {
    const setFormData = vi.fn();
    useAddressSelection.mockReturnValue({
      ...useAddressSelection(),
      setFormData,
    });

    render(<AddressSelectionStep userId={null} onSelectionChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("combobox")[0]);
    fireEvent.click(await screen.findByRole("option", { name: /São Paulo \(SP\)/ }));

    const updater = setFormData.mock.calls[0][0];
    expect(updater({ ...defaultFormData, address_city_id: "old" })).toMatchObject({
      address_state_id: "s1",
      address_state: "SP",
      address_city_id: "",
      address_city: "",
    });
  });

  it("updates the city and clears the neighborhood through the city selector", async () => {
    const setFormData = vi.fn();
    useAddressSelection.mockReturnValue({
      ...useAddressSelection(),
      formData: { ...defaultFormData, address_state_id: "s1", address_state: "SP" },
      setFormData,
    });

    render(<AddressSelectionStep userId={null} onSelectionChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("combobox")[1]);
    fireEvent.click(await screen.findByRole("option", { name: "São Paulo" }));

    const updater = setFormData.mock.calls[0][0];
    expect(updater({ ...defaultFormData, address_neighborhood_id: "old" })).toMatchObject({
      address_city_id: "c1",
      address_city: "São Paulo",
      address_neighborhood_id: "",
      address_neighborhood: "",
    });
  });

  it("updates the neighborhood through the neighborhood selector", async () => {
    const setFormData = vi.fn();
    useAddressSelection.mockReturnValue({
      ...useAddressSelection(),
      formData: {
        ...defaultFormData,
        address_state_id: "s1",
        address_state: "SP",
        address_city_id: "c1",
        address_city: "São Paulo",
      },
      setFormData,
    });

    render(<AddressSelectionStep userId={null} onSelectionChange={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("combobox")[2]);
    fireEvent.click(await screen.findByRole("option", { name: "Bela Vista" }));

    const updater = setFormData.mock.calls[0][0];
    expect(updater(defaultFormData)).toMatchObject({
      address_neighborhood_id: "n1",
      address_neighborhood: "Bela Vista",
    });
  });
});
