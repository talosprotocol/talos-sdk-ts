/**
 * Canonical JSON utilities.
 */

/**
 * Recursively remove keys with null or undefined values from an object.
 * Required for contract-compliant canonical JSON where nulls should be absent.
 */
export function stripNulls(data: any): any {
  if (data === null || data === undefined) {
    return undefined;
  }
  
  if (Array.isArray(data)) {
    return data.map(stripNulls).filter(v => v !== undefined);
  }
  
  if (typeof data === 'object') {
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const stripped = stripNulls(value);
      if (stripped !== undefined) {
        result[key] = stripped;
      }
    }
    return result;
  }
  
  return data;
}
