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
