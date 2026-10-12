import { useState } from 'react';
import { AspectRatio, Center, Image } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

/**
 * A piece's thumbnail, loaded only as it scrolls into view. The TV has no thumbnail for some pieces,
 * and may be unreachable, so a failed load shows a placeholder instead of a broken image.
 */
export function ArtThumbnail({ src, alt }: { src: string; alt: string }) {
    const [failed, setFailed] = useState(false);

    return (
        <AspectRatio ratio={16 / 9} bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
            {failed ? (
                <Center aria-label={`No thumbnail for ${alt}`} role="img">
                    <IconPhoto size={32} stroke={1.25} color="var(--mantine-color-dimmed)" />
                </Center>
            ) : (
                <Image src={src} alt={alt} loading="lazy" fit="contain" onError={() => setFailed(true)} />
            )}
        </AspectRatio>
    );
}
