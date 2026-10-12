import { FrameConnectionError, FrameError, FrameRequestError, FrameTimeoutError, FrameUnauthorizedError } from '@curator/frame';
import { httpError } from '@maroonedsoftware/errors';

/**
 * Maps a frame client error to the HTTP error the API answers with. The TV is an upstream, so its
 * failures are gateway errors, except a request the TV rejected outright, which is usually a bad
 * content id or matte from the caller. Anything that is not a {@link FrameError} passes through.
 */
export const toHttpError = (error: unknown): unknown => {
    if (!(error instanceof FrameError)) {
        return error;
    }
    if (error instanceof FrameConnectionError) {
        return httpError(503).withCause(error).withDetails({ reason: error.message });
    }
    if (error instanceof FrameTimeoutError) {
        return httpError(504).withCause(error).withDetails({ reason: error.message, request: error.request });
    }
    if (error instanceof FrameUnauthorizedError) {
        return httpError(502)
            .withCause(error)
            .withDetails({ reason: `${error.message}. Accept the pairing prompt on the TV and retry.` });
    }
    if (error instanceof FrameRequestError) {
        return httpError(422).withCause(error).withDetails({ reason: error.message, request: error.request, errorCode: error.errorCode });
    }
    return httpError(502).withCause(error).withDetails({ reason: error.message });
};
