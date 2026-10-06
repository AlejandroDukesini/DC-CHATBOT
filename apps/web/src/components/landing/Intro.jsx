import { COMMANDS } from '@dc-chatbot/core';
import { README_URL, REPO_URL } from '../../lib/links.js';
import { GitHubIcon, SectionHeading } from './Chrome.jsx';

export function Hero() {
  const facts = [`${COMMANDS.length} comandos`, 'Prefijo & y slash commands', 'Sin base de datos', 'Demo sin claves de API'];
  return (
    <section id="top" className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:pt-24">
      <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-ink-700 px-3 py-1 font-mono text-xs text-zinc-400">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Bot de Discord · open source · Node.js
      </p>
      <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-zinc-50 sm:text-5xl">
        Investiga, modera y administra tu servidor de Discord.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-zinc-400">
        DC Chatbot incluye un investigador propio que cita fuentes verificables, moderación con jerarquía de roles,
        un juego de finanzas con mercado de valores, radio por streaming y banners de bienvenida.{' '}
        <span className="text-zinc-200">La demo de abajo ejecuta el mismo motor que el bot real.</span>
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a href="#demo" className="rounded-md bg-blurple px-4 py-2.5 font-medium text-white hover:bg-blurple-dark">
          Probar la demo
        </a>
        <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-md border border-ink-700 px-4 py-2.5 font-medium text-zinc-200 hover:border-ink-600">
          <GitHubIcon /> Ver el código
        </a>
        <a href={README_URL} target="_blank" rel="noopener noreferrer" className="px-2 py-2.5 text-sm text-zinc-400 hover:text-zinc-200">
          Documentación →
        </a>
      </div>
      <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 font-mono text-xs text-zinc-500">
        {facts.map((f) => (
          <li key={f} className="flex items-center gap-2">
            <span className="text-blurple">▸</span> {f}
          </li>
        ))}
      </ul>
    </section>
  );
}

const FEATURES = [
  {
    icon: '🔎',
    title: 'Investigador propio',
    text: 'Busca en Wikipedia, reformula la búsqueda si el resultado no encaja, contrasta con Wikidata y añade artículos académicos de Crossref. El resumen es extractivo y citado: nunca inventa.',
    cmd: '&investigar fotosíntesis',
  },
  {
    icon: '🛡️',
    title: 'Moderación',
    text: 'Banear, expulsar, silenciar y advertir con sanción automática al llegar al límite. Respeta la jerarquía de roles igual que Discord y registra cada caso en un canal de logs.',
    cmd: '&advertir @Troll_404 spam',
  },
  {
    icon: '💰',
    title: 'Economía y bolsa',
    text: 'Recompensa diaria con rachas, trabajos, banco, tienda con mejoras y un mercado de 4 acciones cuyos precios cambian cada 10 minutos.',
    cmd: '&mercado',
  },
  {
    icon: '📻',
    title: 'Radio por streaming',
    text: 'Emisoras recomendadas o cualquier enlace de streaming. Los enlaces a redes privadas se bloquean para evitar abusos.',
    cmd: '&radio chillhop',
  },
  {
    icon: '🖼️',
    title: 'Bienvenidas y banners',
    text: 'Banner generado con Canvas para cada miembro nuevo, mensaje personalizable, rol automático y anuncios con formato.',
    cmd: '&banner',
  },
  {
    icon: '⚙️',
    title: 'Configuración por servidor',
    text: 'Prefijo, canales, rol automático, colores, límite de advertencias y moneda. Cada valor se valida antes de guardarse.',
    cmd: '&config',
  },
];

export function Features({ onTry }) {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20" aria-labelledby="features-title">
      <SectionHeading eyebrow="Funcionalidades" title={<span id="features-title">Qué hace el bot</span>}>
        Cada tarjeta tiene un botón para probar la función en la demo.
      </SectionHeading>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <article key={f.title} className="flex flex-col rounded-xl border border-ink-800 bg-ink-900 p-5">
            <div className="mb-3 text-2xl" aria-hidden="true">{f.icon}</div>
            <h3 className="font-semibold text-zinc-100">{f.title}</h3>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{f.text}</p>
            <div className="mt-4 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-xs text-zinc-500">{f.cmd}</code>
              <button type="button" onClick={() => onTry(f.cmd)} className="shrink-0 text-sm font-medium text-blurple hover:text-indigo-300">
                Probar →
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
