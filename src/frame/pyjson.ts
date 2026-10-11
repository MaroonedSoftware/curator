/**
 * JSON serialization matching Python's json.dumps() defaults:
 * ", " and ": " separators, non-ASCII escaped as \uXXXX.
 *
 * The TV almost certainly doesn't care, but the reference implementation
 * sends exactly this, and byte-identical traffic makes "the Python probe
 * works but the TS client doesn't" much easier to debug.
 */
export function pyJson(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return escapeString(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError(`cannot serialize ${value}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return `[${value.map(pyJson).join(', ')}]`;
  if (typeof value === 'object') {
    const parts = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${escapeString(k)}: ${pyJson(v)}`);
    return `{${parts.join(', ')}}`;
  }
  throw new TypeError(`cannot serialize ${typeof value}`);
}

function escapeString(s: string): string {
  return JSON.stringify(s).replace(/[\u007f-￿]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
}
