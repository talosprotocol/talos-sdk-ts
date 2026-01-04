import { describe, it, expect } from "vitest";
import * as mcpSigning from "../src/core/mcp_signing.js";
import { Wallet } from "../src/core/wallet.js";

describe("MCP Signing", () => {
  it("should sign and verify requests", async () => {
    const wallet = await Wallet.generate("test_user");
    const req = { method: "tool/call" };

    const signedFrame = await mcpSigning.signMcpRequest(
      wallet,
      req,
      "session_123",
      "corr_456",
      "my_tool",
      "call",
    );

    expect(signedFrame).toBeDefined();
    expect(signedFrame.correlationId).toBe("corr_456");

    const isValid = await mcpSigning.verifyMcpResponse(
      signedFrame,
      "corr_456",
      wallet.publicKey,
    );
    // Note: verifyMcpResponse checks signature on payload.
    // In reality, response logic mirrors request logic for verification.
    // But here we are just testing the function mechanics.
    expect(isValid).toBe(true);
  });
});
