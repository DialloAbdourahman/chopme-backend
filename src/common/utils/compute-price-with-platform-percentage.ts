export const computePriceWithPlatformPercentage = ({
  price,
  platformPercentage,
  roundToNearestFCFA,
}: {
  price: number;
  platformPercentage: number;
  roundToNearestFCFA: number;
}): number => {
  const total = price * (1 + platformPercentage / 100);

  // Round up to the next roundToNearestFCFA FCFA
  return Math.ceil(total / roundToNearestFCFA) * roundToNearestFCFA;
};
