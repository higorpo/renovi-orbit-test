import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AddressMap } from "../AddressMap";

const setView = vi.fn();

vi.mock("react-leaflet", () => ({
  MapContainer: ({ children }: { children: ReactNode }) => (
    <div data-testid="map-container">{children}</div>
  ),
  TileLayer: () => <div data-testid="tile-layer" />,
  Marker: ({
    eventHandlers,
    position,
  }: {
    eventHandlers?: { dragend?: (event: { target: { getLatLng: () => { lat: number; lng: number } } }) => void };
    position: [number, number];
  }) => (
    <button
      type="button"
      data-testid="draggable-marker"
      data-position={position.join(",")}
      onClick={() =>
        eventHandlers?.dragend?.({
          target: { getLatLng: () => ({ lat: -27.7, lng: -48.6 }) },
        })
      }
    >
      marker
    </button>
  ),
  useMap: () => ({
    setView,
    getZoom: () => 15,
  }),
}));

vi.mock("leaflet", () => ({
  default: {
    icon: vi.fn(() => ({})),
  },
}));

describe("AddressMap", () => {
  it("renders a placeholder before client mount then the interactive map", async () => {
    const onLocationChange = vi.fn();
    render(
      <AddressMap
        location={{ latitude: -27.5, longitude: -48.4 }}
        onLocationChange={onLocationChange}
        className="map-class"
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("map-container")).toBeInTheDocument();
    });

    expect(screen.getByTestId("draggable-marker")).toHaveAttribute(
      "data-position",
      "-27.5,-48.4",
    );
  });

  it("uses Florianópolis default center when location is null", async () => {
    render(<AddressMap location={null} onLocationChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByTestId("draggable-marker")).toBeInTheDocument();
    });

    expect(screen.getByTestId("draggable-marker").getAttribute("data-position")).toContain(
      "-27.5954",
    );
  });

  it("forwards drag end coordinates to onLocationChange", async () => {
    const onLocationChange = vi.fn();
    render(
      <AddressMap
        location={{ latitude: -27.5, longitude: -48.4 }}
        onLocationChange={onLocationChange}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("draggable-marker")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("draggable-marker"));
    expect(onLocationChange).toHaveBeenCalledWith(-27.7, -48.6);
  });

  it("recenters when location prop changes after geocode", async () => {
    const { rerender } = render(
      <AddressMap
        location={{ latitude: -27.5, longitude: -48.4 }}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("draggable-marker")).toBeInTheDocument();
    });

    rerender(
      <AddressMap
        location={{ latitude: -23.55, longitude: -46.63 }}
        onLocationChange={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("draggable-marker").getAttribute("data-position")).toContain(
        "-23.55",
      );
    });
  });
});
