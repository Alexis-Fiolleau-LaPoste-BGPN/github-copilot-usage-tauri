export type UsdToEurRate = {
  rate: number;
  date: string;
};

const USD_TO_EUR_STORAGE_KEY = 'usdToEurRate';
const USD_PER_AI_CREDIT = 0.01;

export function getCachedUsdToEurRate(): UsdToEurRate | null {
  try {
    const stored = localStorage.getItem(USD_TO_EUR_STORAGE_KEY);
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const value = parsed as Partial<UsdToEurRate>;
    if (typeof value.rate !== 'number' || !Number.isFinite(value.rate) || value.rate <= 0) return null;
    if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;

    return { rate: value.rate, date: value.date };
  } catch {
    return null;
  }
}

export async function fetchUsdToEurRate(): Promise<UsdToEurRate> {
  const response = await fetch('https://api.frankfurter.dev/v2/rate/USD/EUR');
  if (!response.ok) throw new Error(`Exchange-rate lookup failed (${response.status})`);

  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null) throw new Error('Invalid exchange-rate response');

  const value = result as Partial<UsdToEurRate>;
  if (typeof value.rate !== 'number' || !Number.isFinite(value.rate) || value.rate <= 0) {
    throw new Error('Invalid USD/EUR exchange rate');
  }
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) {
    throw new Error('Invalid USD/EUR exchange-rate date');
  }

  const rate = { rate: value.rate, date: value.date };
  localStorage.setItem(USD_TO_EUR_STORAGE_KEY, JSON.stringify(rate));
  return rate;
}

export function convertAiCreditsToEuro(credits: number, usdToEurRate: number): number {
  return Math.max(0, credits) * USD_PER_AI_CREDIT * usdToEurRate;
}

export function formatEuroAmount(amount: number): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'EUR' }).format(amount);
}
