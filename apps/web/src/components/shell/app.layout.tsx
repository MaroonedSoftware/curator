import type { ReactNode } from 'react';
import { AppShell, Burger, Group, NavLink, Title } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconActivity, IconPhotoHeart, type Icon } from '@tabler/icons-react';
import { Link, useLocation } from '@tanstack/react-router';
import { ApiStatus } from './api.status';

interface NavItem {
    to: string;
    label: string;
    icon: Icon;
}

const NAV: NavItem[] = [
    { to: '/', label: 'Now showing', icon: IconPhotoHeart },
    { to: '/status', label: 'Status', icon: IconActivity },
];

export function AppLayout({ children }: { children: ReactNode }) {
    const [opened, { toggle, close }] = useDisclosure();
    const pathname = useLocation({ select: location => location.pathname });

    return (
        <AppShell header={{ height: 56 }} navbar={{ width: 220, breakpoint: 'sm', collapsed: { mobile: !opened } }} padding="lg">
            <AppShell.Header>
                <Group h="100%" px="md" justify="space-between">
                    <Group gap="sm">
                        <Burger opened={opened} onClick={toggle} hiddenFrom="sm" size="sm" aria-label="Toggle navigation" />
                        <img src="/frame.svg" alt="" width={24} height={24} />
                        <Title order={4}>Curator</Title>
                    </Group>
                    <ApiStatus />
                </Group>
            </AppShell.Header>
            <AppShell.Navbar p="xs">
                {NAV.map(item => (
                    <NavLink
                        key={item.to}
                        component={Link}
                        to={item.to}
                        label={item.label}
                        leftSection={<item.icon size={18} stroke={1.5} />}
                        active={pathname === item.to}
                        onClick={close}
                    />
                ))}
            </AppShell.Navbar>
            <AppShell.Main>{children}</AppShell.Main>
        </AppShell>
    );
}
