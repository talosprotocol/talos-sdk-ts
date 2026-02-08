# Talos SDK for TypeScript

**Repo Role**: Official TypeScript/Node.js implementation of the Talos Protocol.

## Abstract

The Talos SDK for TypeScript brings secure, autonomous messaging to the JavaScript ecosystem. It provides cryptographic identity management, capability-based authorization, and MCP request signing—enabling Node.js agents and web-based clients to participate in the Talos secure mesh with full end-to-end encryption.

## Quickstart

### Installation

```bash
npm install @talosprotocol/sdk
# or
pnpm add @talosprotocol/sdk
```

> **Note**: The SDK is published as `@talosprotocol/sdk`. For gateway client functionality, also install `@talosprotocol/client`.

### Hello World: Identity → Capability → Signed Request

```typescript
import { Wallet, TalosClient, signCapability, type Capability } from '@talosprotocol/sdk';

// 1. Create a cryptographic identity
const wallet = Wallet.generate("my-agent");
console.log("DID:", wallet.toDid());  // did:key:z6Mk...

// 2. Connect to a Talos Gateway
const client = new TalosClient("wss://gateway.talos.example", wallet);
await client.connect();

// 3. Create a scoped capability token
const capability: Omit<Capability, 'sig'> = {
  v: "1",
  iss: wallet.toDid(),           // Issuer (you)
  sub: wallet.toDid(),           // Subject (your agent)
  scope: "fs:/projects:read",    // Scope-restricted permission
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,  // 1 hour expiry
};

// Sign with your private key
const signedCap = await signCapability(capability, wallet.publicKey);

// 4. Sign and send an MCP tool request
const response = await client.signAndSendMcp(
  { path: "/projects/demo", action: "list" },
  "filesystem",      // tool server
  "list_directory"   // action
);

await client.close();
```

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Application Layer                         │
│     (Your Agent: LangChain, AutoGPT, Custom Framework)      │
├─────────────────────────────────────────────────────────────┤
│                   @talosprotocol/sdk                         │
│  ┌──────────┐  ┌───────────┐  ┌────────────┐  ┌───────────┐ │
│  │  Wallet  │  │  Client   │  │ Capability │  │   MCP     │ │
│  │ (Ed25519)│  │ (Gateway) │  │  Tokens    │  │  Signing  │ │
│  └──────────┘  └───────────┘  └────────────┘  └───────────┘ │
├─────────────────────────────────────────────────────────────┤
│                  @noble/* Cryptography                       │
│           (ed25519, hashes, ciphers - audited)              │
└─────────────────────────────────────────────────────────────┘
```

This SDK is a peer to the Python, Go, Java, and Rust implementations. All SDKs validate against the same [talos-contracts](../../contracts) test vectors, ensuring byte-perfect interoperability.

## Packages

This monorepo contains two packages:

| Package | Description |
|---------|-------------|
| `@talosprotocol/sdk` | Core protocol: identity, crypto, capabilities, MCP signing |
| `@talosprotocol/client` | Gateway client: WebSocket transport, session management |

## API Reference

### Wallet (Identity)

```typescript
// Generate a new random identity
const wallet = Wallet.generate("agent-name");

// Deterministic wallet from 32-byte seed
const wallet = Wallet.fromSeed(seed, "agent-name");

// Get DID string
const did = wallet.toDid();  // "did:key:z6Mk..."

// Get address (SHA-256 hash of public key)
const address = await wallet.getAddress();

// Sign a message
const signature = await wallet.sign(message);

// Verify a signature
const valid = await Wallet.verify(message, signature, publicKey);
```

### TalosClient

```typescript
const client = new TalosClient(gatewayUrl, wallet);

await client.connect();
const version = client.protocolVersion();  // "1.0"
const [min, max] = client.supportedProtocolRange();

// Sign an MCP request without sending
const frame = await client.signMcpRequest(request, tool, action);

// Sign and send with response
const response = await client.signAndSendMcp(request, tool, action);

await client.close();
```

### Capability Tokens

```typescript
import { signCapability, verifyCapability, computeCapabilityHash } from '@talosprotocol/sdk';

// Sign a capability
const signed = await signCapability(unsignedCap, privateKey);

// Verify a capability
const valid = await verifyCapability(signed, publicKey);

// Compute capability hash for audit logs
const hash = await computeCapabilityHash(signed);
```

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Run conformance tests against talos-contracts vectors
make conformance

# Lint and format
npm run lint
npm run format
```

## Evaluation

**Status**: ✅ STABILIZED (v4.0.0-alpha)

- **Conformance**: 100% pass rate on `v1.1.0` test vectors
- **Interop**: Fully verified against Python, Java, and Rust SDKs
- **Coverage**: >80% for both `@talosprotocol/sdk` and `@talosprotocol/client`

## Security Considerations

- **Threat Model**: XSS in web contexts, compromised dependencies
- **Guarantees**:
  - **Key Isolation**: Private keys managed within `Wallet`, never exposed
  - **Audited Crypto**: Uses `@noble/*` libraries (audited, no native dependencies)
  - **Contract-Driven**: All wire formats validated against `talos-contracts` schemas

## References

1. [Talos Protocol Specification](../../PROTOCOL.md)
2. [Talos Contracts (Schemas & Vectors)](../../contracts)
3. [JWE Specification](https://datatracker.ietf.org/doc/html/rfc7516)
4. [Talos Wiki](https://github.com/talosprotocol/talos/wiki)

## License

Licensed under the Apache License 2.0. See [LICENSE](LICENSE).
