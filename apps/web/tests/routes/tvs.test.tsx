import { describe, expect, it } from 'vitest';
import type { Tv } from '../../src/api/api.client';
import { errorResponse, fakeApi, healthy, jsonResponse, noContent } from '../fake.api';
import { renderApp, screen, setupUser, waitFor, within } from '../test.render';

const living: Tv = {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Living Room',
    host: '192.168.1.50',
    port: 8002,
    model: 'QN50LS03FAFXZA',
    paired: true,
    createdAt: '2026-10-12T10:00:00.000Z',
    updatedAt: '2026-10-12T10:00:00.000Z',
};

type ConnectBody = { host: string; port?: number; name?: string };

/** An API holding `stored`. Connecting adds a TV named after the request, unless `connect` answers otherwise. */
function fakeTvsApi(stored: Tv[] = [living], connect?: (body: ConnectBody) => Response | Promise<Response>) {
    const state = { tvs: [...stored] };
    const addTv = (body: ConnectBody) => {
        const tv: Tv = {
            ...living,
            id: '22222222-2222-4222-8222-222222222222',
            name: body.name ?? 'The Frame',
            host: body.host,
            port: body.port ?? 8002,
        };
        state.tvs.push(tv);
        return jsonResponse(tv, 201);
    };
    const requests = fakeApi({
        'GET /health': healthy,
        'GET /tvs': () => jsonResponse({ items: state.tvs }),
        'GET /tvs/discover': () =>
            jsonResponse({
                items: [
                    { host: '192.168.1.50', port: 8002, name: 'Living Room', model: 'QN50LS03FAFXZA', tvId: living.id },
                    { host: '192.168.1.56', port: 8002, name: '50" The Frame', model: 'QN50LS03FAFXZA' },
                ],
            }),
        'POST /tvs': request => (connect ?? addTv)(request.body as ConnectBody),
        [`PATCH /tvs/${living.id}`]: request => {
            state.tvs = state.tvs.map(tv => (tv.id === living.id ? { ...tv, name: (request.body as { name: string }).name } : tv));
            return jsonResponse(state.tvs.find(tv => tv.id === living.id));
        },
        [`DELETE /tvs/${living.id}`]: () => {
            state.tvs = state.tvs.filter(tv => tv.id !== living.id);
            return noContent();
        },
    });
    return { state, requests };
}

const writes = <T extends { method: string }>(requests: T[]) => requests.filter(request => request.method !== 'GET');

describe('TVs page', () => {
    it('lists the stored TVs with their address and pairing', async () => {
        fakeTvsApi([living, { ...living, id: '33333333-3333-4333-8333-333333333333', name: 'Bedroom', host: '192.168.1.60', paired: false }]);

        renderApp('/tvs');

        expect(await screen.findByText('Living Room')).toBeInTheDocument();
        expect(screen.getByText('192.168.1.50:8002')).toBeInTheDocument();
        expect(screen.getByText('Paired')).toBeInTheDocument();
        expect(screen.getByText('Not paired')).toBeInTheDocument();
    });

    it('searches the network and connects a Frame it found, marking ones already added', async () => {
        const { requests } = fakeTvsApi();
        const user = setupUser();

        renderApp('/tvs');
        await user.click(await screen.findByRole('button', { name: 'Search' }));

        expect(await screen.findByText('50" The Frame')).toBeInTheDocument();
        expect(screen.getByText('Added')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Connect 50" The Frame' }));

        expect(await screen.findByText('The Frame is ready.')).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'POST', path: '/tvs', body: { host: '192.168.1.56', port: 8002 } })]);
        expect(await screen.findByText('192.168.1.56:8002')).toBeInTheDocument();
    });

    it('says to accept the prompt on the TV while pairing', async () => {
        let finish: (response: Response) => void = () => {};
        fakeTvsApi([living], () => new Promise<Response>(resolve => (finish = resolve)));
        const user = setupUser();

        renderApp('/tvs');
        await user.type(await screen.findByLabelText(/Address/), '192.168.1.56');
        await user.click(screen.getByRole('button', { name: 'Connect' }));

        expect(await screen.findByText('Pairing with 192.168.1.56')).toBeInTheDocument();
        expect(screen.getByText(/Accept the prompt on the TV/)).toBeInTheDocument();
        finish(errorResponse(502, 'Bad Gateway', { reason: 'pairing was not accepted. Accept the pairing prompt on the TV and retry.' }));
        expect(await screen.findByText('The TV refused the request')).toBeInTheDocument();
    });

    it('connects by address with a port and a name', async () => {
        const { requests } = fakeTvsApi();
        const user = setupUser();

        renderApp('/tvs');
        await user.type(await screen.findByLabelText(/Address/), ' frame.local ');
        await user.clear(screen.getByLabelText('Port'));
        await user.type(screen.getByLabelText('Port'), '8001');
        await user.type(screen.getByLabelText('Name'), 'Hallway');
        await user.click(screen.getByRole('button', { name: 'Connect' }));

        expect(await screen.findByText('Hallway is ready.')).toBeInTheDocument();
        expect(writes(requests)[0]?.body).toEqual({ host: 'frame.local', port: 8001, name: 'Hallway' });
        await waitFor(() => expect(screen.getByLabelText(/Address/)).toHaveValue(''));
    });

    it('explains an address that is already added', async () => {
        fakeTvsApi([living], () => errorResponse(409, 'Conflict', { reason: 'Living Room is already added at 192.168.1.50:8002', tvId: living.id }));
        const user = setupUser();

        renderApp('/tvs');
        await user.type(await screen.findByLabelText(/Address/), '192.168.1.50');
        await user.click(screen.getByRole('button', { name: 'Connect' }));

        expect(await screen.findByText('Already added')).toBeInTheDocument();
        expect(screen.getByText('Living Room is already added at 192.168.1.50:8002')).toBeInTheDocument();
    });

    it('renames a TV', async () => {
        const { requests } = fakeTvsApi();
        const user = setupUser();

        renderApp('/tvs');
        await user.click(await screen.findByRole('button', { name: 'Actions for Living Room' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Rename' }));
        const dialog = await screen.findByRole('dialog');
        const input = within(dialog).getByRole('textbox', { name: 'Name' });
        await user.clear(input);
        await user.type(input, 'Lounge');
        await user.click(within(dialog).getByRole('button', { name: 'Save' }));

        expect(await screen.findByText('Lounge')).toBeInTheDocument();
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'PATCH', body: { name: 'Lounge' } })]);
    });

    it('removes a TV after asking', async () => {
        const { requests } = fakeTvsApi();
        const user = setupUser();

        renderApp('/tvs');
        await user.click(await screen.findByRole('button', { name: 'Actions for Living Room' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Remove' }));
        expect(writes(requests)).toEqual([]);
        await user.click(await screen.findByRole('button', { name: 'Remove' }));

        await waitFor(() => expect(screen.queryByText('192.168.1.50:8002')).not.toBeInTheDocument());
        expect(writes(requests)).toEqual([expect.objectContaining({ method: 'DELETE', path: `/tvs/${living.id}` })]);
        expect(await screen.findByText('No TVs yet. Add one below.')).toBeInTheDocument();
    });
});
