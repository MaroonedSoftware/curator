/**
 * Runs a command with DATABASE_URL set from the app config (`database.*`), for the tools that only
 * read a URL: dbmate and kysely-codegen. A DATABASE_URL already in the environment wins, so the
 * test setup can point these tools wherever it needs.
 *
 *   node … scripts/with.database.url.ts dbmate -d ./data/migrations up
 */
import { spawnSync } from 'node:child_process';
import { databaseUrl } from '../src/server/database.url.js';
import { loadConfig } from '../src/server/load.config.js';

const [command, ...args] = process.argv.slice(2);
if (!command) {
    console.error('usage: with.database.url.ts <command> [args...]');
    process.exit(2);
}

if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = databaseUrl(await loadConfig());
}

const result = spawnSync(command, args, { stdio: 'inherit', env: process.env });
process.exit(result.status ?? 1);
