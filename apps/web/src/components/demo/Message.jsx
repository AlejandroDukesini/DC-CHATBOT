import { Markdown } from '../../lib/markdown.jsx';
import { Embed } from './Embed.jsx';
import { BannerCanvas } from './BannerCanvas.jsx';

const time = (ts) => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export function Avatar({ member, size = 'h-9 w-9' }) {
  const initials = (member?.name ?? '?').slice(0, 2).toUpperCase();
  return (
    <div
      aria-hidden="true"
      className={`${size} flex shrink-0 items-center justify-center rounded-full text-xs font-bold text-white`}
      style={{ backgroundColor: member?.bot ? '#5865F2' : member?.avatarColor ?? '#4E5058' }}
    >
      {member?.bot ? '🤖' : initials}
    </div>
  );
}

function SystemMessage({ message, lookup }) {
  return (
    <div className="flex gap-3 px-4 py-1.5 text-sm text-zinc-400">
      <span aria-hidden="true" className="w-9 shrink-0 text-center">ℹ️</span>
      <div className="min-w-0">
        <Markdown text={message.content} lookup={lookup} />
        {message.visibleTo && <span className="ml-2 text-xs text-zinc-500">· Solo tú puedes ver esto</span>}
      </div>
    </div>
  );
}

export function Message({ message, lookup }) {
  if (message.authorId === 'system') return <SystemMessage message={message} lookup={lookup} />;
  const author = lookup.member(message.authorId);
  const replied = message.replyTo ? lookup.message(message.channelId, message.replyTo) : null;

  return (
    <article className="group px-4 py-1.5 hover:bg-ink-850/40" aria-label={`Mensaje de ${author?.name ?? 'usuario'}`}>
      {replied && (
        <div className="mb-0.5 ml-12 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500">
          <span aria-hidden="true">↪</span>
          <span className="font-medium text-zinc-400">@{lookup.member(replied.authorId)?.name}</span>
          <span className="truncate">{replied.content}</span>
        </div>
      )}
      <div className="flex gap-3">
        <Avatar member={author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium" style={{ color: author?.color ?? '#F2F3F5' }}>
              {author?.name ?? 'Usuario eliminado'}
            </span>
            {author?.bot && <span className="rounded bg-blurple px-1 py-px text-[10px] font-semibold text-white">BOT</span>}
            <time className="text-xs text-zinc-500">{time(message.at)}</time>
          </div>
          {message.content && (
            <div className="text-[15px] leading-relaxed break-words whitespace-pre-wrap text-zinc-200">
              <Markdown text={message.content} lookup={lookup} />
            </div>
          )}
          {message.embeds?.map((e, i) => <Embed key={i} embed={e} lookup={lookup} />)}
          {message.banner && <BannerCanvas spec={message.banner} />}
          {message.visibleTo && (
            <div className="mt-1 text-xs text-zinc-500">👁️ Solo tú puedes ver esto</div>
          )}
        </div>
      </div>
    </article>
  );
}
