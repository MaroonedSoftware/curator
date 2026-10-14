import type { ServerKitModule } from '@maroonedsoftware/fastify';
import { Logger } from '@maroonedsoftware/logger';
import { parseApiConfig } from '../../server/api.config.js';
import { FrameClientFactoryToken } from '../frame/frame.client.registry.js';
import { TvRepository } from '../tvs/tv.repository.js';
import { DiscoveryService } from './discovery.service.js';
import { ssdpSearch, SsdpSearchToken } from './ssdp.search.js';

/** SSDP discovery of Frame TVs. Registered after TvsModule, whose repository and client factory it uses. */
export const DiscoveryModule: ServerKitModule = {
    name: 'Discovery',
    setup: async (registry, config) => {
        const { discovery } = parseApiConfig(config);
        registry.register(SsdpSearchToken).useValue(ssdpSearch);
        registry
            .register(DiscoveryService)
            .useFactory(
                container =>
                    new DiscoveryService(
                        container.get(SsdpSearchToken),
                        container.get(FrameClientFactoryToken),
                        container.get(TvRepository),
                        discovery.timeoutMs,
                        discovery.identifyTimeoutMs,
                        container.get(Logger),
                    ),
            )
            .asSingleton();
    },
};
