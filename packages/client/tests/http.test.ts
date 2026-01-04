import { describe, it, expect, vi } from "vitest";
import { signMcpRequest, verifyMcpResponse } from "../src/http.js";
import { Wallet, signFrame, McpResponseFrame } from "@talosprotocol/sdk";

// Mock TalosAgent
function createMockAgent(wallet: Wallet) {
  return {
    agentId: "test-agent-id",
    keyProvider: {
      sign: (data: Uint8Array) => wallet.sign(data),
      getPublicKey: () => wallet.publicKey,
    },
    capStore: {
      get: vi.fn().mockResolvedValue({
        tool: "test-tool",
        method: "test-method",
        constraints: {},
        issuer: "test-issuer",
        subject: "test-subject",
        issued_at: Date.now(),
        expires_at: Date.now() + 3600000,
      }),
    },
  };
}

describe("HTTP Transport", () => {
  it("should sign an MCP request", async () => {
    const wallet = Wallet.generate();
    const agent = createMockAgent(wallet);

    const frame = await signMcpRequest(
      agent as unknown as import("../src/agent.js").TalosAgent,
      { action: "test" },
      "session-123",
      "correlation-456",
      "test-tool",
      "test-method",
    );

    expect(frame.type).toBe("MCP_MESSAGE");
    expect(frame.sig).toBeDefined();
    expect(frame.session_id).toBe("session-123");
    expect(frame.correlation_id).toBe("correlation-456");
  });

  it("should throw when capability not found", async () => {
    const wallet = Wallet.generate();
    const agent = {
      agentId: "test-agent-id",
      keyProvider: {
        sign: (data: Uint8Array) => wallet.sign(data),
        getPublicKey: () => wallet.publicKey,
      },
      capStore: {
        get: vi.fn().mockResolvedValue(null),
      },
    };

    await expect(
      signMcpRequest(
        agent as unknown as import("../src/agent.js").TalosAgent,
        { action: "test" },
        "session-123",
        "correlation-456",
        "missing-tool",
        "missing-method",
      ),
    ).rejects.toThrow(/No capability found/);
  });

  it("should verify a valid MCP response", async () => {
    const serverWallet = Wallet.generate();
    const responseFrame: Omit<McpResponseFrame, "sig"> = {
      type: "MCP_RESPONSE",
      protocol_version: "1.0",
      session_id: "session-123",
      correlation_id: "correlation-456",
      peer_id: "server-id",
      issued_at: Date.now(),
      response_hash: "resp-hash-abc",
      tool: "test-tool",
      method: "test-method",
      result_code: "OK",
    };

    const signedResponse = await signFrame(
      responseFrame,
      serverWallet["keyPair"].privateKey,
    );
    const isValid = await verifyMcpResponse(
      signedResponse,
      serverWallet.publicKey,
    );
    expect(isValid).toBe(true);
  });

  it("should reject invalid MCP response signature", async () => {
    const serverWallet = Wallet.generate();
    const wrongWallet = Wallet.generate();
    const responseFrame: Omit<McpResponseFrame, "sig"> = {
      type: "MCP_RESPONSE",
      protocol_version: "1.0",
      session_id: "session-123",
      correlation_id: "correlation-456",
      peer_id: "server-id",
      issued_at: Date.now(),
      response_hash: "resp-hash-abc",
      tool: "test-tool",
      method: "test-method",
      result_code: "OK",
    };

    const signedResponse = await signFrame(
      responseFrame,
      serverWallet["keyPair"].privateKey,
    );
    const isValid = await verifyMcpResponse(
      signedResponse,
      wrongWallet.publicKey,
    );
    expect(isValid).toBe(false);
  });
});
