import { defineConfig } from 'vitest/config';

// La configuración de la web (React + jsdom) vive en apps/web/vite.config.js.
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', include: ['packages/core/test/**/*.test.js'], environment: 'node' } },
      { test: { name: 'functions', include: ['netlify/**/*.test.js'], environment: 'node' } },
      // Requiere `npm run bot:install` (dependencias de discord.js y canvas).
      { test: { name: 'bot', include: ['apps/bot/test/**/*.test.js'], environment: 'node' } },
      'apps/web',
    ],
  },
});
