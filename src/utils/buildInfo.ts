export interface BrowserCapability {
  label: string;
  available: boolean;
  detail: string;
}

export const BUILD_INFO = {
  version: "1.0.0",
  mode: import.meta.env.MODE,
  buildId: import.meta.env.VITE_BUILD_ID || "Local build",
  commit: import.meta.env.VITE_COMMIT_SHA || "Not provided",
  schemaVersion: 1,
} as const;

export function browserCapabilities(): BrowserCapability[] {
  const crypto = globalThis.crypto;
  const randomValuesAvailable = Boolean(crypto && typeof crypto.getRandomValues === "function");
  const nativeUuidAvailable = Boolean(crypto && typeof crypto.randomUUID === "function");
  const indexedDbAvailable = typeof globalThis.indexedDB !== "undefined";
  const filePickerAvailable = globalThis.isSecureContext && "showSaveFilePicker" in globalThis;
  return [
    {
      label: "Web Crypto",
      available: randomValuesAvailable,
      detail: nativeUuidAvailable ? "Native UUIDs" : randomValuesAvailable ? "Compatible UUID fallback" : "Unavailable",
    },
    {
      label: "Local recovery",
      available: indexedDbAvailable,
      detail: indexedDbAvailable ? "IndexedDB available" : "Browser storage unavailable",
    },
    {
      label: "Direct file save",
      available: filePickerAvailable,
      detail: filePickerAvailable ? "File picker available" : "Download fallback active",
    },
    {
      label: "Plain HTTP LAN",
      available: randomValuesAvailable,
      detail: globalThis.isSecureContext ? "Secure context" : "UUID fallback active",
    },
  ];
}
