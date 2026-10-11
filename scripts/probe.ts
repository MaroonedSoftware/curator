/**
 * TS twin of frame_probe.py: same checks, same order, so if one passes and the
 * other fails you know the bug is in the port, not the TV.
 *
 *   npm run probe -- 192.168.1.50            # read-only
 *   npm run probe -- 192.168.1.50 --upload   # upload, show, restore, delete a test image
 *   add --debug to print every frame on the wire
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { Category, FileTokenStore, SamsungFrameClient } from '../src/frame/index.js';

const args = process.argv.slice(2);
const host = args.find((a) => !a.startsWith('--'));
if (!host) {
  console.error('usage: npm run probe -- <tv-ip> [--upload] [--debug]');
  process.exit(2);
}
const debug = args.includes('--debug');

const here = dirname(fileURLToPath(import.meta.url));
const portArg = args.find((a) => a.startsWith('--port='));
const tv = new SamsungFrameClient({
  host,
  // --port / --insecure exist for pointing the probe at the fake TV in test/.
  port: portArg ? Number(portArg.split('=')[1]) : 8002,
  secure: !args.includes('--insecure'),
  uploadTimeoutMs: 30_000,
  name: 'FrameRotator',
  tokenStore: new FileTokenStore(join(here, '..', '.data', 'tv-token.txt')),
  logger: {
    debug: (m, ...a) => debug && console.log(`      · ${m}`, ...a),
    info: (m, ...a) => console.log(`INFO  ${m}`, ...a),
    warn: (m, ...a) => console.warn(`WARN  ${m}`, ...a),
  },
});

async function step<T>(name: string, fn: () => Promise<T>): Promise<T | undefined> {
  try {
    const result = await fn();
    console.log(`PASS  ${name}`);
    return result;
  } catch (err) {
    const e = err as Error;
    console.log(`FAIL  ${name}: ${e.name}: ${e.message}${e.cause ? ` (${(e.cause as Error).message})` : ''}`);
    return undefined;
  }
}

async function testImage(): Promise<Buffer> {
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="3840" height="2160">
    <rect width="100%" height="100%" fill="#222831"/>
    <rect x="200" y="200" width="3440" height="1760" fill="none" stroke="#eeeeee" stroke-width="12"/>
    <text x="300" y="400" font-family="sans-serif" font-size="120" fill="#eeeeee">frame probe (ts) ${stamp}</text>
  </svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

async function main() {
  const info = await step('device info', () => tv.deviceInfo());
  if (info) console.log(`      model=${info.model}  name=${info.name}  frameTVSupport=${info.frameTvSupport}`);

  const paired = await step('pairing', () => tv.pair());
  if (!paired) {
    console.log('Stopping: no pairing token. Check the IP, that the TV is on, and accept the prompt on screen.');
    return;
  }
  const version = await step('api version', () => tv.apiVersion());
  if (version) console.log(`      api=${version}`);

  const current = await step('current art', () => tv.current());
  if (current) console.log(`      ${JSON.stringify(current)}`);
  const artMode = await step('art mode status', () => tv.getArtMode());
  if (artMode !== undefined) console.log(`      artMode=${artMode}`);

  const all = await step('list available art', () => tv.list());
  if (all) {
    const mine = all.filter((a) => a.categoryId === Category.MyPhotos);
    console.log(`      total=${all.length}  uploaded(${Category.MyPhotos})=${mine.length}`);
  }

  if (!args.includes('--upload')) {
    console.log('Read-only probe done. Re-run with --upload to test the write path.');
    return;
  }

  const image = await testImage();
  const contentId = await step('upload test image', () => tv.upload(image, { fileType: 'jpg', matte: 'none' }));
  if (!contentId) return;
  console.log(`      content_id=${contentId}`);

  await step('select test image', () => tv.select(contentId));
  console.log('      Check the TV now. Restoring and deleting shortly...');
  await new Promise((r) => setTimeout(r, Number(process.env.PROBE_HOLD_MS ?? 20_000)));

  const previous = current?.content_id;
  if (typeof previous === 'string') await step('restore previous art', () => tv.select(previous));
  await step('delete test image', () => tv.delete(contentId));
  const after = await step('verify deletion', () => tv.list(Category.MyPhotos));
  if (after) console.log(`      still present: ${after.some((a) => a.contentId === contentId)}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => tv.close());
