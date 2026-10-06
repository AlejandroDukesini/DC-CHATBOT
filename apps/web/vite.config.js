import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { createResearchHandler } from '@dc-chatbot/core';

// En desarrollo, /api/research lo atiende el mismo manejador que la Netlify Function.
function researchApi() {
  const handle = createResearchHandler();
  return {
    name: 'dc-chatbot-research-api',
    configureServer(server) {
      server.middlewares.use('/api/research', async (req, res) => {
        const query = new URL(req.url, 'http://localhost').searchParams.get('q') ?? '';
        const { status, body } = await handle({ query, ip: req.socket.remoteAddress });
        res.statusCode = status;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(body));
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), researchApi()],
  test: {
    name: 'web',
    include: ['test/**/*.test.{js,jsx}'],
    environment: 'jsdom',
    setupFiles: ['test/setup.js'],
  },
});
