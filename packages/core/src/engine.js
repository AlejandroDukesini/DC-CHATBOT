// Motor de comandos: interpreta el texto (o los argumentos de un slash command),
// valida permisos, cooldowns y argumentos, ejecuta el comando y persiste los datos.
// Es la única puerta de entrada que usan tanto el bot como la demo web.

import { UserError, isUserError } from './errors.js';
import { errorReply } from './format.js';
import { normalizeGuildData } from './guild-data.js';
import { COMMANDS, PERMISSION_LABELS, findCommand, usage } from './commands/index.js';

/** Separa "&ban @Troll spam" en { name: 'ban', rest: '@Troll spam' }. */
export function parseInvocation(input, prefix) {
  const text = String(input ?? '').trim();
  if (!text.startsWith(prefix)) return null;
  const body = text.slice(prefix.length).trimStart();
  const match = /^(\S+)\s*([\s\S]*)$/.exec(body);
  if (!match) return null;
  return { name: match[1].toLowerCase(), rest: match[2].trim() };
}

/** Convierte el resto del mensaje en valores en bruto según las opciones del comando. */
export function splitArgs(options = [], rest) {
  const raw = {};
  let remaining = rest;
  for (const opt of options) {
    remaining = remaining.trimStart();
    if (!remaining) break;
    if (opt.type === 'text') {
      raw[opt.name] = remaining;
      break;
    }
    const m = /^"([^"]*)"|^(\S+)/.exec(remaining);
    raw[opt.name] = m[1] ?? m[2];
    remaining = remaining.slice(m[0].length);
  }
  return raw;
}

async function coerce(opt, value, ctx) {
  switch (opt.type) {
    case 'user': {
      if (typeof value === 'object') return value;
      const member = await ctx.resolveMember(value);
      if (!member) throw new UserError(`No encontré al miembro «${value}».`);
      return member;
    }
    case 'integer': {
      const n = typeof value === 'number' ? value : Number(String(value).replace(/[._,]/g, ''));
      if (!Number.isInteger(n)) throw new UserError(`\`${opt.name}\` debe ser un número entero.`);
      if (opt.min !== undefined && n < opt.min) throw new UserError(`\`${opt.name}\` debe ser al menos ${opt.min}.`);
      if (opt.max !== undefined && n > opt.max) throw new UserError(`\`${opt.name}\` debe ser como máximo ${opt.max}.`);
      return n;
    }
    default: {
      const s = String(value).trim();
      if (!opt.choices) return s;
      const choice = opt.choices.find((c) => c.toLowerCase() === s.toLowerCase());
      if (!choice) throw new UserError(`\`${opt.name}\` debe ser una de estas opciones: ${opt.choices.map((c) => `\`${c}\``).join(', ')}.`);
      return choice;
    }
  }
}

export function hasPermission(member, permission) {
  if (!permission) return true;
  return member.isOwner || member.permissions.has('Administrator') || member.permissions.has(permission);
}

function checkCooldown(ctx, def) {
  const ms = def.cooldownMs ?? 1500;
  const key = `${ctx.guild.id}:${ctx.author.id}:${def.name}`;
  const now = ctx.now();
  const until = ctx.cooldowns.get(key) ?? 0;
  if (until > now) {
    throw new UserError(`Espera ${Math.ceil((until - now) / 1000)} s antes de volver a usar \`${def.name}\`.`, { title: 'Más despacio' });
  }
  ctx.cooldowns.set(key, now + ms);
  if (ctx.cooldowns.size > 10_000) ctx.cooldowns.clear();
}

/**
 * Ejecuta un comando ya identificado con argumentos en bruto.
 * Nunca lanza: los errores se convierten en una respuesta para el usuario.
 */
export async function executeCommand(def, rawArgs, ctx) {
  try {
    if (!hasPermission(ctx.author, def.permission)) {
      throw new UserError(`Necesitas el permiso **${PERMISSION_LABELS[def.permission]}** para usar \`${def.name}\`.`, { title: 'Sin permiso' });
    }
    const args = {};
    for (const opt of def.options ?? []) {
      const value = rawArgs[opt.name];
      if (value === undefined || value === null || value === '') {
        if (opt.required) throw new UserError(`Falta \`${opt.name}\`. Uso: \`${usage(def, ctx.prefix)}\``, { title: 'Faltan datos' });
        continue;
      }
      args[opt.name] = await coerce(opt, value, ctx);
    }
    checkCooldown(ctx, def);

    if (!def.data) return await def.run(ctx, args);
    // Leer → ejecutar → guardar. Si el comando falla no se guarda nada (operación atómica).
    const data = normalizeGuildData(await ctx.store.read());
    const result = await def.run(ctx, args, data);
    if (def.data === 'write') await ctx.store.write(data);
    return result;
  } catch (err) {
    if (isUserError(err)) return errorReply(err.message, err.title);
    ctx.logError?.(err);
    return errorReply('Ocurrió un error inesperado. Ya quedó registrado; inténtalo de nuevo en un momento.', 'Error interno');
  }
}

/** Punto de entrada para mensajes de texto. Devuelve null si el mensaje no es un comando. */
export async function runCommand(input, ctx) {
  const parsed = parseInvocation(input, ctx.prefix ?? '&');
  if (!parsed) return null;
  const def = findCommand(parsed.name);
  if (!def) return null;
  return { command: def, reply: await executeCommand(def, splitArgs(def.options, parsed.rest), ctx) };
}

export { COMMANDS, findCommand };
