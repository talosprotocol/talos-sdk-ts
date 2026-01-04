import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

/**
 * Encrypt data using ChaCha20-Poly1305.
 * @param key 32 bytes
 * @param nonce 12 bytes
 * @param plaintext Data to encrypt
 * @param aad Associated data (optional)
 * @returns Ciphertext with authentication tag appended (standard behavior of noble)
 */
export function encrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad?: Uint8Array
): Uint8Array {
    return chacha20poly1305(new Uint8Array(key), new Uint8Array(nonce), aad ? new Uint8Array(aad) : undefined)
        .encrypt(new Uint8Array(plaintext));
}

/**
 * Decrypt data using ChaCha20-Poly1305.
 * @param key 32 bytes
 * @param nonce 12 bytes
 * @param ciphertext Ciphertext with auth tag
 * @param aad Associated data (optional)
 * @returns Decrypted plaintext
 * @throws Error if authentication fails
 */
export function decrypt(
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    aad?: Uint8Array
): Uint8Array {
    return chacha20poly1305(new Uint8Array(key), new Uint8Array(nonce), aad ? new Uint8Array(aad) : undefined)
        .decrypt(new Uint8Array(ciphertext));
}
