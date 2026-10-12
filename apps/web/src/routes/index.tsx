import { createFileRoute, redirect } from '@tanstack/react-router';
import { tvsOptions } from '../api/tvs.queries';
import { readLastTvId } from '../tvs/last.tv';

/** Opens the TV this browser last looked at, else the first one, else the TVs page to add one. */
export const Route = createFileRoute('/')({
    beforeLoad: async ({ context }) => {
        const tvs = await context.queryClient.ensureQueryData(tvsOptions()).catch(() => undefined);
        const lastTvId = readLastTvId();
        const tv = tvs?.find(candidate => candidate.id === lastTvId) ?? tvs?.[0];
        if (tv) {
            throw redirect({ to: '/tvs/$tvId', params: { tvId: tv.id } });
        }
        throw redirect({ to: '/tvs' });
    },
});
