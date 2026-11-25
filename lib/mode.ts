export function isSandbox(): boolean {
  if (process.env.VERCEL && process.env.COMMERCE_MODE !== 'live') throw new Error('Configura COMMERCE_MODE=live y la conexión Supabase para desplegar.');
  if (process.env.COMMERCE_MODE === 'live') return false;
  if (process.env.COMMERCE_MODE === 'sandbox' || (!process.env.COMMERCE_MODE && process.env.NODE_ENV !== 'production')) return true;
  throw new Error('Configura explícitamente COMMERCE_MODE.');
}
