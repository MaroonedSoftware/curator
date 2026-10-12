import { AppConfigBuilder, AppConfigResolverEnv, type AppConfig } from '@maroonedsoftware/appconfig';
import { AppConfigSourceYaml } from '@maroonedsoftware/appconfig/yaml';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** apps/api, whether this runs from src/server or dist/server. */
export const API_ROOT = fileURLToPath(new URL('../../', import.meta.url));

/** NODE_ENV names a file, so only a plain lowercase word is accepted. */
const ENVIRONMENT_NAME = /^[a-z][a-z0-9]*$/;

/**
 * Config comes from YAML files in apps/api, later files winning key by key:
 *
 * - `appconfig.${NODE_ENV}.yaml`, committed. NODE_ENV defaults to `development`.
 * - `appconfig.local.yaml`, gitignored and optional, for per-machine overrides such as the TV's address.
 *
 * Any string value may be `${env:NAME}`, filled from the process environment.
 */
export const loadConfig = async (): Promise<AppConfig> => {
    const environment = process.env.NODE_ENV ?? 'development';
    if (!ENVIRONMENT_NAME.test(environment)) {
        throw new Error(`NODE_ENV must name a config environment (got ${environment})`);
    }
    const environmentFile = `${API_ROOT}appconfig.${environment}.yaml`;
    if (!existsSync(environmentFile)) {
        throw new Error(`NODE_ENV=${environment} has no config file: expected ${environmentFile}`);
    }
    return await new AppConfigBuilder()
        .addSource(new AppConfigSourceYaml(environmentFile, { ignoreMissingFile: false }))
        .addSource(new AppConfigSourceYaml(`${API_ROOT}appconfig.local.yaml`))
        .addResolver(new AppConfigResolverEnv())
        .buildSnapshot();
};
