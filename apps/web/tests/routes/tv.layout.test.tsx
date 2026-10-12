import { beforeEach, describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, healthy, jsonResponse, TV, TV_BASE } from '../fake.api';
import { renderApp, screen, setupUser, waitFor } from '../test.render';

const bedroom = { ...TV, id: '33333333-3333-4333-8333-333333333333', name: 'Bedroom', host: '192.168.1.60' };

/** Two TVs, each answering its own art and device reads. */
function twoTvs() {
    const tvApi = (tv: typeof TV) => ({
        [`GET /tvs/${tv.id}`]: () => jsonResponse(tv),
        [`GET /tvs/${tv.id}/art/current`]: () => jsonResponse({ contentId: `${tv.name}-art`, raw: {} }),
        [`GET /tvs/${tv.id}/art-mode`]: () => jsonResponse({ on: true }),
        [`GET /tvs/${tv.id}/art`]: () => jsonResponse({ items: [{ contentId: `${tv.name}-upload`, categoryId: 'MY-C0002', raw: {} }] }),
    });
    return fakeApi({ 'GET /health': healthy, 'GET /tvs': () => jsonResponse({ items: [TV, bedroom] }), ...tvApi(TV), ...tvApi(bedroom) });
}

describe('pages per TV', () => {
    beforeEach(() => {
        window.localStorage.clear();
    });

    it('opens the first TV from /, and the TVs page when there are none', async () => {
        twoTvs();
        const first = renderApp('/');
        await waitFor(() => expect(first.router.state.location.pathname).toBe(TV_BASE));
        first.unmount();

        fakeApi({ 'GET /health': healthy, 'GET /tvs': () => jsonResponse({ items: [] }) });
        const none = renderApp('/');
        await waitFor(() => expect(none.router.state.location.pathname).toBe('/tvs'));
    });

    it('reopens the TV this browser last looked at', async () => {
        twoTvs();
        const visit = renderApp(`/tvs/${bedroom.id}`);
        expect(await screen.findByText('Bedroom-art')).toBeInTheDocument();
        visit.unmount();

        const again = renderApp('/');

        await waitFor(() => expect(again.router.state.location.pathname).toBe(`/tvs/${bedroom.id}`));
    });

    it('says so when the TV in the URL isn’t added', async () => {
        fakeApi({
            'GET /health': healthy,
            'GET /tvs': () => jsonResponse({ items: [TV] }),
            'GET /tvs/44444444-4444-4444-8444-444444444444': () =>
                errorResponse(404, 'Not Found', { reason: 'no TV with id 44444444-4444-4444-8444-444444444444' }),
        });

        renderApp('/tvs/44444444-4444-4444-8444-444444444444/library');

        expect(await screen.findByText('That TV isn’t added')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Go to TVs' })).toHaveAttribute('href', '/tvs');
    });

    it('switches TV and stays on the same page', async () => {
        twoTvs();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library?category=MY-C0002`);
        expect(await screen.findByText('Living Room-upload')).toBeInTheDocument();
        await user.click(screen.getByRole('combobox', { name: 'TV' }));
        await user.click(await screen.findByRole('option', { name: 'Bedroom' }));

        await waitFor(() => expect(router.state.location.pathname).toBe(`/tvs/${bedroom.id}/library`));
        expect(await screen.findByText('Bedroom-upload')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Library on Bedroom' })).toBeInTheDocument();
    });

    it('links each page of the TV in the navigation', async () => {
        twoTvs();

        renderApp(TV_BASE);

        expect(await screen.findByRole('link', { name: 'Library' })).toHaveAttribute('href', `${TV_BASE}/library`);
        expect(screen.getByRole('link', { name: 'Upload' })).toHaveAttribute('href', `${TV_BASE}/upload`);
        expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', `${TV_BASE}/status`);
        expect(screen.getByRole('link', { name: 'TVs' })).toHaveAttribute('href', '/tvs');
        expect(screen.getByRole('link', { name: 'Now showing' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'TVs' })).not.toHaveAttribute('aria-current');
    });

    it('marks only the open page as current', async () => {
        twoTvs();

        renderApp(`${TV_BASE}/library`);

        expect(await screen.findByRole('link', { name: 'Library' })).toHaveAttribute('aria-current', 'page');
        expect(screen.getByRole('link', { name: 'Now showing' })).not.toHaveAttribute('aria-current');
    });
});
