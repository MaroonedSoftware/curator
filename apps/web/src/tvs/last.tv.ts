const KEY = 'curator.lastTvId';

/** The TV this browser last looked at, so `/` can open it again. Storage can be unavailable; then there is none. */
export function readLastTvId(): string | undefined {
    try {
        return window.localStorage.getItem(KEY) ?? undefined;
    } catch {
        return undefined;
    }
}

export function rememberLastTvId(tvId: string): void {
    try {
        window.localStorage.setItem(KEY, tvId);
    } catch {
        // Nothing to do: remembering is a convenience.
    }
}
