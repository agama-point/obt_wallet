const KEY_CACHE_STORAGE_KEY = "obt_wallet:last_scalar_key";

function saveKeyToCache(value: string): void {
  localStorage.setItem(KEY_CACHE_STORAGE_KEY, value);
}

function loadKeyFromCache(): string | null {
  return localStorage.getItem(KEY_CACHE_STORAGE_KEY);
}

function clearKeyCache(): void {
  localStorage.removeItem(KEY_CACHE_STORAGE_KEY);
}

function hasCachedKey(): boolean {
  return loadKeyFromCache() !== null;
}
