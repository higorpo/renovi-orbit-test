import type { ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocationPreviewMap } from "../LocationPreviewMap";

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: () => <div data-testid="marker" />,
  useMap: () => ({
    setView: vi.fn(),
    getZoom: () => 15,
  }),
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
  },
}));

describe("LocationPreviewMap", () => {
  it("shows a placeholder before mount then renders the map", async () => {
    const { container } = render(
      <LocationPreviewMap
        location={{ latitude: -27.5, longitude: -48.4 }}
        height={180}
        className="preview"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });

    expect(screen.getByTestId("marker")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("preview");
  });

  it("applies custom height to the map container wrapper", async () => {
    const { container } = render(
      <LocationPreviewMap
        location={{ latitude: -27.5, longitude: -48.4 }}
        height={220}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });

    expect(container.firstChild).toHaveStyle({ height: "220px" });
  });
});
