// Encrypted-at-rest storage for Arka's most sensitive data: AI provider API
// keys and the GitHub Personal Access Token (both live inside the app's
// `arka-state` blob). Everything else (chat messages, memory, virtual files)
// stays as plain localStorage — this module specifically closes the
// "plaintext secrets in localStorage" finding from the security audit.
//
// THREAT MODEL / WHAT THIS DOES AND DOES NOT PROTECT AGAINST
// ----------------------------------------------------------------------
// Protects against:
//  - Someone reading your browser profile / localStorage files at rest
//    (stolen laptop, disk backup, another local OS user, a browser
//    extension that only reads storage without running in-page JS, etc.)
//    without knowing your passphrase.
// Does NOT protect against:
//  - An active XSS bug running JS in this exact page *while it is unlocked*
//    — at that point the decrypted keys are necessarily in memory to make
//    API calls, same as any client-side app. There is no way to fully avoid
//    this without moving API calls behind a server the browser never sees
//    keys from.
//  - A weak/guessable passphrase (we use PBKDF2 with a high iteration count
//    to slow down brute force, but a strong passphrase is still up to you).
//
// The vault is OPT-IN (see Settings → Keamanan). If never enabled, the app
// behaves exactly as before (plaintext `arka-state` in localStorage).

const SALT_KEY = 'arka-vault-salt';
const DATA_KEY = 'arka-vault-data';
const PBKDF2_ITERATIONS = 200_000;

interface EncryptedPayload {
  iv: string; // base64
  data: string; // base64
}

// Key is kept ONLY in memory for the life of the tab. Reloading the page
// always requires re-entering the passphrase — this is intentional: it's
// what makes "encrypted at rest" meaningful.
let activeKey: CryptoKey | null = null;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach(b => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptString(plaintext: string, key: CryptoKey): Promise<EncryptedPayload> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, enc.encode(plaintext));
  return { iv: toBase64(iv), data: toBase64(new Uint8Array(cipherBuf)) };
}

async function decryptString(payload: EncryptedPayload, key: CryptoKey): Promise<string> {
  const dec = new TextDecoder();
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64(payload.iv) as BufferSource },
    key,
    fromBase64(payload.data) as BufferSource
  );
  return dec.decode(plainBuf);
}

export function isVaultConfigured(): boolean {
  return !!localStorage.getItem(SALT_KEY) && !!localStorage.getItem(DATA_KEY);
}

export function isVaultUnlocked(): boolean {
  return activeKey !== null;
}

/** Encrypt `plaintextObj` under a new passphrase and store it, replacing any previous vault. */
export async function setupVault(passphrase: string, plaintextObj: unknown): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await deriveKey(passphrase, salt);
  const payload = await encryptString(JSON.stringify(plaintextObj), key);
  localStorage.setItem(SALT_KEY, toBase64(salt));
  localStorage.setItem(DATA_KEY, JSON.stringify(payload));
  activeKey = key;
}

/** Try to unlock with `passphrase`. Returns the decrypted object, or null if wrong/corrupted. */
export async function unlockVault(passphrase: string): Promise<unknown | null> {
  const saltB64 = localStorage.getItem(SALT_KEY);
  const dataStr = localStorage.getItem(DATA_KEY);
  if (!saltB64 || !dataStr) return null;

  try {
    const salt = fromBase64(saltB64);
    const key = await deriveKey(passphrase, salt);
    const payload = JSON.parse(dataStr) as EncryptedPayload;
    const plaintext = await decryptString(payload, key);
    activeKey = key;
    return JSON.parse(plaintext);
  } catch {
    return null; // wrong passphrase, or corrupted/tampered ciphertext
  }
}

/** Re-encrypt the given plaintext object using the already-unlocked session key. */
export async function saveToVault(plaintextObj: unknown): Promise<void> {
  if (!activeKey) return; // not unlocked in this session — nothing we can safely persist
  const payload = await encryptString(JSON.stringify(plaintextObj), activeKey);
  localStorage.setItem(DATA_KEY, JSON.stringify(payload));
}

/** Drop the in-memory key. Vault stays configured; next access requires the passphrase again. */
export function lockVault(): void {
  activeKey = null;
}

/** Decrypt with `passphrase`, remove the vault entirely, and return the plaintext to re-save unencrypted. */
export async function disableVault(passphrase: string): Promise<unknown | null> {
  const decrypted = await unlockVault(passphrase);
  if (decrypted === null) return null;
  localStorage.removeItem(SALT_KEY);
  localStorage.removeItem(DATA_KEY);
  activeKey = null;
  return decrypted;
}

export async function changeVaultPassphrase(oldPassphrase: string, newPassphrase: string): Promise<boolean> {
  const decrypted = await unlockVault(oldPassphrase);
  if (decrypted === null) return false;
  await setupVault(newPassphrase, decrypted);
  return true;
}
