/** Every query key, in one place, so a mutation can name exactly what it invalidates. */
export const queryKeys = {
    health: ['health'] as const,
    /** The list of TVs. Invalidate with `exact: true`, or every TV's art goes with it. */
    tvs: ['tvs'] as const,
    discoveredTvs: ['tvs-discover'] as const,
    tv: (tvId: string) => ['tvs', tvId] as const,
    device: (tvId: string) => ['tvs', tvId, 'device'] as const,
    apiVersion: (tvId: string) => ['tvs', tvId, 'api-version'] as const,
    art: (tvId: string, category?: string) => ['tvs', tvId, 'art', 'list', category ?? 'all'] as const,
    allArt: (tvId: string) => ['tvs', tvId, 'art', 'list'] as const,
    currentArt: (tvId: string) => ['tvs', tvId, 'art', 'current'] as const,
    artMode: (tvId: string) => ['tvs', tvId, 'art-mode'] as const,
};
