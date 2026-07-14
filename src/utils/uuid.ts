const WEB_CRYPTO_UNAVAILABLE =
  "Web Crypto API is unavailable; UUID generation requires randomUUID or getRandomValues support.";

export function generateUuid(): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi) throw new Error(WEB_CRYPTO_UNAVAILABLE);

  if (typeof cryptoApi.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }

  if (typeof cryptoApi.getRandomValues !== "function") {
    throw new Error(WEB_CRYPTO_UNAVAILABLE);
  }

  const bytes = cryptoApi.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
