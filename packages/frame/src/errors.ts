export class FrameError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Socket-level trouble: TV asleep, off the network, or closed the channel. */
export class FrameConnectionError extends FrameError {}

/** The TV rejected our token or nobody accepted the pairing prompt. */
export class FrameUnauthorizedError extends FrameError {}

/** A request the TV should have answered, didn't. */
export class FrameTimeoutError extends FrameError {
  constructor(readonly request: string, readonly timeoutMs: number) {
    super(`${request} timed out after ${timeoutMs}ms`);
  }
}

/** The TV answered with an error event (e.g. bad content id, unsupported matte). */
export class FrameRequestError extends FrameError {
  constructor(readonly request: string, readonly errorCode: string) {
    super(`${request} failed with error code ${errorCode}`);
  }
}
