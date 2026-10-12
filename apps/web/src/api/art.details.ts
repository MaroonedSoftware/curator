import type { ArtItem } from './api.client';

const text = (value: unknown): string | undefined => (typeof value === 'string' && value.length > 0 ? value : undefined);

const positive = (value: unknown): number | undefined => {
    const number = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
    return Number.isFinite(number) && number > 0 ? number : undefined;
};

export interface ArtDetails {
    matte?: string;
    portraitMatte?: string;
    /** The original's size, as the TV reports it. */
    width?: number;
    height?: number;
    /** When the image was taken or added, from the TV's `image_date`. */
    date?: Date;
}

/** `image_date` comes as `2026:03:17 13:29:37`, EXIF style, in the TV's local time. */
export function parseImageDate(value: unknown): Date | undefined {
    const match = typeof value === 'string' ? /^(\d{4}):(\d{2}):(\d{2})(?: (\d{2}):(\d{2}):(\d{2}))?$/.exec(value.trim()) : null;
    if (!match) return undefined;
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = match;
    const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
    return Number.isNaN(date.getTime()) ? undefined : date;
}

/** What the TV's raw entry says about a piece, where it says it. */
export function artDetails(item: ArtItem): ArtDetails {
    return {
        matte: text(item.raw.matte_id),
        portraitMatte: text(item.raw.portrait_matte_id),
        width: positive(item.raw.width),
        height: positive(item.raw.height),
        date: parseImageDate(item.raw.image_date),
    };
}
