import { describe, it, expect } from 'vitest';
import en from '../src/locales/en.json';
import fr from '../src/locales/fr.json';

function flattenKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'object' && value !== null) {
      keys.push(...flattenKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

describe('i18n key parity', () => {
  const enKeys = flattenKeys(en);
  const frKeys = flattenKeys(fr);

  it('should have the same keys in en and fr', () => {
    expect(enKeys).toEqual(frKeys);
  });

  it('should have no empty values in en', () => {
    for (const key of enKeys) {
      const value = key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], en);
      expect(value, `en key "${key}" is empty`).toBeTruthy();
    }
  });

  it('should have no empty values in fr', () => {
    for (const key of frKeys) {
      const value = key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], fr);
      expect(value, `fr key "${key}" is empty`).toBeTruthy();
    }
  });
});
