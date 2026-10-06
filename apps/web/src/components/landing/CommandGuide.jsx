import { useState } from 'react';
import { CATEGORIES, COMMANDS, PERMISSION_LABELS, usage } from '@dc-chatbot/core';
import { SectionHeading } from './Chrome.jsx';

/** Guía de comandos generada desde el mismo registro que usa el bot: nunca se desincroniza. */
export function CommandGuide({ onTry }) {
  const [category, setCategory] = useState('investigacion');
  const commands = COMMANDS.filter((c) => c.category === category);

  return (
    <section id="comandos" className="mx-auto max-w-6xl px-4 py-20">
      <SectionHeading eyebrow="Guía de uso" title="Cómo usar cada función">
        Todos los comandos funcionan con el prefijo (<code className="font-mono text-zinc-300">&amp;</code> por defecto) o como slash command
        (<code className="font-mono text-zinc-300">/</code>). Esta guía se genera desde el mismo registro de comandos que usa el bot.
      </SectionHeading>

      <div role="tablist" aria-label="Categorías" className="mb-6 flex gap-2 overflow-x-auto pb-1">
        {Object.entries(CATEGORIES)
          .filter(([key]) => key !== 'general')
          .map(([key, cat]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={category === key}
              onClick={() => setCategory(key)}
              className={`shrink-0 rounded-md border px-3 py-1.5 text-sm ${
                category === key ? 'border-blurple bg-blurple/15 text-zinc-100' : 'border-ink-700 text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat.emoji} {cat.label}
            </button>
          ))}
      </div>

      {category === 'ia' && (
        <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Estos comandos usan APIs de pago (OpenAI, xAI, Google). Solo funcionan en la instalación local con tus propias claves en <code className="font-mono">.env</code>.
        </p>
      )}

      <div role="tabpanel" className="grid gap-3 md:grid-cols-2">
        {commands.map((c) => (
          <article key={c.name} className="rounded-xl border border-ink-800 bg-ink-900 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <code className="font-mono text-sm font-semibold text-zinc-100">{usage(c)}</code>
              {c.permission && (
                <span className="rounded bg-red-500/10 px-1.5 py-0.5 text-[11px] text-red-300" title="Permiso de Discord necesario">
                  🔒 {PERMISSION_LABELS[c.permission]}
                </span>
              )}
            </div>
            <p className="mt-2 text-sm text-zinc-400">{c.description}</p>
            {c.aliases?.length > 0 && <p className="mt-1 text-xs text-zinc-500">Alias: {c.aliases.join(', ')}</p>}
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(c.examples ?? []).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => onTry(`&${e}`)}
                  title="Probar en la demo"
                  className="rounded border border-ink-700 px-2 py-0.5 font-mono text-xs text-zinc-300 hover:border-blurple hover:text-zinc-100"
                >
                  &amp;{e}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
