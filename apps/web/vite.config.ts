import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { tanstackRouter } from '@tanstack/router-plugin/vite';

// The dev API: server.port in apps/api/appconfig.development.yaml. 127.0.0.1 rather than localhost, which can resolve to ::1.
const API_TARGET = 'http://127.0.0.1:14100';

export default defineConfig({
    plugins: [
        // Must precede react() so the generated route tree is in place before JSX transforms.
        tanstackRouter({ target: 'react', autoCodeSplitting: true }),
        react(),
    ],
    server: {
        // server.corsOrigins in apps/api/appconfig.development.yaml names this origin.
        port: 14102,
        strictPort: true,
        proxy: {
            // The API mounts its routes at the root, so the /api prefix is stripped. Proxying keeps
            // the API same-origin, so the browser never needs CORS in development.
            '/api': {
                target: API_TARGET,
                changeOrigin: true,
                rewrite: path => path.replace(/^\/api/, ''),
            },
        },
    },
});
