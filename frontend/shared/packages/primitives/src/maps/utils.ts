import type { LatLng } from "./types";

export function projectPoint(
  point: LatLng,
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
) {
  const { lat, lng } = point;
  const width = bounds.maxLng - bounds.minLng || 1;
  const height = bounds.maxLat - bounds.minLat || 1;

  const x = (lng - bounds.minLng) / width;
  const y = 1 - (lat - bounds.minLat) / height;
  return { x, y };
}

export function calculateBounds(points: LatLng[]): {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
} {
  if (points.length === 0) {
    return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  }
  const [firstPoint, ...restPoints] = points;
  if (!firstPoint) {
    return { minLat: -90, maxLat: 90, minLng: -180, maxLng: 180 };
  }
  return restPoints.reduce(
    (acc, point) => ({
      minLat: Math.min(acc.minLat, point.lat),
      maxLat: Math.max(acc.maxLat, point.lat),
      minLng: Math.min(acc.minLng, point.lng),
      maxLng: Math.max(acc.maxLng, point.lng),
    }),
    {
      minLat: firstPoint.lat,
      maxLat: firstPoint.lat,
      minLng: firstPoint.lng,
      maxLng: firstPoint.lng,
    },
  );
}

export function flattenCoordinates(input: Array<LatLng[] | LatLng>): LatLng[] {
  const points: LatLng[] = [];
  input.forEach((item) => {
    if (Array.isArray(item)) {
      item.forEach((p) => points.push(p));
    } else {
      points.push(item);
    }
  });
  return points;
}
