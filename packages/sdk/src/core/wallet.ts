/**
 * Talos SDK Wallet
 *
 * Identity management as defined in SDK_CONTRACT.md.
 */

import {
  generateKeyPair,
  fromSeed,
  sign,
  verify,
  type KeyPair,
} from "../crypto/ed25519.js";
import { TalosInvalidInputError } from "./errors.js";

// Base58btc alphabet for DID encoding
const BASE58_ALPHABET =
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

function base58btcEncode(data: Uint8Array): string {
  let value = BigInt(0);
  for (const byte of data) {
    value = value * BigInt(256) + BigInt(byte);
  }
  const result: string[] = [];
  while (value > 0) {
    const remainder = Number(value % BigInt(58));
    value = value / BigInt(58);
    result.unshift(BASE58_ALPHABET[remainder]);
  }
  for (const byte of data) {
    if (byte === 0) {
      result.unshift(BASE58_ALPHABET[0]);
    } else {
      break;
    }
  }
  return result.join("");
}

// SHA256 for address computation
async function sha256ForAddress(data: Uint8Array): Promise<Uint8Array> {
  // Cast to ArrayBuffer for crypto.subtle compatibility
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", buffer);
  return new Uint8Array(hashBuffer);
}

export class Wallet {
  private readonly keyPair: KeyPair;
  readonly name?: string;

  private constructor(keyPair: KeyPair, name?: string) {
    this.keyPair = keyPair;
    this.name = name;
  }

  /**
   * Generate a new wallet with a random keypair.
   */
  static generate(name?: string): Wallet {
    const keyPair = generateKeyPair();
    return new Wallet(keyPair, name);
  }

  /**
   * Create a wallet from a 32-byte seed.
   * Deterministic - same seed produces identical keypair.
   */
  static fromSeed(seed: Uint8Array, name?: string): Wallet {
    if (seed.length !== 32) {
      throw new TalosInvalidInputError(
        `Seed must be exactly 32 bytes, got ${seed.length}`,
        { seedLength: seed.length },
      );
    }
    const keyPair = fromSeed(seed);
    return new Wallet(keyPair, name);
  }

  /**
   * Get the 32-byte public key.
   */
  get publicKey(): Uint8Array {
    return this.keyPair.publicKey;
  }

  /**
   * Convert public key to DID string.
   * Format: did:key:z6Mk...
   */
  toDid(): string {
    // Multicodec prefix for Ed25519 public key: 0xed01
    const prefix = new Uint8Array([0xed, 0x01]);
    const multicodecKey = new Uint8Array(
      prefix.length + this.keyPair.publicKey.length,
    );
    multicodecKey.set(prefix);
    multicodecKey.set(this.keyPair.publicKey, prefix.length);
    return `did:key:z${base58btcEncode(multicodecKey)}`;
  }

  /**
   * Get hex-encoded public key hash (address).
   */
  async getAddress(): Promise<string> {
    const hash = await sha256ForAddress(this.keyPair.publicKey);
    return Array.from(hash)
      .map((b: number) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  /**
   * Sign a message using Ed25519.
   * Returns 64-byte signature.
   */
  async sign(message: Uint8Array): Promise<Uint8Array> {
    return sign(message, this.keyPair.privateKey);
  }

  /**
   * Verify a signature against a message and public key.
   */
  static async verify(
    message: Uint8Array,
    signature: Uint8Array,
    publicKey: Uint8Array,
  ): Promise<boolean> {
    try {
      return await verify(signature, message, publicKey);
    } catch {
      return false;
    }
  }
}
