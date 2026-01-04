import { describe, it, expect } from "vitest";
import { encodeBase64Url, decodeBase64Url } from "../src/encoding/base64url.js";
import { canonicalize } from "../src/encoding/canonical_json.js";

describe("Encoding Utilities", () => {
  describe("Base64URL", () => {
    it("should encode correctly", () => {
      const input = new TextEncoder().encode("Hello World");
      const encoded = encodeBase64Url(input);
      expect(encoded).toBe("SGVsbG8gV29ybGQ");
    });

    it("should decode correctly", () => {
      const input = "SGVsbG8gV29ybGQ";
      const decoded = decodeBase64Url(input);
      expect(new TextDecoder().decode(decoded)).toBe("Hello World");
    });

    it("should handle padding cases (implicit removal)", () => {
      // "light work." -> "bGlnaHQgd29yay4=" in standard b64
      // b64url: "bGlnaHQgd29yay4"
      const input = new TextEncoder().encode("light work.");
      expect(encodeBase64Url(input)).toBe("bGlnaHQgd29yay4");
    });
  });

  describe("Canonical JSON", () => {
    it("should sort keys", () => {
      const input = { b: 1, a: 2 };
      const output = new TextDecoder().decode(canonicalize(input));
      expect(output).toBe('{"a":2,"b":1}');
    });

    it("should remove whitespace", () => {
      const input = { a: 2 };
      const output = new TextDecoder().decode(canonicalize(input));
      expect(output).toBe('{"a":2}');
    });

    it("should handle nested objects", () => {
      const input = { c: { y: 2, x: 1 }, a: 0 };
      const output = new TextDecoder().decode(canonicalize(input));
      expect(output).toBe('{"a":0,"c":{"x":1,"y":2}}');
    });
  });

  describe("Base64URL Edge Cases", () => {
    it("should throw on invalid types", () => {
      expect(() => decodeBase64Url(null as unknown as string)).toThrow(
        /VECTOR_MISSING_FIELD/,
      );
      expect(() => decodeBase64Url(123 as unknown as string)).toThrow(
        /INVALID_TYPE/,
      );
    });

    it("should handle single/double byte padding", () => {
      const b1 = new Uint8Array([1]);
      const e1 = encodeBase64Url(b1);
      expect(decodeBase64Url(e1)).toEqual(b1);

      const b2 = new Uint8Array([1, 2]);
      const e2 = encodeBase64Url(b2);
      expect(decodeBase64Url(e2)).toEqual(b2);
    });
  });
});
