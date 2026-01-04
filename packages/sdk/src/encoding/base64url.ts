export class TalosVectorError extends Error {
  constructor(public code: string, public field?: string) {
    const suffix = field ? ` at ${field}` : "";
    super(`Talos Vector Error: ${code}${suffix}`);
    this.name = "TalosVectorError";
  }
}

export function encodeBase64Url(input: Uint8Array): string {
  // Convert bytes to standard base64 first
  let base64 = "";
  const len = input.length;
  for (let i = 0; i < len; i += 3) {
    const b1 = input[i];
    const b2 = i + 1 < len ? input[i + 1] : 0;
    const b3 = i + 2 < len ? input[i + 2] : 0;

    const triplet = (b1 << 16) | (b2 << 8) | b3;

    base64 += btoaString((triplet >> 18) & 0x3f);
    base64 += btoaString((triplet >> 12) & 0x3f);
    if (i + 1 < len) base64 += btoaString((triplet >> 6) & 0x3f);
    if (i + 2 < len) base64 += btoaString(triplet & 0x3f);
  }

  // Replace chars for URL safety and strip padding
  return base64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function btoaString(index: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  return chars[index];
}

export function decodeBase64Url(input: string): Uint8Array {
  if (input === null || input === undefined) {
    throw new TalosVectorError("VECTOR_MISSING_FIELD");
  }
  if (typeof input !== "string") {
    throw new TalosVectorError("INVALID_TYPE", typeof input);
  }

  // Node.js support
  if (typeof Buffer !== 'undefined') {
    // try base64url directly (supported in Node 14.18+)
    try {
      return new Uint8Array(Buffer.from(input, 'base64url'));
    } catch {
      // fallback to manual padding and base64
      let b64 = input.replaceAll('-', '+').replaceAll('_', '/');
      while (b64.length % 4) b64 += '=';
      return new Uint8Array(Buffer.from(b64, 'base64'));
    }
  }

  // Browser support
  const b64 = input.replaceAll('-', '+').replaceAll('_', '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.codePointAt(i) ?? 0;
  }
  return bytes;
}
