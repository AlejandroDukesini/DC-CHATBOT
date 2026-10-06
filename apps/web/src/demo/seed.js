// Datos ficticios del servidor sandbox. Pensados para mostrar estados distintos:
// un dueño, un moderador, un miembro sin permisos, un usuario con advertencias,
// cuentas con dinero e inversiones, y canales de bienvenida y registros ya configurados.

import { getAccount, normalizeGuildData } from '@dc-chatbot/core';

export const SEED_VERSION = 1;

export const GUILD = { id: 'demo-guild', name: 'Laboratorio DC', ownerId: 'u-ana' };

export const ROLES = [
  { id: 'r-bot', name: 'DC Chatbot', position: 6, color: '#5865F2', perms: ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages', 'ManageGuild'] },
  { id: 'r-admin', name: 'Admin', position: 5, color: '#F23F43', perms: ['Administrator'] },
  { id: 'r-mod', name: 'Moderador', position: 3, color: '#23A55A', perms: ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages'] },
  { id: 'r-member', name: 'Miembro', position: 1, color: '#B5BAC1', perms: [] },
  { id: 'r-new', name: 'Novato', position: 1, color: '#F0B232', perms: [] },
];

export const CHANNELS = [
  { id: 'c-general', name: 'general', topic: 'Escribe comandos aquí. Empieza con &ayuda' },
  { id: 'c-bienvenida', name: 'bienvenida', topic: 'Banners automáticos de bienvenida' },
  { id: 'c-anuncios', name: 'anuncios', topic: 'Prueba &anuncio Título | Texto' },
  { id: 'c-logs', name: 'logs-moderacion', topic: 'Registro automático de sanciones' },
];

export const VOICE_CHANNEL = { id: 'v-radio', name: 'Radio Lounge' };

/** Identidades con las que el visitante puede actuar: muestran la autorización en acción. */
export const PERSONAS = [
  { id: 'u-ana', label: 'Ana · Dueña', hint: 'Todos los permisos' },
  { id: 'u-leo', label: 'Leo · Moderador', hint: 'Puede banear, expulsar, silenciar y advertir' },
  { id: 'u-sam', label: 'Sam · Miembro', hint: 'Sin permisos de moderación' },
];

export const JOINERS = ['Nova', 'Pixel', 'Kai', 'Luna', 'Orion', 'Vega', 'Iris', 'Atlas'];

const MEMBERS = [
  { id: 'bot', name: 'DC Chatbot', roles: ['r-bot'], bot: true },
  { id: 'u-ana', name: 'Ana', roles: ['r-admin'] },
  { id: 'u-leo', name: 'Leo', roles: ['r-mod'] },
  { id: 'u-sam', name: 'Sam', roles: ['r-member'] },
  { id: 'u-marta', name: 'Marta', roles: ['r-member'] },
  { id: 'u-bytes', name: 'Bytes', roles: ['r-member'] },
  { id: 'u-troll', name: 'Troll_404', roles: ['r-member'] },
];

const HOUR = 3_600_000;

function seedGuildData(now) {
  const data = normalizeGuildData({
    config: { welcomeChannel: 'c-bienvenida', logChannel: 'c-logs', autoRole: 'r-new', bannerColor: '#5865F2', bannerTheme: 'aurora' },
  });
  const accounts = {
    'u-ana': { wallet: 1200, bank: 3000 },
    'u-leo': { wallet: 640, bank: 800 },
    'u-sam': { wallet: 150, bank: 0 },
    'u-marta': { wallet: 2400, bank: 5200, inventory: { portatil: 1, trofeo: 1 }, portfolio: { NEXO: { shares: 12, invested: 1380 }, MOON: { shares: 150, invested: 1500 } } },
    'u-bytes': { wallet: 90, bank: 300, portfolio: { SOLR: { shares: 20, invested: 900 } } },
    'u-troll': { wallet: 5, bank: 0 },
  };
  for (const [id, values] of Object.entries(accounts)) Object.assign(getAccount(data.economy, id, now), values);

  for (const [i, reason] of ['spam de enlaces', 'lenguaje ofensivo'].entries()) {
    data.moderation.cases.push({
      id: i + 1, type: 'warn', targetId: 'u-troll', targetName: 'Troll_404', moderatorId: 'u-leo', moderatorName: 'Leo', reason, at: now - (48 - i * 20) * HOUR,
    });
  }
  data.moderation.nextCase = 3;
  return data;
}

export function createSeedState(now = Date.now()) {
  const botMsg = (id, channelId, extra) => ({ id, channelId, authorId: 'bot', at: now - HOUR, ...extra });
  return {
    version: SEED_VERSION,
    members: MEMBERS.map((m) => ({ ...m, roles: [...m.roles] })),
    bans: [],
    timeouts: {},
    radio: null,
    joinerIndex: 0,
    seq: 100,
    guildData: seedGuildData(now),
    messages: {
      'c-general': [
        botMsg('m1', 'c-general', {
          embeds: [{
            title: '👋 Bienvenid@ al servidor de pruebas',
            color: 0x5865f2,
            description:
              'Este es un servidor **sandbox** con datos ficticios. Lo que escribas aquí lo procesa el mismo código que el bot real.\n\n' +
              '• Escribe `&ayuda` para ver todos los comandos\n• Prueba `&investigar agujero negro`\n• Cambia de identidad arriba para comprobar los permisos\n• `Reiniciar demo` restaura todo',
            fields: [],
          }],
        }),
      ],
      'c-bienvenida': [
        { id: 'm2', channelId: 'c-bienvenida', authorId: 'bot', at: now - 26 * HOUR, content: '¡Bienvenid@ <@u-bytes> a **Laboratorio DC**! Ya somos 6 miembros.', banner: { title: '¡BIENVENID@!', username: 'Bytes', subtitle: 'Laboratorio DC · miembro #6', accent: '#5865F2', theme: 'aurora' } },
      ],
      'c-anuncios': [],
      'c-logs': [],
    },
  };
}
