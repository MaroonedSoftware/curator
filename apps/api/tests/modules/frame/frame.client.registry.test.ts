import { MemoryTokenStore } from '@curator/frame';
import { describe, expect, it } from 'vitest';
import { FrameClientRegistry, type TvAddress } from '../../../src/modules/frame/frame.client.registry.js';
import { FakeFrameClient } from '../../fake.frame.client.js';

const registryWithFakes = () => {
    const built: { address: TvAddress; client: FakeFrameClient }[] = [];
    const registry = new FrameClientRegistry(
        address => {
            const client = new FakeFrameClient();
            built.push({ address, client });
            return client;
        },
        () => new MemoryTokenStore(),
    );
    return { registry, built };
};

describe('FrameClientRegistry', () => {
    it('builds one client per TV and reuses it', () => {
        const { registry, built } = registryWithFakes();
        const tv = { id: 'a', host: '192.168.1.50', port: 8002 };

        expect(registry.clientFor(tv)).toBe(registry.clientFor(tv));
        expect(registry.clientFor({ id: 'b', host: '192.168.1.60', port: 8002 })).not.toBe(registry.clientFor(tv));
        expect(built).toHaveLength(2);
    });

    it('replaces a client whose TV moved, closing the old one', () => {
        const { registry, built } = registryWithFakes();
        const first = registry.clientFor({ id: 'a', host: '192.168.1.50', port: 8002 });

        const second = registry.clientFor({ id: 'a', host: '192.168.1.51', port: 8002 });

        expect(second).not.toBe(first);
        expect(built[0]?.client.closed).toBe(true);
    });

    it('closes clients on remove and closeAll', async () => {
        const { registry, built } = registryWithFakes();
        registry.clientFor({ id: 'a', host: '192.168.1.50', port: 8002 });
        registry.clientFor({ id: 'b', host: '192.168.1.60', port: 8002 });

        await registry.remove('a');
        expect(built.map(entry => entry.client.closed)).toEqual([true, false]);

        await registry.closeAll();
        expect(built.map(entry => entry.client.closed)).toEqual([true, true]);
    });
});
