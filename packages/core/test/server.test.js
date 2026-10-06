import { describe, expect, it } from 'vitest';
import { BANNER_SIZE, drawBanner, handleMemberJoin, isPrivateAddress, normalizeGuildData, resolveStation, runCommand } from '../src/index.js';
import { createContext, member, text } from './helpers.js';

const admin = member('ana', { name: 'Ana', position: 5, perms: ['ManageGuild', 'ManageMessages'] });
const sam = member('sam', { name: 'Sam' });

describe('configuración', () => {
  it('solo quien gestiona el servidor puede cambiarla', async () => {
    const { ctx } = createContext({ author: sam });
    expect(text((await runCommand('&config prefix !', ctx)).reply)).toContain('Gestionar servidor');
  });

  it('valida y guarda cada clave', async () => {
    const { ctx, getStored } = createContext({ author: admin });
    const run = async (c) => {
      ctx.cooldowns.clear();
      return (await runCommand(c, ctx)).reply;
    };
    await run('&config welcomeChannel #bienvenida');
    await run('&config autoRole @Novato');
    await run('&config bannerColor #eb459e');
    expect(text(await run('&config bannerColor rosa'))).toContain('hexadecimal');
    expect(text(await run('&config prefix dosespacios'))).toContain('entre 1 y 3');
    expect(text(await run('&config welcomeChannel #noexiste'))).toContain('No encontré ese canal');
    expect(getStored().config).toMatchObject({ welcomeChannel: 'c-bienvenida', autoRole: 'r-novato', bannerColor: '#EB459E', prefix: '&' });
    await run('&config welcomeChannel ninguno');
    expect(getStored().config.welcomeChannel).toBeNull();
  });

  it('un prefijo nuevo se respeta', async () => {
    const { ctx } = createContext({ author: admin, prefix: '!' });
    expect(await runCommand('&ping', ctx)).toBeNull();
    expect(text((await runCommand('!ping', ctx)).reply)).toContain('Pong');
  });
});

describe('bienvenida', () => {
  it('envía el banner al canal configurado y asigna el rol automático', async () => {
    const { ctx, calls } = createContext({ author: admin });
    const data = normalizeGuildData({ config: { welcomeChannel: 'c-bienvenida', autoRole: 'r-novato' } });
    const done = await handleMemberJoin(ctx, sam, data);
    expect(done).toEqual(['welcome', 'autoRole']);
    const [, channelId, payload] = calls[0];
    expect(channelId).toBe('c-bienvenida');
    expect(payload.content).toContain('<@sam>');
    expect(payload.content).toContain('Servidor de pruebas');
    expect(payload.banner.username).toBe('Sam');
    expect(calls[1]).toEqual(['addRole', sam, 'r-novato']);
  });

  it('no hace nada si no hay canal ni rol configurados', async () => {
    const { ctx, calls } = createContext({ author: admin });
    expect(await handleMemberJoin(ctx, sam, normalizeGuildData(null))).toEqual([]);
    expect(calls).toHaveLength(0);
  });

  it('el anuncio separa título y texto', async () => {
    const { ctx } = createContext({ author: admin });
    const { reply } = await runCommand('&anuncio Torneo | Sábado a las 18 h', ctx);
    expect(reply.embeds[0]).toMatchObject({ title: '📢 Torneo', description: 'Sábado a las 18 h' });
  });
});

describe('banner', () => {
  it('se dibuja con la API estándar de Canvas', () => {
    const ops = [];
    const canvas = new Proxy({}, {
      get(target, prop) {
        if (prop in target) return target[prop];
        if (prop === 'measureText') return (t) => ({ width: t.length * 20 });
        if (prop === 'createLinearGradient') return () => ({ addColorStop: () => {} });
        return (...args) => ops.push([prop, ...args]);
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    });
    drawBanner(canvas, { title: 'Hola', username: 'Sam', subtitle: 'Servidor', accent: '#5865F2', theme: 'aurora' });
    expect(ops.some(([op, t]) => op === 'fillText' && t === 'Sam')).toBe(true);
    expect(ops.some(([op, t]) => op === 'fillText' && t === 'S')).toBe(true); // iniciales sin avatar
    expect(BANNER_SIZE.width).toBeGreaterThan(BANNER_SIZE.height);
  });
});

describe('radio', () => {
  it('resuelve estaciones por id', () => {
    expect(resolveStation('chillhop')).toMatchObject({ custom: false, name: 'I Love Chillhop' });
  });

  it('acepta enlaces públicos http(s)', () => {
    expect(resolveStation('https://stream.example.com/live.mp3')).toMatchObject({ custom: true, name: 'stream.example.com' });
  });

  it.each([
    'file:///etc/passwd',
    'http://localhost:8080/stream',
    'http://127.0.0.1/a',
    'http://10.0.0.5/a',
    'http://192.168.1.10/a',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/a',
    'https://user:pass@example.com/a',
    'no es una url',
  ])('rechaza %s', (url) => {
    expect(() => resolveStation(url)).toThrow();
  });

  it('detecta rangos privados', () => {
    expect(isPrivateAddress('172.16.0.1')).toBe(true);
    expect(isPrivateAddress('172.32.0.1')).toBe(false);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true);
  });
});
