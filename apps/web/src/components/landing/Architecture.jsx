import { BRANCH, README_URL, REPO_URL, treeUrl } from '../../lib/links.js';
import { SectionHeading } from './Chrome.jsx';

const DIAGRAM = `      Discord (gateway)                         Navegador
             │                                       │
   ┌─────────▼──────────┐                 ┌──────────▼──────────┐
   │ apps/bot           │                 │ apps/web            │
   │ discord.js         │                 │ React + Vite        │
   │ adaptador Discord  │                 │ adaptador sandbox   │
   └─────────┬──────────┘                 └──────────┬──────────┘
             │      ┌───────────────────────────┐     │
             └─────►│ packages/core             │◄────┘
                    │ motor de comandos         │
                    │ economía · mercado        │
                    │ moderación · config       │
                    │ banners · radio           │
                    │ agente investigador       │
                    └─────────────┬─────────────┘
                                  │
   data/<servidor>.json   ◄───────┼───────►   localStorage
   (bot local)                    │           (demo, reiniciable)
                                  ▼
             /api/research (Netlify Function, misma lógica)
                                  │
              Wikipedia · Wikidata · Crossref (APIs públicas)`;

const LAYERS = [
  { path: 'packages/core', title: 'Núcleo compartido', text: 'Reglas de negocio puras: comandos, validación, permisos, economía, moderación y el investigador. Sin dependencias.' },
  { path: 'apps/bot', title: 'Adaptador Discord', text: 'Traduce mensajes, slash commands y eventos de discord.js al formato del núcleo, y ejecuta las acciones reales.' },
  { path: 'apps/web', title: 'Adaptador sandbox', text: 'Implementa la misma interfaz sobre un servidor ficticio en el navegador. Es esta demo.' },
];

const ROWS = [
  ['Motor de comandos y reglas', 'El mismo código', 'El mismo código'],
  ['Datos', 'Ficticios, en tu navegador, reiniciables', 'Archivo JSON por servidor'],
  ['Moderación', 'Sobre miembros ficticios', 'Acciones reales en Discord'],
  ['Investigador', 'Real (Netlify Function)', 'Real (desde el bot)'],
  ['Radio', 'Suena en tu navegador (solo https)', 'En el canal de voz con FFmpeg'],
  ['Banners', 'Canvas del navegador, iniciales', 'Canvas en Node, con el avatar real'],
  ['ChatGPT · Grok · Gemini · imágenes', 'No disponible (claves de pago)', 'Con tus API keys'],
  ['Slash commands', 'Solo prefijo', 'Prefijo y /comandos'],
];

const SETUP = `git clone ${REPO_URL}.git
cd DC-CHATBOT && git checkout ${BRANCH}
npm install              # núcleo + demo web
npm run bot:install      # dependencias del bot (discord.js, voz, canvas)
cp .env.example .env     # DISCORD_TOKEN y DISCORD_CLIENT_ID
npm run deploy-commands  # registra los slash commands
npm run bot              # inicia el bot`;

export function Architecture() {
  return (
    <section id="arquitectura" className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading eyebrow="Ingeniería" title="Una lógica, dos adaptadores">
        La demo no es una copia del bot: importa el mismo paquete <code className="font-mono text-zinc-300">@dc-chatbot/core</code>.
        Solo cambia el adaptador que conecta ese núcleo con Discord o con el navegador.
      </SectionHeading>

      <pre className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900 p-5 font-mono text-[12px] leading-relaxed text-zinc-400" aria-label="Diagrama de arquitectura">
        {DIAGRAM}
      </pre>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {LAYERS.map((l) => (
          <a key={l.path} href={treeUrl(l.path)} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-ink-800 bg-ink-900 p-4 hover:border-ink-600">
            <code className="font-mono text-xs text-blurple">{l.path}/</code>
            <h3 className="mt-1 font-semibold text-zinc-100">{l.title}</h3>
            <p className="mt-1 text-sm text-zinc-400">{l.text}</p>
          </a>
        ))}
      </div>
    </section>
  );
}

export function Comparison() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading eyebrow="Demo vs. local" title="Qué cambia al instalarlo">
        La demo es un entorno controlado: no tiene acceso a Discord, a datos reales ni a claves.
      </SectionHeading>
      <div className="overflow-x-auto rounded-xl border border-ink-800">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-ink-900 text-zinc-300">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Función</th>
              <th scope="col" className="px-4 py-3 font-medium">Demo web</th>
              <th scope="col" className="px-4 py-3 font-medium">Bot instalado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink-800">
            {ROWS.map(([name, demo, local]) => (
              <tr key={name}>
                <th scope="row" className="px-4 py-3 font-medium text-zinc-200">{name}</th>
                <td className="px-4 py-3 text-zinc-400">{demo}</td>
                <td className="px-4 py-3 text-zinc-400">{local}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-12 grid gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <h3 className="text-lg font-semibold text-zinc-100">Instalarlo en tu servidor</h3>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-400">
            <li>Crea una aplicación en el Discord Developer Portal y copia el token del bot.</li>
            <li>Activa los intents <strong className="text-zinc-300">Message Content</strong> y <strong className="text-zinc-300">Server Members</strong>.</li>
            <li>Invita al bot con los permisos de moderación, mensajes y voz (detalle en el README).</li>
            <li>Ejecuta los comandos de la derecha. Necesitas Node.js 20 o superior.</li>
            <li>En Discord, usa <code className="font-mono text-zinc-300">/config</code> para elegir canales y rol automático.</li>
          </ol>
          <a href={README_URL} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-sm font-medium text-blurple hover:text-indigo-300">
            Guía completa en el README →
          </a>
        </div>
        <pre className="overflow-x-auto rounded-xl border border-ink-800 bg-ink-900 p-5 font-mono text-[13px] leading-relaxed text-zinc-300">{SETUP}</pre>
      </div>
    </section>
  );
}
