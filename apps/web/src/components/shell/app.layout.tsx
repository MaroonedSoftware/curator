import type { ReactNode } from 'react';
import { AppShell, Burger, Divider, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconActivity, IconAlbum, IconDeviceTv, IconFileText, IconLibraryPhoto, IconPhotoHeart, IconUpload, type Icon } from '@tabler/icons-react';
import { Link, useLocation, useParams } from '@tanstack/react-router';
import { ApiStatus } from './api.status';
import { TvSwitcher } from './tv.switcher';

interface TvPage {
    /** The path under /tvs/$tvId. */
    path: '' | '/library' | '/albums' | '/upload' | '/status';
    label: string;
    icon: Icon;
}

const TV_PAGES: TvPage[] = [
    { path: '', label: 'Now showing', icon: IconPhotoHeart },
    { path: '/library', label: 'Library', icon: IconLibraryPhoto },
    { path: '/albums', label: 'Albums', icon: IconAlbum },
    { path: '/upload', label: 'Upload', icon: IconUpload },
    { path: '/status', label: 'Status', icon: IconActivity },
];

export function AppLayout({ children }: { children: ReactNode }) {
    const [opened, { toggle, close }] = useDisclosure();
    const pathname = useLocation({ select: location => location.pathname });
    const tvId = useParams({ strict: false, select: params => params.tvId });

    return (
        <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="lg">
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
                        <img src="/frame.svg" alt="" width={24} height={24} />
                        <Title order={4} visibleFrom="xs">
                            Curator
                        </Title>
                        <TvSwitcher tvId={tvId} />
                    </Group>
                    <ApiStatus />
                </Group>
            </AppShell.Header>
            <AppShell.Navbar p="xs">
                {tvId &&
                    TV_PAGES.map(page => {
                        const href = `/tvs/${tvId}${page.path}`;
                        return (
                            <NavLink
                                key={page.path}
                                component={Link}
                                to={href}
                                // Exact, so Now showing (/tvs/$tvId) isn't also marked current on its sibling pages.
                                activeOptions={{ exact: true }}
                                label={page.label}
                                leftSection={<page.icon size={18} stroke={1.5} />}
                                // A page's own sub-pages (an album under Albums) keep it marked, but Now showing has only itself.
                                active={pathname === href || pathname === `${href}/` || (page.path !== '' && pathname.startsWith(`${href}/`))}
                                onClick={close}
                            />
                        );
                    })}
                {tvId && <Divider my="xs" />}
                <NavLink
                    component={Link}
                    to="/tvs"
                    activeOptions={{ exact: true }}
                    label="TVs"
                    leftSection={<IconDeviceTv size={18} stroke={1.5} />}
                    active={pathname === '/tvs' || pathname === '/tvs/'}
                    onClick={close}
                />
                <NavLink
                    component={Link}
                    to="/logs"
                    label="Logs"
                    leftSection={<IconFileText size={18} stroke={1.5} />}
                    active={pathname === '/logs'}
                    onClick={close}
                />
            </AppShell.Navbar>
            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    );
}
