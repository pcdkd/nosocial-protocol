import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";

// noble/ed25519 v2 requires setting the sha512 hash
ed.etc.sha512Sync = (...m) => {
  const h = createHash("sha512");
  for (const msg of m) h.update(msg);
  return new Uint8Array(h.digest());
};

/** Decode a base64url string to Uint8Array */
export function base64urlDecode(s: string): Uint8Array {
  const base64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** Encode Uint8Array to base64url string */
export function base64urlEncode(bytes: Uint8Array): string {
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Extract raw public key bytes from "ed25519:{base64url}" format */
export function parsePublicKey(key: string): Uint8Array {
  const prefix = "ed25519:";
  if (!key.startsWith(prefix)) {
    throw new Error(`Invalid key format: expected "ed25519:" prefix`);
  }
  return base64urlDecode(key.slice(prefix.length));
}

/** Derive a DID from a public key: did:nosocial:{sha256(pubKeyBytes)} */
export function deriveDid(publicKey: string): string {
  const keyBytes = parsePublicKey(publicKey);
  const hash = createHash("sha256").update(keyBytes).digest();
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `did:nosocial:${hex}`;
}

/**
 * Canonical JSON serialization for signing:
 * keys sorted alphabetically at every level, no whitespace.
 */
export function canonicalize(obj: unknown): string {
  if (obj === null || obj === undefined || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return "[" + obj.map(canonicalize).join(",") + "]";
  }
  const sorted = Object.keys(obj as Record<string, unknown>).sort();
  const entries = sorted.map(
    (k) => JSON.stringify(k) + ":" + canonicalize((obj as Record<string, unknown>)[k])
  );
  return "{" + entries.join(",") + "}";
}

/**
 * Verify an Ed25519 signature over a canonical JSON object.
 * The object should have all fields except `signature`.
 */
export function verifySignature(
  obj: Record<string, unknown>,
  signature: string,
  publicKey: string
): boolean {
  const prefix = "ed25519:";
  if (!signature.startsWith(prefix)) return false;

  const sigBytes = base64urlDecode(signature.slice(prefix.length));
  const keyBytes = parsePublicKey(publicKey);
  const message = new TextEncoder().encode(canonicalize(obj));

  return ed.verify(sigBytes, message, keyBytes);
}

/** Sign a canonical JSON object, returning "ed25519:{base64url}" */
export function sign(
  obj: Record<string, unknown>,
  privateKey: Uint8Array
): string {
  const message = new TextEncoder().encode(canonicalize(obj));
  const sig = ed.sign(message, privateKey);
  return `ed25519:${base64urlEncode(sig)}`;
}

/** Generate an Ed25519 keypair */
export function generateKeypair(): {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
} {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return { publicKey, privateKey };
}
