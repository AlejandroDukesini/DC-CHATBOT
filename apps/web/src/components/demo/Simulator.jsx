import { useEffect, useMemo, useRef, useState } from 'react';
import { COMMANDS, usage } from '@dc-chatbot/core';
import { useDemo } from '../../demo/useDemo.js';
import { CHANNELS, GUILD, PERSONAS, ROLES, VOICE_CHANNEL } from '../../demo/seed.js';
import { toMember } from '../../demo/sandbox.js';
import { Avatar, Message } from './Message.jsx';
import { RadioPlayer } from './RadioPlayer.jsx';

export const QUICK_COMMANDS = [
  { label: '🔎 Investigar', cmd: '&investigar agujero negro' },
  { label: '🎁 Diario', cmd: '&diario' },
  { label: '📈 Mercado', cmd: '&mercado' },
  { label: '💹 Invertir', cmd: '&invertir nexo 2' },
  { label: '⚠️ Advertir', cmd: '&advertir @Troll_404 spam' },
  { label: '🔨 Banear', cmd: '&ban @Troll_404 spam reiterado' },
  { label: '🖼️ Banner', cmd: '&banner' },
  { label: '📻 Radio', cmd: '&radio chillhop' },
  { label: '⚙️ Config', cmd: '&config' },
  { label: '📚 Ayuda', cmd: '&ayuda' },
];

const withPrefix = (cmd, prefix) => prefix + cmd.slice(1);

function MemberList({ state, lookup }) {
  const groups = useMemo(() => {
    const byRole = new Map();
    for (const m of state.members) {
      const top = [...m.roles].map((id) => ROLES.find((r) => r.id === id)).sort((a, b) => b.position - a.position)[0];
      const key = top?.name ?? 'Sin rol';
      if (!byRole.has(key)) byRole.set(key, { role: top, members: [] });
      byRole.get(key).members.push(m);
    }
    return [...byRole.values()].sort((a, b) => (b.role?.position ?? 0) - (a.role?.position ?? 0));
  }, [state.members]);

  return (
    <aside className="hidden w-56 shrink-0 overflow-y-auto border-l border-ink-700 bg-ink-900 p-3 lg:block" aria-label="Miembros">
      {groups.map(({ role, members }) => (
        <div key={role?.id ?? 'none'} className="mb-4">
          <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
            {role?.name ?? 'Sin rol'} — {members.length}
          </h4>
          {members.map((m) => {
            const muted = (state.timeouts[m.id] ?? 0) > Date.now();
            const info = lookup.member(m.id);
            return (
              <div key={m.id} className="flex items-center gap-2 rounded px-1.5 py-1">
                <Avatar member={info} size="h-7 w-7" />
                <span className="truncate text-sm" style={{ color: info.color }}>{m.name}</span>
                {m.roles.includes('r-new') && <span title="Rol automático: Novato" className="text-xs">🌱</span>}
                {muted && <span title="Aislado temporalmente" className="text-xs">🔇</span>}
              </div>
            );
          })}
        </div>
      ))}
      {state.bans.length > 0 && (
        <div>
          <h4 className="mb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Baneados — {state.bans.length}</h4>
          {state.bans.map((b) => (
            <div key={b.id} className="px-1.5 py-1 text-sm text-zinc-500 line-through">{b.name}</div>
          ))}
        </div>
      )}
    </aside>
  );
}

export function Simulator({ prefill, researchFn }) {
  const { store, state, lookup } = useDemo(researchFn ? { research: researchFn } : undefined);
  const [personaId, setPersonaId] = useState(PERSONAS[0].id);
  const [channelId, setChannelId] = useState('c-general');
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [seen, setSeen] = useState(() => Object.fromEntries(CHANNELS.map((c) => [c.id, state.messages[c.id]?.length ?? 0])));
  const [lastPrefill, setLastPrefill] = useState(prefill);
  const scroller = useRef(null);
  const inputRef = useRef(null);

  const prefix = state.guildData.config.prefix;
  const messages = state.messages[channelId] ?? [];
  const visible = messages.filter((m) => !m.visibleTo || m.visibleTo === personaId);
  const personaPresent = state.members.some((m) => m.id === personaId);
  const persona = personaPresent ? toMember(state.members.find((m) => m.id === personaId)) : null;

  // Al cambiar de canal se marcan como leídos el canal que se deja y el que se abre.
  function openChannel(id) {
    const count = (cid) => store.getState().messages[cid]?.length ?? 0;
    setSeen((s) => ({ ...s, [channelId]: count(channelId), [id]: count(id) }));
    setChannelId(id);
  }

  // Los botones "Probar" de la landing rellenan el campo (ajuste de estado durante el render).
  if (prefill !== lastPrefill) {
    setLastPrefill(prefill);
    if (prefill?.text) {
      if (channelId !== 'c-general') openChannel('c-general');
      setInput(withPrefix(prefill.text, prefix));
    }
  }

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length, channelId, pending]);

  useEffect(() => {
    if (prefill?.text) inputRef.current?.focus({ preventScroll: true });
  }, [prefill]);

  const suggestions = useMemo(() => {
    if (!input.startsWith(prefix) || input.includes(' ')) return [];
    const typed = input.slice(prefix.length).toLowerCase();
    return COMMANDS.filter((c) => c.name.startsWith(typed) || c.aliases?.some((a) => a.startsWith(typed))).slice(0, 6);
  }, [input, prefix]);

  async function send(text) {
    const content = text.trim();
    if (!content || pending || !personaPresent) return;
    setInput('');
    setPending(true);
    try {
      await store.send(personaId, channelId, content);
    } finally {
      setPending(false);
    }
  }

  async function join() {
    const done = await store.simulateJoin();
    setNotice(done.length ? 'Nuevo miembro: revisa #bienvenida (banner) y la lista de miembros (rol 🌱 Novato).' : 'Nuevo miembro añadido. Configura welcomeChannel o autoRole para ver la bienvenida.');
  }

  function reset() {
    store.reset();
    setPersonaId(PERSONAS[0].id);
    setChannelId('c-general');
    setSeen(Object.fromEntries(CHANNELS.map((c) => [c.id, store.getState().messages[c.id]?.length ?? 0])));
    setNotice('Demo reiniciada: datos iniciales restaurados.');
  }

  const channel = CHANNELS.find((c) => c.id === channelId);

  return (
    <div>
      {/* Controles de la demo */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <fieldset className="flex flex-wrap items-center gap-2">
          <legend className="sr-only">Actuar como</legend>
          <span className="text-sm text-zinc-400">Actuar como:</span>
          {PERSONAS.map((p) => (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              aria-pressed={personaId === p.id}
              onClick={() => setPersonaId(p.id)}
              className={`rounded-md border px-2.5 py-1 text-sm transition-colors ${
                personaId === p.id ? 'border-blurple bg-blurple/15 text-zinc-100' : 'border-ink-700 text-zinc-400 hover:border-ink-600 hover:text-zinc-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </fieldset>
        <div className="flex gap-2">
          <button type="button" onClick={join} className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-ink-600 hover:text-zinc-100">
            ➕ Simular nuevo miembro
          </button>
          <button type="button" onClick={reset} className="rounded-md border border-ink-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-red-500/60 hover:text-red-300">
            ↺ Reiniciar demo
          </button>
        </div>
      </div>
      <p aria-live="polite" className="mb-2 min-h-5 text-sm text-emerald-300">{notice}</p>

      {/* Ventana tipo Discord */}
      <div className="flex h-[min(78vh,680px)] overflow-hidden rounded-xl border border-ink-700 bg-ink-800 shadow-2xl shadow-black/40">
        <nav className="hidden w-56 shrink-0 flex-col border-r border-ink-700 bg-ink-900 md:flex" aria-label="Canales">
          <div className="border-b border-ink-700 px-4 py-3 font-semibold text-zinc-100">{GUILD.name}</div>
          <div className="flex-1 overflow-y-auto p-2">
            <h4 className="px-2 pt-2 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Canales de texto</h4>
            {CHANNELS.map((c) => {
              const unread = (state.messages[c.id]?.length ?? 0) - (seen[c.id] ?? 0);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => openChannel(c.id)}
                  aria-current={c.id === channelId ? 'page' : undefined}
                  className={`flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-[15px] ${
                    c.id === channelId ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400 hover:bg-ink-800 hover:text-zinc-200'
                  }`}
                >
                  <span className="text-zinc-500">#</span>
                  <span className="flex-1 truncate">{c.name}</span>
                  {unread > 0 && c.id !== channelId && (
                    <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white" aria-label={`${unread} mensajes nuevos`}>{unread}</span>
                  )}
                </button>
              );
            })}
            <h4 className="px-2 pt-4 pb-1 text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">Canales de voz</h4>
            <div className="px-2 py-1.5 text-[15px] text-zinc-400">🔊 {VOICE_CHANNEL.name}</div>
            {state.radio && (
              <div className="ml-6 flex items-center gap-2 py-1 text-sm text-zinc-300">
                <Avatar member={lookup.member('bot')} size="h-5 w-5" /> DC Chatbot
              </div>
            )}
          </div>
        </nav>

        <section className="flex min-w-0 flex-1 flex-col" aria-label={`Canal #${channel.name}`}>
          <header className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
            <span className="text-xl text-zinc-500">#</span>
            <h3 className="font-semibold text-zinc-100">{channel.name}</h3>
            <span className="hidden truncate border-l border-ink-600 pl-2 text-sm text-zinc-500 sm:block">{channel.topic}</span>
          </header>
          {/* Canales en móvil */}
          <div className="flex gap-1 overflow-x-auto border-b border-ink-700 px-2 py-1.5 md:hidden">
            {CHANNELS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => openChannel(c.id)}
                className={`shrink-0 rounded px-2 py-1 text-sm ${c.id === channelId ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400'}`}
              >
                #{c.name}
              </button>
            ))}
          </div>
          {/* Una sola instancia: dos <audio> sonarían a la vez. */}
          {state.radio && <RadioPlayer key={state.radio.url} station={state.radio} onStop={() => send(`${prefix}detener`)} />}

          <div ref={scroller} className="flex-1 overflow-y-auto py-3" role="log" aria-live="polite" aria-label="Mensajes">
            {visible.length === 0 && (
              <div className="px-6 py-10 text-center text-sm text-zinc-500">
                Aún no hay mensajes en #{channel.name}.{' '}
                {channelId === 'c-logs' && 'Las sanciones (ban, advertir, silenciar…) se registrarán aquí automáticamente.'}
                {channelId === 'c-anuncios' && `Prueba ${prefix}anuncio Título | Texto del anuncio.`}
              </div>
            )}
            {visible.map((m) => (
              <Message key={m.id} message={m} lookup={lookup} />
            ))}
            {pending && (
              <div className="px-4 py-2 text-sm text-zinc-400" role="status">
                <span className="inline-block animate-pulse">●●●</span> <strong className="text-zinc-300">DC Chatbot</strong> está escribiendo…
              </div>
            )}
          </div>

          <div className="relative px-3 pb-2">
            {suggestions.length > 0 && (
              <ul className="absolute right-3 bottom-full left-3 mb-1 overflow-hidden rounded-lg border border-ink-700 bg-ink-900 shadow-xl" role="listbox" aria-label="Sugerencias de comandos">
                {suggestions.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      onClick={() => {
                        setInput(`${prefix}${c.name} `);
                        inputRef.current?.focus();
                      }}
                      className="flex w-full items-baseline gap-3 px-3 py-2 text-left hover:bg-ink-800"
                    >
                      <code className="shrink-0 font-mono text-sm text-zinc-100">{usage(c, prefix)}</code>
                      <span className="truncate text-xs text-zinc-500">{c.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-center gap-2 rounded-lg bg-ink-700 px-3"
            >
              <label htmlFor="demo-input" className="sr-only">Mensaje para #{channel.name}</label>
              <input
                id="demo-input"
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && suggestions.length) {
                    e.preventDefault();
                    setInput(`${prefix}${suggestions[0].name} `);
                  }
                }}
                disabled={!personaPresent}
                maxLength={2000}
                autoComplete="off"
                placeholder={personaPresent ? `Escribe un comando, p. ej. ${prefix}ayuda` : `${PERSONAS.find((p) => p.id === personaId).label} ya no está en el servidor. Cambia de identidad o reinicia la demo.`}
                className="min-w-0 flex-1 bg-transparent py-3 text-[15px] text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
              />
              <button type="submit" disabled={!input.trim() || pending || !personaPresent} className="rounded-md bg-blurple px-3 py-1.5 text-sm font-medium text-white hover:bg-blurple-dark disabled:opacity-40">
                Enviar
              </button>
            </form>
            <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1" aria-label="Comandos de ejemplo">
              {QUICK_COMMANDS.map((q) => (
                <button
                  key={q.cmd}
                  type="button"
                  onClick={() => send(withPrefix(q.cmd, prefix))}
                  disabled={pending || !personaPresent}
                  title={withPrefix(q.cmd, prefix)}
                  className="shrink-0 rounded-full border border-ink-600 px-2.5 py-1 text-xs text-zinc-300 hover:border-blurple hover:text-zinc-100 disabled:opacity-40"
                >
                  {q.label}
                </button>
              ))}
            </div>
            {persona && (
              <p className="mt-1 text-xs text-zinc-500">
                Escribes como <strong style={{ color: persona.color }}>{persona.name}</strong> · {PERSONAS.find((p) => p.id === personaId).hint}
              </p>
            )}
          </div>
        </section>

        <MemberList state={state} lookup={lookup} />
      </div>
    </div>
  );
}
