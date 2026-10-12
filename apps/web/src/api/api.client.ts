/**
 * A typed client for @curator/api. In development Vite proxies /api to the API (vite.config.ts);
 * in production the API is expected behind the same origin at /api.
 */

const BASE = '/api';

export interface Health {
    status: 'ok';
    uptimeMs: number;
}

export interface Device {
    model?: string;
    name?: string;
    frameTvSupport: boolean;
    powerOn: boolean;
    raw: Record<string, unknown>;
}

export interface ArtItem {
    contentId: string;
    categoryId: string;
    raw: Record<string, unknown>;
}

export interface CurrentArt {
    contentId?: string;
    categoryId?: string;
    raw: Record<string, unknown>;
}

export interface MatteOptions {
    matte?: string;
    portraitMatte?: string;
}

/** TV-side categories. */
export const Category = {
    MyPhotos: 'MY-C0002',
    Favourites: 'MY-C0004',
    Store: 'MY-C0008',
} as const;

/** A non-2xx answer from the API, carrying its status and the `details` ServerKit renders. */
export class ApiError extends Error {
    constructor(
        readonly status: number,
        message: string,
        readonly details: Record<string, unknown> = {},
    ) {
        super(message);
        this.name = 'ApiError';
    }

    /** The API's explanation, when it gave one: `details.reason` for TV failures. */
    get reason(): string | undefined {
        return typeof this.details.reason === 'string' ? this.details.reason : undefined;
    }
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await fetch(`${BASE}${path}`, init);
    if (response.status === 204) {
        return undefined as T;
    }
    const body: unknown = await response.json().catch(() => undefined);
    if (!response.ok) {
        const message = isRecord(body) && typeof body.message === 'string' ? body.message : response.statusText;
        throw new ApiError(response.status, message, isRecord(body) && isRecord(body.details) ? body.details : {});
    }
    return body as T;
}

const json = (method: string, body: unknown): RequestInit => ({
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
});

const query = (params: Record<string, string | undefined>): string => {
    const search = new URLSearchParams(
        Object.entries(params).filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== ''),
    );
    const text = search.toString();
    return text ? `?${text}` : '';
};

export const api = {
    health: () => request<Health>('/health'),
    device: () => request<Device>('/tv'),
    apiVersion: async () => (await request<{ version: string }>('/tv/api-version')).version,
    listArt: async (category?: string) => (await request<{ items: ArtItem[] }>(`/tv/art${query({ category })}`)).items,
    currentArt: () => request<CurrentArt>('/tv/art/current'),
    artMode: async () => (await request<{ on: boolean }>('/tv/art-mode')).on,

    selectArt: (contentId: string, opts: { show?: boolean; category?: string } = {}) =>
        request<void>('/tv/art/current', json('PUT', { contentId, ...opts })),
    deleteArt: (contentId: string) => request<void>(`/tv/art/${encodeURIComponent(contentId)}`, { method: 'DELETE' }),
    changeMatte: (contentId: string, matte: string, portraitMatte?: string) =>
        request<void>(`/tv/art/${encodeURIComponent(contentId)}/matte`, json('PUT', { matte, portraitMatte })),
    setArtMode: (on: boolean) => request<void>('/tv/art-mode', json('PUT', { on })),

    /** Resolves with the content id the TV assigned. */
    uploadArt: async (image: Blob, opts: MatteOptions = {}) =>
        (
            await request<{ contentId: string }>(`/tv/art${query({ ...opts })}`, {
                method: 'POST',
                headers: { 'content-type': image.type },
                body: image,
            })
        ).contentId,
};
