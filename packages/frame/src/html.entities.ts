const NAMED: Record<string, string> = { quot: '"', amp: '&', apos: "'", lt: '<', gt: '>', nbsp: ' ' };

/**
 * Decodes the HTML entities Samsung's REST API leaves in strings the user typed, such as a TV
 * named `50" The Frame` reported as `50&quot; The Frame`. An unknown entity is left as it is.
 */
export function decodeHtmlEntities(text: string): string {
    return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (entity, body: string) => {
        if (body[0] === '#') {
            const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
            return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity;
        }
        return NAMED[body.toLowerCase()] ?? entity;
    });
}
