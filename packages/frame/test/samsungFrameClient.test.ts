import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Category,
  FrameRequestError,
  FrameUnauthorizedError,
  MemoryTokenStore,
  SamsungFrameClient,
  type SamsungFrameClientOptions,
  type TokenStore,
} from '../src/index.js';
import { pyJson } from '../src/pyjson.js';
import { FakeTv, type FakeTvOptions } from './fakeTv.js';

let tv: FakeTv;
let client: SamsungFrameClient;

async function setup(tvOpts: FakeTvOptions = {}, clientOpts: Partial<SamsungFrameClientOptions> = {}) {
  tv = await new FakeTv(tvOpts).start();
  client = new SamsungFrameClient({
    host: '127.0.0.1',
    port: tv.port,
    secure: false,
    commandGapMs: 0,
    requestTimeoutMs: 300,
    pairingTimeoutMs: 1000,
    ...clientOpts,
  });
}

afterEach(async () => {
  await client?.close();
  await tv?.stop();
});

describe('pyJson', () => {
  it('matches python json.dumps defaults', () => {
    expect(pyJson({ a: 1, b: [true, null, 'é'], c: { d: 'x' } })).toBe('{"a": 1, "b": [true, null, "\\u00e9"], "c": {"d": "x"}}');
  });
});

describe('SamsungFrameClient against a fake TV', () => {
  beforeEach(() => setup());

  it('reads device info over REST', async () => {
    const info = await client.deviceInfo();
    expect(info).toMatchObject({ model: 'QN55LS03DAFXZA', frameTvSupport: true, powerOn: true });
  });

  it('pairs once and stores the token', async () => {
    const store = new MemoryTokenStore();
    await client.close();
    client = new SamsungFrameClient({ host: '127.0.0.1', port: tv.port, secure: false, commandGapMs: 0, tokenStore: store });
    await client.apiVersion();
    await client.apiVersion();
    expect(await store.load()).toBe('12345678');
    expect(tv.pairedClients).toBe(1);
  });

  it('sends the envelope the reference library sends', async () => {
    await client.getArtMode();
    const req = tv.received.at(-1)!;
    expect(req.request).toBe('get_artmode_status');
    expect(req.id).toBe(req.request_id);
  });

  it('lists, filters by category, and reads current art', async () => {
    expect((await client.list()).map((a) => a.contentId)).toEqual(['SAM-S0001', 'MY-F0001']);
    expect((await client.list(Category.MyPhotos)).map((a) => a.contentId)).toEqual(['MY-F0001']);
    expect((await client.current()).content_id).toBe('SAM-S0001');
  });

  it('uploads over the side socket and returns the new content id', async () => {
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(200_000, 7)]);
    const id = await client.upload(jpeg, { matte: 'shadowbox_polar' });
    expect(id).toBe('MY-F0002');

    const sent = tv.received.find((r) => r.request === 'send_image')!;
    expect(sent).toMatchObject({ file_type: 'jpg', matte_id: 'shadowbox_polar', file_size: jpeg.length });
    expect(sent.conn_info.id).toBe(sent.id);
    expect(sent.image_date).toMatch(/^\d{4}:\d{2}:\d{2} \d{2}:\d{2}:\d{2}$/);

    const { header, bytes } = tv.uploads[0]!;
    expect(header).toMatchObject({ num: 0, total: 1, fileLength: jpeg.length, fileType: 'jpg', version: '0.0.1' });
    expect(bytes.equals(jpeg)).toBe(true);
  });

  it('selects, deletes, and toggles art mode', async () => {
    await client.select('MY-F0001');
    expect(tv.current).toBe('MY-F0001');
    await client.delete('MY-F0001');
    expect(tv.art.has('MY-F0001')).toBe(false);
    await client.setArtMode(false);
    expect(await client.getArtMode()).toBe(false);
  });

  it('surfaces TV error events as FrameRequestError', async () => {
    await expect(client.select('MY-NOPE')).rejects.toMatchObject({
      name: 'FrameRequestError',
      request: 'select_image',
      errorCode: '-1',
    });
    expect(FrameRequestError).toBeDefined();
  });

  it('publishes TV pushes on one event channel and tracks art mode', async () => {
    const seen: string[] = [];
    client.on('event', (e) => seen.push(e.event));
    await client.setArtMode(false);
    await client.select('MY-NOPE').catch(() => undefined);
    expect(seen).toEqual(['art_mode_changed', 'error']);
    expect(client.artMode).toBe(false);
  });

  it('serializes concurrent calls', async () => {
    const results = await Promise.all([client.current(), client.list(), client.getArtMode(), client.apiVersion()]);
    expect(results).toHaveLength(4);
    expect(tv.received.map((r) => r.request)).toEqual([
      'get_current_artwork',
      'get_content_list',
      'get_artmode_status',
      'get_api_version',
    ]);
  });

  it('reconnects after the TV drops the channel', async () => {
    await client.current();
    tv.dropConnections();
    await new Promise((r) => setTimeout(r, 50));
    expect((await client.current()).content_id).toBe('SAM-S0001');
  });
});

describe('edge cases', () => {
  it('treats a missing reply to select as non-fatal', async () => {
    await setup({ silentRequests: ['select_image'] });
    await expect(client.select('MY-F0001')).resolves.toBeUndefined();
  });

  it('times out required requests', async () => {
    await setup({ silentRequests: ['get_current_artwork'] });
    await expect(client.current()).rejects.toMatchObject({ name: 'FrameTimeoutError' });
  });

  it('reports an unaccepted pairing prompt', async () => {
    await setup({ rejectPairing: true });
    await expect(client.current()).rejects.toBeInstanceOf(FrameUnauthorizedError);
  });

  it('reconnects after a required request times out on a dead socket', async () => {
    await setup();
    await client.current();
    tv.freezeConnections();
    await expect(client.current()).rejects.toMatchObject({ name: 'FrameTimeoutError' });
    expect((await client.current()).content_id).toBe('SAM-S0001');
  });

  it('keeps the channel when an optional request gets no reply', async () => {
    await setup({ silentRequests: ['select_image'] });
    await client.select('MY-F0001');
    await client.current();
    expect(tv.artConnections).toBe(1);
  });

  it('keeps requests on a new channel alive when the old one finishes closing', async () => {
    await setup({ replyDelayMs: 100 });
    await client.current();
    tv.closeSlowly(50);
    await new Promise((r) => setTimeout(r, 10));
    // The old socket is CLOSING, so this opens a new channel; the old socket's
    // close lands while this request is still waiting for its reply.
    expect((await client.current()).content_id).toBe('SAM-S0001');
  });

  it('does not count a slow transfer against the upload timeout', async () => {
    await setup({ uploadDelayMs: 300 }, { uploadTimeoutMs: 100 });
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1000, 7)]);
    await expect(client.upload(jpeg)).resolves.toBe('MY-F0002');
  });

  it('times out an upload the TV never acknowledges', async () => {
    await setup({ silentUploads: true }, { uploadTimeoutMs: 100 });
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(1000, 7)]);
    await expect(client.upload(jpeg)).rejects.toMatchObject({ name: 'FrameTimeoutError', request: 'send_image' });
  });

  it('handles the handshake in order while a refreshed token is being saved', async () => {
    let saved: string | undefined;
    const slowStore: TokenStore = {
      load: async () => saved ?? '12345678',
      save: async (token) => {
        await new Promise((r) => setTimeout(r, 50));
        saved = token;
      },
    };
    await setup({ artToken: 'refreshed' }, { tokenStore: slowStore });
    expect((await client.current()).content_id).toBe('SAM-S0001');
    expect(saved).toBe('refreshed');
  });

  it('fails the handshake when the token cannot be saved', async () => {
    const brokenStore: TokenStore = {
      load: async () => '12345678',
      save: async () => {
        throw new Error('disk full');
      },
    };
    await setup({ artToken: 'refreshed' }, { tokenStore: brokenStore });
    await expect(client.current()).rejects.toMatchObject({ message: 'could not save the pairing token' });
  });

  it('refuses images it cannot identify', async () => {
    await setup();
    await expect(client.upload(Buffer.from('GIF89a'))).rejects.toThrow(/neither JPEG nor PNG/);
  });
});
