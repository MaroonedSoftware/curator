import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, TV, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen } from '../test.render';

const device = { model: 'QE55LS03B', name: 'Living Room', frameTvSupport: true, powerOn: true, raw: {} };

describe('status page', () => {
    it('shows the TV and its art API version', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/device`]: () => jsonResponse(device),
            [`GET ${TV_BASE}/api-version`]: () => jsonResponse({ version: '4.3.4.0' }),
        });

        renderApp(`${TV_BASE}/status`);

        expect(await screen.findByText('Living Room')).toBeInTheDocument();
        expect(screen.getByText('QE55LS03B')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.50:8002')).toBeInTheDocument();
        expect(await screen.findByText('4.3.4.0')).toBeInTheDocument();
        expect(await screen.findByText('API online')).toBeInTheDocument();
    });

    it('explains an unreachable TV', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/device`]: () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV at 192.168.1.50' }),
        });

        renderApp(`${TV_BASE}/status`);

        expect(await screen.findByText('The TV is unreachable')).toBeInTheDocument();
        expect(screen.getByText(/cannot reach TV at 192.168.1.50/)).toBeInTheDocument();
    });

    it('flags the API as offline when it does not answer', async () => {
        fakeApi({
            'GET /health': () => Promise.reject(new TypeError('Failed to fetch')),
            'GET /tvs': () => Promise.reject(new TypeError('Failed to fetch')),
            [`GET ${TV_BASE}`]: () => Promise.reject(new TypeError('Failed to fetch')),
        });

        renderApp(`${TV_BASE}/status`);

        expect(await screen.findByText('API offline')).toBeInTheDocument();
        expect(await screen.findByText('The API is unreachable')).toBeInTheDocument();
    });
});
