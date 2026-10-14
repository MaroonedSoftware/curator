import { AppConfigBuilder, type AppConfigSource } from '@maroonedsoftware/appconfig';
import { describe, expect, it } from 'vitest';
import { EnvTextResolver } from '../../src/server/env.text.resolver.js';

/** Resolves `values` the way loadConfig does, against `environment` rather than the process's own. */
const resolve = async (values: Record<string, unknown>, environment: NodeJS.ProcessEnv) => {
    const source: AppConfigSource = { load: async () => structuredClone(values), get: async key => values[key], watch: () => () => {} };
    const config = await new AppConfigBuilder().addSource(source).addResolver(new EnvTextResolver(environment)).buildSnapshot();
    return config.toObject();
};

describe('EnvTextResolver', () => {
    it('fills a variable in as the exact text it was set to', async () => {
        const environment = { A: '1.50', B: '12345678901234567890', C: 'true', D: 'p$&ss$$' };

        expect(await resolve({ a: '${env:A}', b: '${env:B}', c: '${env:C}', d: '${env:D}' }, environment)).toEqual({
            a: '1.50',
            b: '12345678901234567890',
            c: 'true',
            d: 'p$&ss$$',
        });
    });

    it('fills an unset variable in as an empty string', async () => {
        expect(await resolve({ a: '${env:MISSING}' }, {})).toEqual({ a: '' });
    });

    it('interpolates references inside a longer value and inside arrays', async () => {
        expect(await resolve({ url: 'http://${env:HOST}:${env:PORT}/', list: ['${env:HOST}'] }, { HOST: 'tv', PORT: '8002' })).toEqual({
            url: 'http://tv:8002/',
            list: ['tv'],
        });
    });
});
