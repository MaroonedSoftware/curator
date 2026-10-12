/**
 * Runs a command with DATABASE_URL set from the app config (`database.*`), for the tools that only
 * read a URL: dbmate and kysely-codegen. A DATABASE_URL already in the environment wins, so the
 * test setup can point these tools wherever it needs.
 *
 *   node … scripts/with.database.url.ts dbmate -d ./data/migrations up
 */
import { spawnSync } from 'node:child_process';
import { AppConfig } from '@maroonedsoftware/appconfig';
import { loadConfig } from '../src/server/load.config.js';

const [command, ...args] = process.argv.slice(2);
if (!command) {
    console.error('usage: with.database.url.ts <command> [args...]');
    process.exit(2);
}

if (!process.env.DATABASE_URL) {
    const config: AppConfig = await loadConfig();
    const database = config.toObject().database as { host: string; port?: number | string; user: string; password: string; name: string };
    const url = new URL('postgres://');
    url.hostname = database.host;
    url.port = String(database.port ?? 5432);
    url.username = database.user;
    url.password = database.password;
    url.pathname = `/${database.name}`;
    url.searchParams.set('sslmode', 'disable');
    process.env.DATABASE_URL = url.toString();
}

const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
