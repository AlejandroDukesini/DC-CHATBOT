// Utilidades de formato compartidas por todos los módulos.

export const COLORS = {
  primary: 0x5865f2,
  success: 0x23a55a,
  warning: 0xf0b232,
  danger: 0xda373c,
  info: 0x3ba4f5,
  economy: 0xe0a526,
  research: 0x1abc9c,
  radio: 0xeb459e,
  ai: 0x00a8ff,
};

const LIMITS = { title: 256, description: 4096, fieldName: 256, fieldValue: 1024, footer: 2048, fields: 25 };

export function truncate(text, max) {
  const str = String(text ?? '');
  return str.length <= max ? str : `${str.slice(0, max - 1)}…`;
}

/** Crea un embed neutral (sin discord.js) respetando los límites de Discord. */
export function embed({ title, description, color = COLORS.primary, fields = [], footer, url, image } = {}) {
  const out = { color };
  if (title) out.title = truncate(title, LIMITS.title);
  if (description) out.description = truncate(description, LIMITS.description);
  if (url) out.url = url;
  if (footer) out.footer = truncate(footer, LIMITS.footer);
  if (image) out.image = image;
  out.fields = fields
    .filter((f) => f && f.name && f.value !== undefined && f.value !== '')
    .slice(0, LIMITS.fields)
    .map((f) => ({
      name: truncate(f.name, LIMITS.fieldName),
      value: truncate(f.value, LIMITS.fieldValue),
      inline: Boolean(f.inline),
    }));
  return out;
}

export const reply = (opts) => ({ embeds: [embed(opts)] });
export const errorReply = (message, title = 'No se pudo completar') => ({
  embeds: [embed({ title: `❌ ${title}`, description: message, color: COLORS.danger })],
  ephemeral: true,
});

export const mention = (member) => `<@${member.id}>`;
export const channelMention = (id) => `<#${id}>`;
export const roleMention = (id) => `<@&${id}>`;

export function formatNumber(n) {
  return Math.round(n).toLocaleString('es-ES');
}

export function formatMoney(n, currency = '🪙') {
  return `${currency} ${formatNumber(n)}`;
}

const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

/** "10m" → 600000. Acepta s, m, h, d. Devuelve null si no es válido. */
export function parseDuration(input) {
  const match = /^(\d{1,4})\s*([smhd])$/i.exec(String(input ?? '').trim());
  if (!match) return null;
  const ms = Number(match[1]) * UNITS[match[2].toLowerCase()];
  return ms > 0 ? ms : null;
}

export function formatDuration(ms) {
  if (ms <= 0) return '0s';
  const parts = [];
  let rest = Math.ceil(ms / 1000);
  for (const [label, size] of [['d', 86400], ['h', 3600], ['m', 60], ['s', 1]]) {
    const value = Math.floor(rest / size);
    if (value) parts.push(`${value}${label}`);
    rest -= value * size;
    if (parts.length === 2) break;
  }
  return parts.join(' ');
}

/** Sustituye {user}, {server}, {count} en las plantillas de bienvenida. */
export function renderTemplate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (all, key) => (key in vars ? String(vars[key]) : all));
}

/** Hash FNV-1a de 32 bits: determinista en Node y en el navegador. */
export function hashString(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
