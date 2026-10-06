import { UserError } from '../errors.js';
import { COLORS, reply } from '../format.js';
import economy from './economy.js';
import moderation from './moderation.js';
import server from './server.js';
import media from './media.js';

export const CATEGORIES = {
  general: { label: 'General', emoji: '📚' },
  investigacion: { label: 'Investigación', emoji: '🔎' },
  economia: { label: 'Economía y finanzas', emoji: '💰' },
  moderacion: { label: 'Moderación', emoji: '🛡️' },
  configuracion: { label: 'Configuración y banners', emoji: '⚙️' },
  radio: { label: 'Radio', emoji: '📻' },
  ia: { label: 'IA de terceros (local)', emoji: '🤖' },
};

export const PERMISSION_LABELS = {
  BanMembers: 'Banear miembros',
  KickMembers: 'Expulsar miembros',
  ModerateMembers: 'Aislar temporalmente a miembros',
  ManageMessages: 'Gestionar mensajes',
  ManageGuild: 'Gestionar servidor',
};

export function usage(def, prefix = '&') {
  const opts = (def.options ?? []).map((o) => (o.required ? `<${o.name}>` : `[${o.name}]`));
  return [`${prefix}${def.name}`, ...opts].join(' ');
}

const general = [
  {
    name: 'ayuda',
    aliases: ['help', 'h', 'comandos'],
    category: 'general',
    description: 'Lista los comandos o explica uno en detalle.',
    options: [{ name: 'comando', type: 'string', description: 'Comando a explicar' }],
    examples: ['ayuda', 'ayuda ban'],
    run(ctx, args) {
      const prefix = ctx.prefix ?? '&';
      if (args.comando) {
        const def = findCommand(args.comando);
        if (!def) throw new UserError(`No existe el comando \`${args.comando}\`.`);
        return reply({
          title: `${CATEGORIES[def.category].emoji} ${prefix}${def.name}`,
          description: def.description,
          color: COLORS.primary,
          fields: [
            { name: 'Uso', value: `\`${usage(def, prefix)}\`` },
            { name: 'Ejemplos', value: (def.examples ?? []).map((e) => `\`${prefix}${e}\``).join('\n') },
            def.aliases?.length && { name: 'Alias', value: def.aliases.map((a) => `\`${a}\``).join(', '), inline: true },
            def.permission && { name: 'Permiso necesario', value: PERMISSION_LABELS[def.permission], inline: true },
          ],
          footer: 'También disponible como slash command: /' + def.name,
        });
      }
      return reply({
        title: '📚 Comandos de DC Chatbot',
        description: `Prefijo: \`${prefix}\` · también con \`/\`. Detalle: \`${prefix}ayuda <comando>\``,
        color: COLORS.primary,
        fields: Object.entries(CATEGORIES).map(([key, cat]) => ({
          name: `${cat.emoji} ${cat.label}`,
          value: COMMANDS.filter((c) => c.category === key).map((c) => `\`${c.name}\``).join(' '),
        })),
      });
    },
  },
  {
    name: 'ping',
    category: 'general',
    description: 'Comprueba que el bot responde y mide la latencia.',
    examples: ['ping'],
    run(ctx) {
      const latency = ctx.latency?.();
      return reply({ title: '🏓 Pong', description: latency != null ? `Latencia: ${latency} ms` : 'El bot está en línea.', color: COLORS.success });
    },
  },
];

export const COMMANDS = [...general, ...media.filter((c) => c.category === 'investigacion'), ...economy, ...moderation, ...server, ...media.filter((c) => c.category !== 'investigacion')];

const index = new Map();
for (const def of COMMANDS) {
  for (const key of [def.name, ...(def.aliases ?? [])]) {
    if (index.has(key)) throw new Error(`Comando o alias duplicado: ${key}`);
    index.set(key, def);
  }
}

export const findCommand = (name) => index.get(String(name ?? '').toLowerCase()) ?? null;
