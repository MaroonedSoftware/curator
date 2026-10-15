---
'@curator/web': patch
---

Album collages load their thumbnails again on newer firmware: each piece is asked for by the TV's own spelling of its id (MY_F0001), not the album's (MY-F0001), which the TV rejected.
