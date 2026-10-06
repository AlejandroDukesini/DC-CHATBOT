// Radio por streaming, investigador e IA de terceros.

import { UserError } from '../errors.js';
import { COLORS, embed, reply, truncate } from '../format.js';
import { STATIONS, resolveStation } from '../radio.js';
import { AI_PROVIDERS } from '../config.js';

// Los paréntesis rompen los enlaces markdown: Mercurio_(planeta) → Mercurio_%28planeta%29.
const mdUrl = (url) => url.replace(/\(/g, '%28').replace(/\)/g, '%29');

export function researchReply(result) {
  if (!result.answer) {
    return {
      embeds: [embed({
        title: `🔎 Sin resultados para «${result.query}»`,
        color: COLORS.warning,
        description: 'No encontré artículos fiables sobre ese tema. Prueba con otras palabras o en inglés.',
        fields: [{ name: 'Proceso', value: result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') }],
      })],
    };
  }
  const cite = (i) => `[${i + 1}]`;
  const body = result.highlights.map((h) => `${h.text} ${cite(h.source)}`).join('\n\n');
  return {
    embeds: [embed({
      title: `🔎 Investigación: ${result.query}`,
      color: COLORS.research,
      description: body,
      fields: [
        { name: 'Fuentes', value: result.sources.map((s, i) => `${cite(i)} [${s.title}](${mdUrl(s.url)}) — ${s.type} · ${s.verification}`).join('\n') },
        result.references.length && {
          name: 'Literatura académica (Crossref)',
          value: result.references
            .map((r) => `• [${truncate(r.title, 90)}](${mdUrl(r.url)})${r.year ? ` (${r.year})` : ''}${r.citations ? ` · ${r.citations} citas` : ''}${r.venue ? ` — *${truncate(r.venue, 40)}*` : ''}`)
            .join('\n'),
        },
        { name: 'Cómo lo investigué', value: result.steps.map((s, i) => `${i + 1}. ${s}`).join('\n') },
      ],
      footer: `Confianza ${result.confidenceLabel} (${Math.round(result.confidence * 100)} %) · Resumen extractivo: cada frase es textual de su fuente`,
    })],
  };
}

export default [
  {
    name: 'investigar',
    aliases: ['buscar', 'research', 'wiki'],
    category: 'investigacion',
    description: 'El agente investiga por su cuenta en Wikipedia, Wikidata y Crossref y resume con fuentes citadas.',
    options: [{ name: 'tema', type: 'text', description: 'Qué quieres investigar', required: true }],
    examples: ['investigar agujero negro', 'investigar fotosíntesis', 'investigar quantum computing'],
    cooldownMs: 8000,
    slow: true,
    async run(ctx, args) {
      return researchReply(await ctx.research(args.tema));
    },
  },
  {
    name: 'radio',
    aliases: ['play', 'musica'],
    category: 'radio',
    description: 'Reproduce una estación o un enlace de streaming en tu canal de voz.',
    options: [{ name: 'estacion', type: 'string', description: 'Id de estación o enlace https://…', required: true }],
    examples: ['radio chillhop', 'radio https://stream.radioparadise.com/mp3-128'],
    cooldownMs: 3000,
    async run(ctx, args) {
      const station = resolveStation(args.estacion);
      await ctx.actions.playRadio(station);
      return reply({
        title: `📻 Sonando: ${station.name}`,
        color: COLORS.radio,
        description: `${station.genre}\nFuente: ${station.source}`,
        footer: 'Usa detener para parar la radio',
      });
    },
  },
  {
    name: 'radios',
    aliases: ['estaciones'],
    category: 'radio',
    description: 'Lista las estaciones recomendadas.',
    examples: ['radios'],
    run() {
      return reply({
        title: '📻 Estaciones disponibles',
        color: COLORS.radio,
        description: 'Reproduce con `radio <id>` o pega cualquier enlace de streaming `https://…`.',
        fields: STATIONS.map((s) => ({ name: `${s.name} · \`${s.id}\``, value: s.genre, inline: true })),
      });
    },
  },
  {
    name: 'detener',
    aliases: ['stop', 'parar'],
    category: 'radio',
    description: 'Detiene la radio y sale del canal de voz.',
    examples: ['detener'],
    async run(ctx) {
      const stopped = await ctx.actions.stopRadio();
      return reply({ title: stopped ? '⏹️ Radio detenida' : 'No hay nada sonando', color: COLORS.radio });
    },
  },
  {
    name: 'sonando',
    aliases: ['np', 'nowplaying'],
    category: 'radio',
    description: 'Muestra qué está sonando.',
    examples: ['sonando'],
    async run(ctx) {
      const station = await ctx.actions.nowPlaying();
      return reply(station
        ? { title: `🎶 ${station.name}`, description: `${station.genre}\n${station.url}`, color: COLORS.radio }
        : { title: 'No hay nada sonando', description: 'Prueba `radios`.', color: COLORS.radio });
    },
  },
  {
    name: 'pregunta',
    aliases: ['ask', 'ia'],
    category: 'ia',
    description: 'Pregunta a ChatGPT, Grok o Gemini. Solo con el nombre del proveedor, lo fija como predeterminado (requiere Gestionar servidor).',
    options: [
      { name: 'texto', type: 'text', description: '[proveedor] pregunta', required: true },
    ],
    examples: ['pregunta ¿Qué es un agujero negro?', 'pregunta gemini resume la teoría de la relatividad', 'pregunta grok'],
    data: 'write',
    cooldownMs: 5000,
    slow: true,
    localOnly: true,
    async run(ctx, args, data) {
      if (!ctx.ai) throw new UserError('Los proveedores de IA de pago solo están disponibles en la instalación local con tus propias API keys. Prueba `investigar`, que funciona sin claves.', { title: 'Solo en versión local' });
      const [first, ...rest] = args.texto.trim().split(/\s+/);
      const named = AI_PROVIDERS.includes(first.toLowerCase()) ? first.toLowerCase() : null;
      const question = named ? rest.join(' ') : args.texto.trim();
      if (named && !question) {
        const canManage = ctx.author.isOwner || ctx.author.permissions.has('ManageGuild') || ctx.author.permissions.has('Administrator');
        if (!canManage) throw new UserError('Necesitas el permiso Gestionar servidor para cambiar el proveedor predeterminado.');
        if (!ctx.ai.isAvailable(named)) throw new UserError(`${named} no está configurado (falta su API key).`);
        data.config.aiProvider = named;
        return reply({ title: `✅ Proveedor predeterminado: ${named}`, color: COLORS.success });
      }
      const provider = named ?? data.config.aiProvider;
      if (!ctx.ai.isAvailable(provider)) throw new UserError(`${provider} no está configurado (falta su API key). Usa \`proveedores\`.`);
      const answer = await ctx.ai.ask(provider, question);
      const summary = answer.length > 350 ? `${answer.slice(0, 350).replace(/\s+\S*$/, '')}…` : answer;
      return {
        embeds: [embed({
          title: `🤖 Respuesta de ${provider}`,
          description: summary,
          color: COLORS.ai,
          footer: `Solicitado por ${ctx.author.displayName} · ${answer.length} caracteres`,
        })],
        expandable: answer.length > summary.length ? { title: `📖 Respuesta completa de ${provider}`, text: answer } : undefined,
      };
    },
  },
  {
    name: 'imagen',
    aliases: ['image'],
    category: 'ia',
    description: 'Genera una imagen con OpenAI (requiere OPENAI_API_KEY).',
    options: [{ name: 'descripcion', type: 'text', description: 'Qué imagen quieres', required: true }],
    examples: ['imagen un gato astronauta en estilo acuarela'],
    cooldownMs: 15000,
    slow: true,
    localOnly: true,
    async run(ctx, args) {
      if (!ctx.ai) throw new UserError('La generación de imágenes solo está disponible en la instalación local con tu OPENAI_API_KEY.', { title: 'Solo en versión local' });
      if (!ctx.ai.isAvailable('chatgpt')) throw new UserError('Configura OPENAI_API_KEY para generar imágenes.');
      const image = await ctx.ai.image(args.descripcion);
      return { embeds: [embed({ title: '🖼️ Imagen generada', description: `Prompt: ${args.descripcion}`, color: COLORS.ai, image })] };
    },
  },
  {
    name: 'proveedores',
    aliases: ['providers'],
    category: 'ia',
    description: 'Estado de los proveedores de IA configurados.',
    examples: ['proveedores'],
    data: 'read',
    run(ctx, args, data) {
      return reply({
        title: '🔧 Proveedores de IA',
        color: COLORS.ai,
        description: ctx.ai ? undefined : 'En la demo web no hay claves configuradas. En local se activan con las variables de `.env`.',
        fields: AI_PROVIDERS.map((p) => ({
          name: `${p}${p === data.config.aiProvider ? ' (predeterminado)' : ''}`,
          value: ctx.ai?.isAvailable(p) ? '✅ Disponible' : '❌ Sin API key',
          inline: true,
        })),
      });
    },
  },
];
