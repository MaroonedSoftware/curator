import { execSync } from 'node:child_process';
import { connectionString, createAdminPool, TEMPLATE_DATABASE } from './test.db.js';

/**
 * Builds the template database from scratch once per run; each test file clones its own from it.
 * Rebuilt rather than migrated forward, because dbmate skips a migration it has already applied, so
 * a migration edited in place would otherwise leave the suite on the old schema.
 */
export const setup = async () => {
    const admin = createAdminPool();
    try {
        await admin.query(`alter database ${TEMPLATE_DATABASE} is_template false`).catch(() => undefined);
        await admin.query(`drop database if exists ${TEMPLATE_DATABASE} with (force)`);
        await admin.query(`create database ${TEMPLATE_DATABASE}`);
        execSync('pnpm exec dbmate -d ./data/migrations --no-dump-schema up', {
            env: { ...process.env, DATABASE_URL: connectionString(TEMPLATE_DATABASE) },
            stdio: 'pipe',
        });
        await admin.query(`alter database ${TEMPLATE_DATABASE} is_template true`);
    } catch (error) {
        throw new Error(`Could not prepare the test database. Is it running? Start it with \`pnpm db:up\` at the repo root.\n${String(error)}`);
    } finally {
        await admin.end();
    }
};

/** Sweeps per-test databases a crashed or interrupted worker left behind. */
export const teardown = async () => {
    const admin = createAdminPool();
    try {
        const { rows } = await admin.query<{ datname: string }>(`select datname from pg_database where datname like $1 escape '\\'`, [
            '%.test.ts\\_%',
        ]);
        for (const { datname } of rows) {
            await admin.query(`drop database if exists "${datname}" with (force)`);
        }
    } finally {
        await admin.end();
    }
};
