---
'@curator/frame': patch
---

Art channel events after the handshake no longer log under the trace of the request that opened the channel, and the TV closing the channel with a 1005 close frame now logs at debug instead of as an "Invalid WebSocket frame" warning.
