// Servidor sandbox de la demo. Implementa en el navegador la misma interfaz de
// adaptador que el bot implementa con discord.js, y ejecuta el motor de comandos real
// (@dc-chatbot/core). Todo el estado vive en localStorage: sin base de datos y sin
// acceso a Discord ni a datos reales.

import { UserError, handleMemberJoin, normalizeGuildData, runCommand } from '@dc-chatbot/core';
import { CHANNELS, GUILD, JOINERS, ROLES, SEED_VERSION, createSeedState } from './seed.js';

export const STORAGE_KEY = 'dc-chatbot-demo';
const MAX_MESSAGES_PER_CHANNEL = 80;

function safeStorage(storage) {
  return {
    load() {
      try {
        const raw = storage?.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.version === SEED_VERSION ? parsed : null;
      } catch {
        return null;
      }
    },
    save(state) {
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Almacenamiento lleno o bloqueado (modo privado): la demo sigue funcionando en memoria.
      }
    },
    clear() {
      try {
        storage?.removeItem(STORAGE_KEY);
      } catch {
        // ignorado
      }
    },
  };
}

const roleById = (id) => ROLES.find((r) => r.id === id);

/** Convierte un miembro del sandbox al formato neutral que espera el motor. */
export function toMember(m) {
  const roles = m.roles.map(roleById).filter(Boolean);
  return {
    id: m.id,
    name: m.name,
    displayName: m.name,
    avatarUrl: null,
    isBot: Boolean(m.bot),
    isOwner: m.id === GUILD.ownerId,
    highestRolePosition: Math.max(0, ...roles.map((r) => r.position)),
    permissions: new Set(roles.flatMap((r) => r.perms)),
    color: [...roles].sort((a, b) => b.position - a.position)[0]?.color ?? '#B5BAC1',
  };
}

const clean = (token, re) => String(token ?? '').trim().replace(re, '').toLowerCase();

export function createDemoStore({ storage = globalThis.localStorage, now = () => Date.now(), research } = {}) {
  const persist = safeStorage(storage);
  let state = persist.load() ?? createSeedState(now());
  const listeners = new Set();
  const cooldowns = new Map();

  const emit = () => listeners.forEach((l) => l());
  const update = (mutate) => {
    const next = structuredClone(state);
    mutate(next);
    state = next;
    persist.save(state);
    emit();
  };

  const nextId = (s) => `m${++s.seq}`;
  const post = (s, channelId, message) => {
    const list = (s.messages[channelId] ??= []);
    list.push({ id: nextId(s), channelId, at: now(), ...message });
    if (list.length > MAX_MESSAGES_PER_CHANNEL) list.splice(0, list.length - MAX_MESSAGES_PER_CHANNEL);
  };

  async function defaultResearch(query) {
    let res;
    try {
      res = await fetch(`/api/research?q=${encodeURIComponent(query)}`);
    } catch {
      throw new UserError('No hay conexión con el servidor de la demo.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new UserError(body.error ?? 'Las fuentes no respondieron. Inténtalo de nuevo.');
    return body;
  }

  function findMember(token) {
    const key = clean(token, /^<@!?|>$|^@/g);
    if (!key) return null;
    const members = state.members;
    const m = members.find((x) => x.id.toLowerCase() === key || x.name.toLowerCase() === key)
      ?? members.find((x) => x.name.toLowerCase().startsWith(key));
    return m ? toMember(m) : null;
  }

  /** Construye el contexto que el motor necesita, igual que hace el bot con discord.js. */
  function createContext(authorId, channelId) {
    const author = state.members.find((m) => m.id === authorId);
    const bot = state.members.find((m) => m.bot);
    return {
      platform: 'demo',
      prefix: state.guildData.config.prefix,
      guild: { ...GUILD, memberCount: state.members.length },
      channel: CHANNELS.find((c) => c.id === channelId),
      author: toMember(author),
      bot: toMember(bot),
      now,
      random: Math.random,
      cooldowns,
      logError: (err) => console.error('[demo]', err),
      store: {
        read: async () => structuredClone(state.guildData),
        write: async (data) => update((s) => void (s.guildData = data)),
      },
      resolveMember: async (token) => findMember(token),
      resolveChannel: async (token) => {
        const key = clean(token, /^<#|>$|^#/g);
        return CHANNELS.find((c) => c.id === key || c.name === key) ?? null;
      },
      resolveRole: async (token) => {
        const key = clean(token, /^<@&|>$|^@/g);
        return ROLES.find((r) => r.id === key || r.name.toLowerCase() === key) ?? null;
      },
      research: research ?? defaultResearch,
      actions: {
        ban: async (member, reason) =>
          update((s) => {
            s.members = s.members.filter((m) => m.id !== member.id);
            s.bans.push({ id: member.id, name: member.name, reason: reason ?? null });
          }),
        unban: async (token) => {
          const key = clean(token, /^<@!?|>$|^@/g);
          const ban = state.bans.find((b) => b.id.toLowerCase() === key || b.name.toLowerCase() === key);
          if (!ban) return null;
          update((s) => {
            s.bans = s.bans.filter((b) => b.id !== ban.id);
          });
          return { id: ban.id, name: ban.name, displayName: ban.name };
        },
        kick: async (member) => update((s) => void (s.members = s.members.filter((m) => m.id !== member.id))),
        timeout: async (member, ms) => update((s) => void (s.timeouts[member.id] = now() + ms)),
        purge: async (count) => {
          let deleted = 0;
          update((s) => {
            const list = s.messages[channelId];
            // Respeta el mensaje del comando (el último) y borra los anteriores.
            const removable = Math.max(0, list.length - 1);
            deleted = Math.min(count, removable);
            list.splice(removable - deleted, deleted);
          });
          return deleted;
        },
        addRole: async (member, roleId) =>
          update((s) => {
            const m = s.members.find((x) => x.id === member.id);
            if (m && !m.roles.includes(roleId)) m.roles.push(roleId);
          }),
        sendToChannel: async (targetId, reply) => update((s) => post(s, targetId, { authorId: 'bot', ...reply })),
        playRadio: async (station) => {
          if (!station.url.startsWith('https://')) {
            throw new UserError('En la demo web el navegador solo puede reproducir enlaces https://. El bot real admite también http://.');
          }
          update((s) => void (s.radio = { ...station, startedBy: authorId }));
        },
        stopRadio: async () => {
          const was = Boolean(state.radio);
          update((s) => void (s.radio = null));
          return was;
        },
        nowPlaying: async () => state.radio,
      },
    };
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    /** Publica el mensaje del visitante y, si es un comando, la respuesta del bot. */
    async send(authorId, channelId, text) {
      const content = String(text).trim().slice(0, 2000);
      if (!content) return;
      if (!state.members.some((m) => m.id === authorId)) return;
      const until = state.timeouts[authorId] ?? 0;
      if (until > now()) {
        update((s) => post(s, channelId, { authorId: 'system', visibleTo: authorId, content: `🔇 Estás aislad@ temporalmente y no puedes escribir hasta las ${new Date(until).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}.` }));
        return;
      }
      let userMessageId;
      update((s) => {
        post(s, channelId, { authorId, content });
        userMessageId = s.messages[channelId].at(-1).id;
      });

      const result = await runCommand(content, createContext(authorId, channelId));
      if (!result) {
        if (content.startsWith(state.guildData.config.prefix)) {
          update((s) => post(s, channelId, { authorId: 'system', visibleTo: authorId, content: `Ese comando no existe. Escribe \`${s.guildData.config.prefix}ayuda\` para ver la lista.` }));
        }
        return;
      }
      const { ephemeral, ...reply } = result.reply;
      update((s) => post(s, channelId, { authorId: 'bot', replyTo: userMessageId, visibleTo: ephemeral ? authorId : undefined, command: result.command.name, ...reply }));
    },

    /** Simula la llegada de un miembro nuevo: ejecuta el flujo real de bienvenida + autorol. */
    async simulateJoin() {
      let joined;
      update((s) => {
        const base = JOINERS[s.joinerIndex % JOINERS.length];
        const round = Math.floor(s.joinerIndex / JOINERS.length);
        const name = round ? `${base}${round + 1}` : base;
        s.joinerIndex += 1;
        joined = { id: `u-new-${s.joinerIndex}`, name, roles: ['r-member'] };
        s.members.push(joined);
        post(s, 'c-general', { authorId: 'system', content: `➡️ **${name}** se unió al servidor.` });
      });
      const ctx = createContext(GUILD.ownerId, 'c-general');
      return handleMemberJoin(ctx, toMember(joined), normalizeGuildData(state.guildData));
    },

    reset() {
      persist.clear();
      cooldowns.clear();
      state = createSeedState(now());
      persist.save(state);
      emit();
    },
  };
}
