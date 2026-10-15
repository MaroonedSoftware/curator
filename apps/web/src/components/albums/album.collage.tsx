import { useState } from 'react';
import { AspectRatio, Box, Center, Image, UnstyledButton } from '@mantine/core';
import { IconPhoto } from '@tabler/icons-react';

/** Where each tile sits on a 2×2 grid, by how many tiles there are: one fills it, three put the first down the left. */
const AREAS: Record<number, string[]> = {
    1: ['1 / 1 / 3 / 3'],
    2: ['1 / 1 / 3 / 2', '1 / 2 / 3 / 3'],
    3: ['1 / 1 / 3 / 2', '1 / 2 / 2 / 3', '2 / 2 / 3 / 3'],
    4: ['1 / 1 / 2 / 2', '1 / 2 / 2 / 3', '2 / 1 / 3 / 2', '2 / 2 / 3 / 3'],
};

const placeholder = (label: string) => (
    <Center aria-label={label} role="img" h="100%">
        <IconPhoto size={32} stroke={1.25} color="var(--mantine-color-dimmed)" />
    </Center>
);

/** One piece of the collage. A thumbnail that fails to load leaves a dark tile rather than a broken image. */
function Tile({ src, area }: { src: string; area: string }) {
    const [failed, setFailed] = useState(false);
    return (
        <Box bg="dark.5" style={{ gridArea: area, overflow: 'hidden', minHeight: 0 }}>
            {!failed && <Image src={src} alt="" loading="lazy" fit="cover" h="100%" onError={() => setFailed(true)} />}
        </Box>
    );
}

/** An album's cover: up to four of its pieces' thumbnails in a grid, or a placeholder for an empty album. */
export function AlbumCollage({ srcs, alt, onOpen }: { srcs: string[]; alt: string; onOpen: () => void }) {
    const tiles = srcs.slice(0, 4);
    return (
        <UnstyledButton onClick={onOpen} aria-label={`Open ${alt}`} display="block" w="100%">
            <AspectRatio ratio={16 / 9} bg="dark.6" style={{ borderRadius: 'var(--mantine-radius-sm)', overflow: 'hidden' }}>
                {tiles.length === 0 ? (
                    placeholder(`No pieces in ${alt}`)
                ) : (
                    <Box role="img" aria-label={`Pieces from ${alt}`} style={{ display: 'grid', gridTemplate: '1fr 1fr / 1fr 1fr', gap: 2 }}>
                        {tiles.map((src, i) => (
                            <Tile key={src} src={src} area={AREAS[tiles.length]![i]!} />
                        ))}
                    </Box>
                )}
            </AspectRatio>
        </UnstyledButton>
    );
}
