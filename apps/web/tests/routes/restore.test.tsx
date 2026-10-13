import { describe, expect, it } from 'vitest';
import type { Tv } from '../../src/api/api.client';
import { suggestTargets } from '../../src/components/tvs/restore.backup.modal';
import { backupTv, backupZip } from '../backup/backup.fixture';
import { fakeApi, healthy, jsonResponse, noContent, TV, TV_BASE } from '../fake.api';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

const bedroom: Tv = { ...TV, id: '33333333-3333-4333-8333-333333333333', name: 'Bedroom' };

const backedUp = backupTv({
    name: 'living room',
    pieces: [{ contentId: 'MY-F0001', file: 'tvs/old/art/MY-F0001.jpg', categoryIds: ['MY-C0002'] }],
    albums: [{ name: 'Halloween', contentIds: ['MY-F0001'] }],
});

const openRestore = async () => {
    const user = setupUser();
    renderApp('/tvs');
    await user.click(await screen.findByRole('button', { name: 'Restore…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Restore a backup' });
    const upload = (file: File) => user.upload(dialog.querySelector<HTMLInputElement>('input[type="file"]')!, file);
    return { user, dialog, upload };
};

describe('restoring a backup', () => {
    it('restores each backed-up TV onto the TV it is matched with, then says what it did', async () => {
        const requests = fakeApi({
            'GET /health': healthy,
            'GET /tvs': () => jsonResponse({ items: [TV, bedroom] }),
            [`GET ${TV_BASE}/art`]: () => jsonResponse({ items: [] }),
            [`POST ${TV_BASE}/art`]: () => jsonResponse({ contentId: 'MY-F0007', duplicate: false }, 201),
            [`GET ${TV_BASE}/albums`]: () => jsonResponse({ items: [] }),
            [`POST ${TV_BASE}/albums`]: () => jsonResponse({ id: 'new', name: 'Halloween', pieceCount: 0, createdAt: '', updatedAt: '' }, 201),
            [`PUT ${TV_BASE}/albums/new/pieces`]: noContent,
        });
        const { user, dialog, upload } = await openRestore();

        await upload(backupZip([backedUp], { 'tvs/old/art/MY-F0001.jpg': new Uint8Array([0xff, 0xd8]) }));

        // Matched by name, ignoring case.
        expect(await within(dialog).findByRole('combobox', { name: 'living room' })).toHaveValue('Living Room');
        expect(within(dialog).getByText('1 image, 1 album')).toBeInTheDocument();
        await user.click(within(dialog).getByRole('button', { name: 'Restore' }));

        expect(await within(dialog).findByText('1 image uploaded, 1 album restored.')).toBeInTheDocument();
        expect(within(dialog).getByText('living room → Living Room')).toBeInTheDocument();
        expect(requests.find(request => request.path === `${TV_BASE}/albums/new/pieces`)?.body).toEqual({ contentIds: ['MY-F0007'] });
        await user.click(within(dialog).getByRole('button', { name: 'Done' }));
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    });

    it('says when a file isn’t a backup, and restores nothing', async () => {
        fakeApi({ 'GET /health': healthy, 'GET /tvs': () => jsonResponse({ items: [TV] }) });
        const { dialog, upload } = await openRestore();

        await upload(new File(['hello'], 'notes.zip', { type: 'application/zip' }));

        expect(await within(dialog).findByText('That file isn’t a zip.')).toBeInTheDocument();
        expect(within(dialog).getByRole('button', { name: 'Restore' })).toBeDisabled();
    });
});

describe('suggestTargets', () => {
    const other = backupTv({ id: 'gone', name: 'Kitchen' });

    it('prefers the same TV, then one with the same name', () => {
        expect(
            suggestTargets([backupTv({ id: bedroom.id, name: 'Renamed since' }), backupTv({ name: 'LIVING ROOM' }), other], [TV, bedroom]),
        ).toEqual({
            [bedroom.id]: bedroom.id,
            [backupTv().id]: TV.id,
            gone: undefined,
        });
    });

    it('pairs a lone backed-up TV with a lone stored one, whatever their names', () => {
        expect(suggestTargets([other], [TV])).toEqual({ gone: TV.id });
        expect(suggestTargets([other], [TV, bedroom])).toEqual({ gone: undefined });
    });
});
