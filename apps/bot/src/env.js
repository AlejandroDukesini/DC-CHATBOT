// Carga .env desde la raíz del repositorio (o desde apps/bot/.env si existe).
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

config({
  path: [fileURLToPath(new URL('../.env', import.meta.url)), fileURLToPath(new URL('../../../.env', import.meta.url))],
  quiet: true,
});

export const env = {
  token: process.env.DISCORD_TOKEN?.trim(),
  clientId: process.env.DISCORD_CLIENT_ID?.trim(),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
  contactEmail: process.env.RESEARCH_CONTACT_EMAIL?.trim() || undefined,
  dataDir: process.env.BOT_DATA_DIR?.trim() || fileURLToPath(new URL('../data', import.meta.url)),
};
