import { describe, it, expect } from "vitest";
import {
  validateFrameStrict,
  signFrame,
  verifyFrame,
  McpMessageFrame,
} from "../src/core/frames.js";
import { Wallet } from "../src/core/wallet.js";

describe("Frames", () => {
  it("should validate a valid MCP_MESSAGE frame", () => {
    const frame = {
      type: "MCP_MESSAGE",
      protocol_version: "1.0",
      session_id: "sess-123",
      correlation_id: "corr-456",
      peer_id: "peer-789",
      issued_at: Date.now(),
      request_hash: "abc123",
      tool: "test-tool",
      method: "test-method",
      capability_hash: "cap-hash",
    };
    expect(() => validateFrameStrict(frame)).not.toThrow();
  });

  it("should reject unknown fields in MCP_MESSAGE", () => {
    const frame = {
      type: "MCP_MESSAGE",
      protocol_version: "1.0",
      session_id: "sess-123",
      correlation_id: "corr-456",
      peer_id: "peer-789",
      issued_at: Date.now(),
      request_hash: "abc123",
      tool: "test-tool",
      method: "test-method",
      capability_hash: "cap-hash",
      unknown_field: "should fail",
    };
    expect(() => validateFrameStrict(frame)).toThrow(/Unknown field/);
  });

  it("should validate a valid MCP_RESPONSE frame", () => {
    const frame = {
      type: "MCP_RESPONSE",
      protocol_version: "1.0",
      session_id: "sess-123",
      correlation_id: "corr-456",
      peer_id: "peer-789",
      issued_at: Date.now(),
      response_hash: "resp-hash",
      tool: "test-tool",
      method: "test-method",
      result_code: "OK",
    };
    expect(() => validateFrameStrict(frame)).not.toThrow();
  });

  it("should reject unknown frame type", () => {
    const frame = { type: "UNKNOWN_TYPE" };
    expect(() => validateFrameStrict(frame)).toThrow(/Unknown frame type/);
  });

  it("should sign and verify a frame", async () => {
    const wallet = Wallet.generate();
    const frame: Omit<McpMessageFrame, "sig"> = {
      type: "MCP_MESSAGE",
      protocol_version: "1.0",
      session_id: "sess-123",
      correlation_id: "corr-456",
      peer_id: "peer-789",
      issued_at: Date.now(),
      request_hash: "abc123",
      tool: "test-tool",
      method: "test-method",
      capability_hash: "cap-hash",
    };

    const signedFrame = await signFrame(frame, wallet["keyPair"].privateKey);
    expect(signedFrame.sig).toBeDefined();

    const isValid = await verifyFrame(signedFrame, wallet.publicKey);
    expect(isValid).toBe(true);
  });

  it("should fail verification with wrong key", async () => {
    const wallet = Wallet.generate();
    const wrongWallet = Wallet.generate();
    const frame: Omit<McpMessageFrame, "sig"> = {
      type: "MCP_MESSAGE",
      protocol_version: "1.0",
      session_id: "sess-123",
      correlation_id: "corr-456",
      peer_id: "peer-789",
      issued_at: Date.now(),
      request_hash: "abc123",
      tool: "test-tool",
      method: "test-method",
      capability_hash: "cap-hash",
    };

    const signedFrame = await signFrame(frame, wallet["keyPair"].privateKey);
    const isValid = await verifyFrame(signedFrame, wrongWallet.publicKey);
    expect(isValid).toBe(false);
  });
});
