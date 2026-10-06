// Punto de entrada del bot: conecta discord.js con el motor de @dc-chatbot/core.

import { Client, Events, GatewayIntentBits, MessageFlags, OAuth2Scopes, PermissionFlagsBits } from 'discord.js';
import {
  executeCommand, findCommand, handleMemberJoin, normalizeGuildData, parseInvocation, research, splitArgs, toSlashCommands,
} from '@dc-chatbot/core';
import { env } from './env.js';
import { logger } from './logger.js';
import { JsonGuildStore } from './store.js';
import { RadioManager } from './radio.js';
import { createAiProviders } from './ai.js';
import { buildContext, fullTextEmbed, recall, toMember, toPayload } from './adapter.js';

if (!env.token) {
  logger.error('Falta DISCORD_TOKEN. Copia .env.example a .env y añade el token de tu bot.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent, // privilegiado: comandos con prefijo
    GatewayIntentBits.GuildMembers, // privilegiado: bienvenidas y búsqueda de miembros
    GatewayIntentBits.GuildVoiceStates, // radio
  ],
});

// Permisos mínimos para todas las funciones (moderación, roles, banners, voz).
const INVITE_PERMISSIONS = [
  'ViewChannel', 'SendMessages', 'EmbedLinks', 'AttachFiles', 'ReadMessageHistory', 'ManageMessages',
  'KickMembers', 'BanMembers', 'ModerateMembers', 'ManageRoles', 'Connect', 'Speak',
].map((p) => PermissionFlagsBits[p]);

const store = new JsonGuildStore(env.dataDir);
const deps = {
  store,
  radio: new RadioManager(logger),
  ai: createAiProviders(process.env),
  research: (query) => research(query, { contactEmail: env.contactEmail }),
  cooldowns: new Map(),
  logger,
};

const guildConfig = async (guildId) => normalizeGuildData(await store.read(guildId)).config;

/** Ejecuta un comando; si modifica datos, en exclusiva para ese servidor. */
function execute(def, rawArgs, ctx) {
  const run = () => executeCommand(def, rawArgs, ctx);
  return def.data === 'write' ? store.withLock(ctx.guild.id, run) : run();
}

client.once(Events.ClientReady, (c) => {
  logger.info(`✅ Conectado como ${c.user.tag} en ${c.guilds.cache.size} servidor(es) · ${toSlashCommands().length} comandos`);
  const ai = deps.ai.configured();
  logger.info(`🤖 IA de terceros: ${ai.length ? ai.join(', ') : 'ninguna (opcional)'} · 🔎 investigador: activo`);
  logger.info(`🔗 Invitación: ${c.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions: INVITE_PERMISSIONS })}`);
});

// Comandos con prefijo (&ayuda, &ban…)
client.on(Events.MessageCreate, async (message) => {
  if (!message.inGuild() || message.author.bot || !message.member) return;
  try {
    const { prefix } = await guildConfig(message.guildId);
    const parsed = parseInvocation(message.content, prefix);
    const def = parsed && findCommand(parsed.name);
    if (!def) return;

    if (def.slow) await message.channel.sendTyping().catch(() => {});
    const ctx = buildContext({ client, guild: message.guild, member: message.member, channel: message.channel, sourceMessage: message, deps: { ...deps, prefix } });
    const reply = await execute(def, splitArgs(def.options, parsed.rest), ctx);
    const sent = await message.reply({ ...(await toPayload(reply, { authorId: message.author.id })), failIfNotExists: false });
    // Los mensajes de error "efímeros" no existen con prefijo: se borran solos.
    if (reply.ephemeral) setTimeout(() => sent.delete().catch(() => {}), 15_000);
  } catch (err) {
    logger.error('[messageCreate]', err);
  }
});

// Slash commands y botones
client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton()) return await handleButton(interaction);
    if (!interaction.isChatInputCommand() || !interaction.inCachedGuild()) return;

    const def = findCommand(interaction.commandName);
    if (!def) return;
    const rawArgs = {};
    for (const opt of def.options ?? []) {
      if (opt.type === 'user') {
        const member = interaction.options.getMember(opt.name);
        if (member) rawArgs[opt.name] = toMember(member);
      } else if (opt.type === 'integer') {
        rawArgs[opt.name] = interaction.options.getInteger(opt.name) ?? undefined;
      } else {
        rawArgs[opt.name] = interaction.options.getString(opt.name) ?? undefined;
      }
    }

    if (def.slow) await interaction.deferReply();
    const { prefix } = await guildConfig(interaction.guildId);
    const ctx = buildContext({ client, guild: interaction.guild, member: interaction.member, channel: interaction.channel, deps: { ...deps, prefix } });
    const reply = await execute(def, rawArgs, ctx);
    const payload = await toPayload(reply, { authorId: interaction.user.id });
    if (interaction.deferred) await interaction.editReply(payload);
    else await interaction.reply({ ...payload, flags: reply.ephemeral ? MessageFlags.Ephemeral : undefined });
  } catch (err) {
    logger.error('[interactionCreate]', err);
    const msg = { content: '❌ Ocurrió un error inesperado.', flags: MessageFlags.Ephemeral };
    if (interaction.isRepliable()) await (interaction.deferred || interaction.replied ? interaction.followUp(msg) : interaction.reply(msg)).catch(() => {});
  }
});

async function handleButton(interaction) {
  const [action, key] = interaction.customId.split(':');
  const entry = recall(key);
  if (!entry) return interaction.reply({ content: 'Esta respuesta ya no está disponible.', flags: MessageFlags.Ephemeral });
  if (interaction.user.id !== entry.authorId) {
    return interaction.reply({ content: 'Solo quien hizo la pregunta puede usar estos botones.', flags: MessageFlags.Ephemeral });
  }
  if (action === 'full') return interaction.reply({ embeds: [fullTextEmbed(entry)], flags: MessageFlags.Ephemeral });
  // Discord limita los mensajes a 2000 caracteres: el texto se envía en bloques.
  const chunks = entry.text.match(/[\s\S]{1,1900}/g) ?? [''];
  await interaction.reply({ content: `\`\`\`\n${chunks[0]}\n\`\`\``, flags: MessageFlags.Ephemeral });
  for (const chunk of chunks.slice(1, 5)) await interaction.followUp({ content: `\`\`\`\n${chunk}\n\`\`\``, flags: MessageFlags.Ephemeral });
}

// Bienvenidas: banner + rol automático
client.on(Events.GuildMemberAdd, async (member) => {
  if (member.user.bot) return;
  try {
    const { guild } = member;
    const ctx = buildContext({ client, guild, member: guild.members.me, channel: guild.systemChannel ?? { id: null, name: null }, deps: { ...deps, prefix: '&' } });
    await handleMemberJoin(ctx, toMember(member), normalizeGuildData(await store.read(guild.id)));
  } catch (err) {
    logger.error('[guildMemberAdd]', err);
  }
});

function shutdown() {
  logger.info('Apagando…');
  deps.radio.stopAll();
  client.destroy().finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (err) => logger.error('[unhandledRejection]', err));

client.login(env.token).catch((err) => {
  logger.error('No se pudo iniciar sesión en Discord. ¿El token es correcto y los intents privilegiados están activados?', err.message);
  process.exit(1);
});
