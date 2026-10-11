import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** Where the pairing token lives. The TV issues it once, after you accept the prompt on screen. */
export interface TokenStore {
    load(): Promise<string | undefined>;
    save(token: string): Promise<void>;
}

export class FileTokenStore implements TokenStore {
    constructor(private readonly path: string) {}

    async load(): Promise<string | undefined> {
        try {
            const token = (await readFile(this.path, 'utf8')).trim();
            return token || undefined;
        } catch {
            return undefined;
        }
    }

    async save(token: string): Promise<void> {
        await mkdir(dirname(this.path), { recursive: true });
        await writeFile(this.path, token, { mode: 0o600 });
    }
}

export class MemoryTokenStore implements TokenStore {
    constructor(private token?: string) {}
    async load() {
        return this.token;
    }
    async save(token: string) {
        this.token = token;
    }
}
