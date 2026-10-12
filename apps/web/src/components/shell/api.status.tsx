import { Badge } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { healthOptions } from '../../api/tv.queries';

/** Whether the API answers. It says nothing about the TV, which /status covers. */
export function ApiStatus() {
    const { isSuccess, isError } = useQuery({ ...healthOptions(), refetchInterval: 30_000 });
    if (isError) {
        return (
            <Badge color="red" variant="light">
                API offline
            </Badge>
        );
    }
    return (
        <Badge color={isSuccess ? 'teal' : 'gray'} variant="light">
            {isSuccess ? 'API online' : 'API …'}
        </Badge>
    );
}
