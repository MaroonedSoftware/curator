import { Readable } from 'node:stream';
import { Zip, ZipDeflate, ZipPassThrough } from 'fflate';

export interface ZipEntry {
    name: string;
    data: Uint8Array;
    /** Deflate the entry. Leave it off for JPEGs and PNGs, which are compressed already. */
    compress?: boolean;
}

/**
 * A zip of `entries`, written as they arrive. Only one entry is held in memory at a time, and the
 * next is not read until the reader has taken the last, so a large backup streams in step with the
 * client downloading it.
 */
export function zipStream(entries: AsyncIterable<ZipEntry>, mtime = new Date()): Readable {
    async function* chunks(): AsyncGenerator<Uint8Array> {
        const ready: Uint8Array[] = [];
        let failure: Error | undefined;
        const zip = new Zip((error, chunk) => {
            if (error) failure = error;
            else ready.push(chunk);
        });
        for await (const { name, data, compress } of entries) {
            const file = compress ? new ZipDeflate(name, { level: 6 }) : new ZipPassThrough(name);
            file.mtime = mtime;
            zip.add(file);
            file.push(data, true);
            if (failure) throw failure;
            yield* ready.splice(0);
        }
        zip.end();
        if (failure) throw failure;
        yield* ready.splice(0);
    }
    return Readable.from(chunks(), { objectMode: false });
}
