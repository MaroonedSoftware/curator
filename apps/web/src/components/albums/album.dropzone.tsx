import { useState } from 'react';
import { Alert, Group, Text } from '@mantine/core';
import { Dropzone, type FileRejection } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconPhotoPlus, IconUpload, IconX } from '@tabler/icons-react';
import { useUploadToAlbum } from '../../api/album.mutations';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, rejectionMessage } from '../../api/upload.limits';
import { useTv } from '../../tvs/tv.context';

/**
 * Images dropped here, or anywhere on the page, go to the TV and straight into the album. They are
 * uploaded without a matte and left off screen; the library can change either afterwards.
 */
export function AlbumDropzone({ albumId, albumName }: { albumId: string; albumName: string }) {
    const tv = useTv();
    const upload = useUploadToAlbum(tv.id, albumId);
    const [rejections, setRejections] = useState<string[]>([]);

    const drop = (images: File[]) => {
        if (images.length === 0) return;
        upload.mutate(images, {
            onSuccess: added => {
                if (added.length > 0) {
                    const what = added.length === 1 ? '1 image' : `${added.length} images`;
                    notifications.show({ color: 'teal', title: 'Added', message: `${what} uploaded to the TV and added to ${albumName}.` });
                }
            },
        });
    };
    const reject = (rejected: FileRejection[]) => setRejections(rejected.map(rejectionMessage));
    // A drop reports its rejected files before its accepted ones, so the last drop's messages are
    // cleared here, as the drop lands, rather than when its accepted files start uploading.
    const props = {
        onDropAny: () => setRejections([]),
        onDrop: drop,
        onReject: reject,
        accept: IMAGE_TYPES,
        maxSize: MAX_IMAGE_BYTES,
        multiple: true,
        disabled: upload.isPending,
    };

    return (
        <>
            <Dropzone {...props} loading={upload.isPending} data-testid="album-dropzone">
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
                                : 'Drop images here to upload them into this album, or click to choose'}
                        </Text>
                        <Text size="sm" c="dimmed">
                            JPEG or PNG, up to 20MB each.
                        </Text>
                    </div>
                </Group>
            </Dropzone>
            {/* Catches a drop anywhere on the page, so the strip above needn't be the target. */}
            <Dropzone.FullScreen {...props}>
                <Group justify="center" gap="md" mih="60vh" style={{ pointerEvents: 'none' }}>
                    <IconUpload size={48} stroke={1.5} />
                    <Text size="xl">Drop to add to {albumName}</Text>
                </Group>
            </Dropzone.FullScreen>
            {rejections.length > 0 && (
                <Alert color="red" variant="light">
                    {rejections.map(message => (
                        <div key={message}>{message}</div>
                    ))}
                </Alert>
            )}
        </>
    );
}
