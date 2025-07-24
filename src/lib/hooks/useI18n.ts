export function useI18n() {
  return (key: string, substitutions?: string | string[]) =>
    chrome.i18n.getMessage(key, substitutions);
}
