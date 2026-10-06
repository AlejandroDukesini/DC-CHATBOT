// Contexto de prueba: un servidor en memoria con miembros y roles controlados.

export function member(id, { name = id, position = 1, perms = [], owner = false, bot = false } = {}) {
  return { id, name, displayName: name, highestRolePosition: position, permissions: new Set(perms), isOwner: owner, isBot: bot, avatarUrl: null };
}

export function createContext({ author, members = [], now = 1_700_000_000_000, random = () => 0.5, ...overrides } = {}) {
  const all = new Map([author, ...members].map((m) => [m.id, m]));
  let stored = null;
  const calls = [];
  const record = (name) => async (...args) => {
    calls.push([name, ...args]);
    return undefined;
  };
  const ctx = {
    platform: 'test',
    prefix: '&',
    guild: { id: 'g1', name: 'Servidor de pruebas', memberCount: all.size, ownerId: 'owner' },
    channel: { id: 'c-general', name: 'general' },
    author,
    bot: member('bot', { name: 'DC Chatbot', position: 10, bot: true }),
    clock: now,
    now: () => ctx.clock,
    random,
    cooldowns: new Map(),
    store: {
      read: async () => (stored ? structuredClone(stored) : null),
      write: async (data) => {
        stored = structuredClone(data);
      },
    },
    resolveMember: async (token) => {
      const key = String(token).replace(/^<@!?|>$/g, '').replace(/^@/, '').toLowerCase();
      return [...all.values()].find((m) => m.id.toLowerCase() === key || m.name.toLowerCase() === key) ?? null;
    },
    resolveChannel: async (token) => {
      const name = String(token).replace(/^#/, '');
      return ['general', 'logs', 'bienvenida'].includes(name) ? { id: `c-${name}`, name } : null;
    },
    resolveRole: async (token) => (String(token).replace(/^@/, '') === 'Novato' ? { id: 'r-novato', name: 'Novato', position: 1 } : null),
    actions: {
      ban: record('ban'),
      unban: async (token) => (calls.push(['unban', token]), token === 'Troll' ? { id: 'troll', name: 'Troll' } : null),
      kick: record('kick'),
      timeout: record('timeout'),
      purge: async (n) => (calls.push(['purge', n]), n),
      addRole: record('addRole'),
      sendToChannel: record('sendToChannel'),
      playRadio: record('playRadio'),
      stopRadio: async () => true,
      nowPlaying: async () => null,
    },
    research: async () => {
      throw new Error('research no simulado');
    },
    logError: () => {},
    ...overrides,
  };
  return { ctx, calls, getStored: () => stored };
}

export const text = (reply) => JSON.stringify(reply);
