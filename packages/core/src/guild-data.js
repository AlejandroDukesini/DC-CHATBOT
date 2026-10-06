// Estructura de datos por servidor. El bot la guarda en un archivo JSON
// y la demo web en localStorage: ninguna de las dos necesita base de datos.

export const DATA_VERSION = 1;

export const DEFAULT_CONFIG = Object.freeze({
  prefix: '&',
  welcomeChannel: null,
  welcomeMessage: '¡Bienvenid@ {user} a **{server}**! Ya somos {count} miembros.',
  autoRole: null,
  logChannel: null,
  bannerColor: '#5865F2',
  bannerTheme: 'aurora',
  warnLimit: 3,
  dailyAmount: 200,
  currency: '🪙',
  aiProvider: 'chatgpt',
});

export function createGuildData() {
  return {
    version: DATA_VERSION,
    config: { ...DEFAULT_CONFIG },
    economy: { users: {} },
    moderation: { cases: [], nextCase: 1 },
  };
}

/** Completa con valores por defecto cualquier dato guardado (antiguo o parcial). */
export function normalizeGuildData(raw) {
  const base = createGuildData();
  if (!raw || typeof raw !== 'object') return base;
  return {
    version: DATA_VERSION,
    config: { ...base.config, ...(raw.config ?? {}) },
    economy: { users: { ...(raw.economy?.users ?? {}) } },
    moderation: {
      cases: Array.isArray(raw.moderation?.cases) ? [...raw.moderation.cases] : [],
      nextCase: Number(raw.moderation?.nextCase) || 1,
    },
  };
}
