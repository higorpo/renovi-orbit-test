import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { useAddressSelection } from "../useAddressSelection";
import * as addressesApi from "../../api/addresses.api";
import * as resolveFormDataFromCepModule from "../../utils/resolveFormDataFromCep";

vi.mock("../../api/addresses.api", () => ({
  listAddresses: vi.fn(),
}));

vi.mock("../../utils/resolveFormDataFromCep", () => ({
  resolveFormDataFromCep: vi.fn(),
}));

vi.mock("@/hooks/useAnalytics", () => ({
  useAnalytics: () => ({ trackEvent: vi.fn() }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

const listAddresses = vi.mocked(addressesApi.listAddresses);
const resolveFormDataFromCep = vi.mocked(resolveFormDataFromCepModule.resolveFormDataFromCep);

const mockAddresses = [
  {
    id: "addr-1",
    client_id: "user-1",
    street: "Rua A",
    number: "100",
    neighborhood: "Centro",
    platform_cities: { name: "São Paulo" },
    platform_states: { abbreviation: "SP" },
  } as addressesApi.ClientAddressWithRelations,
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe("useAddressSelection", () => {
  const onSelectionChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    listAddresses.mockResolvedValue({ addresses: mockAddresses, error: null });
    resolveFormDataFromCep.mockResolvedValue(null);
  });

  it("returns default formData and empty addresses when userId is null", async () => {
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses).toEqual([]);
    });
    expect(result.current.formData.address_zip).toBe("");
    expect(result.current.selectedAddressId).toBeNull();
    expect(result.current.showNewAddressForm).toBe(false);
    expect(result.current.restoredFromPersisted).toBe(false);
    expect(listAddresses).not.toHaveBeenCalled();
  });

  it("fetches addresses when userId is provided", async () => {
    const { result } = renderHook(
      () => useAddressSelection({ userId: "user-1", onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses).toEqual(mockAddresses);
    });
    expect(listAddresses).toHaveBeenCalledWith("user-1");
  });

  it("initializes from initialSelection existing", async () => {
    const { result } = renderHook(
      () =>
        useAddressSelection({
          userId: "user-1",
          onSelectionChange,
          initialSelection: { kind: "existing", addressId: "addr-1" },
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses.length).toBeGreaterThan(0);
    });
    expect(result.current.selectedAddressId).toBe("addr-1");
    expect(result.current.showNewAddressForm).toBe(false);
    expect(result.current.restoredFromPersisted).toBe(false);
  });

  it("initializes from initialSelection new with formData and showNewAddressForm true", async () => {
    const initialForm = {
      address_zip: "01310-100",
      address_street: "Av Paulista",
      address_number: "100",
      address_complement: "",
      address_neighborhood_id: "n1",
      address_neighborhood: "Bela Vista",
      address_state_id: "s1",
      address_state: "SP",
      address_city_id: "c1",
      address_city: "São Paulo",
    };
    const { result } = renderHook(
      () =>
        useAddressSelection({
          userId: "user-1",
          onSelectionChange,
          initialSelection: { kind: "new", formData: initialForm },
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses.length).toBeGreaterThan(0);
    });
    expect(result.current.formData.address_zip).toBe("01310-100");
    expect(result.current.showNewAddressForm).toBe(true);
    expect(result.current.restoredFromPersisted).toBe(true);
  });

  it("calls onSelectionChange with new formData when no userId or showNewAddressForm", async () => {
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses).toEqual([]);
    });
    expect(onSelectionChange).toHaveBeenLastCalledWith({
      kind: "new",
      formData: result.current.formData,
    });
  });

  it("calls onSelectionChange with existing address when one is selected and not showNewAddressForm", async () => {
    const { result } = renderHook(
      () =>
        useAddressSelection({
          userId: "user-1",
          onSelectionChange,
          initialSelection: { kind: "existing", addressId: "addr-1" },
        }),
      { wrapper: createWrapper() }
    );
    await waitFor(() => {
      expect(result.current.addresses).toEqual(mockAddresses);
    });
    expect(onSelectionChange).toHaveBeenCalledWith({
      kind: "existing",
      addressId: "addr-1",
    });
  });

  it("updates formData via setFormData", async () => {
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, address_street: "Rua Nova" }));
    });
    expect(result.current.formData.address_street).toBe("Rua Nova");
  });

  it("handleCepBlur with 8-digit CEP calls resolveFormDataFromCep and updates formData on success", async () => {
    resolveFormDataFromCep.mockResolvedValue({
      ok: true,
      data: {
        address_street: "Avenida Resolvida",
        address_state_id: "s1",
        address_state: "SP",
        address_city_id: "c1",
        address_city: "São Paulo",
        address_neighborhood_id: "n1",
        address_neighborhood: "Centro",
      },
    });
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, address_zip: "01310-100" }));
    });
    await act(async () => {
      result.current.handleCepBlur();
    });
    await waitFor(() => {
      expect(resolveFormDataFromCep).toHaveBeenCalledWith("01310-100");
    });
    await waitFor(() => {
      expect(result.current.formData.address_street).toBe("Avenida Resolvida");
      expect(result.current.formData.address_state_id).toBe("s1");
    });
  });

  it("handleCepBlur with cepNotFound clears address fields and shows toast", async () => {
    const { toast } = await import("sonner");
    resolveFormDataFromCep.mockResolvedValue({ ok: false, cepNotFound: true });
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, address_zip: "00000-000" }));
    });
    await act(async () => {
      result.current.handleCepBlur();
    });
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("O CEP digitado não existe.");
    });
    await waitFor(() => {
      expect(result.current.formData.address_zip).toBe("");
      expect(result.current.formData.address_street).toBe("");
    });
  });

  it("handleCepBlur with notAvailable clears form and shows warning toast", async () => {
    const { toast } = await import("sonner");
    resolveFormDataFromCep.mockResolvedValue({ ok: false, notAvailable: true });
    const { result } = renderHook(
      () => useAddressSelection({ userId: null, onSelectionChange }),
      { wrapper: createWrapper() }
    );
    await act(async () => {
      result.current.setFormData((prev) => ({ ...prev, address_zip: "99999-999" }));
    });
    await act(async () => {
      result.current.handleCepBlur();
    });
    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        "A Renovi ainda não está disponível nessa localização."
      );
    });
    await waitFor(() => {
      expect(result.current.formData.address_zip).toBe("");
      expect(result.current.formData.address_street).toBe("");
    });
  });
});
