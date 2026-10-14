import type { AppConfigResolver } from '@maroonedsoftware/appconfig';

type ResolverMeta = Parameters<AppConfigResolver['resolve']>[1];

const ENV_REFERENCE = /\$\{env:([^}]+)\}/g;

/**
 * Fills `${env:NAME}` from the process environment as text, exactly as it was set. An unset variable
 * fills in as ''.
 *
 * In place of appconfig's own `AppConfigResolverEnv`, which JSON-parses what it substitutes (so a
 * password of `1.50` arrives as the number 1.5, and a long run of digits loses precision) and splices
 * the value in as a `replaceAll` pattern (so `$&` or `$$` in a password is rewritten). The schema in
 * api.config.ts coerces every number and boolean it reads, so nothing needs the parse.
 */
export class EnvTextResolver implements AppConfigResolver {
    constructor(private readonly environment: NodeJS.ProcessEnv = process.env) {}

    canResolve(value: string): boolean {
        ENV_REFERENCE.lastIndex = 0;
        return ENV_REFERENCE.test(value);
    }

    async resolve(value: string, meta: ResolverMeta): Promise<void> {
        const resolved = value.replace(ENV_REFERENCE, (_reference, name: string) => this.environment[name] ?? '');
        if (meta.arrayIndex !== undefined && Array.isArray(meta.owner)) {
            meta.owner[meta.arrayIndex] = resolved;
        } else {
            (meta.owner as Record<string, unknown>)[meta.propertyPath] = resolved;
        }
    }
}
