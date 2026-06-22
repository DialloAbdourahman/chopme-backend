interface GeoPoint {
  latitude: number;
  longitude: number;
}

export function computeDistanceBetweenTwoPoints({
  from,
  to,
}: {
  from: GeoPoint;
  to: GeoPoint;
}): number {
  const R = 6371; // Earth's radius in km

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.latitude)) *
      Math.cos(toRadians(to.latitude)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}
