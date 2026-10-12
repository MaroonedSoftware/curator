import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, noContent, TV, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen, setupUser, waitFor } from '../test.render';

const current = { contentId: 'MY-F0001', categoryId: 'MY-C0002', raw: { content_id: 'MY-F0001', matte_id: 'shadowbox_polar' } };

describe('now showing', () => {
    it('shows the artwork on screen with its category and matte', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/art/current`]: () => jsonResponse(current),
            [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
        });

        renderApp(TV_BASE);

        expect(await screen.findByText('MY-F0001')).toBeInTheDocument();
        expect(screen.getByText('My Photos')).toBeInTheDocument();
        expect(screen.getByText('shadowbox_polar')).toBeInTheDocument();
        expect(await screen.findByRole('switch', { name: /art mode/i })).toBeChecked();
    });

    it('turns art mode off, then reads the state back', async () => {
        let on = true;
        const requests = fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/art/current`]: () => jsonResponse(current),
            [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on }),
            [`PUT ${TV_BASE}/art-mode`]: request => {
                on = (request.body as { on: boolean }).on;
                return noContent();
            },
        });
        const user = setupUser();

        renderApp(TV_BASE);
        await user.click(await screen.findByRole('switch', { name: /art mode/i }));

        await waitFor(() => expect(screen.getByRole('switch', { name: /art mode/i })).not.toBeChecked());
        expect(requests.filter(request => request.method === 'PUT')).toEqual([
            expect.objectContaining({ path: `${TV_BASE}/art-mode`, body: { on: false } }),
        ]);
        await waitFor(() => expect(requests.filter(request => request.path === `${TV_BASE}/art-mode` && request.method === 'GET')).toHaveLength(2));
        expect(screen.getByText('The TV is showing television, not art.')).toBeInTheDocument();
    });

    it('puts the switch back when the TV cannot be reached', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/art/current`]: () => jsonResponse(current),
            [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
            [`PUT ${TV_BASE}/art-mode`]: () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
        });
        const user = setupUser();

        renderApp(TV_BASE);
        await user.click(await screen.findByRole('switch', { name: /art mode/i }));

        expect(await screen.findByText('The TV is unreachable')).toBeInTheDocument();
        await waitFor(() => expect(screen.getByRole('switch', { name: /art mode/i })).toBeChecked());
    });

    it('explains an unreachable TV', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/art/current`]: () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
            [`GET ${TV_BASE}/art-mode`]: () => errorResponse(503, 'Service Unavailable', { reason: 'cannot reach TV' }),
        });

        renderApp(TV_BASE);

        expect(await screen.findByText('The TV is unreachable')).toBeInTheDocument();
    });
});
