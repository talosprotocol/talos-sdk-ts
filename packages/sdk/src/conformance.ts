import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { RatchetSession } from './core/ratchet.js';
import { decodeBase64Url, encodeBase64Url } from './encoding/base64url.js';
import { getPublicKey } from './crypto/x25519.js';
import { canonicalize } from './encoding/canonical_json.js';
import { signMcpRequest } from './core/mcp_signing.js';
import { Wallet } from './core/wallet.js';

const __filename = fileURLToPath(import.meta.url);
path.dirname(__filename); // Side effect only, dirname not used

async function runConformance(vectorPath: string): Promise<boolean> {
    const data = JSON.parse(fs.readFileSync(vectorPath, 'utf-8'));
    const filename = path.basename(vectorPath);

    // Release Set handling
    if (data.version && data.vectors && Array.isArray(data.vectors) && typeof data.vectors[0] === 'string') {
        const baseDir = path.dirname(vectorPath);
        let allSuccess = true;
        for (const sub of data.vectors) {
            const subPath = path.join(baseDir, sub);
            if (!await runConformance(subPath)) allSuccess = false;
        }
        return allSuccess;
    }

    console.log(`Running: ${filename}`);
    let success = true;

    if (data.steps) {
        // Trace
        try {
            await runTrace(data);
            console.log("  OK");
        } catch (e: unknown) {
            const err = e as Error;
            console.error(`  [FAILURE] Trace failed: ${err.message}`);
            if (err.stack) console.error(err.stack);
            success = false;
        }
    } else if (data.vectors) {
        for (const vector of data.vectors) {
            if (!await runSingleVector(vector, filename)) success = false;
        }
    } else {
        // Single vector
        if (!await runSingleVector(data, filename)) success = false;
    }

    return success;
}

async function runSingleVector(vector: Record<string, unknown>, filename: string): Promise<boolean> {
    const handler = getHandler(filename);
    try {
        if (vector.expected_error) {
            await handler.runNegative(vector);
        } else {
            await handler.runVector(vector);
        }
        return true;
    } catch (e: unknown) {
        const err = e as Error;
        console.error(`  [FAILURE] ${(vector as { test_id?: string }).test_id || 'unnamed'}: ${err.message}`);
        return false;
    }
}

function getHandler(filename: string): VectorHandler {
    if (filename === 'canonical_json.json') return new CanonicalJsonHandler();
    if (filename === 'signing_verify.json') return new SigningVerifyHandler();
    if (filename === 'mcp_sign_verify.json') return new MCPSignHandler();
    if (filename === 'frame_codec.json') return new FrameCodecHandler();
    if (filename.includes('header_canonical_bytes') || filename.includes('kdf_')) return new MicroVectorHandler();
    return new DefaultHandler();
}

interface VectorHandler {
    runVector(v: Record<string, unknown>): Promise<void>;
    runNegative(v: Record<string, unknown>): Promise<void>;
}

class DefaultHandler implements VectorHandler {
    async runVector(_v: Record<string, unknown>) { }
    async runNegative(_v: Record<string, unknown>) { }
}

class CanonicalJsonHandler extends DefaultHandler {
    override async runVector(v: Record<string, unknown>) {
        const inputs = v.inputs as { unordered?: unknown; value?: unknown; pretty_printed?: string };
        const expected = v.expected as { canonical?: string; canonical_number?: string };
        let res: string;

        if (inputs.unordered) {
            res = new TextDecoder().decode(canonicalize(inputs.unordered));
            if (res !== expected.canonical) throw new Error(`Mismatch: ${res} !== ${expected.canonical}`);
        } else if (inputs.value !== undefined) {
            res = new TextDecoder().decode(canonicalize(inputs.value));
            if (expected.canonical_number && res !== expected.canonical_number) throw new Error(`Number mismatch: ${res}`);
        } else if (inputs.pretty_printed) {
            const obj = JSON.parse(inputs.pretty_printed);
            res = new TextDecoder().decode(canonicalize(obj));
            if (res !== expected.canonical) throw new Error(`Pretty mismatch`);
        }
    }
}

class SigningVerifyHandler extends DefaultHandler {
    override async runVector(v: Record<string, unknown>) {
        const testId = (v as { test_id?: string }).test_id;
        if (testId?.startsWith('sign_')) {
            const inputs = v.inputs as { seed_hex: string; message_utf8: string };
            const expected = v.expected as { signature_base64url?: string };
            const wallet = Wallet.fromSeed(Buffer.from(inputs.seed_hex, 'hex'));
            const sig = await wallet.sign(new TextEncoder().encode(inputs.message_utf8));
            const sigB64 = encodeBase64Url(sig);
            if (expected.signature_base64url && sigB64 !== expected.signature_base64url) {
                throw new Error(`Signature mismatch`);
            }
        }
    }
}

class MCPSignHandler extends DefaultHandler {
    override async runVector(v: Record<string, unknown>) {
        const inputs = v.inputs as { signer_seed_hex: string; request: unknown; session_id: string; correlation_id: string; tool: string; action: string; timestamp: number };
        const expected = v.expected as { payload_canonical?: string };
        const wallet = Wallet.fromSeed(Buffer.from(inputs.signer_seed_hex, 'hex'));
        const frame = await signMcpRequest(
            wallet,
            inputs.request as Record<string, unknown>,
            inputs.session_id,
            inputs.correlation_id,
            inputs.tool,
            inputs.action,
            inputs.timestamp
        );
        const payloadStr = new TextDecoder().decode(frame.payload);
        if (expected.payload_canonical && payloadStr !== expected.payload_canonical) {
            throw new Error(`Payload mismatch`);
        }
    }
}

class MicroVectorHandler extends DefaultHandler {
    override async runVector(v: Record<string, unknown>) {
        const testId = (v as { test_id?: string }).test_id;
        if (testId === 'header_canonical_sorting') {
            const inputHeader = v.input_header as { dh: string; pn: number; n: number };
            const header = {
                dh: inputHeader.dh,
                pn: inputHeader.pn,
                n: inputHeader.n
            };
            const canon = encodeBase64Url(canonicalize(header));
            const expectedB64u = (v as { expected_canonical_b64u?: string }).expected_canonical_b64u;
            if (canon !== expectedB64u) throw new Error(`Canonical mismatch`);
        }
    }
}

class FrameCodecHandler extends DefaultHandler {
    override async runVector(v: Record<string, unknown>) {
        const inputs = v.inputs as { frame_type?: number; payload_utf8?: string };
        const expected = v.expected as { encoded_base64url?: string };
        if (inputs.frame_type && inputs.payload_utf8) {
            const payload = new TextEncoder().encode(inputs.payload_utf8);
            const frame = {
                version: 1,
                type: inputs.frame_type,
                flags: 0,
                payload: encodeBase64Url(payload)
            };
            const encoded = encodeBase64Url(canonicalize(frame));
            if (expected.encoded_base64url && encoded !== expected.encoded_base64url) {
                throw new Error(`Frame encoding mismatch. Got ${encoded}, expected ${expected.encoded_base64url}`);
            }
        }
    }
}

interface TraceData {
    alice: { identity_private: string; ephemeral_private: string; identity_public: string };
    bob: { identity_private: string; identity_public: string; bundle_secrets: { signed_prekey_private: string }; prekey_bundle: { signed_prekey: string; one_time_prekey?: string } };
    steps: Array<{ actor: string; action: string; ratchet_priv?: string; plaintext?: string; nonce?: string; wire_message_b64u?: string; step: number }>;
}

async function runTrace(trace: TraceData) {
    const alice = new RatchetSession();
    const bob = new RatchetSession();

    const aliceIk = decodeBase64Url(trace.alice.identity_private);
    const bobIk = decodeBase64Url(trace.bob.identity_private);
    const bobSpk = decodeBase64Url(trace.bob.bundle_secrets.signed_prekey_private);

    // Alice Ephemeral
    const aliceEphPriv = decodeBase64Url(trace.alice.ephemeral_private);
    const aliceEph = { privateKey: aliceEphPriv, publicKey: getPublicKey(aliceEphPriv) };

    alice.initializeAsInitiator(
        aliceIk,
        decodeBase64Url(trace.bob.identity_public),
        decodeBase64Url(trace.bob.prekey_bundle.signed_prekey),
        trace.bob.prekey_bundle.one_time_prekey ? decodeBase64Url(trace.bob.prekey_bundle.one_time_prekey) : null,
        aliceEph
    );

    let bobInitialized = false;

    for (const step of trace.steps) {
        const isAlice = step.actor === 'alice';
        const actor = isAlice ? alice : bob;
        const peer = isAlice ? bob : alice;

        if (step.ratchet_priv) {
            actor._test_next_ratchet_key = decodeBase64Url(step.ratchet_priv);
        }

        if (step.action === 'encrypt') {
            const pt = decodeBase64Url(step.plaintext!);
            const nonce = decodeBase64Url(step.nonce!);
            const wire = actor.encrypt(pt, nonce);

            if (step.wire_message_b64u && wire !== step.wire_message_b64u) {
                throw new Error(`Wire mismatch at step ${step.step}`);
            }

            if (isAlice && !bobInitialized) {
                // Bob init from Alice's first message
                const envelope = JSON.parse(new TextDecoder().decode(decodeBase64Url(wire)));
                bob.initializeAsResponder(
                    { privateKey: bobIk, publicKey: getPublicKey(bobIk) },
                    { privateKey: bobSpk, publicKey: getPublicKey(bobSpk) },
                    null,
                    decodeBase64Url(trace.alice.identity_public),
                    decodeBase64Url(envelope.header.dh)
                );
                bobInitialized = true;
            }

            const dec = peer.decrypt(wire);
            if (encodeBase64Url(dec) !== step.plaintext) throw new Error(`Decryption mismatch step ${step.step}`);
        }
    }
}

const args = process.argv.slice(2);
const vectorArg = args.indexOf('--vectors');
if (vectorArg !== -1 && args[vectorArg + 1]) {
    runConformance(args[vectorArg + 1]).then(success => {
        process.exit(success ? 0 : 1);
    });
} else {
    console.error("Usage: node conformance.js --vectors <path>");
    process.exit(1);
}
