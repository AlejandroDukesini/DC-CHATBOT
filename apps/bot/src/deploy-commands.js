// Registra los slash commands en Discord a partir del registro compartido de comandos.
// Con DISCORD_GUILD_ID se registran en ese servidor (instantáneo); sin él, globalmente (hasta 1 h).

import { REST, Routes } from 'discord.js';
import { toSlashCommands } from '@dc-chatbot/core';
import { env } from './env.js';

if (!env.token || !env.clientId) {
  console.error('❌ Faltan DISCORD_TOKEN y/o DISCORD_CLIENT_ID en .env');
  process.exit(1);
}

const body = toSlashCommands();
const rest = new REST().setToken(env.token);
const route = env.guildId ? Routes.applicationGuildCommands(env.clientId, env.guildId) : Routes.applicationCommands(env.clientId);

try {
  await rest.put(route, { body });
  console.log(`✅ ${body.length} slash commands registrados ${env.guildId ? `en el servidor ${env.guildId}` : 'globalmente (pueden tardar hasta 1 hora en aparecer)'}.`);
} catch (err) {
  console.error('❌ No se pudieron registrar los comandos:', err.message);
  process.exit(1);
}
