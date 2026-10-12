import { Select } from '@mantine/core';
import { IconDeviceTv } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { tvsOptions } from '../../api/tvs.queries';

/**
 * Picks the TV the pages are about. Switching keeps you on the same page (Library stays Library),
 * and from the TVs page opens the chosen TV's Now showing.
 */
export function TvSwitcher({ tvId }: { tvId: string | undefined }) {
    const tvs = useQuery(tvsOptions());
    const navigate = useNavigate();
    const pathname = useLocation({ select: location => location.pathname });

    if (!tvs.data || tvs.data.length === 0) {
        return null;
    }

    const switchTo = (next: string | null) => {
        if (!next || next === tvId) return;
        const page = tvId ? pathname.slice(`/tvs/${tvId}`.length).replace(/\/$/, '') : '';
        // Same page, other TV. The path is built rather than typed: `page` is whichever TV page is open.
        void navigate({ to: `/tvs/$tvId${page}` as '/tvs/$tvId', params: { tvId: next } });
    };

    return (
        <Select
            aria-label="TV"
            placeholder="Choose a TV"
            data={tvs.data.map(tv => ({ value: tv.id, label: tv.name }))}
            value={tvId ?? null}
            onChange={switchTo}
            allowDeselect={false}
            leftSection={<IconDeviceTv size={16} />}
            w={200}
            size="sm"
        />
    );
}
