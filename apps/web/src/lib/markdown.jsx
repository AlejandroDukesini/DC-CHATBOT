// Subconjunto del markdown de Discord renderizado como elementos React
// (nunca como HTML crudo): **negrita**, *cursiva*, `código`, [enlaces](https://…),
// menciones <@id>, <#canal>, <@&rol> y líneas de subtexto "-# ".

import { Fragment } from 'react';

const TOKEN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|<@!?[\w-]+>|<#[\w-]+>|<@&[\w-]+>)/g;

function Inline({ text, lookup }) {
  const parts = String(text).split(TOKEN);
  return parts.map((part, i) => {
    if (!part) return null;
    // split() con grupo de captura: los índices impares son tokens, los pares texto plano (p. ej. "[1] ").
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    if (part.startsWith('**')) return <strong key={i} className="font-semibold text-zinc-100">{part.slice(2, -2)}</strong>;
    if (part.startsWith('`')) return <code key={i} className="rounded bg-ink-950/70 px-1 py-0.5 font-mono text-[0.85em] text-zinc-200">{part.slice(1, -1)}</code>;
    if (part.startsWith('*')) return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('[')) {
      const m = /^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(part);
      return (
        <a key={i} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">
          {m[1]}
        </a>
      );
    }
    if (part.startsWith('<@&')) {
      const role = lookup.role(part.slice(3, -1));
      return <Mention key={i} color={role?.color}>@{role?.name ?? 'rol'}</Mention>;
    }
    if (part.startsWith('<@')) {
      const member = lookup.member(part.replace(/^<@!?|>$/g, ''));
      return <Mention key={i}>@{member?.name ?? 'usuario'}</Mention>;
    }
    if (part.startsWith('<#')) {
      const channel = lookup.channel(part.slice(2, -1));
      return <Mention key={i}>#{channel?.name ?? 'canal'}</Mention>;
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

function Mention({ children, color }) {
  return (
    <span className="rounded bg-blurple/25 px-0.5 font-medium text-indigo-200" style={color ? { color } : undefined}>
      {children}
    </span>
  );
}

export function Markdown({ text, lookup }) {
  if (!text) return null;
  const lines = String(text).split('\n');
  return lines.map((line, i) => {
    const sub = line.startsWith('-# ');
    const content = sub ? line.slice(3) : line;
    return (
      <Fragment key={i}>
        {sub ? (
          <span className="block text-xs text-zinc-500">
            <Inline text={content} lookup={lookup} />
          </span>
        ) : (
          <Inline text={content} lookup={lookup} />
        )}
        {i < lines.length - 1 && !sub && <br />}
      </Fragment>
    );
  });
}
