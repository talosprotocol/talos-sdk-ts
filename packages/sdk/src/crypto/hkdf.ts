import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha256.js';

/**
 * Perform HKDF using SHA-256.
 * @param ikm Input Key Material
 * @param salt Salt (optional)
 * @param info Info (optional)
 * @param length Output length (default 32)
 */
export function hkdfSha256(
    ikm: Uint8Array,
    salt?: Uint8Array,
    info?: Uint8Array,
    length: number = 32
): Uint8Array {
    return hkdf(
        sha256,
        new Uint8Array(ikm),
        salt ? new Uint8Array(salt) : undefined,
        info ? new Uint8Array(info) : undefined,
        length
    );
}
