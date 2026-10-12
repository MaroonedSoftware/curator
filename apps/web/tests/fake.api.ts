import { vi } from 'vitest';

type Responder = (request: {
    method: string;
    path: string;
    search: URLSearchParams;
    body: unknown;
    headers: Headers;
}) => Response | Promise<Response>;

export const jsonResponse = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export const noContent = () => new Response(null, { status: 204 });

/** A ServerKit error body, as the API renders a failed TV call. */
export const errorResponse = (status: number, message: string, details: Record<string, unknown> = {}) =>
    jsonResponse({ statusCode: status, message, details }, status);

/**
 * Replaces `fetch` with a table of `"METHOD /path"` responders (the path without the /api prefix
 * or query string). An unlisted request fails the test loudly. Returns the requests seen.
 */
export function fakeApi(routes: Record<string, Responder>) {
    const requests: { method: string; path: string; search: URLSearchParams; body: unknown; headers: Headers }[] = [];
    vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
        const url = new URL(input, 'http://localhost');
        const method = init.method ?? 'GET';
        const path = url.pathname.replace(/^\/api/, '');
        const headers = new Headers(init.headers);
        const body = typeof init.body === 'string' ? JSON.parse(init.body) : init.body;
        const request = { method, path, search: url.searchParams, body, headers };
        requests.push(request);
        const responder = routes[`${method} ${path}`];
        if (!responder) {
            throw new Error(`fakeApi: no route for ${method} ${path}`);
        }
        return responder(request);
    });
    return requests;
}

export const healthy = () => jsonResponse({ status: 'ok', uptimeMs: 1000 });

/** The TV the page tests are about. */
export const TV = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Living Room',
    host: '192.168.1.50',
    port: 8002,
    model: 'QN50LS03FAFXZA',
    paired: true,
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
};

/** Where that TV's pages and endpoints live: `/tvs/<id>`. */
export const TV_BASE = `/tvs/${TV.id}`;

/** What every page under /tvs/$tvId reads before its own data: the API's health, the TV list and the TV. */
export const withTv = () => ({
    'GET /health': healthy,
    'GET /tvs': () => jsonResponse({ items: [TV] }),
    [`GET ${TV_BASE}`]: () => jsonResponse(TV),
});
