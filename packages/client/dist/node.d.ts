import { Capability, McpMessageFrame, McpResponseFrame } from '@talos-protocol/sdk';

interface KeyProvider {
    getPublicKey(): Promise<Uint8Array>;
    sign(data: Uint8Array): Promise<Uint8Array>;
}
declare class InMemoryKeyProvider implements KeyProvider {
    private publicKey;
    private privateKey;
    constructor(seed?: Uint8Array);
    getPublicKey(): Promise<Uint8Array>;
    sign(data: Uint8Array): Promise<Uint8Array>;
}
interface CapabilityStore {
    put(cap: Capability): Promise<void>;
    get(tool: string, method: string): Promise<Capability | undefined>;
}
declare class InMemoryCapabilityStore implements CapabilityStore {
    private caps;
    put(cap: Capability): Promise<void>;
    get(tool: string, _method: string): Promise<Capability | undefined>;
}
declare class TalosAgent {
    readonly agentId: string;
    readonly keyProvider: KeyProvider;
    readonly capStore: CapabilityStore;
    constructor(agentId: string, // DID
    keyProvider: KeyProvider, capStore?: CapabilityStore);
}

declare function signMcpRequest(agent: TalosAgent, request: unknown, sessionId: string, correlationId: string, tool: string, method: string): Promise<McpMessageFrame>;
declare function verifyMcpResponse(responseFrame: McpResponseFrame, serverPublicKey: Uint8Array): Promise<boolean>;

export { type CapabilityStore, InMemoryCapabilityStore, InMemoryKeyProvider, type KeyProvider, TalosAgent, signMcpRequest, verifyMcpResponse };
