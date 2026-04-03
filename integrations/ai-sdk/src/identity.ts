/**
 * NoSocial agent identity — Ed25519 keypairs, DID derivation, and signing.
 *
 * Adapted from oracle/src/crypto/signing.ts. Uses @noble/ed25519 v2.
 * Keys are stored as raw bytes in a configurable directory.
 */

import * as ed from "@noble/ed25519";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// noble/ed25519 v2 requires setting the sha512 hash
ed.etc.sha512Sync = (...m: Uint8Array[]) => {
  const h = createHash("sha512");
  for (const msg of m) h.update(msg);
  return new Uint8Array(h.digest());
};

function base64urlEncode(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

function canonicalize(obj: unknown): string {
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

function safeFilename(name: string): string {
  const h = createHash("sha256").update(name).digest("hex").slice(0, 12);
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_");
  return `${safe}_${h}`;
}

export class AgentIdentity {
  readonly publicKeyStr: string;
  readonly did: string;
  private readonly privateKey: Uint8Array;

  constructor(privateKey: Uint8Array) {
    this.privateKey = privateKey;
    const publicKey = ed.getPublicKey(privateKey);
    this.publicKeyStr = `ed25519:${base64urlEncode(publicKey)}`;
    const hash = createHash("sha256").update(publicKey).digest("hex");
    this.did = `did:nosocial:${hash}`;
  }

  static generate(): AgentIdentity {
    return new AgentIdentity(ed.utils.randomPrivateKey());
  }

  static async loadOrCreate(name: string, keysDir = ".nosocial/keys"): Promise<AgentIdentity> {
    await mkdir(keysDir, { recursive: true });
    const keyFile = join(keysDir, `${safeFilename(name)}.key`);

    try {
      const data = await readFile(keyFile);
      return new AgentIdentity(new Uint8Array(data));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }

    const identity = AgentIdentity.generate();
    await writeFile(keyFile, Buffer.from(identity.privateKey), { mode: 0o600 });
    return identity;
  }

  sign(obj: Record<string, unknown>): string {
    const message = new TextEncoder().encode(canonicalize(obj));
    const sig = ed.sign(message, this.privateKey);
    return `ed25519:${base64urlEncode(sig)}`;
  }
}

export { canonicalize };
