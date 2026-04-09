import { describe, it, expect, vi, beforeEach } from "vitest";
import { TalosClient, PROTOCOL_VERSION } from "../src/core/client.js";
import { Wallet } from "../src/core/wallet.js";

describe("TalosClient", () => {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    onopen: null,
    onclose: null,
    onmessage: null,
    onerror: null,
  };

  beforeEach(() => {
    vi.stubGlobal("WebSocket", vi.fn().mockImplementation(() => mockWs));
    mockWs.send.mockClear();
    mockWs.close.mockClear();
  });

  it("should initialize with wallet", () => {
    const w = Wallet.generate("Test");
    const client = new TalosClient("http://localhost:8000", w);
    expect(client.wallet).toBe(w);
  });

  it("should report correct protocol version", () => {
    const w = Wallet.generate();
    const client = new TalosClient("http://localhost:8000", w);
    expect(client.protocolVersion()).toBe(PROTOCOL_VERSION);
    expect(client.supportedProtocolRange()).toEqual(["1.0", "1.x"]);
  });

  it("should manage connection state", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("http://localhost:8000", w);

    const connectPromise = client.connect();
    
    // Simulate open
    if (mockWs.onopen) (mockWs as any).onopen();
    
    await connectPromise;
    await client.close();
    expect(mockWs.close).toHaveBeenCalled();
  });

  it("should sign requests when connected", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("http://localhost:8000", w);

    // Before connect -> should fail
    await expect(() =>
      client.signMcpRequest({}, "tool", "action"),
    ).rejects.toThrow("Not connected");

    const connectPromise = client.connect();
    if (mockWs.onopen) (mockWs as any).onopen();
    await connectPromise;

    const frame = await client.signMcpRequest({ data: 123 }, "aws:s3", "list");
    expect(frame.correlationId).toMatch(/^corr-\d+$/);

    const decoded = JSON.parse(new TextDecoder().decode(frame.payload));
    expect(decoded.tool).toBe("aws:s3");
    expect(decoded.action).toBe("list");
  });

  it("should sign and send mcp", async () => {
    const w = Wallet.generate();
    const client = new TalosClient("http://localhost:8000", w);
    
    const connectPromise = client.connect();
    if (mockWs.onopen) (mockWs as any).onopen();
    await connectPromise;

    const sendPromise = client.signAndSendMcp({foo: "bar"}, "tool", "action");
    
    // Check that it sent something
    await vi.waitFor(() => expect(mockWs.send).toHaveBeenCalled());
    const sentFrame = JSON.parse(mockWs.send.mock.calls[0][0]);
    
    // Simulate response
    if (mockWs.onmessage) {
      (mockWs as any).onmessage({
        data: JSON.stringify({
          correlationId: sentFrame.correlationId,
          status: "ok",
          result: { success: true }
        })
      });
    }

    const resp = await sendPromise;
    expect(resp.status).toBe("ok");
    expect((resp.result as any).success).toBe(true);
  });
});
