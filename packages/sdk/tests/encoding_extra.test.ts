import { describe, it, expect } from "vitest";
import { base58btcEncode } from "../src/encoding/base58.js";
import {
  utf8ToBytes,
  bytesToUtf8,
  concatBytes,
} from "../src/encoding/bytes.js";

describe("Encoding Extra", () => {
  describe("Base58BTC", () => {
    it("should encode correctly", () => {
      const data = new Uint8Array([0, 0, 1, 2, 3]);
      const encoded = base58btcEncode(data);
      // 0 is '1' in base58
      expect(encoded.startsWith("11")).toBe(true);
    });

    it("should encode empty data", () => {
      expect(base58btcEncode(new Uint8Array([]))).toBe("");
    });
  });

  describe("Bytes", () => {
    it("should convert utf8 strings", () => {
      const str = "hello 😊";
      const bytes = utf8ToBytes(str);
      expect(bytesToUtf8(bytes)).toBe(str);
    });

    it("should concatenate bytes", () => {
      const b1 = new Uint8Array([1, 2]);
      const b2 = new Uint8Array([3, 4]);
      const combined = concatBytes(b1, b2);
      expect(combined).toEqual(new Uint8Array([1, 2, 3, 4]));
    });
  });
});
