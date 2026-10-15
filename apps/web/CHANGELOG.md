# @curator/web

## 0.2.1

### Patch Changes

- a95ce95: Album collages load their thumbnails again on newer firmware: each piece is asked for by the TV's own spelling of its id (MY_F0001), not the album's (MY-F0001), which the TV rejected.

## 0.2.0

### Minor Changes

- b48a085: Album cards show a collage of up to four of the album's pieces, picked at random each time the list loads, instead of only the first piece. The albums list returns them as `previewContentIds`.

## 0.1.1

No changes in this release.

## 0.1.0

No changes in this release.
