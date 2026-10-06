import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { embed } from '@dc-chatbot/core';
import { JsonGuildStore } from '../src/store.js';
import { recall, toPayload } from '../src/adapter.js';
import { renderBanner } from '../src/banner.js';

describe('JsonGuildStore', () => {
  let dir;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'dc-store-'));
  });
  afterEach(() => rm(dir, { recursive: true, force: true }));

  it('devuelve null si el servidor no tiene datos y persiste en JSON', async () => {
    const store = new JsonGuildStore(dir);
    expect(await store.read('123')).toBeNull();
    await store.write('123', { config: { prefix: '!' } });
    expect(JSON.parse(await readFile(path.join(dir, '123.json'), 'utf8'))).toEqual({ config: { prefix: '!' } });
    expect(await new JsonGuildStore(dir).read('123')).toEqual({ config: { prefix: '!' } });
    expect(await readdir(dir)).toEqual(['123.json']); // sin archivos temporales residuales
  });

  it('devuelve copias: mutar el resultado no altera la caché', async () => {
    const store = new JsonGuildStore(dir);
    await store.write('1', { n: 1 });
    (await store.read('1')).n = 99;
    expect((await store.read('1')).n).toBe(1);
  });

  it('rechaza ids que podrían escapar del directorio', async () => {
    const store = new JsonGuildStore(dir);
    await expect(store.read('../../etc/passwd')).rejects.toThrow('no válido');
  });

  it('serializa las operaciones de un mismo servidor', async () => {
    const store = new JsonGuildStore(dir);
    await store.write('g', { n: 0 });
    const increment = () =>
      store.withLock('g', async () => {
        const data = await store.read('g');
        await new Promise((r) => setTimeout(r, 5));
        data.n += 1;
        await store.write('g', data);
      });
    await Promise.all(Array.from({ length: 10 }, increment));
    expect((await store.read('g')).n).toBe(10);
  });
});

describe('toPayload', () => {
  it('convierte embeds neutrales y bloquea menciones masivas', async () => {
    const payload = await toPayload({ content: '@everyone hola', embeds: [embed({ title: 'Título', description: 'Texto', fields: [{ name: 'a', value: 'b', inline: true }] })] });
    expect(payload.embeds[0].toJSON()).toMatchObject({ title: 'Título', description: 'Texto', fields: [{ name: 'a', value: 'b', inline: true }] });
    expect(payload.allowedMentions).toEqual({ parse: ['users'], repliedUser: false });
  });

  it('adjunta el banner como imagen PNG', async () => {
    const payload = await toPayload({ banner: { title: 'Hola', username: 'Sam', subtitle: 'Servidor', accent: '#5865F2', theme: 'aurora' } });
    expect(payload.files[0].name).toBe('banner.png');
    expect(payload.files[0].attachment.subarray(1, 4).toString()).toBe('PNG');
  });

  it('crea botones para respuestas largas ligados a su autor', async () => {
    const payload = await toPayload({ embeds: [], expandable: { title: 'Completa', text: 'x'.repeat(3000) } }, { authorId: '42' });
    const [full, copy] = payload.components[0].toJSON().components;
    expect(full.custom_id).toMatch(/^full:/);
    expect(copy.custom_id).toMatch(/^copy:/);
    expect(recall(full.custom_id.split(':')[1])).toMatchObject({ authorId: '42' });
  });
});

describe('banner', () => {
  it('no descarga avatares fuera del CDN de Discord', async () => {
    const png = await renderBanner({ title: 'Hola', username: 'Sam', subtitle: 'S', accent: '#5865F2', theme: 'noche', avatarUrl: 'http://169.254.169.254/avatar.png' });
    expect(png.subarray(1, 4).toString()).toBe('PNG');
  });
});
