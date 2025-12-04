export interface LatLng {
  lat: number;
  lng: number;
}

export interface MapMarker {
  id?: string;
  position: LatLng;
  title?: string;
  subtitle?: string;
  status?: "active" | "error" | "maintenance" | "offline" | string;
  type?: string;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface MapPath {
  id?: string;
  coordinates: LatLng[];
  color?: string;
  width?: number;
  metadata?: Record<string, unknown>;
}

export interface MapPolygon {
  id?: string;
  coordinates: LatLng[][] | LatLng[];
  color?: string;
  opacity?: number;
  metadata?: Record<string, unknown>;
}

export interface MapViewState {
  center: LatLng;
  zoom: number;
}
