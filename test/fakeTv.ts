/**
 * A fake Frame TV speaking the protocol as the reference library expects it.
 * Not a spec of real firmware (we don't have one); a harness that keeps the
 * client honest about framing, matching, and the upload handshake.
 */
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';

export interface FakeTvOptions {
  token?: string;
  /** Requests the TV silently ignores (to exercise optional/timeout paths). */
  silentRequests?: string[];
  /** Pretend the human never accepts the pairing prompt. */
  rejectPairing?: boolean;
}

export class FakeTv {
  readonly received: Record<string, any>[] = [];
  readonly uploads: { header: Record<string, any>; bytes: Buffer }[] = [];
  readonly art = new Map<string, { content_id: string; category_id: string }>([
    ['SAM-S0001', { content_id: 'SAM-S0001', category_id: 'MY-C0008' }],
    ['MY-F0001', { content_id: 'MY-F0001', category_id: 'MY-C0002' }],
  ]);
  current = 'SAM-S0001';
  artMode = 'on';
  pairedClients = 0;

  private server!: http.Server;
  private wss!: WebSocketServer;
  private uploadServer!: net.Server;
  private artSockets = new Set<WebSocket>();
  private nextId = 2;
  private pendingUpload: { key: string; size: number; requestId: string } | undefined;

  constructor(private readonly opts: FakeTvOptions = {}) {}

  get port() {
    return (this.server.address() as AddressInfo).port;
  }

  async start() {
    this.server = http.createServer((req, res) => {
      if (req.url === '/api/v2/') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({ device: { modelName: 'QN55LS03DAFXZA', name: 'Fake Frame', FrameTVSupport: 'true', PowerState: 'on' } }));
      } else {
        res.statusCode = 404;
        res.end();
      }
    });
    this.wss = new WebSocketServer({ server: this.server });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, new URL(req.url!, 'http://x')));
    this.uploadServer = net.createServer((s) => this.onUploadSocket(s));
    await new Promise<void>((r) => this.server.listen(0, '127.0.0.1', r));
    await new Promise<void>((r) => this.uploadServer.listen(0, '127.0.0.1', r));
    return this;
  }

  async stop() {
    for (const c of this.wss.clients) c.terminate();
    await new Promise((r) => this.wss.close(r));
    await new Promise((r) => this.server.close(r));
    await new Promise((r) => this.uploadServer.close(r));
  }

  /** Simulates the TV dropping the art channel (sleep, Wi-Fi blip). */
  dropConnections() {
    for (const ws of this.artSockets) ws.terminate();
  }

  private onConnection(ws: WebSocket, url: URL) {
    const name = Buffer.from(url.searchParams.get('name') ?? '', 'base64').toString();
    if (url.pathname.endsWith('/samsung.remote.control')) {
      if (this.opts.rejectPairing) {
        ws.send(JSON.stringify({ event: 'ms.channel.timeOut', data: {} }));
        return;
      }
      this.pairedClients++;
      ws.send(JSON.stringify({ event: 'ms.channel.connect', data: { id: name, token: this.opts.token ?? '12345678' } }));
      return;
    }
    if (!url.pathname.endsWith('/com.samsung.art-app')) return ws.close();

    this.artSockets.add(ws);
    ws.on('close', () => this.artSockets.delete(ws));
    // Real TVs sometimes send noise before the connect event.
    ws.send(JSON.stringify({ event: 'ed.edenTV.update', data: {} }));
    ws.send(JSON.stringify({ event: 'ms.channel.connect', data: { id: name } }));
    ws.send(JSON.stringify({ event: 'ms.channel.ready', data: {} }));
    ws.on('message', (raw) => this.onArtMessage(ws, raw.toString()));
  }

  private reply(ws: WebSocket, data: Record<string, unknown>) {
    ws.send(JSON.stringify({ event: 'd2d_service_message', from: 'host', data: JSON.stringify(data) }));
  }

  private onArtMessage(ws: WebSocket, raw: string) {
    const msg = JSON.parse(raw);
    if (msg.method !== 'ms.channel.emit' || msg.params?.event !== 'art_app_request') return;
    const req = JSON.parse(msg.params.data);
    this.received.push(req);
    const rid = req.request_id;
    if (this.opts.silentRequests?.includes(req.request)) return;

    switch (req.request) {
      case 'get_api_version':
        return this.reply(ws, { event: 'get_api_version', version: '4.3.4.0', request_id: rid, id: rid });
      case 'get_content_list':
        return this.reply(ws, {
          event: 'get_content_list',
          request_id: rid,
          id: rid,
          content_list: JSON.stringify([...this.art.values()]),
        });
      case 'get_current_artwork':
        return this.reply(ws, { event: 'get_current_artwork', content_id: this.current, matte_id: 'none', request_id: rid, id: rid });
      case 'get_artmode_status':
        return this.reply(ws, { event: 'artmode_status', value: this.artMode, request_id: rid, id: rid });
      case 'set_artmode_status':
        this.artMode = req.value;
        return this.reply(ws, { event: 'art_mode_changed', status: req.value, request_id: rid, id: rid });
      case 'select_image':
        if (!this.art.has(req.content_id)) return this.error(ws, req, '-1');
        this.current = req.content_id;
        return this.reply(ws, { event: 'image_selected', content_id: req.content_id, request_id: rid, id: rid });
      case 'delete_image_list':
        for (const { content_id } of req.content_id_list) this.art.delete(content_id);
        return this.reply(ws, { event: 'image_deleted', request_id: rid, id: rid });
      case 'send_image': {
        const key = `key-${rid.slice(0, 8)}`;
        this.pendingUpload = { key, size: req.file_size, requestId: rid };
        const { port } = this.uploadServer.address() as AddressInfo;
        return this.reply(ws, {
          event: 'ready_to_use',
          request_id: rid,
          id: rid,
          conn_info: JSON.stringify({ ip: '127.0.0.1', port: String(port), key, secured: false }),
        });
      }
      default:
        return this.error(ws, req, '-7');
    }
  }

  private error(ws: WebSocket, req: Record<string, unknown>, code: string) {
    this.reply(ws, { event: 'error', error_code: code, request_id: req.request_id, id: req.id, request_data: JSON.stringify(req) });
  }

  private onUploadSocket(socket: net.Socket) {
    const chunks: Buffer[] = [];
    socket.on('data', (c) => chunks.push(Buffer.from(c)));
    socket.on('end', () => {
      const buf = Buffer.concat(chunks);
      const headerLen = buf.readUInt32BE(0);
      const header = JSON.parse(buf.subarray(4, 4 + headerLen).toString('ascii'));
      const bytes = buf.subarray(4 + headerLen);
      this.uploads.push({ header, bytes });
      const pending = this.pendingUpload;
      if (!pending || header.secKey !== pending.key || bytes.length !== pending.size) return;
      const contentId = `MY-F${String(this.nextId++).padStart(4, '0')}`;
      this.art.set(contentId, { content_id: contentId, category_id: 'MY-C0002' });
      for (const ws of this.artSockets)
        this.reply(ws, { event: 'image_added', content_id: contentId, request_id: pending.requestId, id: pending.requestId });
      this.pendingUpload = undefined;
    });
  }
}
