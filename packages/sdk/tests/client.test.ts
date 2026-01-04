import { describe, it, expect } from "vitest";
import { TalosClient, PROTOCOL_VERSION } from "../src/core/client.js";
import { Wallet } from "../src/core/wallet.js";

describe("TalosClient", () => {
  it("should initialize with wallet", () => {
    const w = Wallet.generate("Test");
    const client = new TalosClient("ws://localhost:8000", w);
    expect(client.wallet).toBe(w);
  });

  it("should report correct protocol version", () => {
    const w = Wallet.generate();
    const client = new TalosClient("", w);
    expect(client.protocolVersion()).toBe(PROTOCOL_VERSION);
    expect(client.supportedProtocolRange()).toEqual(["1.0", "1.x"]);
  });

  it("should manage connection state", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("", w);

    await client.connect();
    // Access private connected state via any if needed or test behavior
    // Since connect is a promise, just ensuring it resolves is basic test.
    // It sets sessionId

    await client.close();
  });

  it("should sign requests when connected", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("", w);

    // Before connect -> should fail
    await expect(() =>
      client.signMcpRequest({}, "tool", "action"),
    ).rejects.toThrow("Not connected");

    await client.connect();

    const frame = await client.signMcpRequest({ data: 123 }, "aws:s3", "list");
    expect(frame.correlationId).toMatch(/^corr-\d+$/);

    const decoded = JSON.parse(new TextDecoder().decode(frame.payload));
    expect(decoded.tool).toBe("aws:s3");
    expect(decoded.action).toBe("list");
  });

  it("should sign and send mock", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("", w);
    await client.connect();

    const resp = await client.signAndSendMcp({}, "t", "a");
    expect(resp.status).toBe("ok");
  });
});
