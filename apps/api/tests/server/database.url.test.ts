import { AppConfig } from '@maroonedsoftware/appconfig';
import { describe, expect, it } from 'vitest';
import { databaseUrl } from '../../src/server/database.url.js';

const config = (database: Record<string, unknown>) =>
    new AppConfig({ server: {}, database: { host: 'db', user: 'postgres', password: 'secret', name: 'curator', ...database } });

describe('databaseUrl', () => {
    it('builds a postgres URL from database.*, with the default port', () => {
        expect(databaseUrl(config({}))).toBe('postgres://postgres:secret@db:5432/curator?sslmode=disable');
    });

    it('percent-encodes credentials', () => {
        const url = new URL(databaseUrl(config({ port: '6543', password: 'p@ss/word#1' })));

        expect(url.port).toBe('6543');
        expect(decodeURIComponent(url.password)).toBe('p@ss/word#1');
    });
});
