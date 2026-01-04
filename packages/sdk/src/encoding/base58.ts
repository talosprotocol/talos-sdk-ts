/**
 * Base58btc encoding for DID generation.
 */

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export function base58btcEncode(data: Uint8Array): string {
  // Convert bytes to a big integer
  let value = BigInt(0);
  for (const byte of data) {
    value = value * BigInt(256) + BigInt(byte);
  }

  // Convert to base58
  const result: string[] = [];
  while (value > 0) {
    const remainder = Number(value % BigInt(58));
    value = value / BigInt(58);
    result.unshift(ALPHABET[remainder]);
  }

  // Handle leading zeros
  for (const byte of data) {
    if (byte === 0) {
      result.unshift(ALPHABET[0]);
    } else {
      break;
    }
  }

  return result.join("");
}
