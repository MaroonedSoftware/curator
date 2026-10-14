/**
 * A caught `unknown` as a sentence for a log line: the message, or the value itself when something
 * threw a non-Error. It drops the stack and type on purpose; code deciding what to do about a failure
 * should look at the error itself.
 */
export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));
