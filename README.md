# frame-rotator

Art rotation for Samsung The Frame. Step one: a TypeScript client for the Frame's local art-mode protocol.

## Layout

```
src/frame/
  FrameClient.ts          the interface the rest of the app codes against
  SamsungFrameClient.ts   protocol implementation (WebSocket + side-channel TCP upload)
  tokenStore.ts           where the pairing token lives (file or memory)
  errors.ts               Connection / Unauthorized / Timeout / Request errors
  pyjson.ts               Python-style JSON, so wire traffic matches the reference byte for byte
scripts/probe.ts          run against the real TV
test/fakeTv.ts            fake TV speaking the protocol, used by the tests
```

## Try it on the TV

```
npm install
npm run probe -- 192.168.1.50            # read-only; accept the pairing prompt on the TV
npm run probe -- 192.168.1.50 --upload   # upload, show, restore, delete a test image
npm run probe -- 192.168.1.50 --debug    # print every frame on the wire
```

The token is saved to `.data/tv-token.txt`. Give the TV a DHCP reservation.

## When it breaks

The protocol is ported from [NickWaterton/samsung-tv-ws-api](https://github.com/NickWaterton/samsung-tv-ws-api)
(`samsungtvws/async_art.py`, LGPL-3.0). If the TS probe fails, run `frame_probe.py` against the same TV:

- Python passes, TS fails: bug in the port. Compare `--debug` output with the Python library's debug logging.
- Both fail: the TV or firmware changed. Check that repo's recent commits and issues.

## Behaviour worth knowing

- **One request at a time.** Calls are queued; the TV handles concurrent art requests badly. A short gap
  (`commandGapMs`, default 250ms) follows each command, like the reference's pacing.
- **Lazy connect, auto reconnect.** The art channel opens on first use and reopens after the TV drops it.
- **Fire-and-forget commands.** `select`, `delete`, `changeMatte` and `setArtMode` don't fail if the TV never
  replies (the reference treats them the same way). Reads and uploads do.
- **TV pushes** arrive on `client.on('event', ({ event, data }) => ...)`; `client.artMode` tracks the last known state.
