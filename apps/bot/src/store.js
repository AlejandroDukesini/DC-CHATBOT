// Almacenamiento por servidor en archivos JSON: sin base de datos que instalar ni mantener.
// Escrituras atómicas (archivo temporal + rename) y un cerrojo por servidor para que
// dos comandos simultáneos no se pisen los datos.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VALID_ID = /^[\w-]{1,32}$/;

export class JsonGuildStore {
  constructor(dir) {
    this.dir = dir;
    this.cache = new Map();
    this.locks = new Map();
  }

  file(guildId) {
    // Evita rutas como "../../etc": el id de servidor siempre es un snowflake numérico.
    if (!VALID_ID.test(guildId)) throw new Error(`Id de servidor no válido: ${guildId}`);
    return path.join(this.dir, `${guildId}.json`);
  }

  async read(guildId) {
    if (!this.cache.has(guildId)) {
      try {
        this.cache.set(guildId, JSON.parse(await readFile(this.file(guildId), 'utf8')));
      } catch (err) {
        if (err.code !== 'ENOENT') throw err;
        this.cache.set(guildId, null);
      }
    }
    const data = this.cache.get(guildId);
    return data ? structuredClone(data) : null;
  }

  async write(guildId, data) {
    const target = this.file(guildId);
    await mkdir(this.dir, { recursive: true });
    const tmp = `${target}.${process.pid}.tmp`;
    await writeFile(tmp, JSON.stringify(data, null, 2), 'utf8');
    await rename(tmp, target);
    this.cache.set(guildId, structuredClone(data));
  }

  forGuild(guildId) {
    return { read: () => this.read(guildId), write: (data) => this.write(guildId, data) };
  }

  /** Ejecuta fn en exclusiva para ese servidor (las operaciones se encolan). */
  async withLock(guildId, fn) {
    const previous = this.locks.get(guildId) ?? Promise.resolve();
    let release;
    const current = new Promise((resolve) => (release = resolve));
    const chain = previous.then(() => current);
    this.locks.set(guildId, chain);
    await previous;
    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(guildId) === chain) this.locks.delete(guildId);
    }
  }
}
