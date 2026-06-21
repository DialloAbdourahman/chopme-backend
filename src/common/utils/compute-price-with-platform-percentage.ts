export const computePriceWithPlatformPercentage = ({
  price,
  platformPercentage,
  rountToNearestFCFA,
}: {
  price: number;
  platformPercentage: number;
  rountToNearestFCFA: number;
}): number => {
  const total = price * (1 + platformPercentage / 100);

  // Round up to the next rountToNearestFCFA FCFA
  return Math.ceil(total / rountToNearestFCFA) * rountToNearestFCFA;
};
