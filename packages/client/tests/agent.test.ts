import { describe, it, expect, vi } from "vitest";
import {
  TalosAgent,
  InMemoryKeyProvider,
  InMemoryCapabilityStore,
} from "../src/agent.js";
import { Wallet, type Capability } from "@talosprotocol/sdk";

describe("TalosAgent", () => {
  it("should initialize with provider and store", () => {
    const wallet = Wallet.generate();
    const provider = {
      sign: vi.fn(),
      getPublicKey: async () => wallet.publicKey,
    };
    const store = {
      get: vi.fn(),
      put: vi.fn(),
      list: vi.fn(),
      delete: vi.fn(),
    };

    const agent = new TalosAgent("agent-1", provider, store);
    expect(agent.agentId).toBe("agent-1");
    expect(agent.keyProvider).toBe(provider);
    expect(agent.capStore).toBe(store);
  });

  it("should create from wallet", async () => {
    const wallet = Wallet.generate();
    const agent = TalosAgent.fromWallet("agent-2", wallet);
    expect(agent.agentId).toBe("agent-2");
    expect(await agent.keyProvider.getPublicKey()).toEqual(wallet.publicKey);
    expect(await agent.keyProvider.sign(new Uint8Array([1, 2]))).toEqual(
      await wallet.sign(new Uint8Array([1, 2])),
    );
  });

  it("should test InMemoryKeyProvider", async () => {
    const provider = new InMemoryKeyProvider();
    expect(provider).toBeDefined();
  });
});

describe("InMemoryProvider and Store", () => {
  it("InMemoryKeyProvider random", async () => {
    const provider = new InMemoryKeyProvider();
    const pub = await provider.getPublicKey();
    expect(pub.length).toBe(32);
    const sig = await provider.sign(new Uint8Array([1, 2]));
    expect(sig.length).toBe(64);
  });

  it("InMemoryKeyProvider from seed", async () => {
    const seed = new Uint8Array(32).fill(7);
    const provider = new InMemoryKeyProvider(seed);
    const pub = await provider.getPublicKey();
    expect(pub).toBeDefined();
  });

  it("InMemoryCapabilityStore", async () => {
    const store = new InMemoryCapabilityStore();
    const cap = { scope: "tool:test", tool: "test" } as unknown as Capability;
    await store.put(cap);
    const found = await store.get("test", "any");
    expect(found).toBe(cap);
    const notFound = await store.get("missing", "any");
    expect(notFound).toBeUndefined();
  });
});
