import type { TokenStore } from '@curator/frame';
import type { TvRepository } from './tv.repository.js';

/** A TV's pairing token, kept in its `tvs` row. The TV may issue a fresh one on any connect. */
export class DbTokenStore implements TokenStore {
    constructor(
        private readonly tvs: TvRepository,
        private readonly tvId: string,
    ) {}

    load(): Promise<string | undefined> {
        return this.tvs.getToken(this.tvId);
    }

    save(token: string): Promise<void> {
        return this.tvs.setToken(this.tvId, token);
    }
}
