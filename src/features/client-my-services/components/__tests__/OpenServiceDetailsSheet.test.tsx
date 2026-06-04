import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Wrench } from "lucide-react";
import { OpenServiceDetailsSheet } from "../OpenServiceDetailsSheet";
import type { ServiceRequestCardModel } from "../../types/client-my-services.types";

vi.mock("../ClientMyServicesSections", () => ({
  ClientMyServicesSections: () => <div data-testid="sections" />,
}));

vi.mock("@/features/request-quote", () => ({
  getServiceCardStyle: vi.fn(() => ({
    Icon: Wrench,
    color: "from-slate-500 to-slate-700",
  })),
}));

const baseModel: ServiceRequestCardModel = {
  id: "sr-1",
  title: "Título do pedido",
  description: "Detalhes",
  descriptionPreview: "",
  formData: null,
  formSchema: null,
  listPhase: "negotiation",
  statusTabId: "negotiation",
  createdAt: "2025-03-01T12:00:00Z",
  updatedAt: "2025-03-01T12:00:00Z",
  address: {
    neighborhood: "Centro",
    cityName: "Florianópolis",
    stateAbbreviation: "SC",
    street: "Rua A",
    number: "10",
    zipCode: "88000-000",
    complement: "Apto 2",
  },
  service: { title: "Eletricista", slug: "eletricista" },
  photoPaths: [],
};

describe("OpenServiceDetailsSheet", () => {
  it("renders title, service, address parts, and sections when open", () => {
    const onOpenChange = vi.fn();
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={baseModel}
        onOpenChange={onOpenChange}
      />
    );

    expect(screen.getByText("Título do pedido")).toBeInTheDocument();
    expect(screen.getByText("Eletricista")).toBeInTheDocument();
    expect(screen.getByText(/Rua A, 10/i)).toBeInTheDocument();
    expect(screen.getByText(/Complemento: Apto 2/i)).toBeInTheDocument();
    expect(screen.getByText(/Centro, Florianópolis - SC/i)).toBeInTheDocument();
    expect(screen.getByText(/CEP: 88000-000/i)).toBeInTheDocument();
    expect(screen.getByTestId("sections")).toBeInTheDocument();
  });

  it("shows fallback address copy when address is missing", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{ ...baseModel, address: null }}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText("Endereço não informado")).toBeInTheDocument();
  });

  it("closes when close button is clicked", () => {
    const onOpenChange = vi.fn();
    render(
      <OpenServiceDetailsSheet open serviceRequest={baseModel} onOpenChange={onOpenChange} />
    );

    const closeButtons = screen.getAllByRole("button", { name: /^Fechar$/i });
    fireEvent.click(closeButtons[0]);
    expect(onOpenChange).toHaveBeenCalled();
  });

  it("renders fallback service label and omits icon when service is missing", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{ ...baseModel, service: undefined as unknown as typeof baseModel.service }}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText("Serviço")).toBeInTheDocument();
  });

  it("formats address line2 without state segment when state is missing", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{
          ...baseModel,
          address: {
            neighborhood: "Centro",
            cityName: "Florianópolis",
            stateAbbreviation: undefined,
            street: "Rua C",
            number: "5",
            zipCode: "",
            complement: "",
          },
        }}
        onOpenChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Rua C, 5 \| Centro, Florianópolis/)
    ).toBeInTheDocument();
  });

  it("includes complement line when street and number are empty", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{
          ...baseModel,
          address: {
            neighborhood: "Centro",
            cityName: "São Paulo",
            stateAbbreviation: "SP",
            street: "",
            number: "",
            zipCode: "01000-000",
            complement: "Bloco B",
          },
        }}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Complemento: Bloco B/)).toBeInTheDocument();
  });

  it("formats address with only city and state when street is missing", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{
          ...baseModel,
          address: {
            neighborhood: "",
            cityName: "Florianópolis",
            stateAbbreviation: "SC",
            street: "",
            number: "",
            zipCode: "",
            complement: "",
          },
        }}
        onOpenChange={vi.fn()}
      />
    );
    expect(screen.getByText(/Florianópolis\s*-\s*SC/)).toBeInTheDocument();
  });

  it("formats address with only state when neighborhood and city are blank", () => {
    render(
      <OpenServiceDetailsSheet
        open
        serviceRequest={{
          ...baseModel,
          address: {
            neighborhood: "  ",
            cityName: "  ",
            stateAbbreviation: "RJ",
            street: "Rua B",
            number: "1",
            zipCode: "20000-000",
            complement: undefined,
          },
        }}
        onOpenChange={vi.fn()}
      />
    );
    expect(
      screen.getByText(/Rua B, 1 \| RJ \| CEP: 20000-000/)
    ).toBeInTheDocument();
  });

  it("renders no inner card when serviceRequest is null", () => {
    render(<OpenServiceDetailsSheet open serviceRequest={null} onOpenChange={vi.fn()} />);
    expect(screen.queryByText("Título do pedido")).not.toBeInTheDocument();
  });
});
