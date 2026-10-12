import { Alert } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { describeError } from '../../api/api.error';

/** A failed call, explained in the API's terms. */
export function ErrorAlert({ error }: { error: unknown }) {
    const { title, message } = describeError(error);
    return (
        <Alert color="red" variant="light" title={title} icon={<IconAlertTriangle size={18} />}>
            {message}
        </Alert>
    );
}
