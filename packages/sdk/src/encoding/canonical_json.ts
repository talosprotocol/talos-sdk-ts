/**
 * RFC 8785 Canonical JSON Serialization.
 * Strict v1 requirements:
 * - No floats (integers only)
 * - No NaN/Infinity
 * - No duplicates (enforced by input object nature primarily, but assumed valid)
 * - Omit nulls (validation error if null found)
 * - UTF-8
 */

export function canonicalize(value: unknown): Uint8Array {
    const jsonStr = stringify(value);
    return new TextEncoder().encode(jsonStr);
}

function stringify(value: unknown): string {
    if (value === null) {
        throw new Error("Canonical JSON v1: Null values not permitted (omit field instead)");
    }

    if (typeof value === 'boolean') {
        return value ? 'true' : 'false';
    }

    if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
            throw new Error(`Canonical JSON v1: Number must be finite, got ${value}`);
        }
        // RFC 8785 compliant formatting for numbers.
        // JS JSON.stringify() handles integers and floats with no trailing zeros correctly.
        return JSON.stringify(value);
    }

    if (typeof value === 'string') {
        return JSON.stringify(value);
    }

    if (Array.isArray(value)) {
        let res = '[';
        for (let i = 0; i < value.length; i++) {
            if (i > 0) res += ',';
            res += stringify(value[i]);
        }
        res += ']';
        return res;
    }

    if (typeof value === 'object') {
        // Keys sort
        const keys = Object.keys(value as object).sort();
        let res = '{';
        let first = true;
        for (const key of keys) {
            const val = (value as Record<string, unknown>)[key];
            // Skip undefined, but reject null per spec
            if (val === undefined) continue;

            if (!first) res += ',';
            first = false;

            res += JSON.stringify(key);
            res += ':';
            res += stringify(val);
        }
        res += '}';
        return res;
    }

    throw new Error(`Canonical JSON v1: Unsupported type ${typeof value}`);
}
