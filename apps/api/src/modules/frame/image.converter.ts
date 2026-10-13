import { httpError } from '@maroonedsoftware/errors';
import sharp from 'sharp';

/** What the TV takes, by media type. */
export const FRAME_IMAGE_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png' } as const;

/** What curator converts for the TV, by media type, with the name a person would know it by. */
export const CONVERTIBLE_IMAGE_TYPES = {
    'image/webp': 'WebP',
    'image/avif': 'AVIF',
    'image/gif': 'GIF',
    'image/tiff': 'TIFF',
} as const;

/** Every media type an upload may arrive as. */
export const UPLOAD_IMAGE_TYPES = [...Object.keys(FRAME_IMAGE_TYPES), ...Object.keys(CONVERTIBLE_IMAGE_TYPES)];

export type FrameImage = { data: Buffer; fileType: (typeof FRAME_IMAGE_TYPES)[keyof typeof FRAME_IMAGE_TYPES] };

const isFrameType = (mediaType: string): mediaType is keyof typeof FRAME_IMAGE_TYPES => mediaType in FRAME_IMAGE_TYPES;
const isConvertible = (mediaType: string): mediaType is keyof typeof CONVERTIBLE_IMAGE_TYPES => mediaType in CONVERTIBLE_IMAGE_TYPES;

/**
 * Turns an uploaded image into one the TV takes. A JPEG or PNG passes through untouched. Anything
 * else is decoded, turned upright by its EXIF orientation, and re-encoded: as a PNG when it has
 * transparency to keep, otherwise as a JPEG. An animated image keeps only its first frame.
 */
export const toFrameImage = async (image: Buffer, mediaType: string): Promise<FrameImage> => {
    if (isFrameType(mediaType)) {
        return { data: image, fileType: FRAME_IMAGE_TYPES[mediaType] };
    }
    if (!isConvertible(mediaType)) {
        throw httpError(415).withDetails({ reason: `${mediaType} isn’t an image curator can upload` });
    }
    try {
        const decoded = sharp(image).rotate();
        // A GIF always decodes with an alpha channel, so ask whether any pixel actually uses it.
        const { isOpaque } = await decoded.stats();
        return isOpaque
            ? { data: await decoded.jpeg({ quality: 92, mozjpeg: true }).toBuffer(), fileType: 'jpg' }
            : { data: await decoded.png().toBuffer(), fileType: 'png' };
    } catch (error) {
        throw httpError(422)
            .withCause(error as Error)
            .withDetails({ reason: `the image couldn’t be read as a ${CONVERTIBLE_IMAGE_TYPES[mediaType]}` });
    }
};
