/**
 * A typed client for @curator/api: `api` for the TVs themselves, `tvApi(tvId)` for one TV's art. In development Vite proxies /api to the API (vite.config.ts);
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
    /** The first of `categoryIds`. */
    categoryId: string;
    /** Every category the TV lists the piece under. */
    categoryIds: string[];
    raw: Record<string, unknown>;
}

export interface CurrentArt {
    contentId?: string;
    categoryId?: string;
    raw: Record<string, unknown>;
}

/** A TV curator manages. */
export interface Tv {
    id: string;
    name: string;
    host: string;
    port: number;
    model?: string;
    /** False when the TV must be paired again. */
    paired: boolean;
    createdAt: string;
    updatedAt: string;
}

/** A Frame found on the network. `tvId` is set when it is already added. */
export interface DiscoveredTv {
    host: string;
    port: number;
    name?: string;
    model?: string;
    tvId?: string;
}

export interface ConnectTv {
    host: string;
    port?: number;
    name?: string;
}

export interface MatteOptions {
    matte?: string;
    portraitMatte?: string;
}

/**
 * TV-side categories. MY-C0008 is the Art Store in the reference library, but a 2025 Frame lists
 * uploads there too, so it is shown as Other.
 */
export const Category = {
    MyPhotos: 'MY-C0002',
    Favourites: 'MY-C0004',
    Other: 'MY-C0008',
} as const;

/** Uploads are ours to delete: anything in My Photos, or with an upload's id (MY-F0001, or MY_F0001 on newer firmware). */
export const isUpload = (item: ArtItem): boolean => item.categoryIds.includes(Category.MyPhotos) || /^MY[-_]F/.test(item.contentId);

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

    tvs: async () => (await request<{ items: Tv[] }>('/tvs')).items,
    tv: (tvId: string) => request<Tv>(`/tvs/${encodeURIComponent(tvId)}`),
    /** Searches the network for a few seconds. */
    discoverTvs: async () => (await request<{ items: DiscoveredTv[] }>('/tvs/discover')).items,
    /** Pairs with the TV, which waits for someone to accept the prompt on it: up to 30 seconds. */
    connectTv: (tv: ConnectTv) => request<Tv>('/tvs', json('POST', tv)),
    renameTv: (tvId: string, name: string) => request<Tv>(`/tvs/${encodeURIComponent(tvId)}`, json('PATCH', { name })),
    removeTv: (tvId: string) => request<void>(`/tvs/${encodeURIComponent(tvId)}`, { method: 'DELETE' }),
};

/** One TV's own endpoints, under /tvs/:tvId. */
export const tvApi = (tvId: string) => {
    const base = `/tvs/${encodeURIComponent(tvId)}`;
    return {
        device: () => request<Device>(`${base}/device`),
        apiVersion: async () => (await request<{ version: string }>(`${base}/api-version`)).version,
        listArt: async (category?: string) => (await request<{ items: ArtItem[] }>(`${base}/art${query({ category })}`)).items,
        currentArt: () => request<CurrentArt>(`${base}/art/current`),
        artMode: async () => (await request<{ on: boolean }>(`${base}/art-mode`)).on,

        selectArt: (contentId: string, opts: { show?: boolean; category?: string } = {}) =>
            request<void>(`${base}/art/current`, json('PUT', { contentId, ...opts })),
        deleteArt: (contentId: string) => request<void>(`${base}/art/${encodeURIComponent(contentId)}`, { method: 'DELETE' }),
        changeMatte: (contentId: string, matte: string, portraitMatte?: string) =>
            request<void>(`${base}/art/${encodeURIComponent(contentId)}/matte`, json('PUT', { matte, portraitMatte })),
        setArtMode: (on: boolean) => request<void>(`${base}/art-mode`, json('PUT', { on })),

        /** Where the browser loads a piece's thumbnail from. The API batches and caches these. */
        thumbnailUrl: (contentId: string) => `${BASE}${base}/art/${encodeURIComponent(contentId)}/thumbnail`,
        /** Where the browser loads a piece's original from, when the API kept one: see `hasOriginal`. */
        originalUrl: (contentId: string) => `${BASE}${base}/art/${encodeURIComponent(contentId)}/original`,
        /** Whether the API kept the piece's original, which it does only for pieces uploaded through curator. */
        hasOriginal: async (contentId: string) => {
            const response = await fetch(`${BASE}${base}/art/${encodeURIComponent(contentId)}/original`, { method: 'HEAD' });
            if (response.status === 404) return false;
            if (!response.ok) throw new ApiError(response.status, response.statusText);
            return true;
        },

        /** Resolves with the content id the TV assigned. */
        uploadArt: async (image: Blob, opts: MatteOptions = {}) =>
            (
                await request<{ contentId: string }>(`${base}/art${query({ ...opts })}`, {
                    method: 'POST',
                    headers: { 'content-type': image.type },
                    body: image,
                })
            ).contentId,
    };
};
