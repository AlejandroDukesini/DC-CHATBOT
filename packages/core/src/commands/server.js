// Configuración, anuncios y banners.

import { UserError } from '../errors.js';
import { COLORS, embed, mention, renderTemplate, reply } from '../format.js';
import { CONFIG_KEYS, findConfigKey, showConfigValue } from '../config.js';
import { bannerSpec } from '../banner.js';

/** Lo que ocurre cuando alguien entra al servidor: banner de bienvenida + rol automático. */
export async function handleMemberJoin(ctx, member, data) {
  const { config } = data;
  const done = [];
  if (config.welcomeChannel) {
    const content = renderTemplate(config.welcomeMessage, {
      user: mention(member),
      server: ctx.guild.name,
      count: ctx.guild.memberCount ?? '?',
    });
    await ctx.actions.sendToChannel(config.welcomeChannel, { content, banner: bannerSpec({ member, guild: ctx.guild, config }) });
    done.push('welcome');
  }
  if (config.autoRole) {
    await ctx.actions.addRole(member, config.autoRole);
    done.push('autoRole');
  }
  return done;
}

export default [
  {
    name: 'config',
    aliases: ['configurar', 'ajustes'],
    category: 'configuracion',
    description: 'Muestra la configuración del servidor o cambia un valor: `config <clave> <valor>`.',
    permission: 'ManageGuild',
    options: [
      { name: 'clave', type: 'string', description: 'Ajuste a cambiar', choices: Object.keys(CONFIG_KEYS) },
      { name: 'valor', type: 'text', description: 'Nuevo valor' },
    ],
    examples: ['config', 'config welcomeChannel #bienvenida', 'config bannerColor #EB459E', 'config warnLimit 3'],
    data: 'write',
    async run(ctx, args, data) {
      if (!args.clave) {
        return reply({
          title: '⚙️ Configuración del servidor',
          color: COLORS.primary,
          description: 'Cambia un valor con `config <clave> <valor>`.',
          fields: Object.entries(CONFIG_KEYS).map(([key, def]) => ({
            name: `${def.label} · \`${key}\``,
            value: `${showConfigValue(key, data.config[key])}\n-# ${def.help}`,
            inline: true,
          })),
        });
      }
      const key = findConfigKey(args.clave);
      if (!key) throw new UserError(`Clave desconocida. Claves: ${Object.keys(CONFIG_KEYS).map((k) => `\`${k}\``).join(', ')}.`);
      if (args.valor === undefined) throw new UserError(`Indica un valor. ${CONFIG_KEYS[key].label}: ${CONFIG_KEYS[key].help}`);
      data.config[key] = await CONFIG_KEYS[key].parse(args.valor, ctx);
      return reply({
        title: '✅ Configuración actualizada',
        description: `**${CONFIG_KEYS[key].label}** → ${showConfigValue(key, data.config[key])}`,
        color: COLORS.success,
      });
    },
  },
  {
    name: 'anuncio',
    aliases: ['announce'],
    category: 'configuracion',
    description: 'Publica un anuncio con formato. Separa título y texto con `|`.',
    permission: 'ManageMessages',
    options: [{ name: 'contenido', type: 'text', description: 'Título | texto del anuncio', required: true }],
    examples: ['anuncio Torneo el sábado | Inscripciones abiertas en #general. ¡Premio de 5000 🪙!'],
    data: 'read',
    run(ctx, args, data) {
      const [title, ...rest] = args.contenido.split('|');
      const body = rest.join('|').trim();
      return {
        embeds: [embed({
          title: `📢 ${title.trim()}`,
          description: body || undefined,
          color: parseInt(data.config.bannerColor.slice(1), 16),
          footer: `Anunciado por ${ctx.author.displayName}`,
        })],
      };
    },
  },
  {
    name: 'banner',
    aliases: ['bienvenida'],
    category: 'configuracion',
    description: 'Genera el banner de bienvenida de un miembro con el estilo configurado.',
    options: [{ name: 'usuario', type: 'user', description: 'Miembro (por defecto, tú)' }],
    examples: ['banner', 'banner @Marta'],
    data: 'read',
    cooldownMs: 5000,
    run(ctx, args, data) {
      const member = args.usuario ?? ctx.author;
      return { content: `Vista previa del banner de ${member.displayName}:`, banner: bannerSpec({ member, guild: ctx.guild, config: data.config }) };
    },
  },
];
