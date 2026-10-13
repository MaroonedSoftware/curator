import { useState } from 'react';
import { Alert, Group, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconPhotoPlus, IconUpload, IconX } from '@tabler/icons-react';
import { useUploadToAlbum } from '../../api/album.mutations';
import { IMAGE_TYPE_NAMES, IMAGE_TYPES, MAX_IMAGE_BYTES, rejectionMessage, sortDropped } from '../../api/upload.limits';
import { useTv } from '../../tvs/tv.context';

const images = (n: number) => (n === 1 ? '1 image' : `${n} images`);

/** "2 images uploaded to the TV and added to Halloween.", saying how many were already there. */
const addedMessage = (added: number, duplicates: number, albumName: string): string => {
    if (duplicates === 0) return `${images(added)} uploaded to the TV and added to ${albumName}.`;
    const already = duplicates === 1 ? '1 was already on the TV, so it wasn’t' : `${duplicates} were already on the TV, so they weren’t`;
    return `${images(added)} added to ${albumName}. ${already} uploaded again.`;
};

/**
 * Uploading images into an album, and the files the last drop turned away. Images go up without a
 * matte and stay off screen; the library can change either afterwards.
 */
export function useAlbumUpload(albumId: string, albumName: string) {
    const tv = useTv();
    const upload = useUploadToAlbum(tv.id, albumId);
    const [rejections, setRejections] = useState<string[]>([]);

    const add = (files: File[]) => {
        if (files.length === 0) return;
        upload.mutate(files, {
            onSuccess: ({ added, duplicates }) => {
                if (added > 0) {
                    notifications.show({ color: 'teal', title: 'Added', message: addedMessage(added, duplicates, albumName) });
                }
            },
        });
    };

    return {
        add,
        /** For files dropped outside the dropzone, which haven't been sorted yet. */
        drop: (files: File[]) => {
            const sorted = sortDropped(files);
            setRejections(sorted.rejections);
            add(sorted.images);
        },
        rejections,
        setRejections,
        isPending: upload.isPending,
        progress: upload.progress,
    };
}

export type AlbumUpload = ReturnType<typeof useAlbumUpload>;

/** The strip that takes images into the album, and why the last drop turned any away. */
export function AlbumDropzone({ upload }: { upload: AlbumUpload }) {
    return (
        <>
            <Dropzone
                // A drop reports its rejected files before its accepted ones, so the last drop's messages are
                // cleared here, as the drop lands, rather than when its accepted files start uploading.
                onDropAny={() => upload.setRejections([])}
                onDrop={upload.add}
                onReject={rejected => upload.setRejections(rejected.map(rejectionMessage))}
                accept={IMAGE_TYPES}
                maxSize={MAX_IMAGE_BYTES}
                multiple
                disabled={upload.isPending}
                loading={upload.isPending}
                data-testid="album-dropzone"
            >
                <Group justify="center" gap="md" mih={72} style={{ pointerEvents: 'none' }}>
                    <Dropzone.Accept>
                        <IconUpload size={28} stroke={1.5} />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                        <IconX size={28} stroke={1.5} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                        <IconPhotoPlus size={28} stroke={1.5} />
                    </Dropzone.Idle>
                    <div>
                        <Text>
                            {upload.progress
                                ? `Uploading ${upload.progress.done + 1} of ${upload.progress.total}…`
                                : 'Drop images here or anywhere on the page to add them, or onto a piece to replace it'}
                        </Text>
                        <Text size="sm" c="dimmed">
                            {IMAGE_TYPE_NAMES}, up to 20MB each.
                        </Text>
                    </div>
                </Group>
            </Dropzone>
            {upload.rejections.length > 0 && (
                <Alert color="red" variant="light">
                    {upload.rejections.map(message => (
                        <div key={message}>{message}</div>
                    ))}
                </Alert>
            )}
        </>
    );
}
