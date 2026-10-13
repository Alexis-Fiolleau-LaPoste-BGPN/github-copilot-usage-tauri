import { localeForLanguage, type Language } from '../i18n';

export const CURRENCY_OPTIONS = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type CurrencyCode = (typeof CURRENCY_OPTIONS)[number];

export type UsdExchangeRate = {
  rate: number;
  date: string | null;
};

const CURRENCY_STORAGE_KEY = 'gctCurrency';
const USD_PER_AI_CREDIT = 0.01;

function rateStorageKey(currency: CurrencyCode): string {
  return currency === 'EUR' ? 'usdToEurRate' : `usdTo${currency}Rate`;
}

function isValidRateDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const timestamp = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === date;
}

export function getStoredCurrency(): CurrencyCode {
  const stored = localStorage.getItem(CURRENCY_STORAGE_KEY);
  return CURRENCY_OPTIONS.find((currency) => currency === stored) ?? 'EUR';
}

export function storeCurrency(currency: CurrencyCode): void {
  localStorage.setItem(CURRENCY_STORAGE_KEY, currency);
}

export function getCachedUsdExchangeRate(currency: CurrencyCode): UsdExchangeRate | null {
  if (currency === 'USD') return { rate: 1, date: null };

  try {
    const stored = localStorage.getItem(rateStorageKey(currency));
    if (!stored) return null;

    const parsed: unknown = JSON.parse(stored);
    if (typeof parsed !== 'object' || parsed === null) return null;

    const value = parsed as Partial<UsdExchangeRate>;
    if (typeof value.rate !== 'number' || !Number.isFinite(value.rate) || value.rate <= 0) return null;
    if (typeof value.date !== 'string' || !isValidRateDate(value.date)) return null;

    return { rate: value.rate, date: value.date };
  } catch {
    return null;
  }
}

export async function fetchUsdExchangeRate(currency: CurrencyCode): Promise<UsdExchangeRate> {
  if (currency === 'USD') return { rate: 1, date: null };

  const response = await fetch(`https://api.frankfurter.dev/v2/rate/USD/${currency}`);
  if (!response.ok) throw new Error(`Exchange-rate lookup failed (${response.status})`);

  const result: unknown = await response.json();
  if (typeof result !== 'object' || result === null) throw new Error('Invalid exchange-rate response');

  const value = result as Partial<UsdExchangeRate>;
  if (typeof value.rate !== 'number' || !Number.isFinite(value.rate) || value.rate <= 0) {
    throw new Error(`Invalid USD/${currency} exchange rate`);
  }
  if (typeof value.date !== 'string' || !isValidRateDate(value.date)) {
    throw new Error(`Invalid USD/${currency} exchange-rate date`);
  }

  const rate = { rate: value.rate, date: value.date };
  localStorage.setItem(rateStorageKey(currency), JSON.stringify(rate));
  return rate;
}

export function convertAiCreditsToCurrency(credits: number, usdExchangeRate: number): number {
  return Math.max(0, credits) * USD_PER_AI_CREDIT * usdExchangeRate;
}

export function formatCurrencyAmount(amount: number, currency: CurrencyCode, language: Language): string {
  return new Intl.NumberFormat(localeForLanguage(language), { style: 'currency', currency }).format(amount);
}

export function formatExchangeRateDate(date: string | null, language: Language): string {
  if (!date) return '';
  return new Intl.DateTimeFormat(localeForLanguage(language), { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
}
