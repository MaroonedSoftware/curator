import { AppConfig } from '@maroonedsoftware/appconfig';
import { describe, expect, it } from 'vitest';
import { parseApiConfig } from '../../src/server/api.config.js';

const config = (overrides: Record<string, unknown>) =>
    new AppConfig({ server: {}, database: { host: 'db', user: 'postgres', password: 'secret', name: 'curator' }, ...overrides });

describe('parseApiConfig', () => {
    it('serves the web app when the API has a route prefix', () => {
        const parsed = parseApiConfig(config({ server: { routePrefix: '/api' }, web: { dir: 'public' } }));

        expect(parsed.web.dir).toBe('public');
        expect(parsed.server.routePrefix).toBe('/api');
    });

    it('refuses web.dir with the API at the root, naming server.routePrefix', () => {
        expect(() => parseApiConfig(config({ web: { dir: 'public' } }))).toThrow(/server\.routePrefix/);
    });

    it('allows a route prefix without the web app', () => {
        expect(parseApiConfig(config({ server: { routePrefix: '/api' } })).web.dir).toBeUndefined();
    });
});
