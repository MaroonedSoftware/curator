import { useState } from 'react';
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconReplace, IconUpload, IconX } from '@tabler/icons-react';
import { tvApi } from '../../api/api.client';
import { useReplaceArt } from '../../api/tv.mutations';
import { IMAGE_TYPES, MAX_IMAGE_BYTES, rejectionMessage } from '../../api/upload.limits';
import { useTv } from '../../tvs/tv.context';
import { ArtThumbnail } from './art.thumbnail';

interface ReplaceModalProps {
    contentId: string;
    /** A file already chosen, as when one is dropped straight onto the piece. */
    file?: File;
    onClose: () => void;
    /** Called with the piece now standing in for the old one. */
    onReplaced?: (contentId: string) => void;
}

/** Swaps one piece's image for a new file, after showing what will happen. */
export function ReplaceModal({ contentId, file: initialFile, onClose, onReplaced }: ReplaceModalProps) {
    const tv = useTv();
    const replace = useReplaceArt(tv.id);
    const [file, setFile] = useState(initialFile);
    const [rejection, setRejection] = useState<string>();

    const submit = () => {
        if (!file) return;
        replace.mutate(
            { contentId, image: file },
            {
                onSuccess: result => {
                    notifications.show({
                        color: 'teal',
                        title: 'Replaced',
                        message: result.duplicate
                            ? `The TV already had that image as ${result.contentId}, which now stands in for ${contentId}.`
                            : `${contentId} is now ${result.contentId}.`,
                    });
                    onReplaced?.(result.contentId);
                    onClose();
                },
            },
        );
    };

    return (
        <Modal opened onClose={onClose} title={`Replace ${contentId}`}>
            <Stack>
                <Group wrap="nowrap" align="flex-start">
                    <div style={{ width: 160, flexShrink: 0 }}>
                        <ArtThumbnail src={tvApi(tv.id).thumbnailUrl(contentId)} alt={contentId} />
                    </div>
                    <Text size="sm" c="dimmed">
                        The new image keeps this piece’s mattes and takes its place in every album and the rotation. The old image is then deleted
                        from the TV.
                    </Text>
                </Group>
                <Dropzone
                    onDrop={files => {
                        setRejection(undefined);
                        if (files[0]) setFile(files[0]);
                    }}
                    onReject={rejections => rejections[0] && setRejection(rejectionMessage(rejections[0]))}
                    accept={IMAGE_TYPES}
                    maxSize={MAX_IMAGE_BYTES}
                    multiple={false}
                    disabled={replace.isPending}
                    data-testid="replace-dropzone"
                >
                    <Group justify="center" gap="md" mih={64} style={{ pointerEvents: 'none' }}>
                        <Dropzone.Accept>
                            <IconUpload size={28} stroke={1.5} />
                        </Dropzone.Accept>
                        <Dropzone.Reject>
                            <IconX size={28} stroke={1.5} />
                        </Dropzone.Reject>
                        <Dropzone.Idle>
                            <IconPhoto size={28} stroke={1.5} />
                        </Dropzone.Idle>
                        <Text>{file ? file.name : 'Drop the new image here, or click to choose it'}</Text>
                    </Group>
                </Dropzone>
                {rejection && (
                    <Alert color="red" variant="light">
                        {rejection}
                    </Alert>
                )}
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose} disabled={replace.isPending}>
                        Cancel
                    </Button>
                    <Button leftSection={<IconReplace size={16} />} onClick={submit} loading={replace.isPending} disabled={!file}>
                        Replace
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
