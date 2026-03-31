/**
 * AES-256-GCM encryption for sensitive tokens stored in Convex.
 *
 * Uses the Web Crypto API (available in Convex V8 runtime).
 * Requires TOKEN_ENCRYPTION_KEY env var — a 64-char hex string (32 bytes).
 *
 * Format: base64(iv + ciphertext + authTag)
 *   - iv: 12 bytes (random per encryption)
 *   - authTag: included in ciphertext by Web Crypto
 */

const IV_LENGTH = 12;
const ALGORITHM = "AES-GCM";

function getKeyHex(): string {
	const key = process.env.TOKEN_ENCRYPTION_KEY;
	if (!key || key.length !== 64) {
		throw new Error(
			"TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
		);
	}
	return key;
}

function hexToBytes(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
	}
	return bytes;
}

async function getKey(): Promise<CryptoKey> {
	const keyBytes = hexToBytes(getKeyHex());
	return crypto.subtle.importKey(
		"raw",
		keyBytes.buffer as ArrayBuffer,
		{ name: ALGORITHM },
		false,
		["encrypt", "decrypt"],
	);
}

function toBase64(bytes: Uint8Array): string {
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
	const binary = atob(b64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return bytes;
}

/**
 * Encrypt a plaintext string with AES-256-GCM.
 * Returns a base64 string containing iv + ciphertext.
 */
export async function encrypt(plaintext: string): Promise<string> {
	const key = await getKey();
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
	const encoded = new TextEncoder().encode(plaintext);

	const ciphertext = await crypto.subtle.encrypt(
		{ name: ALGORITHM, iv },
		key,
		encoded,
	);

	// Combine iv + ciphertext into one buffer
	const combined = new Uint8Array(iv.length + ciphertext.byteLength);
	combined.set(iv);
	combined.set(new Uint8Array(ciphertext), iv.length);

	return toBase64(combined);
}

/**
 * Decrypt a base64 string produced by encrypt().
 * Returns the original plaintext.
 */
export async function decrypt(encryptedB64: string): Promise<string> {
	const key = await getKey();
	const combined = fromBase64(encryptedB64);

	const iv = combined.slice(0, IV_LENGTH);
	const ciphertext = combined.slice(IV_LENGTH);

	const decrypted = await crypto.subtle.decrypt(
		{ name: ALGORITHM, iv },
		key,
		ciphertext,
	);

	return new TextDecoder().decode(decrypted);
}

/**
 * Check if TOKEN_ENCRYPTION_KEY is configured.
 * Returns false if missing — callers can fall back to plaintext.
 */
export function isEncryptionConfigured(): boolean {
	const key = process.env.TOKEN_ENCRYPTION_KEY;
	return !!key && key.length === 64;
}
