/** Every query key, in one place, so a mutation can name exactly what it invalidates. */
export const queryKeys = {
    health: ['health'] as const,
    tv: ['tv'] as const,
    device: ['tv', 'device'] as const,
    apiVersion: ['tv', 'api-version'] as const,
    art: (category?: string) => ['tv', 'art', 'list', category ?? 'all'] as const,
    allArt: ['tv', 'art', 'list'] as const,
    currentArt: ['tv', 'art', 'current'] as const,
    artMode: ['tv', 'art-mode'] as const,
};
