import type { FileRejection } from '@mantine/dropzone';

/** The API's ceiling (apps/api's MAX_IMAGE_BYTES). A 4K JPEG is well under it. */
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** What the API takes (apps/api's UPLOAD_IMAGE_TYPES). It converts all but JPEG and PNG for the TV. */
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'image/tiff'];

/** {@link IMAGE_TYPES} as a person would read them. */
export const IMAGE_TYPE_NAMES = 'JPEG, PNG, WebP, AVIF, GIF or TIFF';

/** Why a dropped file was turned away, in a sentence. */
export const rejectionMessage = (rejection: FileRejection): string => {
    const code = rejection.errors[0]?.code;
    if (code === 'file-too-large') return `${rejection.file.name} is over 20MB.`;
    if (code === 'file-invalid-type') return `${rejection.file.name} isn’t a ${IMAGE_TYPE_NAMES}.`;
    return rejection.errors[0]?.message ?? `${rejection.file.name} can’t be uploaded.`;
};
