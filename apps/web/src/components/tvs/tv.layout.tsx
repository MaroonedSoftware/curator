import { useEffect } from 'react';
import { Alert, Button, Skeleton, Stack } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, Outlet } from '@tanstack/react-router';
import { ApiError } from '../../api/api.client';
import { tvOptions } from '../../api/tvs.queries';
import { rememberLastTvId } from '../../tvs/last.tv';
import { TvContext } from '../../tvs/tv.context';
import { ErrorAlert } from '../shared/error.alert';

/** Loads the TV a /tvs/$tvId page is about and provides it to the page. */
export function TvLayout({ tvId }: { tvId: string }) {
    const tv = useQuery(tvOptions(tvId));

    useEffect(() => {
        if (tv.isSuccess) {
            rememberLastTvId(tv.data.id);
        }
    }, [tv.isSuccess, tv.data?.id]);

    if (tv.isPending) {
        return <Skeleton h={120} maw={640} />;
    }
    if (tv.isError) {
        const missing = tv.error instanceof ApiError && (tv.error.status === 404 || tv.error.status === 400);
        return (
            <Stack maw={640}>
                {missing ? (
                    <Alert color="orange" variant="light" title="That TV isn’t added">
                        It may have been removed. Pick another TV, or add it again.
                    </Alert>
                ) : (
                    <ErrorAlert error={tv.error} />
                )}
                <Button component={Link} to="/tvs" variant="light" w="fit-content">
                    Go to TVs
                </Button>
            </Stack>
        );
    }
    return (
        <TvContext.Provider value={tv.data}>
            <Outlet />
        </TvContext.Provider>
    );
}
