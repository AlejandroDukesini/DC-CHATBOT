// Reglas de moderación: quién puede sancionar a quién y registro de casos.
// La acción real (banear en Discord o en el servidor sandbox) la ejecuta el adaptador.

import { UserError } from './errors.js';
import { COLORS, embed, formatDuration } from './format.js';

export const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // límite de Discord
export const AUTO_TIMEOUT_MS = 60 * 60 * 1000;

const ACTION_LABELS = {
  ban: '🔨 Baneo',
  unban: '♻️ Desbaneo',
  kick: '👢 Expulsión',
  timeout: '🔇 Silencio',
  warn: '⚠️ Advertencia',
  purge: '🧹 Limpieza',
};

/**
 * Comprueba la jerarquía de roles igual que Discord:
 * nadie puede sancionarse a sí mismo, al dueño, ni a alguien con un rol igual o superior.
 */
export function assertCanModerate({ author, target, bot }) {
  if (!target) throw new UserError('No encontré a ese miembro en el servidor.');
  if (target.id === author.id) throw new UserError('No puedes aplicarte una sanción a ti mism@.');
  if (bot && target.id === bot.id) throw new UserError('No puedo moderarme a mí mismo.');
  if (target.isOwner) throw new UserError('No se puede sancionar al dueño del servidor.');
  if (!author.isOwner && target.highestRolePosition >= author.highestRolePosition) {
    throw new UserError(`**${target.displayName}** tiene un rol igual o superior al tuyo.`);
  }
  if (bot && target.highestRolePosition >= bot.highestRolePosition) {
    throw new UserError(`Mi rol está por debajo del de **${target.displayName}**. Sube el rol del bot en Ajustes del servidor → Roles.`);
  }
}

export function addCase(moderation, { type, target, moderator, reason, duration, now }) {
  const entry = {
    id: moderation.nextCase++,
    type,
    targetId: target.id,
    targetName: target.displayName ?? target.name,
    moderatorId: moderator.id,
    moderatorName: moderator.displayName ?? moderator.name,
    reason: reason || 'Sin motivo',
    at: now,
  };
  if (duration) entry.duration = duration;
  moderation.cases.push(entry);
  // Un registro acotado: suficiente para auditoría sin crecer sin límite.
  if (moderation.cases.length > 500) moderation.cases.splice(0, moderation.cases.length - 500);
  return entry;
}

export const activeWarnings = (moderation, userId) =>
  moderation.cases.filter((c) => c.type === 'warn' && c.targetId === userId && !c.cleared);

export function clearWarnings(moderation, userId) {
  const warns = activeWarnings(moderation, userId);
  for (const w of warns) w.cleared = true;
  return warns.length;
}

export function caseEmbed(entry) {
  return embed({
    title: `${ACTION_LABELS[entry.type] ?? entry.type} · Caso #${entry.id}`,
    color: entry.type === 'warn' ? COLORS.warning : COLORS.danger,
    fields: [
      { name: 'Miembro', value: `${entry.targetName} (<@${entry.targetId}>)`, inline: true },
      { name: 'Moderador', value: `<@${entry.moderatorId}>`, inline: true },
      entry.duration && { name: 'Duración', value: formatDuration(entry.duration), inline: true },
      { name: 'Motivo', value: entry.reason },
    ],
    footer: new Date(entry.at).toISOString().replace('T', ' ').slice(0, 16) + ' UTC',
  });
}
