/** The website this app reads from and writes to. Set EXPO_PUBLIC_API_URL to point at another (a test server, say). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://erp.argandufarms.com.ng").replace(/\/$/, "");
