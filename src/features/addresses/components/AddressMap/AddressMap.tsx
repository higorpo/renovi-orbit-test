/**
 * Interactive map for address step. OpenStreetMap + Leaflet; draggable marker.
 * Renders only on client (Leaflet uses window).
 */

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { AddressLocation } from "../../types/addresses.types";

/** Default map center: Florianópolis. */
const DEFAULT_CENTER: AddressLocation = { latitude: -27.5954, longitude: -48.548 };
const ZOOM = 15;

/** Pans map to the given position when it changes (e.g. after geocoding from address form). */
function MapCenterController({ center }: { center: AddressLocation }) {
  const map = useMap();
  useEffect(() => {
    map.setView([center.latitude, center.longitude], map.getZoom());
  }, [map, center.latitude, center.longitude]);
  return null;
}

function DraggableMarker({
  position,
  onPositionChange,
}: {
  position: AddressLocation;
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const icon = L.icon({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
  });

  const [markerPosition, setMarkerPosition] = useState<[number, number]>([
    position.latitude,
    position.longitude,
  ]);

  useEffect(() => {
    setMarkerPosition([position.latitude, position.longitude]);
  }, [position.latitude, position.longitude]);

  return (
    <Marker
      position={markerPosition}
      draggable
      icon={icon}
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          setMarkerPosition([latlng.lat, latlng.lng]);
          onPositionChange(latlng.lat, latlng.lng);
        },
      }}
    />
  );
}

export interface AddressMapProps {
  /** Current marker position; when null, marker is at center and user can drag to set. */
  location: AddressLocation | null;
  onLocationChange: (lat: number, lng: number) => void;
  className?: string;
}

export function AddressMap({ location, onLocationChange, className }: AddressMapProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const center = location ?? DEFAULT_CENTER;
  const markerPosition = location ?? center;

  if (!mounted) {
    return (
      <div
        className={className}
        style={{ height: 280, background: "var(--muted)", borderRadius: 8 }}
        aria-hidden
      />
    );
  }

  return (
    <div className={className} style={{ height: 280, borderRadius: 8, overflow: "hidden" }}>
      <MapContainer
        center={[center.latitude, center.longitude]}
        zoom={ZOOM}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom
        className="[&_.leaflet-tile-pane]:grayscale"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapCenterController center={center} />
        <DraggableMarker position={markerPosition} onPositionChange={onLocationChange} />
      </MapContainer>
    </div>
  );
}
