import { loadConfig } from './server/load.config.js';
import { startServer } from './server/setup.server.js';

await startServer(await loadConfig());
