/**
 * Read-only map preview. OpenStreetMap + Leaflet; fixed marker.
 * Renders only on client (Leaflet uses window).
 */

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { cn } from "@/lib/utils";
import type { AddressLocation } from "../../types/addresses.types";

const ZOOM = 15;

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function MapCenterController({ center }: { center: AddressLocation }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], ZOOM);
  }, [map, center.latitude, center.longitude]);
  return null;
}

export interface LocationPreviewMapProps {
  location: AddressLocation;
  className?: string;
  height?: number;
}

export function LocationPreviewMap({
  location,
  className,
  height = 240,
}: LocationPreviewMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className={cn("relative isolate z-0", className)}
        style={{ height, background: "var(--muted)", borderRadius: 8 }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className={cn("relative isolate z-0", className)}
      style={{ height, borderRadius: 8, overflow: "hidden" }}
    >
      <MapContainer
        center={[location.latitude, location.longitude]}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={false}
        dragging
        className="[&_.leaflet-tile-pane]:grayscale"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenterController center={location} />
        <Marker position={[location.latitude, location.longitude]} icon={markerIcon} />
      </MapContainer>
    </div>
  );
}
