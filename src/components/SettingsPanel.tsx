import { CURRENCY_OPTIONS, type CurrencyCode } from '../services/currency';
import { translate, type Language } from '../i18n';

type Props = {
  language: Language;
  currency: CurrencyCode;
  isOpen: boolean;
  onLanguageChange: (language: Language) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
};

const CURRENCY_LABELS = {
  EUR: 'euro',
  USD: 'usDollar',
  GBP: 'poundSterling',
  CHF: 'swissFranc',
} as const;

export default function SettingsPanel({ language, currency, isOpen, onLanguageChange, onCurrencyChange }: Props) {
  return (
    <section className="settings-panel" id="gct-settings" aria-label={translate(language, 'settings')} hidden={!isOpen}>
      <h2>{translate(language, 'settings')}</h2>
      <p className="settings-description">{translate(language, 'settingsDescription')}</p>
      <div className="settings-fields">
        <label className="settings-field">
          <span>{translate(language, 'language')}</span>
          <select value={language} onChange={(event) => onLanguageChange(event.target.value as Language)}>
            <option value="en">{translate(language, 'english')}</option>
            <option value="fr">{translate(language, 'french')}</option>
          </select>
        </label>
        <label className="settings-field">
          <span>{translate(language, 'currency')}</span>
          <select value={currency} onChange={(event) => onCurrencyChange(event.target.value as CurrencyCode)}>
            {CURRENCY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {translate(language, CURRENCY_LABELS[option])}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
