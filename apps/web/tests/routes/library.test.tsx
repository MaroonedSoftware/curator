import { describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, noContent, TV, TV_BASE, withTv } from '../fake.api';
import { fireEvent } from '@testing-library/react';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

type Item = { contentId: string; categoryId: string; categoryIds: string[]; raw: Record<string, unknown> };

const upload: Item = {
    contentId: 'MY-F0001',
    categoryId: 'MY-C0002',
    categoryIds: ['MY-C0002'],
    raw: { content_id: 'MY-F0001', matte_id: 'shadowbox_polar' },
};
const store: Item = { contentId: 'SAM-S0001', categoryId: 'MY-C0008', categoryIds: ['MY-C0008'], raw: { content_id: 'SAM-S0001', matte_id: 'none' } };

/** A TV holding `art`, with SAM-S0001 on screen and the originals of `originals` kept. Writes change the state the next read returns. */
function fakeTv(art: Item[] = [upload, store], originals: string[] = []) {
    const state = { art: [...art], current: 'SAM-S0001' };
    const requests = fakeApi({
        ...withTv(),
        [`GET ${TV_BASE}/art`]: request => {
            const category = request.search.get('category');
            return jsonResponse({ items: state.art.filter(item => !category || item.categoryId === category) });
        },
        [`GET ${TV_BASE}/art/current`]: () => jsonResponse({ contentId: state.current, raw: {} }),
        [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
        [`PUT ${TV_BASE}/art/current`]: request => {
            state.current = (request.body as { contentId: string }).contentId;
            return noContent();
        },
        [`DELETE ${TV_BASE}/art/MY-F0001`]: () => {
            state.art = state.art.filter(item => item.contentId !== 'MY-F0001');
            return noContent();
        },
        [`PUT ${TV_BASE}/art/MY-F0001/matte`]: () => noContent(),
        // The new image stands in for MY-F0001 as MY-F0005.
        [`POST ${TV_BASE}/art/MY-F0001/replace`]: () => {
            state.art = state.art.map(item =>
                item.contentId === 'MY-F0001' ? { ...item, contentId: 'MY-F0005', raw: { ...item.raw, content_id: 'MY-F0005' } } : item,
            );
            return jsonResponse({ contentId: 'MY-F0005', duplicate: false });
        },
        [`HEAD ${TV_BASE}/art/MY-F0005/original`]: () => new Response(null, { status: 200 }),
        [`HEAD ${TV_BASE}/art/MY-F0001/original`]: () => new Response(null, { status: originals.includes('MY-F0001') ? 200 : 404 }),
    });
    return { state, requests };
}

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET' && request.method !== 'HEAD');

describe('library', () => {
    it('lists the TV’s artwork with its category and matte, marking what’s on screen', async () => {
        fakeTv();

        renderApp(`${TV_BASE}/library?view=list`);

        const uploadRow = (await screen.findByText('MY-F0001')).closest('tr')!;
        expect(within(uploadRow).getByText('My Photos')).toBeInTheDocument();
        expect(within(uploadRow).getByText('Shadowbox, polar')).toBeInTheDocument();
        const storeRow = screen.getByText('SAM-S0001').closest('tr')!;
        expect(await within(storeRow).findByText('On screen')).toBeInTheDocument();
    });

    it('filters by category through the URL', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library`);
        await screen.findByText('SAM-S0001');
        await user.click(screen.getByRole('radio', { name: 'My Photos' }));

        await waitFor(() => expect(screen.queryByText('SAM-S0001')).not.toBeInTheDocument());
        expect(router.state.location.search).toEqual({ category: 'MY-C0002' });
        expect(requests.filter(request => request.path === `${TV_BASE}/art`).map(request => request.search.get('category'))).toContain('MY-C0002');
    });

    it('opens on a category named in the URL', async () => {
        const { requests } = fakeTv();

        renderApp(`${TV_BASE}/library?category=MY-C0008`);

        expect(await screen.findByText('SAM-S0001')).toBeInTheDocument();
        expect(requests.find(request => request.path === `${TV_BASE}/art`)?.search.get('category')).toBe('MY-C0008');
    });

    it('shows an artwork on the TV', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library?view=list`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Show on TV' }));

        await waitFor(() =>
            expect(writes(requests)).toEqual([
                expect.objectContaining({ path: `${TV_BASE}/art/current`, body: { contentId: 'MY-F0001', category: 'MY-C0002' } }),
            ]),
        );
        const uploadRow = screen.getByText('MY-F0001').closest('tr')!;
        expect(await within(uploadRow).findByText('On screen')).toBeInTheDocument();
    });

    it('deletes an upload after asking', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
        expect(writes(requests)).toEqual([]);
        await user.click(await screen.findByRole('button', { name: 'Delete' }));

        await waitFor(() => expect(screen.queryByText('MY-F0001')).not.toBeInTheDocument());
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'DELETE', path: `${TV_BASE}/art/MY-F0001` })]);
    });

    it('replaces an upload’s image after it is chosen', async () => {
        const { requests } = fakeTv();
        const user = setupUser();
        const image = new File(['new'], 'new.jpg', { type: 'image/jpeg' });

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Replace image…' }));
        const dialog = await screen.findByRole('dialog', { name: 'Replace MY-F0001' });
        expect(within(dialog).getByRole('button', { name: 'Replace' })).toBeDisabled();
        await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"]')!, image);
        expect(within(dialog).getByText('new.jpg')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Replace' }));

        expect(await screen.findByText('MY-F0005')).toBeInTheDocument();
        expect(screen.getByText('MY-F0001 is now MY-F0005.')).toBeInTheDocument();
        expect(writes(requests)).toEqual([
            expect.objectContaining({ method: 'POST', path: `${TV_BASE}/art/MY-F0001/replace`, body: image, headers: expect.any(Headers) }),
        ]);
        expect(writes(requests)[0]!.headers.get('content-type')).toBe('image/jpeg');
    });

    it('moves the viewer on to the piece that replaced the one it showed', async () => {
        fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library?piece=MY-F0001`);
        await user.click(await screen.findByRole('button', { name: 'Replace' }));
        const dialog = await screen.findByRole('dialog', { name: 'Replace MY-F0001' });
        await user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"]')!, new File(['new'], 'new.jpg', { type: 'image/jpeg' }));
        await user.click(within(dialog).getByRole('button', { name: 'Replace' }));

        await waitFor(() => expect(router.state.location.search).toEqual({ piece: 'MY-F0005' }));
    });

    it('offers no delete for a piece that isn’t an upload', async () => {
        fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for SAM-S0001' }));

        expect(await screen.findByRole('menuitem', { name: 'Show on TV' })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: 'Replace image…' })).not.toBeInTheDocument();
    });

    it('changes the matte, starting from the current one', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Change matte' }));
        expect(await screen.findByRole('combobox', { name: 'Landscape' })).toHaveValue('shadowbox');
        expect(screen.getByRole('combobox', { name: 'Landscape colour' })).toHaveValue('polar');

        await user.click(screen.getByRole('combobox', { name: 'Landscape colour' }));
        await user.click(await screen.findByRole('option', { name: 'apricot' }));
        await user.click(screen.getByRole('button', { name: 'Save' }));

        await waitFor(() =>
            expect(writes(requests)).toEqual([
                expect.objectContaining({ path: `${TV_BASE}/art/MY-F0001/matte`, body: { matte: 'shadowbox_apricot', portraitMatte: 'none' } }),
            ]),
        );
    });

    it('keeps the matte dialog open and explains a matte the TV rejects', async () => {
        fakeApi({
            ...withTv(),
            [`GET ${TV_BASE}/art`]: () => jsonResponse({ items: [upload] }),
            [`GET ${TV_BASE}/art/current`]: () => jsonResponse({ raw: {} }),
            [`PUT ${TV_BASE}/art/MY-F0001/matte`]: () =>
                errorResponse(422, 'Unprocessable Entity', { reason: 'change_matte failed with error code -7' }),
        });
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Change matte' }));
        await user.click(await screen.findByRole('button', { name: 'Save' }));

        expect(await screen.findByText('The TV rejected that')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    });

    it('shows thumbnails in a grid by default, each loaded lazily from the API', async () => {
        fakeTv();

        renderApp(`${TV_BASE}/library`);

        const image = await screen.findByRole('img', { name: 'MY-F0001' });
        expect(image).toHaveAttribute('src', `/api${TV_BASE}/art/MY-F0001/thumbnail`);
        expect(image).toHaveAttribute('loading', 'lazy');
        const cards = screen.getAllByTestId('art-card');
        expect(cards).toHaveLength(2);
        expect(within(cards[0]!).getByText('Shadowbox, polar')).toBeInTheDocument();
        expect(await within(cards[1]!).findByText('On screen')).toBeInTheDocument();
        expect(screen.queryByRole('table')).not.toBeInTheDocument();
    });

    it('shows a placeholder for a thumbnail that fails to load', async () => {
        fakeTv();

        renderApp(`${TV_BASE}/library`);
        fireEvent.error(await screen.findByRole('img', { name: 'MY-F0001' }));

        expect(await screen.findByRole('img', { name: 'No thumbnail for MY-F0001' })).toBeInTheDocument();
    });

    it('switches between grid and list, keeping the choice and the category in the URL', async () => {
        fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library?category=MY-C0002`);
        await screen.findByRole('img', { name: 'MY-F0001' });
        await user.click(screen.getByRole('radio', { name: 'List' }));

        expect(await screen.findByRole('table')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ category: 'MY-C0002', view: 'list' });

        await user.click(screen.getByRole('radio', { name: 'Grid' }));
        await waitFor(() => expect(screen.queryByRole('table')).not.toBeInTheDocument());
        expect(router.state.location.search).toEqual({ category: 'MY-C0002' });
    });

    it('acts on a piece from its card', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Actions for MY-F0001' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Show on TV' }));

        await waitFor(() => expect(writes(requests)).toEqual([expect.objectContaining({ body: { contentId: 'MY-F0001', category: 'MY-C0002' } })]));
    });

    it('labels MY-C0008 Other and shows every category, offering delete for an upload listed outside My Photos', async () => {
        // As a 2025 Frame lists them: an upload (MY_F id) under MY-C0008 as well as My Photos.
        const newer: Item = { contentId: 'MY_F0019', categoryId: 'MY-C0008', categoryIds: ['MY-C0008', 'MY-C0002'], raw: { content_id: 'MY_F0019' } };
        fakeTv([newer]);
        const user = setupUser();

        renderApp(`${TV_BASE}/library?view=list`);

        const row = (await screen.findByText('MY_F0019')).closest('tr')!;
        expect(within(row).getByText(/^Other/)).toHaveAttribute('title', 'MY-C0008');
        expect(within(row).getByText('My Photos')).toHaveAttribute('title', 'MY-C0002');
        expect(screen.getByRole('radio', { name: 'Other' })).toBeInTheDocument();
        await user.click(within(row).getByRole('button', { name: 'Actions for MY_F0019' }));
        expect(await screen.findByRole('menuitem', { name: 'Delete' })).toBeInTheDocument();
    });

    it('expands a piece when its thumbnail is clicked, with its details and actions', async () => {
        fakeTv([
            { ...upload, raw: { ...upload.raw, portrait_matte_id: 'shadowbox_black', width: 3840, height: 2160, image_date: '2026:03:17 13:29:37' } },
            store,
        ]);
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library`);
        await user.click(await screen.findByRole('button', { name: 'Expand MY-F0001' }));

        const viewer = await screen.findByRole('dialog');
        expect(within(viewer).getByRole('img', { name: 'MY-F0001' })).toHaveAttribute('src', `/api${TV_BASE}/art/MY-F0001/thumbnail`);
        expect(within(viewer).getByText('3840 × 2160')).toBeInTheDocument();
        expect(within(viewer).getByText(/Shadowbox, polar · portrait: Shadowbox, black/)).toBeInTheDocument();
        expect(within(viewer).getByText('1 of 2')).toBeInTheDocument();
        expect(within(viewer).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
        expect(router.state.location.search).toEqual({ piece: 'MY-F0001' });
    });

    it('shows the kept original in the viewer, and offers it for download', async () => {
        fakeTv([upload, store], ['MY-F0001']);

        renderApp(`${TV_BASE}/library?piece=MY-F0001`);

        const viewer = await screen.findByRole('dialog');
        const download = await within(viewer).findByRole('link', { name: 'Download' });
        expect(download).toHaveAttribute('href', `/api${TV_BASE}/art/MY-F0001/original`);
        expect(download).toHaveAttribute('download');
        expect(within(viewer).getByRole('img', { name: 'MY-F0001' })).toHaveAttribute('src', `/api${TV_BASE}/art/MY-F0001/original`);
    });

    it('shows the thumbnail and no download for an upload whose original was not kept', async () => {
        const { requests } = fakeTv();

        renderApp(`${TV_BASE}/library?piece=MY-F0001`);

        const viewer = await screen.findByRole('dialog');
        await waitFor(() => expect(requests.some(request => request.method === 'HEAD')).toBe(true));
        expect(within(viewer).getByRole('img', { name: 'MY-F0001' })).toHaveAttribute('src', `/api${TV_BASE}/art/MY-F0001/thumbnail`);
        expect(within(viewer).queryByRole('link', { name: 'Download' })).not.toBeInTheDocument();
    });

    it('does not ask after the original of a piece from the Art Store', async () => {
        const { requests } = fakeTv();

        renderApp(`${TV_BASE}/library?piece=SAM-S0001`);

        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(requests.some(request => request.method === 'HEAD')).toBe(false);
    });

    it('steps through pieces with the arrow keys and buttons, and closes with Escape', async () => {
        fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library?piece=MY-F0001`);
        const viewer = await screen.findByRole('dialog');
        expect(within(viewer).getByRole('button', { name: 'Previous piece' })).toBeDisabled();

        await user.keyboard('{ArrowRight}');
        await waitFor(() => expect(router.state.location.search).toEqual({ piece: 'SAM-S0001' }));
        expect(await within(await screen.findByRole('dialog')).findByText('2 of 2')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Next piece' })).toBeDisabled();
        // SAM-S0001 is on screen and isn't an upload.
        expect(screen.getByRole('button', { name: 'On screen' })).toBeDisabled();
        expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Previous piece' }));
        await waitFor(() => expect(router.state.location.search).toEqual({ piece: 'MY-F0001' }));

        await user.keyboard('{Escape}');
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        expect(router.state.location.search).toEqual({});
    });

    it('shows the piece on the TV from the viewer', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library?piece=MY-F0001`);
        await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Show on TV' }));

        await waitFor(() => expect(writes(requests)).toEqual([expect.objectContaining({ body: { contentId: 'MY-F0001', category: 'MY-C0002' } })]));
        expect(await screen.findByRole('button', { name: 'On screen' })).toBeDisabled();
    });

    it('closes the viewer and asks before deleting from it', async () => {
        const { requests } = fakeTv();
        const user = setupUser();

        const { router } = renderApp(`${TV_BASE}/library?piece=MY-F0001`);
        await user.click(await within(await screen.findByRole('dialog')).findByRole('button', { name: 'Delete' }));

        expect(await screen.findByText('Delete from Living Room?')).toBeInTheDocument();
        expect(router.state.location.search).toEqual({});
        expect(writes(requests)).toEqual([]);
    });

    it('opens the viewer from the list too', async () => {
        fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/library?view=list`);
        await user.click(await screen.findByRole('button', { name: 'MY-F0001' }));

        expect(await within(await screen.findByRole('dialog')).findByRole('img', { name: 'MY-F0001' })).toBeInTheDocument();
    });

    it('opens nothing for a piece the TV doesn’t have', async () => {
        fakeTv();

        renderApp(`${TV_BASE}/library?piece=MY-F9999`);

        expect(await screen.findByRole('button', { name: 'Expand MY-F0001' })).toBeInTheDocument();
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('says so when a category is empty', async () => {
        fakeTv([store]);

        renderApp(`${TV_BASE}/library?category=MY-C0002`);

        expect(await screen.findByText('Nothing in my photos yet.')).toBeInTheDocument();
    });
});
