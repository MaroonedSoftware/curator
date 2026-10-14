import type { AppConfig } from '@maroonedsoftware/appconfig';
import { z } from 'zod';

/** `${env:NAME}` substitutions arrive as strings, so numbers and booleans accept either form. */
const port = (fallback: number) =>
    z.preprocess(
        // An unset variable substitutes as '', which would coerce to port 0: take it as "not set" instead.
        value => (value === '' || value === undefined ? fallback : value),
        z.coerce.number().int().min(0).max(65535),
    );

/** The resolver JSON-parses what it substitutes, so a password of `1234` arrives as a number. */
const text = z.coerce.string();

const ApiConfigSchema = z.object({
    server: z.object({
        port: port(14100),
        /** Comma-separated browser origins allowed by CORS. Empty allows none. */
        corsOrigins: z.string().default(''),
        /**
         * Path every API route is mounted under, such as `/api` when the API also serves the web app
         * from the same origin. Empty mounts them at the root, which is what the web dev server's
         * proxy expects: it strips `/api` before forwarding.
         */
        routePrefix: z
            .string()
            .regex(/^(\/[A-Za-z0-9._~-]+)*$/, 'must be empty, or start with / and not end with one')
            .default(''),
    }),
    web: z
        .object({
            /**
             * The web app's build (`apps/web/dist`), served from the same origin as the API. Unset
             * serves nothing, which is right whenever the web dev server is in front. Relative to apps/api.
             */
            dir: z.string().min(1).optional(),
        })
        .prefault({}),
    database: z.object({
        host: z.string().min(1),
        port: port(5432),
        user: text.pipe(z.string().min(1)),
        password: text,
        name: text.pipe(z.string().min(1)),
        pool: z
            .object({
                max: z.coerce.number().int().positive().default(5),
                connectionTimeoutMs: z.coerce.number().int().positive().default(10_000),
            })
            .prefault({}),
    }),
    frame: z
        .object({
            /** Shown on a TV's pairing prompt. */
            clientName: z.string().min(1).default('Curator'),
            /** Log every frame on the wire, for every TV. Noisy; for chasing protocol trouble. */
            debug: z.stringbool().or(z.boolean()).default(false),
            /** Memory for thumbnails across every TV. A thumbnail is tens of kilobytes. */
            thumbnailCacheMegabytes: z.coerce.number().int().min(1).max(4096).default(64),
            /** Where uploaded images are kept, since the TV can't give them back. Relative to apps/api. */
            originalsDir: z.string().min(1).default('.data/originals'),
        })
        .prefault({}),
    rotation: z
        .object({
            /** How often to look for a TV whose next album piece is due. Well under the shortest interval (1 minute), or a TV due just after a tick waits a whole extra tick. */
            tickSeconds: z.coerce.number().int().min(1).max(3600).default(25),
            /** How long to leave a TV that failed to advance (off, say) before trying it again. */
            retrySeconds: z.coerce.number().int().min(1).max(86_400).default(300),
        })
        .prefault({}),
    discovery: z
        .object({
            /** How long `GET /tvs/discover` listens for TVs to answer. */
            timeoutMs: z.coerce.number().int().min(500).max(15_000).default(3000),
            /** How long to wait for each TV that answered to say what it is. */
            identifyTimeoutMs: z.coerce.number().int().min(500).max(15_000).default(3000),
        })
        .prefault({}),
    log: z
        .object({
            /** Where `api.log` and its rotated segments are kept. Relative to apps/api. */
            dir: z.string().min(1).default('.data/logs'),
            /** Rotate the log once it reaches this many bytes. */
            maxBytes: z.coerce
                .number()
                .int()
                .min(1024)
                .default(2 * 1024 * 1024),
            /** Rotated files kept besides the active one, so the log never takes more than (maxFiles + 1) × maxBytes. */
            maxFiles: z.coerce.number().int().min(1).max(100).default(3),
            /** Longest one logged value may be, in characters, before it is cut short. */
            maxValueChars: z.coerce.number().int().min(16).default(512),
            /** Longest one line may be, in bytes, before it is cut short. */
            maxLineBytes: z.coerce
                .number()
                .int()
                .min(256)
                .max(65_536)
                .default(8 * 1024),
        })
        .prefault({}),
});

export type ApiConfig = z.infer<typeof ApiConfigSchema>;

/** Validates the loaded config once at boot, so a bad value fails with its key named rather than mid-request. */
export const parseApiConfig = (config: AppConfig): ApiConfig => {
    const result = ApiConfigSchema.safeParse(config.toObject());
    if (!result.success) {
        throw new Error(`Invalid config:\n${z.prettifyError(result.error)}`);
    }
    return result.data;
};
