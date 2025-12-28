// src/agent.ts
import { generateKeyPair, sign, fromSeed } from "@talos-protocol/sdk";
var InMemoryKeyProvider = class {
  publicKey;
  privateKey;
  constructor(seed) {
    if (seed) {
      const kp = fromSeed(seed);
      this.publicKey = kp.publicKey;
      this.privateKey = kp.privateKey;
    } else {
      const kp = generateKeyPair();
      this.publicKey = kp.publicKey;
      this.privateKey = kp.privateKey;
    }
  }
  async getPublicKey() {
    return this.publicKey;
  }
  async sign(data) {
    return sign(data, this.privateKey);
  }
};
var InMemoryCapabilityStore = class {
  caps = [];
  async put(cap) {
    this.caps.push(cap);
  }
  async get(tool, _method) {
    return this.caps.find((c) => c.scope.includes(tool));
  }
};
var TalosAgent = class {
  constructor(agentId, keyProvider, capStore = new InMemoryCapabilityStore()) {
    this.agentId = agentId;
    this.keyProvider = keyProvider;
    this.capStore = capStore;
  }
};

// src/http.ts
import {
  createEnvelopeContent,
  computeRequestHash,
  computeCapabilityHash,
  canonicalize,
  encodeBase64Url,
  verifyFrame
} from "@talos-protocol/sdk";
async function signMcpRequest(agent, request, sessionId, correlationId, tool, method) {
  const requestHash = await computeRequestHash(request);
  const cap = await agent.capStore.get(tool, method);
  if (!cap) {
    throw new Error(`No capability found for ${tool}/${method}`);
  }
  const capHash = await computeCapabilityHash(cap);
  const frameContent = createEnvelopeContent(
    sessionId,
    correlationId,
    agent.agentId,
    requestHash,
    tool,
    method,
    capHash,
    cap
  );
  const contentCanonical = canonicalize(frameContent);
  const sigBytes = await agent.keyProvider.sign(contentCanonical);
  const sig = encodeBase64Url(sigBytes);
  return { ...frameContent, sig };
}
async function verifyMcpResponse(responseFrame, serverPublicKey) {
  return verifyFrame(responseFrame, serverPublicKey);
}
export {
  InMemoryCapabilityStore,
  InMemoryKeyProvider,
  TalosAgent,
  signMcpRequest,
  verifyMcpResponse
};
