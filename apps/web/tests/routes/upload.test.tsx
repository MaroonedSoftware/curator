import { beforeAll, describe, expect, it } from 'vitest';
import { errorResponse, fakeApi, jsonResponse, noContent, TV, TV_BASE, withTv } from '../fake.api';
import { renderApp, screen, setupUser, waitFor } from '../test.render';

const jpeg = () => new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'sunset.jpg', { type: 'image/jpeg' });

/** The dropzone's hidden input. Throws until the page has rendered it, so `waitFor` retries. */
const fileInput = () => {
    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error('no file input yet');
    return input;
};

// jsdom has no object URLs; the preview only needs a string.
beforeAll(() => {
    URL.createObjectURL = () => 'blob:preview';
    URL.revokeObjectURL = () => {};
});

function fakeTv() {
    return fakeApi({
        ...withTv(),
        [`POST ${TV_BASE}/art`]: () => jsonResponse({ contentId: 'MY-F0007' }, 201),
        [`PUT ${TV_BASE}/art/current`]: () => noContent(),
        [`GET ${TV_BASE}/art/current`]: () => jsonResponse({ contentId: 'MY-F0007', raw: {} }),
        [`GET ${TV_BASE}/art-mode`]: () => jsonResponse({ on: true }),
    });
}

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET');

describe('upload', () => {
    it('uploads the chosen image with its matte, then shows it', async () => {
        const requests = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/upload`);
        await user.upload(await waitFor(fileInput), jpeg());
        expect(await screen.findByText('sunset.jpg')).toBeInTheDocument();
        expect(screen.getByAltText('Preview of sunset.jpg')).toBeInTheDocument();
        expect(screen.getByText('1 KB')).toBeInTheDocument();

        await user.click(screen.getByRole('combobox', { name: 'Landscape' }));
        await user.click(await screen.findByRole('option', { name: 'shadowbox' }));
        await user.click(screen.getByRole('button', { name: 'Upload' }));

        expect(await screen.findByText('On the TV')).toBeInTheDocument();
        expect(screen.getByText('MY-F0007')).toBeInTheDocument();
        const [post, put] = writes(requests);
        expect(post).toMatchObject({ method: 'POST', path: `${TV_BASE}/art` });
        expect(post?.headers.get('content-type')).toBe('image/jpeg');
        expect(post?.search.get('matte')).toBe('shadowbox_black');
        expect(post?.search.get('portraitMatte')).toBe('none');
        expect(put).toMatchObject({
            method: 'PUT',
            path: `${TV_BASE}/art/current`,
            body: { contentId: 'MY-F0007', show: true, category: 'MY-C0002' },
        });
    });

    it('leaves the screen alone when asked to', async () => {
        const requests = fakeTv();
        const user = setupUser();

        renderApp(`${TV_BASE}/upload`);
        await user.upload(await waitFor(fileInput), jpeg());
        await user.click(await screen.findByRole('checkbox', { name: /show it on the tv/i }));
        await user.click(screen.getByRole('button', { name: 'Upload' }));

        expect(await screen.findByText('On the TV')).toBeInTheDocument();
        expect(writes(requests).map(request => request.method)).toEqual(['POST']);
    });

    it('refuses a file that is not a JPEG or PNG', async () => {
        const requests = fakeTv();
        // applyAccept off, so the file reaches the dropzone as a dragged one would.
        const user = setupUser({ applyAccept: false });

        renderApp(`${TV_BASE}/upload`);
        const gif = new File([new Uint8Array([0x47, 0x49, 0x46])], 'cat.gif', { type: 'image/gif' });
        await user.upload(await waitFor(fileInput), gif);

        expect(await screen.findByText('cat.gif isn’t a JPEG or PNG.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Upload' })).not.toBeInTheDocument();
        expect(writes(requests)).toEqual([]);
    });

    it('explains an upload the TV never acknowledged, and keeps the file', async () => {
        fakeApi({
            ...withTv(),
            [`POST ${TV_BASE}/art`]: () => errorResponse(504, 'Gateway Timeout', { reason: 'send_image timed out after 15000ms' }),
        });
        const user = setupUser();

        renderApp(`${TV_BASE}/upload`);
        await user.upload(await waitFor(fileInput), jpeg());
        await user.click(await screen.findByRole('button', { name: 'Upload' }));

        expect(await screen.findByText('The TV didn’t answer')).toBeInTheDocument();
        expect(screen.getByText('sunset.jpg')).toBeInTheDocument();
    });
});
