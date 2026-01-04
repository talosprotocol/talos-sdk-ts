import { x25519 } from '@noble/curves/ed25519.js';

export interface KeyPairX25519 {
    publicKey: Uint8Array;
    privateKey: Uint8Array;
}

/**
 * Generate a random X25519 keypair.
 */
export function generateKeyPair(): KeyPairX25519 {
    const { secretKey, publicKey } = x25519.keygen();
    return { publicKey, privateKey: secretKey };
}

/**
 * Generate X25519 keypair from a seed.
 */
export function fromSeed(seed: Uint8Array): KeyPairX25519 {
    if (seed.length !== 32) {
        throw new Error(`Seed must be 32 bytes, got ${seed.length}`);
    }
    const privateKey = seed;
    const publicKey = x25519.getPublicKey(privateKey);
    return { publicKey, privateKey };
}

export function getPublicKey(privateKey: Uint8Array): Uint8Array {
    return x25519.getPublicKey(privateKey);
}

/**
 * Perform Diffie-Hellman key exchange.t shared secret.
 */
export function getSharedSecret(privateKey: Uint8Array, publicKey: Uint8Array): Uint8Array {
    return x25519.getSharedSecret(privateKey, publicKey);
}
