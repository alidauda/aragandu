import "expo-sqlite/localStorage/install";

import * as SecureStore from "expo-secure-store";

/** What the app keeps on the phone: the last figures it loaded and entries waiting to be sent. */
export const kept = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  /** False when the phone couldn't keep it (storage full). */
  set(key: string, value: unknown): boolean {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
  remove(key: string) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

const TOKEN = "argandu.token";
// The browser build (for testing) has no keychain.
const web = process.env.EXPO_OS === "web";

/** The sign-in token, in the phone's keychain. */
export const token = {
  get: async () => (web ? localStorage.getItem(TOKEN) : SecureStore.getItemAsync(TOKEN)),
  set: async (value: string) => (web ? localStorage.setItem(TOKEN, value) : SecureStore.setItemAsync(TOKEN, value)),
  clear: async () => (web ? localStorage.removeItem(TOKEN) : SecureStore.deleteItemAsync(TOKEN)),
};
