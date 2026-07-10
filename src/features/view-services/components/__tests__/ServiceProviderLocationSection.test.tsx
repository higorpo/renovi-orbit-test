// @vitest-environment happy-dom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ServiceProviderLocationSection } from "../ServiceProviderLocationSection";

const openGoogleMapsMock = vi.fn();

vi.mock("@/features/addresses", () => ({
  LocationPreviewMap: () => <div data-testid="map-preview" />,
}));

vi.mock("@/lib/maps/openGoogleMaps", () => ({
  openGoogleMaps: (...args: unknown[]) => openGoogleMapsMock(...args),
}));

describe("ServiceProviderLocationSection", () => {
  it("returns null when there is no location information", () => {
    const { container } = render(<ServiceProviderLocationSection address={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders address and opens maps when coordinates exist", () => {
    render(
      <ServiceProviderLocationSection
        address={{
          neighborhood: "Centro",
          cityName: "Florianópolis",
          stateAbbreviation: "SC",
          latitude: -27.59,
          longitude: -48.54,
        }}
      />,
    );

    expect(screen.getByText("Local do serviço")).toBeInTheDocument();
    expect(screen.getByText(/Centro, Florianópolis/)).toBeInTheDocument();
    expect(screen.getByTestId("map-preview")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Abrir no mapa/i }));
    expect(openGoogleMapsMock).toHaveBeenCalledWith({
      latitude: -27.59,
      longitude: -48.54,
    });
  });

  it("disables map button when coordinates are missing", () => {
    render(
      <ServiceProviderLocationSection
        address={{
          neighborhood: "Centro",
          cityName: "Florianópolis",
          stateAbbreviation: "SC",
          latitude: null,
          longitude: null,
        }}
      />,
    );

    expect(screen.getByRole("button", { name: /Abrir no mapa/i })).toBeDisabled();
  });
});
