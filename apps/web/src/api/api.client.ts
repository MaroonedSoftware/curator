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

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

/** One line of the API's log. `text` is the message and its `| key=value ...` details, as written. */
export interface LogEntry {
    /** ISO 8601, or empty for a line that didn't parse. */
    ts: string;
    /** Empty for a line that didn't parse. */
    level: LogLevel | '';
    text: string;
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

/** A named set of pieces on one TV. */
export interface Album {
    id: string;
    name: string;
    pieceCount: number;
    /** The album's first piece. Absent for an empty album. */
    coverContentId?: string;
    createdAt: string;
    updatedAt: string;
}

/** An album with its pieces' content ids, in album order. Ids use `-`, never `_` (MY-F0001). */
export interface AlbumDetail extends Album {
    contentIds: string[];
}

/** The album a TV cycles through, one piece every `intervalMinutes`. */
export interface Rotation {
    albumId: string;
    albumName: string;
    intervalMinutes: number;
    /** Every piece once in random order before any repeats, or the album's order. */
    shuffle: boolean;
    lastContentId?: string;
    lastRotatedAt?: string;
    /** When the next piece is due. Absent when it is due now. */
    nextRotationAt?: string;
}

export interface RotationSetting {
    albumId: string;
    intervalMinutes?: number;
    shuffle?: boolean;
}

/** An upload's piece. `duplicate` is set when the TV already had this exact image, which then wasn't sent again. */
export interface UploadedArt {
    contentId: string;
    duplicate: boolean;
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

/** A content id as albums keep it: newer firmware reports MY_F0019 where older reports MY-F0019, so `_` is read as `-`. */
export const normalizeContentId = (contentId: string): string => contentId.replaceAll('_', '-');

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
    /** The API's log, newest first, from `level` up. */
    logs: async (level?: LogLevel) => (await request<{ items: LogEntry[] }>(`/logs${query({ level, limit: '500' })}`)).items,

    tvs: async () => (await request<{ items: Tv[] }>('/tvs')).items,
    tv: (tvId: string) => request<Tv>(`/tvs/${encodeURIComponent(tvId)}`),
    /** Searches the network for a few seconds. */
    discoverTvs: async () => (await request<{ items: DiscoveredTv[] }>('/tvs/discover')).items,
    /** Pairs with the TV, which waits for someone to accept the prompt on it: up to 30 seconds. */
    connectTv: (tv: ConnectTv) => request<Tv>('/tvs', json('POST', tv)),
    renameTv: (tvId: string, name: string) => request<Tv>(`/tvs/${encodeURIComponent(tvId)}`, json('PATCH', { name })),
    removeTv: (tvId: string) => request<void>(`/tvs/${encodeURIComponent(tvId)}`, { method: 'DELETE' }),

    /** Where the browser downloads a backup of every TV from: a zip of their art, albums and rotations. */
    backupUrl: `${BASE}/backup`,
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

        /** Where the browser downloads a backup of this TV from: a zip of its art, albums and rotation. */
        backupUrl: `${BASE}${base}/backup`,

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

        albums: async () => (await request<{ items: Album[] }>(`${base}/albums`)).items,
        album: (albumId: string) => request<AlbumDetail>(`${base}/albums/${encodeURIComponent(albumId)}`),
        createAlbum: (name: string) => request<Album>(`${base}/albums`, json('POST', { name })),
        renameAlbum: (albumId: string, name: string) => request<Album>(`${base}/albums/${encodeURIComponent(albumId)}`, json('PATCH', { name })),
        deleteAlbum: (albumId: string) => request<void>(`${base}/albums/${encodeURIComponent(albumId)}`, { method: 'DELETE' }),
        /** Appends pieces to the album. Pieces already in it keep their place. */
        addToAlbum: (albumId: string, contentIds: string[]) =>
            request<void>(`${base}/albums/${encodeURIComponent(albumId)}/pieces`, json('PUT', { contentIds })),
        removeFromAlbum: (albumId: string, contentId: string) =>
            request<void>(`${base}/albums/${encodeURIComponent(albumId)}/pieces/${encodeURIComponent(contentId)}`, { method: 'DELETE' }),

        /** Resolves undefined when the TV isn't rotating. */
        rotation: () => request<Rotation | undefined>(`${base}/rotation`),
        setRotation: (setting: RotationSetting) => request<Rotation>(`${base}/rotation`, json('PUT', setting)),
        stopRotation: () => request<void>(`${base}/rotation`, { method: 'DELETE' }),
        /** Shows the album's next piece now. Resolves with its content id. */
        advanceRotation: async () => (await request<{ contentId: string }>(`${base}/rotation/advance`, { method: 'POST' })).contentId,

        /**
         * Swaps a piece's image: the new one keeps the piece's mattes and takes its place in every album
         * and the rotation, and the old one is deleted. Resolves with the piece now standing in for it.
         */
        replaceArt: (contentId: string, image: Blob) =>
            request<UploadedArt>(`${base}/art/${encodeURIComponent(contentId)}/replace`, {
                method: 'POST',
                headers: { 'content-type': image.type },
                body: image,
            }),

        /**
         * Resolves with the piece's content id, which the TV assigns. An image curator already uploaded
         * isn't sent again: the piece already on the TV comes back, marked `duplicate`, its mattes unchanged.
         */
        uploadArt: (image: Blob, opts: MatteOptions = {}) =>
            request<UploadedArt>(`${base}/art${query({ ...opts })}`, {
                method: 'POST',
                headers: { 'content-type': image.type },
                body: image,
            }),
    };
};
