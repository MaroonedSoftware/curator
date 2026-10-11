import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Category,
  FrameRequestError,
  FrameUnauthorizedError,
  MemoryTokenStore,
  SamsungFrameClient,
  type SamsungFrameClientOptions,
} from '../src/frame/index.js';
import { pyJson } from '../src/frame/pyjson.js';
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

  it('refuses images it cannot identify', async () => {
    await setup();
    await expect(client.upload(Buffer.from('GIF89a'))).rejects.toThrow(/neither JPEG nor PNG/);
  });
});
