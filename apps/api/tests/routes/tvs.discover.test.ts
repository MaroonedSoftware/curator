import { FrameConnectionError } from '@curator/frame';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestServer } from '../test.server.js';

const answerFrom = (address: string) => ({ address, headers: { st: 'urn:samsung.com:device:RemoteControlReceiver:1' } });

describe('GET /tvs/discover', () => {
    let server: Awaited<ReturnType<typeof createTestServer>>;

    beforeAll(async () => {
        server = await createTestServer(import.meta.url);
    });

    beforeEach(async () => {
        await server.db.deleteFrom('tvs').execute();
        server.tvs.clear();
        server.built.length = 0;
        server.ssdp.responses = [];
        server.ssdp.searches.length = 0;
        server.prepareTvs(() => {});
    });

    afterAll(async () => {
        await server.close();
    });

    it('searches for Samsung TVs and lists the Frames among them, by name, marking ones already added', async () => {
        const added = await server.addTv({ host: '192.168.1.60', port: 8002 });
        server.ssdp.responses = [answerFrom('192.168.1.50'), answerFrom('192.168.1.50'), answerFrom('192.168.1.60'), answerFrom('192.168.1.70')];
        const devices: Record<string, { name: string; frameTvSupport: boolean }> = {
            '192.168.1.50': { name: 'Living Room', frameTvSupport: true },
            '192.168.1.60': { name: 'Bedroom', frameTvSupport: true },
            '192.168.1.70': { name: 'Kitchen', frameTvSupport: false },
        };
        // Clients are built in the order hosts first answered.
        const order = ['192.168.1.50', '192.168.1.60', '192.168.1.70'];
        server.prepareTvs(client => {
            client.device = { ...client.device, ...devices[order[server.built.length]!]! };
        });

        const response = await server.app.inject({ method: 'GET', url: '/tvs/discover' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({
            items: [
                { host: '192.168.1.60', port: 8002, name: 'Bedroom', model: 'QE55LS03B', tvId: added.id },
                { host: '192.168.1.50', port: 8002, name: 'Living Room', model: 'QE55LS03B' },
            ],
        });
        expect(server.ssdp.searches[0]?.searchTargets).toContain('urn:samsung.com:device:RemoteControlReceiver:1');
        expect(server.built).toHaveLength(3);
        expect(server.built.every(client => client.closed)).toBe(true);
        expect(server.built.flatMap(client => client.calls.map(call => call.method))).toEqual(['deviceInfo', 'deviceInfo', 'deviceInfo']);
    });

    it('leaves out a responder that doesn’t answer', async () => {
        server.ssdp.responses = [answerFrom('192.168.1.80')];
        server.prepareTvs(client => {
            client.failOn.set('deviceInfo', new FrameConnectionError('cannot reach TV'));
        });

        const response = await server.app.inject({ method: 'GET', url: '/tvs/discover' });

        expect(response.json()).toEqual({ items: [] });
    });

    it('gives up on a responder that answers SSDP but not REST', async () => {
        await server.close();
        server = await createTestServer(import.meta.url, { discovery: { identifyTimeoutMs: 500 } });
        server.ssdp.responses = [answerFrom('192.168.1.178'), answerFrom('192.168.1.56')];
        server.prepareTvs(client => {
            if (server.built.length === 0) {
                client.deviceInfo = () => new Promise(() => {});
            }
        });
        const started = Date.now();

        const response = await server.app.inject({ method: 'GET', url: '/tvs/discover' });

        expect(response.json().items.map((tv: { host: string }) => tv.host)).toEqual(['192.168.1.56']);
        expect(Date.now() - started).toBeLessThan(2000);
        expect(server.built[0]?.closed).toBe(true);
    });

    it('answers an empty list when nothing is on the network', async () => {
        const response = await server.app.inject({ method: 'GET', url: '/tvs/discover' });

        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual({ items: [] });
        expect(server.ssdp.searches[0]?.timeoutMs).toBe(3000);
    });
});
