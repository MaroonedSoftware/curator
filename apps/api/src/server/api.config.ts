import type { AppConfig } from '@maroonedsoftware/appconfig';
import { z } from 'zod';

/** `${env:NAME}` substitutions arrive as strings, so numbers and booleans accept either form. */
const port = z.coerce.number().int().min(0).max(65535);

const ApiConfigSchema = z.object({
    server: z.object({
        port: port.default(14100),
        /** Comma-separated browser origins allowed by CORS. Empty allows none. */
        corsOrigins: z.string().default(''),
    }),
    database: z.object({
        host: z.string().min(1),
        port: port.default(5432),
        user: z.string().min(1),
        password: z.string(),
        name: z.string().min(1),
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
            /** How often to look for a TV whose next album piece is due. */
            tickSeconds: z.coerce.number().int().min(1).max(3600).default(60),
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
