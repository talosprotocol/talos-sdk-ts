import { describe, it, expect, vi, afterEach } from "vitest";
import { sha256 } from "../src/crypto/sha256.js";
import { decodeBase64Url } from "../src/encoding/base64url.js";
import { canonicalize } from "../src/encoding/canonical_json.js";

describe("Crypto Fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should fallback to noble-hashes if WebCrypto fails", async () => {
    vi.stubGlobal("crypto", {
      subtle: {
        digest: () => Promise.reject(new Error("forced failure")),
      },
    });

    const data = new Uint8Array([1, 2, 3]);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
  });

  it("should fallback to noble-hashes if WebCrypto is missing", async () => {
    vi.stubGlobal("crypto", undefined);

    const data = new Uint8Array([1, 2, 3]);
    const hash = await sha256(data);
    expect(hash.length).toBe(32);
  });
});

describe("Base64URL Fallbacks", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should fallback if Buffer is missing", () => {
    vi.stubGlobal("Buffer", undefined);

    const input = "AQID"; // [1, 2, 3]
    const decoded = decodeBase64Url(input);
    expect(decoded).toEqual(new Uint8Array([1, 2, 3]));
  });
});

describe("Canonical JSON Edge Cases", () => {
  it("should handle booleans", () => {
    expect(new TextDecoder().decode(canonicalize(true))).toBe("true");
    expect(new TextDecoder().decode(canonicalize(false))).toBe("false");
  });

  it("should throw on non-finite numbers", () => {
    expect(() => canonicalize(Infinity)).toThrow(/finite/);
    expect(() => canonicalize(Number.NaN)).toThrow(/finite/);
  });

  it("should handle arrays", () => {
    const input = [1, { b: 2, a: 1 }, 3];
    const output = new TextDecoder().decode(canonicalize(input));
    expect(output).toBe('[1,{"a":1,"b":2},3]');
  });

  it("should handle nested objects with undefined", () => {
    const input = { a: 1, b: undefined, c: 3 };
    const output = new TextDecoder().decode(canonicalize(input));
    expect(output).toBe('{"a":1,"c":3}');
  });

  it("should throw on null", () => {
    expect(() => canonicalize(null)).toThrow(/Null values/);
    expect(() => canonicalize({ a: null })).toThrow(/Null values/);
  });

  it("should throw on unsupported types", () => {
    expect(() => canonicalize(() => {})).toThrow(/Unsupported type/);
    expect(() => canonicalize(Symbol("test"))).toThrow(/Unsupported type/);
  });
});
