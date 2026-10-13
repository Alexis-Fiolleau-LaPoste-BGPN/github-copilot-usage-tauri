import {
  formatCurrencyAmount,
  formatExchangeRateDate,
  type CurrencyCode,
} from '../services/currency';
import { translate, type Language } from '../i18n';

type Props = {
  label: string;
  percent: number;
  used?: number;
  limit?: number;
  className?: string;
  /** Colour of the fill. Derived from the label when not given. */
  variant?: 'premium' | 'standard' | 'claude';
  currencyEquivalent?: number | null;
  currency?: CurrencyCode;
  currencyRateDate?: string | null;
  language?: Language;
};

export default function ProgressBar({
  label,
  percent,
  used,
  limit,
  className,
  variant,
  currencyEquivalent,
  currency = 'EUR',
  currencyRateDate,
  language = 'en',
}: Props) {
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  const fill = variant ?? (label.toLowerCase().includes('premium') ? 'premium' : 'standard');
  const rateDate = formatExchangeRateDate(currencyRateDate ?? null, language);
  const dateSuffix = rateDate ? translate(language, 'rateDateSuffix', { date: rateDate }) : '';
  const tooltip = currency === 'USD'
    ? translate(language, 'usdCurrencyTooltip')
    : translate(language, 'currencyTooltip', { currency, date: dateSuffix });

  return (
    <div className={className}>
      <h2>{label}</h2>
      <div className="progress-bar">
        <div className={`progress-fill ${fill}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="usage-text">
        {typeof used === 'number' && typeof limit === 'number' ? `${used} / ${limit} (${pct}%)` : `(${pct}%)`}
      </div>
      {typeof currencyEquivalent === 'number' && Number.isFinite(currencyEquivalent) && (
        <div
          className="usage-currency-equivalent"
          title={tooltip}
        >
          {translate(language, 'approximateEquivalent', {
            amount: formatCurrencyAmount(currencyEquivalent, currency, language),
          })}
        </div>
      )}
    </div>
  );
}
