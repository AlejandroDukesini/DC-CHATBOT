// Adaptador Discord: traduce objetos de discord.js al formato neutral del núcleo
// y las respuestas neutrales del núcleo a mensajes de Discord.

import {
  ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonStyle, ChannelType, DiscordAPIError, EmbedBuilder, PermissionFlagsBits,
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { UserError, embed as neutralEmbed } from '@dc-chatbot/core';
import { renderBanner } from './banner.js';

const PERMISSIONS = ['Administrator', 'BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages', 'ManageGuild'];

export function toMember(gm) {
  return {
    id: gm.id,
    name: gm.user.username,
    displayName: gm.displayName,
    avatarUrl: gm.displayAvatarURL({ extension: 'png', size: 256 }),
    isBot: gm.user.bot,
    isOwner: gm.guild.ownerId === gm.id,
    highestRolePosition: gm.roles.highest.position,
    permissions: new Set(PERMISSIONS.filter((p) => gm.permissions.has(PermissionFlagsBits[p]))),
  };
}

const snowflake = (token, re) => re.exec(String(token).trim())?.[1] ?? null;

/** Convierte errores de permisos de Discord en mensajes comprensibles. */
function guard(fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof DiscordAPIError && [50001, 50013].includes(err.code)) {
        throw new UserError('Me faltan permisos en Discord para hacer eso. Revisa los permisos y la posición del rol del bot.');
      }
      throw err;
    }
  };
}

// Respuestas largas de IA para los botones "Ver completa" / "Copiar". Acotado en tamaño y tiempo.
const EXPANDABLE_TTL = 60 * 60 * 1000;
const expandables = new Map();
function remember(entry) {
  const key = randomUUID().slice(0, 12);
  expandables.set(key, { ...entry, expires: Date.now() + EXPANDABLE_TTL });
  for (const [k, v] of expandables) {
    if (expandables.size <= 500 && v.expires > Date.now()) break;
    expandables.delete(k);
  }
  return key;
}
export function recall(key) {
  const entry = expandables.get(key);
  if (!entry || entry.expires < Date.now()) return null;
  return entry;
}

function toEmbedBuilder(e, files) {
  const b = new EmbedBuilder().setColor(e.color);
  if (e.title) b.setTitle(e.title);
  if (e.description) b.setDescription(e.description);
  if (e.url) b.setURL(e.url);
  if (e.footer) b.setFooter({ text: e.footer });
  if (e.fields?.length) b.addFields(e.fields);
  if (e.image?.url) b.setImage(e.image.url);
  else if (e.image?.base64) {
    files.push(new AttachmentBuilder(Buffer.from(e.image.base64, 'base64'), { name: 'imagen.png' }));
    b.setImage('attachment://imagen.png');
  }
  return b;
}

/** Respuesta neutral → payload de discord.js. */
export async function toPayload(reply, { authorId } = {}) {
  const files = [];
  const embeds = (reply.embeds ?? []).map((e) => toEmbedBuilder(e, files));
  if (reply.banner) files.push(new AttachmentBuilder(await renderBanner(reply.banner), { name: 'banner.png' }));
  const components = [];
  if (reply.expandable && authorId) {
    const key = remember({ ...reply.expandable, authorId });
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`full:${key}`).setLabel('Ver respuesta completa').setEmoji('📖').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`copy:${key}`).setLabel('Copiar texto').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    ));
  }
  return {
    content: reply.content || undefined,
    embeds,
    files,
    components,
    // Nunca se notifican @everyone, @here ni roles aunque el texto los contenga.
    allowedMentions: { parse: ['users'], repliedUser: false },
  };
}

/** Embed con la respuesta completa, troceada en campos de 1024 caracteres. */
export function fullTextEmbed({ title, text }) {
  const chunks = text.match(/[\s\S]{1,1024}/g)?.slice(0, 25) ?? [];
  return toEmbedBuilder(neutralEmbed({ title, color: 0x00a8ff, fields: chunks.map((value, i) => ({ name: chunks.length > 1 ? `Parte ${i + 1}` : 'Respuesta', value })) }), []);
}

/** Contexto del núcleo para un comando ejecutado en `guild` por `member`. */
export function buildContext({ client, guild, member, channel, sourceMessage, deps }) {
  const { store, radio, ai, research, cooldowns, logger, prefix } = deps;

  const resolveMember = async (token) => {
    const id = snowflake(token, /^<@!?(\d+)>$/) ?? snowflake(token, /^(\d{15,22})$/);
    if (id) {
      const gm = await guild.members.fetch(id).catch(() => null);
      return gm ? toMember(gm) : null;
    }
    const name = String(token).replace(/^@/, '').toLowerCase();
    if (!name) return null;
    const found = guild.members.cache.find((m) => m.user.username.toLowerCase() === name || m.displayName.toLowerCase() === name)
      ?? (await guild.members.fetch({ query: name, limit: 1 }).catch(() => null))?.first();
    return found ? toMember(found) : null;
  };

  const resolveChannel = async (token) => {
    const id = snowflake(token, /^<#(\d+)>$/) ?? snowflake(token, /^(\d{15,22})$/);
    const name = String(token).replace(/^#/, '').toLowerCase();
    const ch = id ? guild.channels.cache.get(id) : guild.channels.cache.find((c) => c.name.toLowerCase() === name);
    return ch && [ChannelType.GuildText, ChannelType.GuildAnnouncement].includes(ch.type) ? { id: ch.id, name: ch.name } : null;
  };

  const resolveRole = async (token) => {
    const id = snowflake(token, /^<@&(\d+)>$/) ?? snowflake(token, /^(\d{15,22})$/);
    const name = String(token).replace(/^@/, '').toLowerCase();
    const role = id ? guild.roles.cache.get(id) : guild.roles.cache.find((r) => r.name.toLowerCase() === name);
    return role && !role.managed && role.id !== guild.id ? { id: role.id, name: role.name, position: role.position } : null;
  };

  return {
    platform: 'discord',
    prefix,
    guild: { id: guild.id, name: guild.name, memberCount: guild.memberCount, ownerId: guild.ownerId },
    channel: { id: channel.id, name: channel.name },
    author: toMember(member),
    bot: guild.members.me ? toMember(guild.members.me) : null,
    now: () => Date.now(),
    random: Math.random,
    latency: () => (client.ws.ping >= 0 ? client.ws.ping : null),
    cooldowns,
    store: store.forGuild(guild.id),
    logError: (err) => logger.error(`[${guild.id}]`, err),
    resolveMember,
    resolveChannel,
    resolveRole,
    research: (query) => research(query),
    ai,
    actions: {
      ban: guard((m, reason) => guild.members.ban(m.id, { reason: reason ?? undefined })),
      unban: guard(async (token, reason) => {
        const bans = await guild.bans.fetch();
        const id = snowflake(token, /^<?@?!?(\d{15,22})>?$/);
        const name = String(token).replace(/^@/, '').toLowerCase();
        const ban = id ? bans.get(id) : bans.find((b) => b.user.username.toLowerCase() === name);
        if (!ban) return null;
        await guild.bans.remove(ban.user.id, reason ?? undefined);
        return { id: ban.user.id, name: ban.user.username, displayName: ban.user.globalName ?? ban.user.username };
      }),
      kick: guard((m, reason) => guild.members.kick(m.id, reason ?? undefined)),
      timeout: guard(async (m, ms, reason) => (await guild.members.fetch(m.id)).timeout(ms, reason ?? undefined)),
      purge: guard(async (count) => {
        // Con prefijo también se borra el propio mensaje del comando.
        const extra = sourceMessage ? 1 : 0;
        const deleted = await channel.bulkDelete(Math.min(100, count + extra), true);
        return Math.max(0, deleted.size - extra);
      }),
      addRole: guard((m, roleId) => guild.members.addRole({ user: m.id, role: roleId, reason: 'Rol automático de bienvenida' })),
      sendToChannel: guard(async (channelId, reply) => {
        const target = guild.channels.cache.get(channelId);
        if (!target?.isTextBased()) throw new UserError('El canal configurado ya no existe. Actualízalo con `config`.');
        await target.send(await toPayload(reply));
      }),
      playRadio: (station) => radio.play(guild, member, station),
      stopRadio: async () => radio.stop(guild.id),
      nowPlaying: async () => radio.nowPlaying(guild.id),
    },
  };
}
