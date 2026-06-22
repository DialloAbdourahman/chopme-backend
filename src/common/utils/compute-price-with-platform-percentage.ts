export const computePriceWithPlatformPercentage = ({
  price,
  platformPercentage,
  roundToNearestFCFA,
  deliveryPrice,
}: {
  price: number;
  platformPercentage: number;
  roundToNearestFCFA: number;
  deliveryPrice?: number;
}): number => {
  const total = (price + (deliveryPrice || 0)) * (1 + platformPercentage / 100);

  // Round up to the next roundToNearestFCFA FCFA
  return Math.ceil(total / roundToNearestFCFA) * roundToNearestFCFA;
};
