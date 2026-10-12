import { createSocket, type Socket } from 'node:dgram';
import { afterEach, describe, expect, it } from 'vitest';
import { mSearch, parseSsdpResponse, ssdpSearch } from '../../../src/modules/discovery/ssdp.search.js';

const answer = (st: string) =>
    [
        'HTTP/1.1 200 OK',
        'CACHE-CONTROL: max-age=1800',
        'LOCATION: http://127.0.0.1:7676/rcr/',
        `ST: ${st}`,
        'SERVER: SHP, UPnP/1.0, Samsung UPnP SDK/1.0',
        '',
        '',
    ].join('\r\n');

describe('parseSsdpResponse', () => {
    it('reads the headers of a 200 answer, keys lowercased', () => {
        expect(parseSsdpResponse(answer('urn:samsung.com:device:RemoteControlReceiver:1'))).toMatchObject({
            location: 'http://127.0.0.1:7676/rcr/',
            st: 'urn:samsung.com:device:RemoteControlReceiver:1',
        });
    });

    it('ignores searches and notifications from other hosts', () => {
        expect(parseSsdpResponse(mSearch('ssdp:all', 2))).toBeUndefined();
        expect(parseSsdpResponse('NOTIFY * HTTP/1.1\r\nNT: upnp:rootdevice\r\n\r\n')).toBeUndefined();
    });
});

describe('ssdpSearch', () => {
    let responder: Socket | undefined;

    afterEach(() => {
        responder?.close();
        responder = undefined;
    });

    /** A device that answers every M-SEARCH it receives, for its own search target. */
    const startResponder = () =>
        new Promise<{ port: number; received: string[] }>(resolve => {
            const received: string[] = [];
            responder = createSocket('udp4');
            responder.on('message', (message, remote) => {
                const text = message.toString('utf8');
                received.push(text);
                const st = /^ST: (.*?)\r?$/m.exec(text)?.[1] ?? '';
                responder?.send(answer(st), remote.port, remote.address);
            });
            responder.bind(0, '127.0.0.1', () => resolve({ port: responder!.address().port, received }));
        });

    it('sends an M-SEARCH per target and collects the answers', async () => {
        const { port, received } = await startResponder();

        const responses = await ssdpSearch({ searchTargets: ['urn:a', 'urn:b'], timeoutMs: 300, address: '127.0.0.1', port });

        expect(received.map(text => /^ST: (.*?)\r?$/m.exec(text)?.[1])).toEqual(['urn:a', 'urn:b']);
        expect(received[0]).toContain('MAN: "ssdp:discover"');
        expect(responses.map(response => [response.address, response.headers.st])).toEqual([
            ['127.0.0.1', 'urn:a'],
            ['127.0.0.1', 'urn:b'],
        ]);
    });

    it('answers nothing when nobody replies', async () => {
        const silent = createSocket('udp4');
        await new Promise<void>(resolve => silent.bind(0, '127.0.0.1', resolve));
        try {
            await expect(
                ssdpSearch({ searchTargets: ['urn:a'], timeoutMs: 200, address: '127.0.0.1', port: silent.address().port }),
            ).resolves.toEqual([]);
        } finally {
            silent.close();
        }
    });
});
