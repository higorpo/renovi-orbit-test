import {
  createRef,
  useState,
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
} from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  defaultAddressFormData,
  type AddressFormData,
} from "../../../types/addressForm.validation";
import { AddressFormWithMap } from "../AddressFormWithMap";

vi.mock("../../AddressMap/AddressMap", () => ({
  AddressMap: ({
    location,
    onLocationChange,
  }: {
    location: { latitude: number; longitude: number } | null;
    onLocationChange: (lat: number, lng: number) => void;
  }) => (
    <button
      type="button"
      data-testid="address-map"
      onClick={() => onLocationChange(-27.6, -48.5)}
    >
      {location ? `${location.latitude},${location.longitude}` : "no-location"}
    </button>
  ),
}));

const states = [{ id: "state-1", name: "Santa Catarina", abbreviation: "SC" }];
const cities = [{ id: "city-1", name: "Florianópolis", state_id: "state-1" }];
const neighborhoods = [
  { id: "nbhd-1", name: "Centro", city_id: "city-1" },
];

function FormHarness({
  initial = defaultAddressFormData,
  ...rest
}: Partial<ComponentProps<typeof AddressFormWithMap>> & {
  initial?: AddressFormData;
}) {
  const [formData, setFormData] = useState(initial);
  return (
    <AddressFormWithMap
      formData={formData}
      setFormData={setFormData as Dispatch<SetStateAction<AddressFormData>>}
      location={null}
      onLocationChange={vi.fn()}
      handleCepBlur={vi.fn()}
      fetchingCep={false}
      states={states}
      cities={cities}
      neighborhoods={neighborhoods}
      onStateChange={vi.fn()}
      onCityChange={vi.fn()}
      onNeighborhoodChange={vi.fn()}
      reverseGeocoding={false}
      {...rest}
    />
  );
}

describe("AddressFormWithMap", () => {
  it("masks CEP input and calls blur handler", () => {
    const handleCepBlur = vi.fn();
    render(<FormHarness handleCepBlur={handleCepBlur} />);

    const cep = screen.getByLabelText("CEP");
    fireEvent.change(cep, { target: { value: "88015000" } });
    expect(cep).toHaveValue("88015-000");

    fireEvent.blur(cep);
    expect(handleCepBlur).toHaveBeenCalled();
  });

  it("updates street, number, complement and optional label fields", () => {
    const onNumberBlur = vi.fn();
    const numberRef = createRef<HTMLInputElement>();
    render(
      <FormHarness
        showLabelField
        idPrefix="addr-"
        numberInputRef={numberRef}
        onNumberBlur={onNumberBlur}
      />,
    );

    fireEvent.change(screen.getByLabelText("Apelido"), {
      target: { value: "Trabalho" },
    });
    expect(screen.getByLabelText("Apelido")).toHaveValue("Trabalho");

    fireEvent.change(screen.getByLabelText("Rua"), {
      target: { value: "Rua das Flores" },
    });
    fireEvent.change(screen.getByLabelText("Número"), {
      target: { value: "100" },
    });
    fireEvent.blur(screen.getByLabelText("Número"));
    fireEvent.change(screen.getByLabelText("Complemento"), {
      target: { value: "Apto 2" },
    });

    expect(screen.getByLabelText("Rua")).toHaveValue("Rua das Flores");
    expect(screen.getByLabelText("Número")).toHaveValue("100");
    expect(screen.getByLabelText("Complemento")).toHaveValue("Apto 2");
    expect(onNumberBlur).toHaveBeenCalled();
    expect(numberRef.current).toBeInstanceOf(HTMLInputElement);
  });

  it("shows reverse geocoding indicator and region info when enabled", () => {
    render(
      <FormHarness
        reverseGeocoding
        showRegionInfo
        mapDescription="Custom map help"
      />,
    );

    expect(screen.getByText("Buscando endereço...")).toBeInTheDocument();
    expect(screen.getByText("Custom map help")).toBeInTheDocument();
    expect(screen.getByText(/ainda não está presente/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "@prestway.com" })).toHaveAttribute(
      "href",
      "https://www.instagram.com/prestway.com/",
    );
  });

  it("disables CEP and selects while fetching CEP", () => {
    render(<FormHarness fetchingCep />);

    expect(screen.getByLabelText("CEP")).toBeDisabled();
    expect(screen.getByLabelText("Rua")).toBeDisabled();
    expect(screen.getByLabelText("Número")).toBeDisabled();
  });

  it("forwards map location changes", () => {
    const onLocationChange = vi.fn();
    render(
      <FormHarness
        onLocationChange={onLocationChange}
        location={{ latitude: -27.5, longitude: -48.4 }}
      />,
    );

    expect(screen.getByTestId("address-map")).toHaveTextContent("-27.5,-48.4");
    fireEvent.click(screen.getByTestId("address-map"));
    expect(onLocationChange).toHaveBeenCalledWith(-27.6, -48.5);
  });

  it("hides label field by default", () => {
    render(<FormHarness />);
    expect(screen.queryByLabelText("Apelido")).not.toBeInTheDocument();
  });

  it("disables city select until state is chosen", () => {
    render(<FormHarness />);
    const comboboxes = screen.getAllByRole("combobox");
    const city = comboboxes.find((el) => el.textContent?.includes("Selecione a cidade"));
    expect(city).toBeDefined();
    expect(city).toBeDisabled();
  });

  it("disables neighborhood select until city is chosen", () => {
    render(
      <FormHarness
        initial={{
          ...defaultAddressFormData,
          address_state_id: "state-1",
          address_state: "SC",
        }}
      />,
    );
    const comboboxes = screen.getAllByRole("combobox");
    const neighborhood = comboboxes.find((el) =>
      el.textContent?.includes("Selecione o bairro"),
    );
    expect(neighborhood).toBeDefined();
    expect(neighborhood).toBeDisabled();
  });

  it("renders cepRightIcon when provided", () => {
    render(<FormHarness cepRightIcon={<span data-testid="cep-icon">icon</span>} />);
    expect(screen.getByTestId("cep-icon")).toBeInTheDocument();
  });

  it("disables selects while states are loading", () => {
    render(<FormHarness statesLoading />);
    const comboboxes = screen.getAllByRole("combobox");
    const state = comboboxes.find((el) => el.textContent?.includes("Selecione o estado"));
    expect(state).toBeDefined();
    expect(state).toBeDisabled();
  });
});
