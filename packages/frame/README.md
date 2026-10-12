# @curator/frame

A TypeScript client for the Samsung The Frame's local art-mode protocol.

## Layout

```
src/
  frame.client.ts            the FrameClient interface the rest of the app codes against
  samsung.frame.client.ts    protocol implementation (WebSocket + side-channel TCP upload)
  token.store.ts             where the pairing token lives (file or memory)
  errors.ts                  Connection / Unauthorized / Timeout / Request errors
  pyjson.ts                  Python-style JSON, so wire traffic matches the reference byte for byte
scripts/
  frame.probe.ts             run against the real TV
  fake.tv.serve.ts           run the fake TV on 127.0.0.1:14180 for the probe
tests/
  fake.tv.ts                 fake TV speaking the protocol, used by the tests
  samsung.frame.client.test.ts
```

## Try it on the TV

From `packages/frame` (or prefix with `pnpm --filter @curator/frame` from the root):

```
pnpm probe 192.168.1.50            # read-only; accept the pairing prompt on the TV
pnpm probe 192.168.1.50 --upload   # upload, show, restore, delete a test image
pnpm probe 192.168.1.50 --debug    # print every frame on the wire
```

The token is saved to `packages/frame/.data/tv-token.txt`. Give the TV a DHCP reservation.

To exercise the probe without a TV, run `pnpm fake:tv` in one shell and `pnpm probe 127.0.0.1 --port=14180 --insecure --upload` in another.

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
