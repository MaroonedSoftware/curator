import { SamsungFrameClient } from '@curator/frame';
import { describe, expect, it } from 'vitest';
import { FrameClientToken } from '../../../src/modules/frame/frame.tokens.js';
import { buildServer } from '../../../src/server/setup.server.js';
import { createTestServer, silentLogger, testConfig } from '../../test.server.js';

describe('FrameModule', () => {
    it('builds a Samsung client from config without dialling the TV', async () => {
        const { builder, container } = await buildServer(testConfig(), silentLogger);

        expect(container.get(FrameClientToken)).toBeInstanceOf(SamsungFrameClient);
        await builder.app.close();
    });

    it('refuses to boot without a TV host', async () => {
        await expect(buildServer(testConfig(undefined, { tv: {} }), silentLogger)).rejects.toThrow(/tv\.host/);
    });

    it('closes the client on shutdown', async () => {
        const server = await createTestServer(import.meta.url);

        await server.close();

        expect(server.tv.closed).toBe(true);
    });
});
