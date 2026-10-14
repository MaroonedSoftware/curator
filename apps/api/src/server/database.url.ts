import type { AppConfig } from '@maroonedsoftware/appconfig';
import { parseApiConfig } from './api.config.js';

/**
 * The configured database (`database.*`) as a URL, for the tools that only read one: dbmate and
 * kysely-codegen. The URL setters percent-encode, so a password with `@` or `/` in it survives.
 */
export const databaseUrl = (config: AppConfig): string => {
    const { database } = parseApiConfig(config);
    const url = new URL('postgres://');
    url.hostname = database.host;
    url.port = String(database.port);
    url.username = database.user;
    url.password = database.password;
    url.pathname = `/${database.name}`;
    url.searchParams.set('sslmode', 'disable');
    return url.toString();
};
