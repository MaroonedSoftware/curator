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
    tv: z.object({
        /** The Frame's address on the LAN. Give it a DHCP reservation. */
        host: z.string().min(1),
        /** 8002 is the TLS port modern Frames want. */
        port: port.default(8002),
        /** Shown on the TV's pairing prompt. */
        name: z.string().default('Curator'),
        /** Where the pairing token is kept, relative to apps/api. */
        tokenFile: z.string().default('.data/tv-token.txt'),
        /** Log every frame on the wire. Noisy; for chasing protocol trouble. */
        debug: z.stringbool().or(z.boolean()).default(false),
    }),
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
