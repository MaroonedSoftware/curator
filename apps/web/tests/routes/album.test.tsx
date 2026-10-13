import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, noContent, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

type Item = { contentId: string; categoryId: string; categoryIds: string[]; raw: Record<string, unknown> };

const piece = (contentId: string): Item => ({ contentId, categoryId: 'MY-C0002', categoryIds: ['MY-C0002'], raw: {} });

const HALLOWEEN = '22222222-2222-4222-8222-222222222222';
const CHRISTMAS = '33333333-3333-4333-8333-333333333333';
const NEW = '44444444-4444-4444-8444-444444444444';

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET' && request.method !== 'HEAD');

/**
 * A TV whose library holds MY_F0001 (newer firmware's spelling) and MY-F0002, with a Halloween
 * album of MY-F0001 and MY-F0009 (since deleted from the TV) and an empty Christmas. Writes change
 * what the next read returns.
 */
function fakeTv() {
    const state = {
        current: 'MY_F0001',
        albums: [
            { id: HALLOWEEN, name: 'Halloween', contentIds: ['MY-F0001', 'MY-F0009'] },
            { id: CHRISTMAS, name: 'Christmas', contentIds: [] as string[] },
        ],
    };
    const summary = ({ contentIds, ...album }: (typeof state.albums)[number]) => ({
        ...album,
        pieceCount: contentIds.length,
        coverContentId: contentIds[0],
        createdAt: '2026-10-12T10:00:00.000Z',
        updatedAt: '2026-10-12T10:00:00.000Z',
    });
    const albumRoutes = Object.fromEntries(
        [HALLOWEEN, CHRISTMAS, NEW].flatMap(id => {
            const find = () => state.albums.find(album => album.id === id)!;
            return [
                [
                    `DELETE ${TV_BASE}/albums/${id}`,
                    () => {
                        state.albums = state.albums.filter(album => album.id !== id);
                        return noContent();
                    },
                ],
                [`GET ${TV_BASE}/albums/${id}`, () => jsonResponse({ ...summary(find()), contentIds: find().contentIds })],
                [
                    `PUT ${TV_BASE}/albums/${id}/pieces`,
                    (request: { body: unknown }) => {
                        const album = find();
                        for (const contentId of (request.body as { contentIds: string[] }).contentIds) {
                            const normalized = contentId.replaceAll('_', '-');
                            if (!album.contentIds.includes(normalized)) album.contentIds.push(normalized);
                        }
                        return noContent();
                    },
                ],
                ...['MY-F0001', 'MY_F0001', 'MY-F0009'].map(contentId => [
                    `DELETE ${TV_BASE}/albums/${id}/pieces/${contentId}`,
                    () => {
                        const album = find();
                        album.contentIds = album.contentIds.filter(candidate => candidate !== contentId.replaceAll('_', '-'));
                        return noContent();
                    },
                ]),
            ];
        }),
    );
    const uploads = { next: 10, failing: new Set<string>() };
    const requests = fakeApi({
        ...withTv(),
        [`GET ${TV_BASE}/art`]: () => jsonResponse({ items: [piece('MY_F0001'), piece('MY-F0002')] }),
        // A body named in `uploads.failing` (by its text) is refused, as a TV that times out would be.
        [`POST ${TV_BASE}/art`]: async request => {
            if (uploads.failing.has(await (request.body as Blob).text())) {
                return errorResponse(504, 'Gateway Timeout', { reason: 'the TV did not acknowledge the upload' });
            }
            return jsonResponse({ contentId: `MY-F00${uploads.next++}` }, 201);
        },
        [`GET ${TV_BASE}/art/current`]: () => jsonResponse({ contentId: state.current, raw: {} }),
        [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
        [`PUT ${TV_BASE}/art/current`]: request => {
            state.current = (request.body as { contentId: string }).contentId;
            return noContent();
        },
        [`GET ${TV_BASE}/rotation`]: () => noContent(),
        [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: state.albums.map(summary) }),
        [`POST ${TV_BASE}/albums`]: request => {
            const created = { id: NEW, name: (request.body as { name: string }).name, contentIds: [] as string[] };
            state.albums.push(created);
            return jsonResponse(summary(created), 201);
        },
        ...albumRoutes,
    });
    return { state, requests, uploads };
}

const image = (name: string, type = 'image/jpeg') => new File([name], name, { type });

/** The album page's dropzone input. Throws until the page has rendered it, so `waitFor` retries. */
const dropzoneInput = () => {
    const input = screen.getByTestId('album-dropzone').querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input yet');
    return input;
};

describe('album', () => {
    it('uploads dropped images into the album, one at a time, carrying on past one the TV refuses', async () => {
        const { requests, state, uploads } = fakeTv();
        uploads.failing.add('two.jpg');
        const user = setupUser();

        renderApp(`${TV_BASE}/albums/${CHRISTMAS}`);
        await user.upload(await waitFor(dropzoneInput), [image('one.jpg'), image('two.jpg'), image('three.png', 'image/png')]);

        expect(await screen.findByText('two.jpg wasn’t added')).toBeInTheDocument();
        expect(await screen.findByText('2 images uploaded to the TV and added to Christmas.')).toBeInTheDocument();
        expect(state.albums[1]!.contentIds).toEqual(['MY-F0010', 'MY-F0011']);
        expect(writes(requests).map(request => `${request.method} ${request.path}`)).toEqual([
            `POST ${TV_BASE}/art`,
            `PUT ${TV_BASE}/albums/${CHRISTMAS}/pieces`,
            `POST ${TV_BASE}/art`,
            `POST ${TV_BASE}/art`,
            `PUT ${TV_BASE}/albums/${CHRISTMAS}/pieces`,
        ]);
        expect(writes(requests)[0]!.headers.get('content-type')).toBe('image/jpeg');
    });

    it('names the files it turns away from a drop that also has images in it, uploading the images', async () => {
        const { state } = fakeTv();
        const user = setupUser({ applyAccept: false });

        renderApp(`${TV_BASE}/albums/${CHRISTMAS}`);
        await user.upload(await waitFor(dropzoneInput), [image('one.jpg'), image('photo.heic', 'image/heic'), image('two.jpg')]);

        expect(await screen.findByText('2 images uploaded to the TV and added to Christmas.')).toBeInTheDocument();
        expect(screen.getByText('photo.heic isn’t a JPEG or PNG.')).toBeInTheDocument();
        expect(state.albums[1]!.contentIds).toEqual(['MY-F0010', 'MY-F0011']);
    });

    it('turns away a file that isn’t a JPEG or PNG, uploading nothing', async () => {
        const { requests } = fakeTv();
        const user = setupUser({ applyAccept: false });

        renderApp(`${TV_BASE}/albums/${CHRISTMAS}`);
        await user.upload(await waitFor(dropzoneInput), image('notes.txt', 'text/plain'));

        expect(await screen.findByText('notes.txt isn’t a JPEG or PNG.')).toBeInTheDocument();
        expect(writes(requests)).toEqual([]);
    });

    it('shows the album’s pieces in order, matching either spelling of an id, and marks one gone from the TV', async () => {
        fakeTv();

        renderApp(`${TV_BASE}/albums/${HALLOWEEN}`);

        expect(await screen.findByRole('heading', { name: 'Halloween' })).toBeInTheDocument();
        const cards = await screen.findAllByTestId('album-piece');
        expect(cards.map(card => within(card).getByText(/^MY-F/).textContent)).toEqual(['MY-F0001', 'MY-F0009']);
        expect(await within(cards[0]!).findByText('On screen')).toBeInTheDocument();
        expect(await within(cards[1]!).findByText('Not on the TV')).toBeInTheDocument();
        expect(within(cards[0]!).queryByText('Not on the TV')).not.toBeInTheDocument();
    });

    it('opens from its card on the albums page', async () => {
        fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/albums`);
        await user.click(await screen.findByRole('link', { name: 'Halloween' }));

        await waitFor(() => expect(router.state.location.pathname).toBe(`${TV_BASE}/albums/${HALLOWEEN}`));
        expect(await screen.findByRole('heading', { name: 'Halloween' })).toBeInTheDocument();
    });

    it('removes a piece from the album', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums/${HALLOWEEN}`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0009' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Remove from album' }));

        await waitFor(() => expect(screen.getAllByTestId('album-piece')).toHaveLength(1));
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'DELETE', path: `${TV_BASE}/albums/${HALLOWEEN}/pieces/MY-F0009` })]);
    });

    it('shows a piece on the TV by the TV’s own id, and offers no show for one gone from it', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/albums/${HALLOWEEN}`);
        await screen.findByText('Not on the TV');
        await user.click(screen.getByRole('button', { name: 'Actions for MY-F0009' }));
        expect(screen.queryByRole('menuitem', { name: 'Show on TV' })).not.toBeInTheDocument();
        await user.keyboard('{Escape}');
        await user.click(screen.getByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Show on TV' }));

        await waitFor(() =>
            expect(writes(requests)).toEqual([
                expect.objectContaining({ path: `${TV_BASE}/art/current`, body: { contentId: 'MY_F0001', category: 'MY-C0002' } }),
            ]),
        );
    });

    it('deletes the album after asking, and goes back to the albums', async () => {
        const { requests, state } = fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/albums/${HALLOWEEN}`);
        await user.click(await screen.findByRole('button', { name: 'Delete' }));
        expect(writes(requests)).toEqual([]);
        await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(router.state.location.pathname).toBe(`${TV_BASE}/albums`));
        expect(state.albums.map(album => album.name)).toEqual(['Christmas']);
    });

    it('adds a piece to an album from the library, and takes it out again', async () => {
        const { requests, state } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0002' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Albums…' }));
        const christmas = await screen.findByRole('checkbox', { name: 'Christmas' });
        await waitFor(() => expect(christmas).toBeEnabled());
        expect(christmas).not.toBeChecked();

        await user.click(christmas);
        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Christmas' })).toBeChecked());
        expect(state.albums[1]!.contentIds).toEqual(['MY-F0002']);
        expect(writes(requests)).toEqual([
            expect.objectContaining({ method: 'PUT', path: `${TV_BASE}/albums/${CHRISTMAS}/pieces`, body: { contentIds: ['MY-F0002'] } }),
        ]);
    });

    it('ticks the albums a piece is already in, matching either spelling of its id', async () => {
        fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY_F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Albums…' }));

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Halloween' })).toBeChecked());
        expect(screen.getByRole('checkbox', { name: 'Christmas' })).not.toBeChecked();
    });

    it('starts a new album with the piece in it', async () => {
        const { state } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0002' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Albums…' }));
        await user.type(await screen.findByRole('textbox', { name: 'New album' }), 'Easter');
        await user.click(screen.getByRole('button', { name: 'Add' }));

        await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Easter' })).toBeChecked());
        expect(state.albums[2]).toEqual({ id: NEW, name: 'Easter', contentIds: ['MY-F0002'] });
    });
});
