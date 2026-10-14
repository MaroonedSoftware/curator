import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { currentTrace } from '../../src/logging/trace.context.js';
import { tracePlugin } from '../../src/logging/trace.plugin.js';

describe('tracePlugin', () => {
    it('runs each request in a trace named by its id and route pattern', async () => {
        const app = Fastify({ genReqId: () => 'req-1' });
        await app.register(tracePlugin());
        app.get('/tvs/:tvId', async () => {
            // Past an await, as the frame client's lines would be.
            await new Promise(done => setImmediate(done));
            return currentTrace();
        });

        const response = await app.inject({ method: 'GET', url: '/tvs/abc?secret=1' });

        expect(response.json()).toEqual({ id: 'req-1', kind: 'GET /tvs/:tvId' });
    });

    it('names an unmatched request by its path, without the query', async () => {
        const app = Fastify({ genReqId: () => 'req-2' });
        await app.register(tracePlugin());
        let seen: unknown;
        app.setNotFoundHandler(async (_request, reply) => {
            seen = currentTrace();
            return reply.code(404).send();
        });

        await app.inject({ method: 'GET', url: '/nope?token=x' });

        expect(seen).toEqual({ id: 'req-2', kind: 'GET /nope' });
    });
});
