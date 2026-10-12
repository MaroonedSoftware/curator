import { MemoryTokenStore, SamsungFrameClient } from '@curator/frame';
import { describe, expect, it } from 'vitest';
import { FrameClientFactoryToken } from '../../../src/modules/frame/frame.client.registry.js';
import { buildServer } from '../../../src/server/setup.server.js';
import { createTestServer, silentLogger, testConfig } from '../../test.server.js';

describe('TvsModule', () => {
    it('boots with no TVs, and builds Samsung clients without dialling them', async () => {
        const { builder, container } = await buildServer(testConfig(), silentLogger);

        const client = container.get(FrameClientFactoryToken)({ id: 'a', host: '192.0.2.1', port: 8002 }, new MemoryTokenStore());

        expect(client).toBeInstanceOf(SamsungFrameClient);
        await client.close();
        await builder.app.close();
    });

    it('closes every TV’s client on shutdown', async () => {
        const server = await createTestServer(import.meta.url);
        const tv = await server.addTv();
        await server.app.inject({ method: 'GET', url: `/tvs/${tv.id}/art-mode` });
        const client = server.tvs.get(tv.id)!.client;

        await server.close();

        expect(client.closed).toBe(true);
    });
});
