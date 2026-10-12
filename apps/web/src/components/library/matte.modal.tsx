import { useState } from 'react';
import { Button, Group, Modal, Stack, Text } from '@mantine/core';
import type { ArtItem } from '../../api/api.client';
import { NO_MATTE } from '../../api/mattes';
import { useChangeMatte } from '../../api/tv.mutations';
import { useTv } from '../../tvs/tv.context';
import { MattePicker } from '../art/matte.picker';

const stringField = (raw: Record<string, unknown>, key: string): string | undefined => (typeof raw[key] === 'string' ? raw[key] : undefined);

/** Changes an artwork's landscape and portrait mattes. */
export function MatteModal({ item, onClose }: { item: ArtItem; onClose: () => void }) {
    const [matte, setMatte] = useState(stringField(item.raw, 'matte_id') ?? NO_MATTE);
    const [portraitMatte, setPortraitMatte] = useState(stringField(item.raw, 'portrait_matte_id') ?? NO_MATTE);
    const changeMatte = useChangeMatte(useTv().id);

    const save = () => changeMatte.mutate({ contentId: item.contentId, matte, portraitMatte }, { onSuccess: onClose });

    return (
        <Modal opened onClose={onClose} title={`Matte for ${item.contentId}`}>
            <Stack>
                <MattePicker label="Landscape" value={matte} onChange={setMatte} />
                <MattePicker label="Portrait" value={portraitMatte} onChange={setPortraitMatte} />
                <Text size="sm" c="dimmed">
                    Not every matte fits every image. The TV refuses one that doesn’t.
                </Text>
                <Group justify="flex-end">
                    <Button variant="default" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button onClick={save} loading={changeMatte.isPending}>
                        Save
                    </Button>
                </Group>
            </Stack>
        </Modal>
    );
}
