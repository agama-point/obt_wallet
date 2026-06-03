"use strict";
const KEY_CACHE_STORAGE_KEY = "obt_wallet:last_scalar_key";
function saveKeyToCache(value) {
    localStorage.setItem(KEY_CACHE_STORAGE_KEY, value);
}
function loadKeyFromCache() {
    return localStorage.getItem(KEY_CACHE_STORAGE_KEY);
}
function clearKeyCache() {
    localStorage.removeItem(KEY_CACHE_STORAGE_KEY);
}
function hasCachedKey() {
    return loadKeyFromCache() !== null;
}
