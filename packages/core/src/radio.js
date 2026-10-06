// Radio por streaming: estaciones recomendadas + validación de enlaces enviados por usuarios.

import { UserError } from './errors.js';

// Emisoras públicas que ofrecen enlaces directos de streaming (verificadas desde Latinoamérica).
export const STATIONS = Object.freeze([
  { id: 'paradise', name: 'Radio Paradise', genre: 'Rock · indie · ecléctico', url: 'https://stream.radioparadise.com/mp3-128', source: 'radioparadise.com' },
  { id: 'mellow', name: 'Radio Paradise Mellow', genre: 'Acústico · chill', url: 'https://stream.radioparadise.com/mellow-128', source: 'radioparadise.com' },
  { id: 'chillhop', name: 'I Love Chillhop', genre: 'Lo-fi · chillhop para programar', url: 'https://streams.ilovemusic.de/iloveradio17.mp3', source: 'ilovemusic.de' },
  { id: 'kexp', name: 'KEXP 90.3 Seattle', genre: 'Alternativa · radio en vivo', url: 'https://kexp.streamguys1.com/kexp160.aac', source: 'kexp.org' },
  { id: 'plaza', name: 'Nightwave Plaza', genre: 'Vaporwave · synthwave', url: 'https://radio.plaza.one/mp3', source: 'plaza.one' },
]);

const MAX_URL_LENGTH = 500;

/** IPs privadas, locales o reservadas: un enlace de radio nunca debería apuntar ahí (SSRF). */
export function isPrivateAddress(host) {
  const h = String(host).toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (h.includes(':')) {
    if (h === '::' || h === '::1') return true;
    if (h.startsWith('::ffff:')) return isPrivateAddress(h.slice(7));
    return /^(fc|fd|fe8|fe9|fea|feb)/.test(h);
  }
  return false;
}

/** Acepta el id/nombre de una estación o un enlace http(s) público. */
export function resolveStation(input) {
  const raw = String(input ?? '').trim().replace(/^<|>$/g, '');
  if (!raw) throw new UserError('Indica una estación o un enlace de streaming.');
  const key = raw.toLowerCase();
  const preset = STATIONS.find((s) => s.id === key || s.name.toLowerCase() === key);
  if (preset) return { ...preset, custom: false };

  if (raw.length > MAX_URL_LENGTH) throw new UserError('El enlace es demasiado largo.');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UserError(`No reconozco esa estación. Usa \`radios\` para ver la lista o pega un enlace \`https://…\` de streaming.`);
  }
  if (!['http:', 'https:'].includes(url.protocol)) throw new UserError('Solo se admiten enlaces http:// o https://.');
  if (url.username || url.password) throw new UserError('El enlace no puede incluir credenciales.');
  if (isPrivateAddress(url.hostname)) throw new UserError('Ese enlace apunta a una red privada y no está permitido.');
  return { id: 'custom', name: url.hostname, genre: 'Enlace personalizado', url: url.href, source: url.hostname, custom: true };
}
