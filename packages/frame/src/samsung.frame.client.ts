/**
 * Samsung The Frame art-mode client.
 *
 * Protocol ported from NickWaterton/samsung-tv-ws-api (samsungtvws/async_art.py,
 * LGPL-3.0), which is the reference when firmware changes break something.
 *
 * Shape of the protocol:
 *   1. Pairing: open wss://tv:8002/api/v2/channels/samsung.remote.control, the TV
 *      shows a prompt, and the ms.channel.connect event carries a token.
 *   2. Art channel: open .../channels/com.samsung.art-app with that token, wait for
 *      ms.channel.connect then ms.channel.ready.
 *   3. Requests are ms.channel.emit envelopes whose `data` is a JSON *string*
 *      containing {request, id, request_id, ...}. Replies arrive as
 *      d2d_service_message events whose `data` is again a JSON string, matched
 *      back by request_id/id, or by sub-event name (e.g. "image_added").
 *   4. Uploads: send_image returns conn_info {ip, port, key, secured}; we open a
 *      raw TCP (or TLS) socket to it and write [u32 BE header length][header JSON][bytes].
 *      The TV then emits "image_added" with the new content_id.
 */
import { EventEmitter } from 'node:events';
import { randomInt, randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import tls from 'node:tls';
import WebSocket from 'ws';

import { pyJson } from './pyjson.js';
import type { TokenStore } from './token.store.js';
import { MemoryTokenStore } from './token.store.js';
import type { ArtItem, DeviceInfo, FrameClient, UploadOptions } from './frame.client.js';
import {
  FrameConnectionError,
  FrameError,
  FrameRequestError,
  FrameTimeoutError,
  FrameUnauthorizedError,
} from './errors.js';

const ART_ENDPOINT = 'com.samsung.art-app';
const REMOTE_ENDPOINT = 'samsung.remote.control';
const IGNORE_AT_STARTUP = new Set(['ed.edenTV.update', 'ms.voiceApp.hide']);

export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
  info(msg: string, ...args: unknown[]): void;
  warn(msg: string, ...args: unknown[]): void;
}

const silentLogger: Logger = { debug() {}, info() {}, warn() {} };

export interface SamsungFrameClientOptions {
  host: string;
  /** 8002 is the TLS port and the one modern Frames want. */
  port?: number;
  /** Defaults to true on 8002. Only turn off for tests against a fake TV. */
  secure?: boolean;
  /** Shown on the TV's pairing prompt. */
  name?: string;
  tokenStore?: TokenStore;
  /** Default wait for a reply. The reference uses 2s; a little slack costs nothing. */
  requestTimeoutMs?: number;
  /** content lists can be big. */
  listTimeoutMs?: number;
  /** Wait for image_added after the bytes are sent. */
  uploadTimeoutMs?: number;
  /** Covers the human walking over to accept the pairing prompt. */
  pairingTimeoutMs?: number;
  connectTimeoutMs?: number;
  /** Pause after each command. The reference sleeps 1s; the TV dislikes being rushed. */
  commandGapMs?: number;
  logger?: Logger;
}

/** Every sub-event the TV pushes, via client.on('event', ({ event, data }) => ...). */
export interface FrameEvent {
  event: string;
  data: Record<string, unknown>;
}

interface Waiter {
  resolve(data: Record<string, unknown>): void;
  reject(err: Error): void;
}

export class SamsungFrameClient extends EventEmitter implements FrameClient {
  private readonly opts: Required<Omit<SamsungFrameClientOptions, 'logger' | 'tokenStore'>>;
  private readonly tokenStore: TokenStore;
  private readonly log: Logger;

  private ws: WebSocket | undefined;
  private connecting: Promise<WebSocket> | undefined;
  private readonly waiters = new Map<string, Waiter>();
  private queue: Promise<unknown> = Promise.resolve();

  /** Last art-mode state the TV pushed to us, if any. */
  artMode: boolean | undefined;

  constructor(options: SamsungFrameClientOptions) {
    super();
    const port = options.port ?? 8002;
    this.opts = {
      host: options.host,
      port,
      secure: options.secure ?? port === 8002,
      name: options.name ?? 'FrameRotator',
      requestTimeoutMs: options.requestTimeoutMs ?? 3000,
      listTimeoutMs: options.listTimeoutMs ?? 5000,
      uploadTimeoutMs: options.uploadTimeoutMs ?? 15000,
      pairingTimeoutMs: options.pairingTimeoutMs ?? 30000,
      connectTimeoutMs: options.connectTimeoutMs ?? 10000,
      commandGapMs: options.commandGapMs ?? 250,
    };
    this.tokenStore = options.tokenStore ?? new MemoryTokenStore();
    this.log = options.logger ?? silentLogger;
  }

  // ---------------------------------------------------------------- public API

  async deviceInfo(): Promise<DeviceInfo> {
    const raw = await this.rest('');
    const device = (raw.device ?? {}) as Record<string, unknown>;
    return {
      model: device.modelName as string | undefined,
      name: device.name as string | undefined,
      frameTvSupport: device.FrameTVSupport === 'true',
      powerOn: device.PowerState === undefined ? true : device.PowerState === 'on',
      raw,
    };
  }

  apiVersion(): Promise<string> {
    return this.exclusive(async () => {
      const data =
        (await this.request({ request: 'get_api_version' }, { optional: true })) ??
        (await this.request({ request: 'api_version' }));
      return String(data!.version);
    });
  }

  list(category?: string): Promise<ArtItem[]> {
    return this.exclusive(async () => {
      const data = await this.request(
        { request: 'get_content_list', category: category ?? null },
        { timeoutMs: this.opts.listTimeoutMs },
      );
      const items = parseJsonField<Record<string, unknown>[]>(data!, 'content_list');
      return items
        .filter((v) => !category || v.category_id === category)
        .map((v) => ({ contentId: String(v.content_id), categoryId: String(v.category_id), raw: v }));
    });
  }

  current(): Promise<Record<string, unknown>> {
    return this.exclusive(async () => (await this.request({ request: 'get_current_artwork' }))!);
  }

  upload(image: Buffer, opts: UploadOptions = {}): Promise<string> {
    return this.exclusive(async () => {
      const fileType = opts.fileType ?? sniffType(image);
      const id = randomUUID();

      // Register for image_added before any bytes move, so a fast TV can't beat us to it.
      // The timeout starts once the bytes are sent: a big image on slow Wi-Fi can take
      // longer to transfer than the TV takes to acknowledge it.
      const added = this.waitFor('image_added', undefined, 'send_image');

      let reply: Record<string, unknown>;
      try {
        reply = (await this.request({
          request: 'send_image',
          file_type: fileType,
          request_id: id,
          id,
          conn_info: { d2d_mode: 'socket', connection_id: randomInt(2 ** 32), id },
          image_date: pyDate(new Date()),
          matte_id: opts.matte ?? 'none',
          portrait_matte_id: opts.portraitMatte ?? 'none',
          file_size: image.length,
        }))!;
      } catch (err) {
        added.cancel();
        throw err;
      }

      const conn = parseJsonField<{ ip: string; port: string | number; key: string; secured?: boolean }>(
        reply,
        'conn_info',
      );
      const header = pyJson({
        num: 0,
        total: 1,
        fileLength: image.length,
        fileName: 'dummy',
        fileType,
        secKey: conn.key,
        version: '0.0.1',
      });

      try {
        await sendOverSocket(conn.ip, Number(conn.port), Boolean(conn.secured), header, image, this.opts.connectTimeoutMs);
      } catch (err) {
        added.cancel();
        throw new FrameConnectionError(`upload socket to ${conn.ip}:${conn.port} failed`, { cause: err });
      }

      added.arm(this.opts.uploadTimeoutMs);
      const done = await added.promise;
      const contentId = done.content_id;
      if (typeof contentId !== 'string') throw new FrameError(`image_added had no content_id: ${pyJson(done)}`);
      this.log.info('uploaded %s', contentId);
      return contentId;
    });
  }

  select(contentId: string, opts: { show?: boolean; category?: string } = {}): Promise<void> {
    return this.exclusive(async () => {
      await this.request(
        { request: 'select_image', category_id: opts.category ?? null, content_id: contentId, show: opts.show ?? true },
        { optional: true },
      );
    });
  }

  delete(contentIds: string | string[]): Promise<void> {
    const ids = Array.isArray(contentIds) ? contentIds : [contentIds];
    return this.exclusive(async () => {
      await this.request(
        { request: 'delete_image_list', content_id_list: ids.map((content_id) => ({ content_id })) },
        { optional: true },
      );
    });
  }

  changeMatte(contentId: string, matte: string, portraitMatte?: string): Promise<void> {
    return this.exclusive(async () => {
      await this.request(
        { request: 'change_matte', content_id: contentId, matte_id: matte || 'none', portrait_matte_id: portraitMatte },
        { optional: true },
      );
    });
  }

  getArtMode(): Promise<boolean> {
    return this.exclusive(async () => {
      const data = await this.request({ request: 'get_artmode_status' });
      this.artMode = data!.value === 'on';
      return this.artMode;
    });
  }

  setArtMode(on: boolean): Promise<void> {
    return this.exclusive(async () => {
      await this.request({ request: 'set_artmode_status', value: on ? 'on' : 'off' }, { optional: true });
    });
  }

  async close(): Promise<void> {
    const ws = this.ws;
    this.ws = undefined;
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      await new Promise<void>((resolve) => {
        ws.once('close', () => resolve());
        ws.close();
        setTimeout(resolve, 1000).unref();
      });
    }
    this.failWaiters(new FrameConnectionError('client closed'));
  }

  /** Runs pairing explicitly. Normally happens on first use; handy for a setup step. */
  async pair(): Promise<string> {
    const existing = await this.tokenStore.load();
    if (existing) return existing;
    this.log.info('pairing with %s: accept the prompt on the TV', this.opts.host);
    const ws = await this.openChannel(REMOTE_ENDPOINT, undefined, this.opts.pairingTimeoutMs);
    ws.close();
    const token = await this.tokenStore.load();
    if (!token) throw new FrameUnauthorizedError('TV accepted the connection but issued no token');
    return token;
  }

  // ---------------------------------------------------------------- plumbing

  /** One operation at a time. The TV handles concurrent art requests badly. */
  private exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const run = this.queue.then(fn, fn);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async request(
    body: Record<string, unknown>,
    { timeoutMs = this.opts.requestTimeoutMs, optional = false } = {},
  ): Promise<Record<string, unknown> | undefined> {
    const ws = await this.connection();
    const id = typeof body.id === 'string' ? body.id : randomUUID();
    const payload = { ...body, id, request_id: id };
    const name = String(body.request);

    const waiter = this.waitFor(id, timeoutMs, name);
    const envelope = pyJson({
      method: 'ms.channel.emit',
      params: { event: 'art_app_request', to: 'host', data: pyJson(payload) },
    });
    this.log.debug('-> %s', envelope);
    ws.send(envelope);

    try {
      const data = await waiter.promise;
      return data;
    } catch (err) {
      if (err instanceof FrameTimeoutError) {
        if (optional) {
          this.log.debug('%s: no reply (ok for this request)', name);
          return undefined;
        }
        // A socket that died without closing (TV asleep, Wi-Fi gone) still looks
        // open, and a missing reply is the only sign. Drop it so the next call
        // reconnects instead of timing out on the same dead socket forever.
        this.dropChannel(ws, `${name} got no reply`);
      }
      throw err;
    } finally {
      if (this.opts.commandGapMs) await sleep(this.opts.commandGapMs);
    }
  }

  /**
   * Registers a waiter for a reply. With no timeoutMs the clock doesn't start
   * until arm() is called, so a caller can register early and time only the wait.
   */
  private waitFor(key: string, timeoutMs: number | undefined, requestName: string) {
    let timer: NodeJS.Timeout | undefined;
    let settled = false;
    let waiter!: Waiter;
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      waiter = {
        resolve: (d) => {
          settled = true;
          clearTimeout(timer);
          resolve(d);
        },
        reject: (e) => {
          settled = true;
          clearTimeout(timer);
          reject(e);
        },
      };
      this.waiters.set(key, waiter);
    });
    // The caller may not await this until later (upload does other work first);
    // a rejection in the meantime must not surface as an unhandled rejection.
    promise.catch(() => undefined);

    const arm = (ms: number) => {
      if (settled) return;
      timer = setTimeout(() => {
        if (this.waiters.get(key) === waiter) this.waiters.delete(key);
        waiter.reject(new FrameTimeoutError(requestName, ms));
      }, ms);
    };
    if (timeoutMs !== undefined) arm(timeoutMs);

    return {
      promise,
      arm,
      cancel: () => {
        settled = true;
        clearTimeout(timer);
        if (this.waiters.get(key) === waiter) this.waiters.delete(key);
      },
    };
  }

  private async connection(): Promise<WebSocket> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return this.ws;
    this.connecting ??= (async () => {
      try {
        let token = await this.tokenStore.load();
        if (!token) token = await this.pair();
        const ws = await this.openChannel(ART_ENDPOINT, token, this.opts.connectTimeoutMs, true);
        ws.on('message', (raw) => this.onMessage(raw.toString()));
        ws.on('close', () => {
          // A socket that was already replaced (it lingered in CLOSING while a new
          // one opened) must not fail requests waiting on its successor.
          if (this.ws !== ws) return;
          this.ws = undefined;
          this.failWaiters(new FrameConnectionError('art channel closed'));
        });
        this.ws = ws;
        return ws;
      } finally {
        this.connecting = undefined;
      }
    })();
    return this.connecting;
  }

  /**
   * Opens a channel and runs its handshake. Resolves once the channel is usable:
   * after ms.channel.connect, and for the art channel also ms.channel.ready.
   */
  private openChannel(endpoint: string, token: string | undefined, timeoutMs: number, waitReady = false) {
    const { host, port, secure, name } = this.opts;
    const params = new URLSearchParams({ name: Buffer.from(name).toString('base64') });
    if (secure && token) params.set('token', token);
    const url = `${secure ? 'wss' : 'ws'}://${host}:${port}/api/v2/channels/${endpoint}?${params}`;
    this.log.debug('connecting %s', url.replace(/token=[^&]+/, 'token=***'));

    return new Promise<WebSocket>((resolve, reject) => {
      const ws = new WebSocket(url, { rejectUnauthorized: false, handshakeTimeout: Math.min(timeoutMs, 10000) });
      let stage: 'connect' | 'ready' = 'connect';
      let settled = false;
      // The token is saved in the background so later handshake messages are still
      // handled in order; done() waits for the save before resolving.
      let saving: Promise<void> = Promise.resolve();
      const timer = setTimeout(() => fail(new FrameTimeoutError(`${endpoint} handshake`, timeoutMs)), timeoutMs);

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        ws.removeAllListeners('message');
        ws.terminate();
        reject(err);
      };

      ws.on('error', (err) => fail(new FrameConnectionError(`cannot reach TV at ${host}:${port}`, { cause: err })));
      ws.on('close', () => fail(new FrameConnectionError(`${endpoint} closed during handshake`)));
      ws.on('message', (raw) => {
        const msg = safeParse(raw.toString());
        const event = typeof msg?.event === 'string' ? msg.event : '*';
        this.log.debug('<- %s', raw.toString());
        if (IGNORE_AT_STARTUP.has(event)) return;

        if (stage === 'connect') {
          if (event === 'ms.channel.unauthorized') return fail(new FrameUnauthorizedError('TV rejected the token'));
          if (event === 'ms.channel.timeOut')
            return fail(new FrameUnauthorizedError('pairing prompt was not accepted on the TV'));
          if (event !== 'ms.channel.connect') return fail(new FrameConnectionError(`unexpected event ${event}`));
          const newToken = (msg?.data as Record<string, unknown> | undefined)?.token;
          if (typeof newToken === 'string' && newToken) {
            saving = this.tokenStore.save(newToken);
            // done() handles a failed save; until it runs, the rejection must not count as unhandled.
            saving.catch(() => undefined);
          }
          if (!waitReady) return done();
          stage = 'ready';
          return;
        }
        if (event === 'ms.channel.ready') return done();
        fail(new FrameConnectionError(`expected ms.channel.ready, got ${event}`));
      });

      const done = () => {
        ws.removeAllListeners('message');
        saving.then(
          () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            ws.removeAllListeners('close');
            ws.removeAllListeners('error');
            ws.on('error', (err) => this.log.warn('art channel error: %s', err.message));
            resolve(ws);
          },
          (err) => fail(new FrameError('could not save the pairing token', { cause: err })),
        );
      };
    });
  }

  private onMessage(raw: string) {
    this.log.debug('<- %s', raw);
    const msg = safeParse(raw);
    if (!msg) return;
    if (msg.event === 'ms.error') {
      this.log.warn('TV error message: %s', raw);
      return;
    }
    if (msg.event !== 'd2d_service_message' || typeof msg.data !== 'string') return;

    const data = safeParse(msg.data);
    if (!data) return;
    const sub = typeof data.event === 'string' ? data.event : '*';

    if (sub.includes('artmode_status') || sub === 'art_mode_changed') {
      this.artMode = (data.value ?? data.status) === 'on';
    } else if (sub === 'go_to_standby') {
      this.artMode = false;
    }
    // One channel only: re-emitting sub-event names would turn the TV's "error"
    // sub-event into an EventEmitter 'error' and crash the process if unhandled.
    this.emit('event', { event: sub, data } satisfies FrameEvent);

    const requestId = (data.request_id ?? data.id) as string | undefined;
    const key = requestId && this.waiters.has(requestId) ? requestId : this.waiters.has(sub) ? sub : undefined;
    if (!key) return;
    const waiter = this.waiters.get(key)!;
    this.waiters.delete(key);

    if (sub === 'error') {
      const req = safeParse(String(data.request_data ?? '{}'));
      waiter.reject(new FrameRequestError(String(req?.request ?? key), String(data.error_code)));
    } else {
      waiter.resolve(data);
    }
  }

  private dropChannel(ws: WebSocket, reason: string) {
    if (this.ws !== ws) return;
    this.log.warn('dropping art channel: %s', reason);
    this.ws = undefined;
    ws.terminate();
  }

  private failWaiters(err: Error) {
    for (const w of this.waiters.values()) w.reject(err);
    this.waiters.clear();
  }

  private rest(route: string): Promise<Record<string, unknown>> {
    const { host, port, secure } = this.opts;
    const url = `${secure ? 'https' : 'http'}://${host}:${port}/api/v2/${route}`;
    const lib = secure ? https : http;
    return new Promise((resolve, reject) => {
      const req = lib.get(url, { rejectUnauthorized: false, timeout: this.opts.connectTimeoutMs } as https.RequestOptions, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          const parsed = safeParse(body);
          if (parsed) resolve(parsed);
          else reject(new FrameError(`bad REST response from ${url}`));
        });
      });
      req.on('timeout', () => req.destroy(new FrameConnectionError(`REST timeout ${url}`)));
      req.on('error', (err) => reject(new FrameConnectionError(`cannot reach TV at ${url}`, { cause: err })));
    });
  }
}

// ---------------------------------------------------------------- helpers

function sendOverSocket(host: string, port: number, secured: boolean, header: string, body: Buffer, timeoutMs: number) {
  return new Promise<void>((resolve, reject) => {
    const socket: net.Socket = secured
      ? tls.connect({ host, port, rejectUnauthorized: false })
      : net.connect({ host, port });
    socket.setTimeout(timeoutMs, () => socket.destroy(new Error('socket timeout')));
    socket.once('error', reject);
    socket.once(secured ? 'secureConnect' : 'connect', () => {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(Buffer.byteLength(header, 'ascii'));
      socket.write(len);
      socket.write(Buffer.from(header, 'ascii'));
      socket.end(body);
    });
    socket.once('close', (hadError) => (hadError ? undefined : resolve()));
  });
}

function parseJsonField<T>(data: Record<string, unknown>, field: string): T {
  const value = data[field];
  if (typeof value === 'string') {
    const parsed = safeParse(value);
    if (parsed !== undefined) return parsed as T;
  } else if (value !== undefined) {
    return value as T;
  }
  throw new FrameError(`reply missing ${field}`);
}

function safeParse(s: string): Record<string, any> | undefined {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

function sniffType(buf: Buffer): 'jpg' | 'png' {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  throw new FrameError('image is neither JPEG nor PNG; pass fileType explicitly or convert it first');
}

/** Python's strftime("%Y:%m:%d %H:%M:%S"), local time. */
function pyDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}:${p(d.getMonth() + 1)}:${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
