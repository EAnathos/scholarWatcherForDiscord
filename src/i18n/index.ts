import i18next from 'i18next';
import en from '../locales/en.json' with { type: 'json' };
import fr from '../locales/fr.json' with { type: 'json' };

await i18next.init({
  fallbackLng: 'en',
  defaultNS: 'translation',
  resources: {
    en: { translation: en },
    fr: { translation: fr },
  },
  interpolation: { escapeValue: false },
});

export function t(key: string, lang: string, options?: Record<string, unknown>): string {
  return i18next.t(key, { lng: lang, ...options });
}

export { i18next };
