import { useCallback, useEffect, useSyncExternalStore } from 'react';
import messages from './messages.json';
export { UI_COPY, type UiCopy } from './legacy-ui-copy.js';

export type Locale = 'en' | 'zh-CN' | 'ja';
export const LOCALE_KEY = 'airp-ui-locale';
export function validLocale(value: unknown): Locale {
  return value === 'zh-CN' || value === 'ja' ? value : 'en';
}
export function translate(locale: Locale, key: string, values: Record<string, string | number> = {}): string {
  const entry = (messages as Record<string, Record<string, string>>)[key];
  const text = locale === 'en' ? key : entry?.[locale] ?? key;
  return text.replace(/\{(\w+)\}/g, (token, name) => String(values[name] ?? token));
}
let locale: Locale = 'en';
try { locale = validLocale(localStorage.getItem(LOCALE_KEY)); } catch { /* Storage may be unavailable. */ }
const listeners = new Set<() => void>();
export function setLocale(value: Locale): void {
  locale = validLocale(value);
  try { localStorage.setItem(LOCALE_KEY, locale); } catch { /* Keep an in-memory preference. */ }
  listeners.forEach(listener => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useLocale() {
  const current = useSyncExternalStore(subscribe, () => locale, () => 'en' as Locale);
  useEffect(() => { document.documentElement.lang = current; }, [current]);
  const t = useCallback((key: string, values?: Record<string, string | number>) => translate(current, key, values), [current]);
  return { locale: current, setLocale, t };
}
