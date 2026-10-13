import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Checkbox, Group, Image, Stack, Text, Title } from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import { IconPhoto, IconUpload, IconX } from '@tabler/icons-react';
import { Link } from '@tanstack/react-router';
import { NO_MATTE } from '../../api/mattes';
import { useUploadArt } from '../../api/tv.mutations';
import { IMAGE_TYPE_NAMES, IMAGE_TYPES, MAX_IMAGE_BYTES, rejectionMessage } from '../../api/upload.limits';
import { useTv } from '../../tvs/tv.context';
import { MattePicker } from '../art/matte.picker';

const fileSize = (bytes: number) =>
    bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

/** Sends one image to the TV's My Photos. */
export function UploadPage() {
    const [file, setFile] = useState<File>();
    const [rejection, setRejection] = useState<string>();
    const [matte, setMatte] = useState(NO_MATTE);
    const [portraitMatte, setPortraitMatte] = useState(NO_MATTE);
    const [show, setShow] = useState(true);
    const [uploaded, setUploaded] = useState<string>();
    const tv = useTv();
    const upload = useUploadArt(tv.id);

    const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
    useEffect(
        () => () => {
            if (preview) URL.revokeObjectURL(preview);
        },
        [preview],
    );

    const choose = (next: File) => {
        setFile(next);
        setRejection(undefined);
        setUploaded(undefined);
    };

    const send = () => {
        if (!file) return;
        upload.mutate(
            { image: file, matte, portraitMatte, show },
            {
                onSuccess: contentId => {
                    setUploaded(contentId);
                    setFile(undefined);
                    notifications.show({ color: 'teal', title: 'Uploaded', message: `The TV saved it as ${contentId}.` });
                },
            },
        );
    };

    return (
        <Stack maw={640}>
            <Title order={2}>Upload to {tv.name}</Title>

            <Dropzone
                onDrop={files => files[0] && choose(files[0])}
                onReject={rejections => rejections[0] && setRejection(rejectionMessage(rejections[0]))}
                accept={IMAGE_TYPES}
                maxSize={MAX_IMAGE_BYTES}
                maxFiles={1}
                multiple={false}
                loading={upload.isPending}
            >
                <Group justify="center" gap="lg" mih={140} style={{ pointerEvents: 'none' }}>
                    <Dropzone.Accept>
                        <IconUpload size={40} stroke={1.5} />
                    </Dropzone.Accept>
                    <Dropzone.Reject>
                        <IconX size={40} stroke={1.5} />
                    </Dropzone.Reject>
                    <Dropzone.Idle>
                        <IconPhoto size={40} stroke={1.5} />
                    </Dropzone.Idle>
                    <div>
                        <Text size="lg">Drop an image here, or click to choose one</Text>
                        <Text size="sm" c="dimmed">
                            {IMAGE_TYPE_NAMES}, up to 20MB. 3840×2160 fills the screen.
                        </Text>
                    </div>
                </Group>
            </Dropzone>

            {rejection && (
                <Alert color="red" variant="light">
                    {rejection}
                </Alert>
            )}

            {uploaded && (
                <Alert color="teal" variant="light" title="On the TV">
                    Saved as{' '}
                    <Text span ff="monospace">
                        {uploaded}
                    </Text>
                    . Find it in the{' '}
                    <Link to="/tvs/$tvId/library" params={{ tvId: tv.id }} search={{ category: 'MY-C0002' }}>
                        library
                    </Link>
                    .
                </Alert>
            )}

            {file && (
                <Card withBorder>
                    <Stack>
                        <Group wrap="nowrap" align="flex-start">
                            {preview && <Image src={preview} alt={`Preview of ${file.name}`} w={160} h={90} fit="contain" bg="dark.8" radius="sm" />}
                            <div>
                                <Text fw={600}>{file.name}</Text>
                                <Text size="sm" c="dimmed">
                                    {fileSize(file.size)}
                                </Text>
                            </div>
                        </Group>
                        <MattePicker label="Landscape" value={matte} onChange={setMatte} />
                        <MattePicker label="Portrait" value={portraitMatte} onChange={setPortraitMatte} />
                        <Checkbox
                            label="Show it on the TV once it’s uploaded"
                            checked={show}
                            onChange={event => setShow(event.currentTarget.checked)}
                        />
                        <Group justify="flex-end">
                            <Button variant="default" onClick={() => setFile(undefined)} disabled={upload.isPending}>
                                Clear
                            </Button>
                            <Button onClick={send} loading={upload.isPending} leftSection={<IconUpload size={16} />}>
                                Upload
                            </Button>
                        </Group>
                    </Stack>
                </Card>
            )}
        </Stack>
    );
}
