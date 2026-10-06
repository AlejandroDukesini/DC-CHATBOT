// Configuración por servidor: cada clave define cómo se valida y cómo se muestra.

import { UserError } from './errors.js';
import { BANNER_THEMES } from './banner.js';
import { channelMention, roleMention } from './format.js';

const NONE = ['ninguno', 'ninguna', 'none', 'off', 'desactivar'];
const isNone = (v) => NONE.includes(String(v).trim().toLowerCase());

function intInRange(min, max) {
  return (v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < min || n > max) throw new UserError(`Debe ser un número entero entre ${min} y ${max}.`);
    return n;
  };
}

export const AI_PROVIDERS = ['chatgpt', 'grok', 'gemini'];

export const CONFIG_KEYS = {
  prefix: {
    label: 'Prefijo de comandos',
    help: '1 a 3 caracteres sin espacios. Ej.: `!`',
    parse: (v) => {
      const s = String(v).trim();
      if (!/^\S{1,3}$/.test(s)) throw new UserError('El prefijo debe tener entre 1 y 3 caracteres, sin espacios.');
      return s;
    },
  },
  welcomeChannel: {
    label: 'Canal de bienvenida',
    help: '#canal o `ninguno`',
    async parse(v, ctx) {
      if (isNone(v)) return null;
      const ch = await ctx.resolveChannel(v);
      if (!ch) throw new UserError('No encontré ese canal.');
      return ch.id;
    },
    show: (v) => (v ? channelMention(v) : '—'),
  },
  welcomeMessage: {
    label: 'Mensaje de bienvenida',
    help: 'Variables: {user}, {server}, {count}',
    parse: (v) => {
      const s = String(v).trim();
      if (!s || s.length > 300) throw new UserError('El mensaje debe tener entre 1 y 300 caracteres.');
      return s;
    },
  },
  autoRole: {
    label: 'Rol automático al entrar',
    help: '@rol o `ninguno`',
    async parse(v, ctx) {
      if (isNone(v)) return null;
      const role = await ctx.resolveRole(v);
      if (!role) throw new UserError('No encontré ese rol.');
      if (ctx.bot && role.position >= ctx.bot.highestRolePosition) throw new UserError('Ese rol está por encima del mío; no podría asignarlo.');
      return role.id;
    },
    show: (v) => (v ? roleMention(v) : '—'),
  },
  logChannel: {
    label: 'Canal de registros de moderación',
    help: '#canal o `ninguno`',
    async parse(v, ctx) {
      if (isNone(v)) return null;
      const ch = await ctx.resolveChannel(v);
      if (!ch) throw new UserError('No encontré ese canal.');
      return ch.id;
    },
    show: (v) => (v ? channelMention(v) : '—'),
  },
  bannerColor: {
    label: 'Color del banner',
    help: 'Hex, ej.: `#5865F2`',
    parse: (v) => {
      const s = String(v).trim();
      if (!/^#[0-9a-f]{6}$/i.test(s)) throw new UserError('Usa un color hexadecimal como `#5865F2`.');
      return s.toUpperCase();
    },
  },
  bannerTheme: {
    label: 'Estilo del banner',
    help: BANNER_THEMES.join(', '),
    parse: (v) => {
      const s = String(v).trim().toLowerCase();
      if (!BANNER_THEMES.includes(s)) throw new UserError(`Estilos disponibles: ${BANNER_THEMES.join(', ')}.`);
      return s;
    },
  },
  warnLimit: { label: 'Advertencias antes de silenciar', help: '0 = desactivado, máx. 10', parse: intInRange(0, 10) },
  dailyAmount: { label: 'Recompensa diaria base', help: '10 a 10000', parse: intInRange(10, 10000) },
  currency: {
    label: 'Símbolo de moneda',
    help: 'Emoji o texto corto',
    parse: (v) => {
      const s = String(v).trim();
      if (!s || s.length > 8) throw new UserError('Máximo 8 caracteres.');
      return s;
    },
  },
  aiProvider: {
    label: 'Proveedor de IA por defecto',
    help: AI_PROVIDERS.join(', '),
    parse: (v) => {
      const s = String(v).trim().toLowerCase();
      if (!AI_PROVIDERS.includes(s)) throw new UserError(`Proveedores: ${AI_PROVIDERS.join(', ')}.`);
      return s;
    },
  },
};

export function findConfigKey(input) {
  const raw = String(input ?? '').trim().toLowerCase();
  return Object.keys(CONFIG_KEYS).find((k) => k.toLowerCase() === raw) ?? null;
}

export const showConfigValue = (key, value) => {
  const def = CONFIG_KEYS[key];
  if (def.show) return def.show(value);
  return value === null || value === undefined || value === '' ? '—' : String(value);
};
