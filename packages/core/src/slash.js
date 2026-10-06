// Convierte las definiciones de comandos al JSON de slash commands de Discord.
// Es JSON plano: no depende de discord.js y se puede probar sin conexión.

import { COMMANDS } from './commands/index.js';

const OPTION_TYPES = { string: 3, text: 3, integer: 4, user: 6 };

const PERMISSION_BITS = {
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  ManageGuild: 1n << 5n,
  ManageMessages: 1n << 13n,
  ModerateMembers: 1n << 40n,
};

function toOption(opt) {
  const out = {
    type: OPTION_TYPES[opt.type] ?? 3,
    name: opt.name,
    description: opt.description.slice(0, 100),
    required: Boolean(opt.required),
  };
  if (opt.choices) out.choices = opt.choices.slice(0, 25).map((c) => ({ name: c, value: c }));
  if (opt.type === 'integer') {
    if (opt.min !== undefined) out.min_value = opt.min;
    if (opt.max !== undefined) out.max_value = opt.max;
  }
  if (opt.type === 'text') out.max_length = 1000;
  return out;
}

export function toSlashCommands(commands = COMMANDS) {
  return commands.map((def) => {
    const options = (def.options ?? []).map(toOption);
    // Discord exige que las opciones obligatorias vayan antes que las opcionales.
    options.sort((a, b) => Number(b.required) - Number(a.required));
    const json = {
      name: def.name,
      description: def.description.replace(/`/g, '').slice(0, 100),
      type: 1,
      contexts: [0], // solo en servidores
      options,
    };
    if (def.permission) json.default_member_permissions = PERMISSION_BITS[def.permission].toString();
    return json;
  });
}
