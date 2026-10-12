import { useState } from 'react';
import { AspectRatio, Center, Image, UnstyledButton } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

/**
 * A piece's thumbnail, loaded only as it scrolls into view. The TV has no thumbnail for some pieces,
 * and may be unreachable, so a failed load shows a placeholder instead of a broken image, as does no `src`.
 */
export function ArtThumbnail({ src, alt, onOpen }: { src?: string; alt: string; onOpen?: () => void }) {
    const [failed, setFailed] = useState(false);

    const thumbnail = (
        <AspectRatio ratio={16 / 9} bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
            {failed || !src ? (
                <Center aria-label={`No thumbnail for ${alt}`} role="img">
                    <IconPhoto size={32} stroke={1.25} color="var(--mantine-color-dimmed)" />
                </Center>
            ) : (
                <Image src={src} alt={alt} loading="lazy" fit="contain" onError={() => setFailed(true)} />
            )}
        </AspectRatio>
    );
    if (!onOpen) return thumbnail;
    return (
        <UnstyledButton onClick={onOpen} aria-label={`Expand ${alt}`} display="block" w="100%" style={{ cursor: 'zoom-in' }}>
            {thumbnail}
        </UnstyledButton>
    );
}
