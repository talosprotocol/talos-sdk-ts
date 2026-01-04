import { describe, it, expect } from "vitest";
import { encrypt, decrypt } from "../src/crypto/aead.js";

describe("AEAD", () => {
  it("should encrypt and decrypt with AAD", () => {
    const key = new Uint8Array(32).fill(1);
    const nonce = new Uint8Array(12).fill(2);
    const aad = new Uint8Array(8).fill(3);
    const plaintext = new TextEncoder().encode("secret message");

    const ciphertext = encrypt(key, nonce, plaintext, aad);
    expect(ciphertext).not.toEqual(plaintext);

    const decrypted = decrypt(key, nonce, ciphertext, aad);
    expect(new TextDecoder().decode(decrypted)).toBe("secret message");
  });

  it("should encrypt and decrypt without AAD", () => {
    const key = new Uint8Array(32).fill(4);
    const nonce = new Uint8Array(12).fill(5);
    const plaintext = new TextEncoder().encode("no aad message");

    const ciphertext = encrypt(key, nonce, plaintext);
    const decrypted = decrypt(key, nonce, ciphertext);
    expect(new TextDecoder().decode(decrypted)).toBe("no aad message");
  });

  it("should fail decryption with wrong AAD", () => {
    const key = new Uint8Array(32).fill(6);
    const nonce = new Uint8Array(12).fill(7);
    const aad = new Uint8Array(8).fill(8);
    const wrongAad = new Uint8Array(8).fill(9);
    const plaintext = new TextEncoder().encode("failed aad message");

    const ciphertext = encrypt(key, nonce, plaintext, aad);
    expect(() => decrypt(key, nonce, ciphertext, wrongAad)).toThrow();
  });
});
