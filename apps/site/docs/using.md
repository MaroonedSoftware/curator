---
sidebar_label: Using it
---

# Using it

Every page is about one TV, picked in the header; switching TV stays on the same page. The TV
confirms very few of the things it is asked to do, so curator reads its state back after each change
rather than trusting the request.

## Now showing

The artwork on screen, and a switch for art mode. If an album is rotating on this TV, its card says
which album, how often it changes, and when the next piece is due.

## Library

The TV's art by category, as a grid of thumbnails or as a list. Open a piece to see it larger with its
categories, mattes, size and date; the arrow keys step through the rest and Esc closes it. From there
you can show it on the TV, change its matte, replace its image, add it to an album, or delete it.
Delete is offered only for your own uploads.

The TV only hands out thumbnails (384×216 on a 2025 Frame), never the full image, so that is what the
library shows.

## Upload

Drop a JPEG or PNG of up to 20 MB, or a WebP, AVIF, GIF or TIFF, which curator converts first. Pick a
matte for landscape and one for portrait, and optionally show it at once. curator keeps the original
on its `/data` volume.

A matte is a style (modern, shadowbox, panoramic and so on) and a colour. Not every matte fits every
picture's shape, and the TV refuses one that doesn't.

## Albums

An album is a named set of pieces on one TV, such as Halloween or Christmas. Add pieces from the
library, or drop new images onto the album to upload them straight into it.

Rotate an album and the TV cycles through it: every so many minutes, up to once a day, in order or
shuffled. Only one album rotates on a TV at a time.

## Backups

The TVs page downloads a zip of every TV, and each TV's menu one of just that TV. A backup holds the
originals curator uploaded, each piece's mattes and categories, the albums, and the rotation. It never
holds a pairing token.

Restoring one uploads the images to a TV, the same one or another, with their mattes, then rebuilds
the albums and the rotation. Restoring twice is harmless: curator recognises an image the TV already
has. A piece curator never uploaded, such as one from the Art Store, has no image in the backup, so
it comes back only on a TV that still has it.

## Status and logs

The status page shows the TV's address, model, power state and art API version. The logs page shows
curator's own log, newest first, which is where to look when a TV stops answering.
