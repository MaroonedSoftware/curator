import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { toFrameImage } from '../../../src/modules/frame/image.converter.js';

/** A small solid image, encoded as `format`, with an alpha channel when `alpha` is set. */
const image = (format: 'webp' | 'avif' | 'gif' | 'tiff', alpha = false) =>
    sharp({ create: { width: 8, height: 6, channels: alpha ? 4 : 3, background: { r: 200, g: 40, b: 40, alpha: alpha ? 0.5 : 1 } } })
        .toFormat(format)
        .toBuffer();

describe('toFrameImage', () => {
    it('passes a JPEG or PNG through untouched', async () => {
        const bytes = Buffer.from('not decoded');

        expect(await toFrameImage(bytes, 'image/jpeg')).toEqual({ data: bytes, fileType: 'jpg' });
        expect(await toFrameImage(bytes, 'image/png')).toEqual({ data: bytes, fileType: 'png' });
    });

    it.each(['webp', 'avif', 'gif', 'tiff'] as const)('turns an opaque %s into a JPEG of the same size', async format => {
        const converted = await toFrameImage(await image(format), `image/${format}`);

        expect(converted.fileType).toBe('jpg');
        expect(await sharp(converted.data).metadata()).toMatchObject({ format: 'jpeg', width: 8, height: 6 });
    });

    it('keeps transparency by turning it into a PNG', async () => {
        const converted = await toFrameImage(await image('webp', true), 'image/webp');

        expect(converted.fileType).toBe('png');
        expect(await sharp(converted.data).metadata()).toMatchObject({ format: 'png', hasAlpha: true });
    });

    it('turns an image upright by its EXIF orientation', async () => {
        // Orientation 6 means the stored 8×6 pixels are shown rotated a quarter turn, as 6×8.
        const sideways = await sharp(await image('webp'))
            .withMetadata({ orientation: 6 })
            .webp()
            .toBuffer();

        const converted = await toFrameImage(sideways, 'image/webp');

        expect(await sharp(converted.data).metadata()).toMatchObject({ width: 6, height: 8 });
    });

    it('answers 422 for bytes that aren’t the image they claim to be', async () => {
        await expect(toFrameImage(Buffer.from('RIFF nonsense'), 'image/webp')).rejects.toMatchObject({ statusCode: 422 });
    });

    it('answers 415 for a type it can’t convert', async () => {
        await expect(toFrameImage(Buffer.from('BM'), 'image/bmp')).rejects.toMatchObject({ statusCode: 415 });
    });
});
