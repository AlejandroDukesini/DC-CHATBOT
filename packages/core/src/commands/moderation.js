import { UserError } from '../errors.js';
import { COLORS, formatDuration, parseDuration, reply } from '../format.js';
import {
  AUTO_TIMEOUT_MS, MAX_TIMEOUT_MS, activeWarnings, addCase, assertCanModerate, caseEmbed, clearWarnings,
} from '../moderation.js';

const reasonOption = { name: 'motivo', type: 'text', description: 'Motivo (queda en el registro)' };
const targetOption = { name: 'usuario', type: 'user', description: 'Miembro', required: true };

/** Registra el caso, lo publica en el canal de logs (si existe) y devuelve la respuesta. */
async function record(ctx, data, entryData) {
  const entry = addCase(data.moderation, { ...entryData, moderator: ctx.author, now: ctx.now() });
  const logged = { embeds: [caseEmbed(entry)] };
  if (data.config.logChannel && data.config.logChannel !== ctx.channel.id) {
    await ctx.actions.sendToChannel(data.config.logChannel, logged).catch((err) => ctx.logError(err));
  }
  return { entry, reply: logged };
}

export default [
  {
    name: 'ban',
    aliases: ['banear'],
    category: 'moderacion',
    description: 'Banea a un miembro del servidor.',
    permission: 'BanMembers',
    options: [targetOption, reasonOption],
    examples: ['ban @Troll_404 spam reiterado'],
    data: 'write',
    async run(ctx, args, data) {
      assertCanModerate({ author: ctx.author, target: args.usuario, bot: ctx.bot });
      await ctx.actions.ban(args.usuario, args.motivo);
      return (await record(ctx, data, { type: 'ban', target: args.usuario, reason: args.motivo })).reply;
    },
  },
  {
    name: 'unban',
    aliases: ['desbanear'],
    category: 'moderacion',
    description: 'Retira el baneo de un usuario (por ID o nombre).',
    permission: 'BanMembers',
    options: [{ name: 'usuario', type: 'string', description: 'ID o nombre del usuario baneado', required: true }, reasonOption],
    examples: ['unban Troll_404'],
    data: 'write',
    async run(ctx, args, data) {
      const user = await ctx.actions.unban(args.usuario, args.motivo);
      if (!user) throw new UserError('Ese usuario no está en la lista de baneos.');
      return (await record(ctx, data, { type: 'unban', target: user, reason: args.motivo })).reply;
    },
  },
  {
    name: 'kick',
    aliases: ['expulsar'],
    category: 'moderacion',
    description: 'Expulsa a un miembro (puede volver con una invitación).',
    permission: 'KickMembers',
    options: [targetOption, reasonOption],
    examples: ['kick @Bytes flood en #general'],
    data: 'write',
    async run(ctx, args, data) {
      assertCanModerate({ author: ctx.author, target: args.usuario, bot: ctx.bot });
      await ctx.actions.kick(args.usuario, args.motivo);
      return (await record(ctx, data, { type: 'kick', target: args.usuario, reason: args.motivo })).reply;
    },
  },
  {
    name: 'silenciar',
    aliases: ['timeout', 'mute'],
    category: 'moderacion',
    description: 'Aísla temporalmente a un miembro (no puede escribir ni hablar). Duración: 30s, 10m, 2h, 1d…',
    permission: 'ModerateMembers',
    options: [targetOption, { name: 'duracion', type: 'string', description: 'Ej.: 10m, 1h, 1d', required: true }, reasonOption],
    examples: ['silenciar @Troll_404 10m lenguaje ofensivo'],
    data: 'write',
    async run(ctx, args, data) {
      const ms = parseDuration(args.duracion);
      if (!ms) throw new UserError('Duración no válida. Usa un número seguido de s, m, h o d (por ejemplo `10m`).');
      if (ms > MAX_TIMEOUT_MS) throw new UserError('Discord permite como máximo 28 días.');
      assertCanModerate({ author: ctx.author, target: args.usuario, bot: ctx.bot });
      await ctx.actions.timeout(args.usuario, ms, args.motivo);
      return (await record(ctx, data, { type: 'timeout', target: args.usuario, reason: args.motivo, duration: ms })).reply;
    },
  },
  {
    name: 'advertir',
    aliases: ['warn'],
    category: 'moderacion',
    description: 'Registra una advertencia. Al llegar al límite configurado se silencia 1 h automáticamente.',
    permission: 'ModerateMembers',
    options: [targetOption, reasonOption],
    examples: ['advertir @Bytes evita el spam'],
    data: 'write',
    async run(ctx, args, data) {
      assertCanModerate({ author: ctx.author, target: args.usuario, bot: ctx.bot });
      const { reply: out } = await record(ctx, data, { type: 'warn', target: args.usuario, reason: args.motivo });
      const count = activeWarnings(data.moderation, args.usuario.id).length;
      const limit = data.config.warnLimit;
      out.content = `⚠️ ${args.usuario.displayName} tiene **${count}** advertencia(s)${limit ? ` de ${limit}` : ''}.`;
      if (limit && count >= limit) {
        await ctx.actions.timeout(args.usuario, AUTO_TIMEOUT_MS, `Límite de ${limit} advertencias`);
        const auto = await record(ctx, data, {
          type: 'timeout', target: args.usuario, reason: `Automático: alcanzó ${limit} advertencias`, duration: AUTO_TIMEOUT_MS,
        });
        clearWarnings(data.moderation, args.usuario.id);
        out.embeds.push(...auto.reply.embeds);
        out.content += ` Se aplicó un silencio automático de ${formatDuration(AUTO_TIMEOUT_MS)} y se reiniciaron sus advertencias.`;
      }
      return out;
    },
  },
  {
    name: 'advertencias',
    aliases: ['warnings', 'warns'],
    category: 'moderacion',
    description: 'Lista las advertencias activas de un miembro.',
    permission: 'ModerateMembers',
    options: [targetOption],
    examples: ['advertencias @Troll_404'],
    data: 'read',
    run(ctx, args, data) {
      const warns = activeWarnings(data.moderation, args.usuario.id);
      return reply({
        title: `⚠️ Advertencias de ${args.usuario.displayName}`,
        color: COLORS.warning,
        description: warns.length
          ? warns.map((w) => `**#${w.id}** · ${w.reason} — <@${w.moderatorId}>`).join('\n')
          : 'Sin advertencias activas.',
        footer: data.config.warnLimit ? `Límite configurado: ${data.config.warnLimit}` : 'Sin límite automático',
      });
    },
  },
  {
    name: 'perdonar',
    aliases: ['clearwarns', 'limpiar-advertencias'],
    category: 'moderacion',
    description: 'Borra las advertencias activas de un miembro.',
    permission: 'ModerateMembers',
    options: [targetOption],
    examples: ['perdonar @Bytes'],
    data: 'write',
    run(ctx, args, data) {
      const n = clearWarnings(data.moderation, args.usuario.id);
      return reply({ title: '🕊️ Advertencias retiradas', description: `Se retiraron ${n} advertencia(s) de ${args.usuario.displayName}.`, color: COLORS.success });
    },
  },
  {
    name: 'purgar',
    aliases: ['purge', 'clear'],
    category: 'moderacion',
    description: 'Borra los últimos mensajes del canal (1-100).',
    permission: 'ManageMessages',
    options: [{ name: 'cantidad', type: 'integer', description: 'Mensajes a borrar', required: true, min: 1, max: 100 }],
    examples: ['purgar 10'],
    async run(ctx, args) {
      const deleted = await ctx.actions.purge(args.cantidad);
      return { ...reply({ title: '🧹 Canal limpio', description: `Se borraron ${deleted} mensaje(s).`, color: COLORS.success }), ephemeral: true };
    },
  },
  {
    name: 'casos',
    aliases: ['modlog'],
    category: 'moderacion',
    description: 'Muestra las últimas 10 acciones de moderación.',
    permission: 'ModerateMembers',
    examples: ['casos'],
    data: 'read',
    run(ctx, args, data) {
      const cases = data.moderation.cases.slice(-10).reverse();
      const icon = { ban: '🔨', unban: '♻️', kick: '👢', timeout: '🔇', warn: '⚠️' };
      return reply({
        title: '📋 Registro de moderación',
        color: COLORS.primary,
        description: cases.length
          ? cases.map((c) => `${icon[c.type] ?? '•'} **#${c.id}** ${c.targetName} — ${c.reason}${c.cleared ? ' *(retirada)*' : ''}`).join('\n')
          : 'Todavía no hay casos.',
      });
    },
  },
];
