/**
 * Applies data/migrations to the configured database with dbmate, then exits with dbmate's status.
 * The compiled twin of `pnpm migrate:up`, for where there is no TypeScript loader and no dev
 * dependencies: the Docker image runs it before starting the server. dbmate must be on PATH.
 */
import { spawnSync } from 'node:child_process';
import { databaseUrl } from './server/database.url.js';
import { API_ROOT, loadConfig } from './server/load.config.js';

const result = spawnSync('dbmate', ['--no-dump-schema', '-d', `${API_ROOT}data/migrations`, 'up'], {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: databaseUrl(await loadConfig()) },
});
if (result.error) {
    console.error(`Could not run dbmate: ${result.error.message}`);
}
process.exit(result.status ?? 1);
