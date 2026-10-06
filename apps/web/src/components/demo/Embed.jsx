import { Markdown } from '../../lib/markdown.jsx';

const hex = (color) => `#${(color ?? 0x5865f2).toString(16).padStart(6, '0')}`;

/** Embed con el mismo aspecto que en Discord. Recibe el objeto neutral que genera el núcleo. */
export function Embed({ embed, lookup }) {
  return (
    <div
      className="mt-1.5 max-w-xl overflow-hidden rounded border-l-4 bg-ink-850 py-2.5 pr-4 pl-3 text-sm"
      style={{ borderLeftColor: hex(embed.color) }}
    >
      {embed.title && (
        <div className="mb-1 font-semibold text-zinc-100">
          {embed.url ? (
            <a href={embed.url} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
              {embed.title}
            </a>
          ) : (
            embed.title
          )}
        </div>
      )}
      {embed.description && (
        <div className="leading-relaxed whitespace-pre-wrap text-zinc-300">
          <Markdown text={embed.description} lookup={lookup} />
        </div>
      )}
      {embed.fields?.length > 0 && (
        <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-3">
          {embed.fields.map((f, i) => (
            <div key={i} className={f.inline ? 'min-w-0' : 'min-w-0 sm:col-span-3'}>
              <div className="text-xs font-semibold text-zinc-100">
                <Markdown text={f.name} lookup={lookup} />
              </div>
              <div className="text-[13px] leading-relaxed break-words whitespace-pre-wrap text-zinc-400">
                <Markdown text={f.value} lookup={lookup} />
              </div>
            </div>
          ))}
        </div>
      )}
      {embed.image?.url && <img src={embed.image.url} alt="" className="mt-2 max-h-72 rounded" loading="lazy" />}
      {embed.footer && <div className="mt-2 text-xs text-zinc-500">{embed.footer}</div>}
    </div>
  );
}
