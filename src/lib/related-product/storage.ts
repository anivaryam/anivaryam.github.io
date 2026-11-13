import type { SavedProviderSettings } from "./types";

const STORAGE_KEY = "related-product-finder.v1";
const ENVELOPE_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const ASSOCIATED_DATA = new TextEncoder().encode(`${STORAGE_KEY}:aes-gcm:v1`);

interface EncryptedSettings {
  version: 1;
  algorithm: "AES-GCM";
  kdf: "PBKDF2-SHA-256";
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function getCrypto(): Crypto {
  if (!globalThis.crypto?.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error("Secure browser encryption is unavailable. Open this page over HTTPS.");
  }
  return globalThis.crypto;
}

async function deriveEncryptionKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const crypto = getCrypto();
  const material = await crypto.subtle.importKey(
    "raw",
    asArrayBuffer(new TextEncoder().encode(passphrase)),
    "PBKDF2",
    false,
    ["deriveKey"],
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: asArrayBuffer(salt),
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

function isSavedSettings(value: unknown): value is SavedProviderSettings {
  if (!value || typeof value !== "object") return false;
  const settings = value as Partial<SavedProviderSettings>;
  return typeof settings.apiBase === "string"
    && typeof settings.apiKey === "string"
    && typeof settings.selectedModel === "string";
}

function readEnvelope(): EncryptedSettings | null {
  let stored: string | null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error("Browser storage is unavailable. Check your browser privacy settings.");
  }
  if (!stored) return null;
  if (stored.length > 50_000) throw new Error("Saved settings are invalid or too large.");

  let envelope: Partial<EncryptedSettings>;
  try {
    envelope = JSON.parse(stored) as Partial<EncryptedSettings>;
  } catch {
    throw new Error("Saved settings are damaged. Forget them and connect again.");
  }

  if (
    envelope.version !== ENVELOPE_VERSION
    || envelope.algorithm !== "AES-GCM"
    || envelope.kdf !== "PBKDF2-SHA-256"
    || envelope.iterations !== PBKDF2_ITERATIONS
    || typeof envelope.salt !== "string"
    || typeof envelope.iv !== "string"
    || typeof envelope.ciphertext !== "string"
  ) {
    throw new Error("Saved settings use an unsupported format. Forget them and connect again.");
  }

  return envelope as EncryptedSettings;
}

export function hasSavedProviderSettings(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    throw new Error("Browser storage is unavailable. Check your browser privacy settings.");
  }
}

export async function saveProviderSettings(
  settings: SavedProviderSettings,
  passphrase: string,
): Promise<void> {
  if (passphrase.length < 12) {
    throw new Error("Use a vault passphrase with at least 12 characters.");
  }

  const crypto = getCrypto();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = new TextEncoder().encode(JSON.stringify(settings));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(iv),
      additionalData: asArrayBuffer(ASSOCIATED_DATA),
      tagLength: 128,
    },
    key,
    asArrayBuffer(plaintext),
  );
  const envelope: EncryptedSettings = {
    version: ENVELOPE_VERSION,
    algorithm: "AES-GCM",
    kdf: "PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(ciphertext)),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
  } catch {
    throw new Error("Could not save encrypted settings in this browser.");
  }
}

export async function unlockProviderSettings(passphrase: string): Promise<SavedProviderSettings> {
  const envelope = readEnvelope();
  if (!envelope) throw new Error("No saved API settings were found.");

  try {
    const key = await deriveEncryptionKey(passphrase, fromBase64(envelope.salt));
    const plaintext = await getCrypto().subtle.decrypt(
      {
        name: "AES-GCM",
        iv: asArrayBuffer(fromBase64(envelope.iv)),
        additionalData: asArrayBuffer(ASSOCIATED_DATA),
        tagLength: 128,
      },
      key,
      asArrayBuffer(fromBase64(envelope.ciphertext)),
    );
    const settings: unknown = JSON.parse(new TextDecoder().decode(plaintext));
    if (!isSavedSettings(settings)) throw new Error("Invalid saved settings.");
    return settings;
  } catch {
    throw new Error("Could not unlock. Check your passphrase or forget the damaged settings.");
  }
}

export function forgetProviderSettings(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    throw new Error("Could not remove saved settings from this browser.");
  }
}
