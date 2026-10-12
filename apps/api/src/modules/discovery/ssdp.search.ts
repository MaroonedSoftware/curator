import { createSocket } from 'node:dgram';
import type { Identifier } from 'injectkit';

/** The SSDP multicast group and port every UPnP device listens on. */
export const SSDP_ADDRESS = '239.255.255.250';
export const SSDP_PORT = 1900;

/**
 * What Samsung TVs answer to. The remote-control receiver is the one the art API rides on; DIAL is
 * a fallback some firmware answers more reliably.
 */
export const SAMSUNG_SEARCH_TARGETS = ['urn:samsung.com:device:RemoteControlReceiver:1', 'urn:dial-multiscreen-org:service:dial:1'];

export interface SsdpResponse {
    /** The address the answer came from: the device's IP. */
    address: string;
    /** Response headers, keys lowercased. */
    headers: Record<string, string>;
}

export interface SsdpSearchOptions {
    searchTargets: string[];
    /** How long to listen for answers. Devices wait up to MX seconds before replying. */
    timeoutMs: number;
    /** Where to send the search. The multicast group, unless a test points it at a local responder. */
    address?: string;
    port?: number;
}

export type SsdpSearch = (options: SsdpSearchOptions) => Promise<SsdpResponse[]>;

export const SsdpSearchToken: Identifier<SsdpSearch> = Symbol('SsdpSearch');

export const mSearch = (searchTarget: string, mx: number) =>
    ['M-SEARCH * HTTP/1.1', `HOST: ${SSDP_ADDRESS}:${SSDP_PORT}`, 'MAN: "ssdp:discover"', `MX: ${mx}`, `ST: ${searchTarget}`, '', ''].join('\r\n');

/** Parses an SSDP answer (`HTTP/1.1 200 OK` and headers). Anything else, such as another host's NOTIFY or search, is undefined. */
export function parseSsdpResponse(text: string): Record<string, string> | undefined {
    const [status, ...lines] = text.split(/\r?\n/);
    if (!status || !/^HTTP\/1\.[01] 200\b/i.test(status)) {
        return undefined;
    }
    const headers: Record<string, string> = {};
    for (const line of lines) {
        const colon = line.indexOf(':');
        if (colon > 0) {
            headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
        }
    }
    return headers;
}

/**
 * Sends an M-SEARCH for each target and collects every answer that arrives within `timeoutMs`.
 * Answers are not deduplicated: one device answers once per target, and often more than once.
 */
export const ssdpSearch: SsdpSearch = ({ searchTargets, timeoutMs, address = SSDP_ADDRESS, port = SSDP_PORT }) =>
    new Promise((resolve, reject) => {
        const socket = createSocket({ type: 'udp4', reuseAddr: true });
        const responses: SsdpResponse[] = [];
        const mx = Math.max(1, Math.min(5, Math.floor(timeoutMs / 1000) - 1));

        socket.on('message', (message, remote) => {
            const headers = parseSsdpResponse(message.toString('utf8'));
            if (headers) {
                responses.push({ address: remote.address, headers });
            }
        });
        socket.once('error', error => {
            socket.close();
            reject(error);
        });
        socket.bind(0, () => {
            for (const target of searchTargets) {
                socket.send(mSearch(target, mx), port, address);
            }
            setTimeout(() => {
                socket.close();
                resolve(responses);
            }, timeoutMs).unref();
        });
    });
