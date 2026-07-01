import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    {
      name: 'dev-password',
      configureServer(server) {
        const password = process.env.DEV_PASSWORD;
        if (!password) return;
        server.middlewares.use((req, res, next) => {
          const auth = req.headers['authorization'];
          if (auth?.startsWith('Basic ')) {
            const decoded = Buffer.from(auth.slice(6), 'base64').toString();
            const colon = decoded.indexOf(':');
            if (colon !== -1 && decoded.slice(colon + 1) === password) {
              return next();
            }
          }
          res.statusCode = 401;
          res.setHeader('WWW-Authenticate', 'Basic realm="DeisBikes Dev"');
          res.end('Unauthorized');
        });
      }
    },
    react(),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API server not running. Start it with: npm run dev (from project root)' }));
          });
        }
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (_err, _req, res) => {
            res.writeHead(503, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'API server not running. Start it with: npm run dev (from project root)' }));
          });
        }
      }
    }
  }
});
