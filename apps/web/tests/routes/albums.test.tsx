import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, noContent, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

type Album = { id: string; name: string; pieceCount: number; coverContentId?: string; createdAt: string; updatedAt: string };

const album = (id: string, name: string, contentIds: string[] = []): Album & { contentIds: string[] } => ({
    id,
    name,
    pieceCount: contentIds.length,
    coverContentId: contentIds[0],
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
    contentIds,
});

const HALLOWEEN = '22222222-2222-4222-8222-222222222222';
const CHRISTMAS = '33333333-3333-4333-8333-333333333333';

/** A TV holding `albums`. Writes change what the next read returns. */
function fakeAlbums(albums = [album(HALLOWEEN, 'Halloween', ['MY-F0001', 'MY-F0002']), album(CHRISTMAS, 'Christmas')]) {
    const state = { albums: [...albums] };
    const summary = ({ contentIds: _contentIds, ...rest }: (typeof albums)[number]) => rest;
    const requests = fakeApi({
        ...withTv(),
        [`GET ${TV_BASE}/rotation`]: () => noContent(),
        [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: [...state.albums].sort((a, b) => a.name.localeCompare(b.name)).map(summary) }),
        [`POST ${TV_BASE}/albums`]: request => {
            const { name } = request.body as { name: string };
            if (state.albums.some(a => a.name.toLowerCase() === name.toLowerCase())) {
                return errorResponse(409, 'Conflict', { reason: `there is already an album called ${name}` });
            }
            const created = album('44444444-4444-4444-8444-444444444444', name);
            state.albums.push(created);
            return jsonResponse(summary(created), 201);
        },
        [`PATCH ${TV_BASE}/albums/${HALLOWEEN}`]: request => {
            const target = state.albums.find(a => a.id === HALLOWEEN)!;
            target.name = (request.body as { name: string }).name;
            return jsonResponse(summary(target));
        },
        [`DELETE ${TV_BASE}/albums/${CHRISTMAS}`]: () => {
            state.albums = state.albums.filter(a => a.id !== CHRISTMAS);
            return noContent();
        },
    });
    return { state, requests };
}

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET' && request.method !== 'HEAD');

describe('albums', () => {
    it('lists the TV’s albums with their size', async () => {
        fakeAlbums();

        renderApp(`${TV_BASE}/albums`);

        const cards = await screen.findAllByTestId('album-card');
        expect(cards.map(card => within(card).getByText(/Halloween|Christmas/).textContent)).toEqual(['Christmas', 'Halloween']);
        expect(within(cards[1]!).getByText('2 pieces')).toBeInTheDocument();
        expect(within(cards[0]!).getByText('0 pieces')).toBeInTheDocument();
    });

    it('says how to start when there are none', async () => {
        fakeAlbums([]);

        renderApp(`${TV_BASE}/albums`);

        expect(await screen.findByText(/No albums yet/)).toBeInTheDocument();
    });

    it('creates an album', async () => {
        const { requests } = fakeAlbums();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums`);
        await user.click(await screen.findByRole('button', { name: 'New album' }));
        await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'Easter');
        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(await screen.findByText('Easter')).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'POST', path: `${TV_BASE}/albums`, body: { name: 'Easter' } })]);
    });

    it('explains a name that is already taken', async () => {
        fakeAlbums();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums`);
        await user.click(await screen.findByRole('button', { name: 'New album' }));
        await user.type(await screen.findByRole('textbox', { name: 'Name' }), 'halloween');
        await user.click(screen.getByRole('button', { name: 'Create' }));

        expect(await screen.findByText(/already an album called halloween/)).toBeInTheDocument();
    });

    it('renames an album', async () => {
        const { requests } = fakeAlbums();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums`);
        await user.click(await screen.findByRole('button', { name: 'Actions for Halloween' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
        const input = await screen.findByRole('textbox', { name: 'Name' });
        await user.clear(input);
        await user.type(input, 'Spooky');
        await user.click(screen.getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('Spooky')).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'PATCH', body: { name: 'Spooky' } })]);
    });

    it('deletes an album after asking', async () => {
        const { requests } = fakeAlbums();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums`);
        await user.click(await screen.findByRole('button', { name: 'Actions for Christmas' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        expect(writes(requests)).toEqual([]);
        await user.click(await screen.findByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.queryByText('Christmas')).not.toBeInTheDocument());
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'DELETE', path: `${TV_BASE}/albums/${CHRISTMAS}` })]);
    });
});
