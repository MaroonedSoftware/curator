import { ApiError } from './api.client';

export interface ErrorDescription {
    title: string;
    message: string;
}

/** What to tell a person about a failed call, in the API's terms (see apps/api/README.md). */
export function describeError(error: unknown): ErrorDescription {
    if (!(error instanceof ApiError)) {
        return { title: 'The API is unreachable', message: 'Is it running? Start it with `pnpm --filter @curator/api dev`.' };
    }
    const reason = error.reason ?? error.message;
    switch (error.status) {
        case 503:
            return { title: 'The TV is unreachable', message: `It may be asleep or off the network. (${reason})` };
        case 504:
            return { title: 'The TV didn’t answer', message: reason };
        case 502:
            return { title: 'The TV refused the request', message: reason };
        case 422:
            return { title: 'The TV rejected that', message: reason };
        default:
            return { title: `Request failed (${error.status})`, message: reason };
    }
}
