import { describe, expect, it } from 'vitest';
import type { LogEntry } from '../../src/api/api.client';
import { fakeApi, healthy, jsonResponse } from '../fake.api';
import { renderApp, screen, setupUser, waitFor } from '../test.render';

const lines: LogEntry[] = [
    { ts: '2026-10-14T08:00:03.000Z', level: 'warn', text: 'rotation: could not advance; retrying later | tvId=a trace=r1' },
    { ts: '2026-10-14T08:00:02.000Z', level: 'info', text: 'tvs: listed | trace=q2' },
    { ts: '2026-10-14T08:00:01.000Z', level: 'debug', text: 'frame: connecting | tvId=a trace=r1' },
];

function fakeLogsApi() {
    return fakeApi({
        'GET /health': healthy,
        'GET /tvs': () => jsonResponse({ items: [] }),
        'GET /logs': request => {
            const level = request.search.get('level');
            return jsonResponse({ items: level === 'warn' ? lines.slice(0, 1) : lines });
        },
    });
}

describe('Logs page', () => {
    it('shows the log newest first, with each line level and details', async () => {
        fakeLogsApi();
        renderApp('/logs');

        expect(await screen.findByText(/rotation: could not advance; retrying later \| tvId=a/)).toBeInTheDocument();
        const page = document.body.textContent ?? '';
        expect(page.indexOf('rotation: could not')).toBeLessThan(page.indexOf('tvs: listed'));
        expect(page.indexOf('tvs: listed')).toBeLessThan(page.indexOf('frame: connecting'));
        expect(page).toMatch(/WARN\s+rotation/);
    });

    it('asks for a level and up', async () => {
        const requests = fakeLogsApi();
        const user = setupUser();
        renderApp('/logs');
        await screen.findByText(/tvs: listed/);

        await user.click(screen.getByPlaceholderText('Every level'));
        await user.click(await screen.findByRole('option', { name: 'warn and up' }));

        await waitFor(() => expect(screen.queryByText(/tvs: listed/)).not.toBeInTheDocument());
        expect(requests.some(request => request.path === '/logs' && request.search.get('level') === 'warn')).toBe(true);
    });

    it('narrows to one trace when its id is picked, and back', async () => {
        fakeLogsApi();
        const user = setupUser();
        renderApp('/logs');

        await user.click((await screen.findAllByText('trace=r1'))[0]!);

        expect(screen.queryByText(/tvs: listed/)).not.toBeInTheDocument();
        expect(screen.getByText(/frame: connecting/)).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Show every trace' }));

        expect(screen.getByText(/tvs: listed/)).toBeInTheDocument();
    });

    it('says when nothing is logged', async () => {
        fakeApi({ 'GET /health': healthy, 'GET /tvs': () => jsonResponse({ items: [] }), 'GET /logs': () => jsonResponse({ items: [] }) });
        renderApp('/logs');

        expect(await screen.findByText('Nothing logged yet.')).toBeInTheDocument();
    });
});
