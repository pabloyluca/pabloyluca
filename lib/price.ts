/** Converts a percentage configured to two decimal places to integer basis points.
 * All price calculations use MXN centavos and round once per order. */
export function discountAmount(subtotal: number, percent: number) {
  const basisPoints = BigInt(Math.round(percent * 100));
  return Number((BigInt(subtotal) * basisPoints + 5000n) / 10000n);
}
