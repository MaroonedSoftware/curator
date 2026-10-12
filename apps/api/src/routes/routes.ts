import type { ServerKitRoutes } from '@maroonedsoftware/fastify';
import { HealthRoutes } from './health.routes.js';
import { TvsRoutes } from './tvs.routes.js';

/** Every route plugin, in registration order. */
export const routes: ServerKitRoutes[] = [HealthRoutes, TvsRoutes];
