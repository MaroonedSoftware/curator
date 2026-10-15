import { describe, expect, it } from 'vitest';
import { fakeApi, jsonResponse, noContent, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

const HALLOWEEN = '22222222-2222-4222-8222-222222222222';
const CHRISTMAS = '33333333-3333-4333-8333-333333333333';

const albumSummary = (id: string, name: string) => ({
    id,
    name,
    pieceCount: 2,
    coverContentId: 'MY-F0001',
    previewContentIds: ['MY-F0001', 'MY-F0002'],
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
});

type Rotation = { albumId: string; albumName: string; intervalMinutes: number; shuffle: boolean; lastContentId?: string; nextRotationAt?: string };

/** A TV with Halloween and Christmas albums, rotating through `rotation` if given. Writes change what the next read returns. */
function fakeTv(rotation?: Rotation) {
    const state = { rotation, current: 'MY-F0001' };
    const albums = [albumSummary(CHRISTMAS, 'Christmas'), albumSummary(HALLOWEEN, 'Halloween')];
    const requests = fakeApi({
        ...withTv(),
        [`GET ${TV_BASE}/art/current`]: () => jsonResponse({ contentId: state.current, raw: {} }),
        [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
        [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: albums }),
        [`GET ${TV_BASE}/albums/${HALLOWEEN}`]: () => jsonResponse({ ...albumSummary(HALLOWEEN, 'Halloween'), contentIds: [] }),
        [`GET ${TV_BASE}/art`]: () => jsonResponse({ items: [] }),
        [`GET ${TV_BASE}/rotation`]: () => (state.rotation ? jsonResponse(state.rotation) : noContent()),
        [`PUT ${TV_BASE}/rotation`]: request => {
            const body = request.body as { albumId: string; intervalMinutes: number; shuffle: boolean };
            state.rotation = { ...body, albumName: albums.find(album => album.id === body.albumId)!.name };
            return jsonResponse(state.rotation);
        },
        [`DELETE ${TV_BASE}/rotation`]: () => {
            state.rotation = undefined;
            return noContent();
        },
        [`POST ${TV_BASE}/rotation/advance`]: () => {
            state.current = 'MY-F0002';
            state.rotation = { ...state.rotation!, lastContentId: 'MY-F0002', nextRotationAt: '2026-10-12T15:30:00.000Z' };
            return jsonResponse({ contentId: 'MY-F0002' });
        },
    });
    return { state, requests };
}

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET' && request.method !== 'HEAD');

describe('rotation', () => {
    it('says the TV isn’t rotating, and starts a rotation from Now showing', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(TV_BASE);
        await user.click(await screen.findByRole('button', { name: 'Rotate an album' }));
        const dialog = await screen.findByRole('dialog');
        await user.click(within(dialog).getByRole('combobox', { name: 'Album' }));
        await user.click(await within(dialog).findByRole('option', { name: 'Halloween' }));
        await user.click(within(dialog).getByRole('combobox', { name: 'Change every' }));
        await user.click(await within(dialog).findByRole('option', { name: '1 minute' }));
        await user.click(within(dialog).getByRole('switch', { name: /shuffle/i }));
        await user.click(within(dialog).getByRole('button', { name: 'Rotate' }));

        const card = await screen.findByTestId('rotation');
        await waitFor(() => expect(card).toHaveTextContent('Rotating through Halloween, in order, every 1 minute.'));
        expect(writes(requests)).toEqual([
            expect.objectContaining({
                method: 'PUT',
                path: `${TV_BASE}/rotation`,
                body: { albumId: HALLOWEEN, intervalMinutes: 1, shuffle: false },
            }),
        ]);
    });

    it('shows the next piece now, and when the one after is due', async () => {
        fakeTv({ albumId: HALLOWEEN, albumName: 'Halloween', intervalMinutes: 30, shuffle: true });
        const user = setupUser();

        renderApp(TV_BASE);
        const card = await screen.findByTestId('rotation');
        expect(await within(card).findByText(/Rotating through/)).toHaveTextContent('Rotating through Halloween, shuffled, every 30 minutes.');
        expect(within(card).getByText('The first piece is on its way.')).toBeInTheDocument();
        await user.click(within(card).getByRole('button', { name: 'Next' }));

        expect(await screen.findByText('MY-F0002')).toBeInTheDocument();
        expect(await within(card).findByText(/^Next piece at/)).toBeInTheDocument();
    });

    it('stops the rotation', async () => {
        const { requests } = fakeTv({ albumId: HALLOWEEN, albumName: 'Halloween', intervalMinutes: 30, shuffle: true });
        const user = setupUser();

        renderApp(TV_BASE);
        await user.click(await screen.findByRole('button', { name: 'Stop' }));

        expect(await screen.findByRole('button', { name: 'Rotate an album' })).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'DELETE', path: `${TV_BASE}/rotation` })]);
    });

    it('marks the album being rotated, and rotates another from its card, keeping the interval and order', async () => {
        const { requests } = fakeTv({ albumId: HALLOWEEN, albumName: 'Halloween', intervalMinutes: 360, shuffle: false });
        const user = setupUser();

        renderApp(`${TV_BASE}/albums`);
        const cards = await screen.findAllByTestId('album-card');
        expect(await within(cards[1]!).findByText('Rotating')).toBeInTheDocument();
        expect(within(cards[0]!).queryByText('Rotating')).not.toBeInTheDocument();

        await user.click(within(cards[0]!).getByRole('button', { name: 'Actions for Christmas' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rotate on TV' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate' }));

        await waitFor(() => expect(within(cards[0]!).getByText('Rotating')).toBeInTheDocument());
        expect(writes(requests)).toEqual([expect.objectContaining({ body: { albumId: CHRISTMAS, intervalMinutes: 360, shuffle: false } })]);
    });

    it('rotates an album from its own page', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums/${HALLOWEEN}`);
        await user.click(await screen.findByRole('button', { name: 'Rotate on TV' }));
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Rotate' }));

        expect(await screen.findByRole('button', { name: 'Change rotation' })).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ body: { albumId: HALLOWEEN, intervalMinutes: 30, shuffle: true } })]);
    });
});
