import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, healthy, jsonResponse, noContent } from '../fake.api';
import { renderApp, screen, setupUser, waitFor } from '../test.render';

const current = { contentId: 'MY-F0001', categoryId: 'MY-C0002', raw: { content_id: 'MY-F0001', matte_id: 'shadowbox_polar' } };

describe('now showing', () => {
    it('shows the artwork on screen with its category and matte', async () => {
        fakeApi({ 'GET /health': healthy, 'GET /tv/art/current': () => jsonResponse(current), 'GET /tv/art-mode': () => jsonResponse({ on: true }) });

        renderApp('/');

        expect(await screen.findByText('MY-F0001')).toBeInTheDocument();
        expect(screen.getByText('My Photos')).toBeInTheDocument();
        expect(screen.getByText('shadowbox_polar')).toBeInTheDocument();
        expect(await screen.findByRole('switch', { name: /art mode/i })).toBeChecked();
    });

    it('turns art mode off, then reads the state back', async () => {
        let on = true;
        const requests = fakeApi({
            'GET /health': healthy,
            'GET /tv/art/current': () => jsonResponse(current),
            'GET /tv/art-mode': () => jsonResponse({ on }),
            'PUT /tv/art-mode': request => {
                on = (request.body as { on: boolean }).on;
                return noContent();
            },
        });
        const user = setupUser();

        renderApp('/');
        await user.click(await screen.findByRole('switch', { name: /art mode/i }));

        await waitFor(() => expect(screen.getByRole('switch', { name: /art mode/i })).not.toBeChecked());
        expect(requests.filter(request => request.method === 'PUT')).toEqual([
            expect.objectContaining({ path: '/tv/art-mode', body: { on: false } }),
        ]);
        await waitFor(() => expect(requests.filter(request => request.path === '/tv/art-mode' && request.method === 'GET')).toHaveLength(2));
        expect(screen.getByText('The TV is showing television, not art.')).toBeInTheDocument();
    });

    it('puts the switch back when the TV cannot be reached', async () => {
        fakeApi({
            'GET /health': healthy,
            'GET /tv/art/current': () => jsonResponse(current),
            'GET /tv/art-mode': () => jsonResponse({ on: true }),
            'PUT /tv/art-mode': () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
        });
        const user = setupUser();

        renderApp('/');
        await user.click(await screen.findByRole('switch', { name: /art mode/i }));

        expect(await screen.findByText('The TV is unreachable')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('switch', { name: /art mode/i })).toBeChecked());
    });

    it('explains an unreachable TV', async () => {
        fakeApi({
            'GET /health': healthy,
            'GET /tv/art/current': () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
            'GET /tv/art-mode': () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
        });

        renderApp('/');

        expect(await screen.findByText('The TV is unreachable')).toBeInTheDocument();
    });
});
