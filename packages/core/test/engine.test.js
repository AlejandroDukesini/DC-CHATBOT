import { describe, expect, it } from 'vitest';
import { COMMANDS, parseInvocation, runCommand, splitArgs, toSlashCommands } from '../src/index.js';
import { createContext, member, text } from './helpers.js';

const admin = member('ana', { name: 'Ana', position: 5, perms: ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages', 'ManageGuild'] });

describe('parser', () => {
  it('separa el comando del resto respetando el prefijo', () => {
    expect(parseInvocation('&ban @Troll spam', '&')).toEqual({ name: 'ban', rest: '@Troll spam' });
    expect(parseInvocation('hola', '&')).toBeNull();
    expect(parseInvocation('!PING', '!')).toEqual({ name: 'ping', rest: '' });
  });

  it('asigna tokens a opciones y el resto a la opción de texto', () => {
    const opts = [{ name: 'usuario', type: 'user' }, { name: 'motivo', type: 'text' }];
    expect(splitArgs(opts, '@Troll spam en  #general')).toEqual({ usuario: '@Troll', motivo: 'spam en  #general' });
    expect(splitArgs([{ name: 'a', type: 'string' }, { name: 'b', type: 'string' }], '"dos palabras" x')).toEqual({ a: 'dos palabras', b: 'x' });
  });
});

describe('runCommand', () => {
  it('ignora mensajes que no son comandos y comandos desconocidos', async () => {
    const { ctx } = createContext({ author: admin });
    expect(await runCommand('hola', ctx)).toBeNull();
    expect(await runCommand('&noexiste', ctx)).toBeNull();
  });

  it('resuelve alias', async () => {
    const { ctx } = createContext({ author: admin });
    const res = await runCommand('&help', ctx);
    expect(res.command.name).toBe('ayuda');
  });

  it('informa de argumentos obligatorios con el uso correcto', async () => {
    const { ctx } = createContext({ author: admin });
    const res = await runCommand('&pagar', ctx);
    expect(text(res.reply)).toContain('&pagar <usuario> <cantidad>');
    expect(res.reply.ephemeral).toBe(true);
  });

  it('valida enteros y opciones cerradas', async () => {
    const { ctx } = createContext({ author: admin });
    expect(text((await runCommand('&purgar mil', ctx)).reply)).toContain('número entero');
    expect(text((await runCommand('&purgar 500', ctx)).reply)).toContain('como máximo 100');
    expect(text((await runCommand('&apostar 10 canto', ctx)).reply)).toContain('cara');
  });

  it('aplica cooldowns por usuario y comando', async () => {
    const { ctx } = createContext({ author: admin });
    await runCommand('&ping', ctx);
    expect(text((await runCommand('&ping', ctx)).reply)).toContain('Espera');
    ctx.clock += 2000;
    expect(text((await runCommand('&ping', ctx)).reply)).toContain('Pong');
  });

  it('oculta errores internos al usuario y los registra', async () => {
    const logged = [];
    const { ctx } = createContext({ author: admin, logError: (e) => logged.push(e) });
    const res = await runCommand('&investigar algo', ctx);
    expect(text(res.reply)).toContain('error inesperado');
    expect(text(res.reply)).not.toContain('research no simulado');
    expect(logged).toHaveLength(1);
  });

  it('no guarda datos si el comando falla', async () => {
    const { ctx, getStored } = createContext({ author: admin });
    await runCommand('&depositar 99999', ctx);
    expect(getStored()).toBeNull();
  });
});

describe('slash commands', () => {
  const json = toSlashCommands();

  it('genera un slash command válido por cada comando', () => {
    expect(json).toHaveLength(COMMANDS.length);
    for (const cmd of json) {
      expect(cmd.name).toMatch(/^[a-z0-9-]{1,32}$/);
      expect(cmd.description.length).toBeGreaterThan(0);
      expect(cmd.description.length).toBeLessThanOrEqual(100);
      const firstOptional = cmd.options.findIndex((o) => !o.required);
      if (firstOptional >= 0) expect(cmd.options.slice(firstOptional).every((o) => !o.required)).toBe(true);
    }
  });

  it('restringe por defecto los comandos de moderación', () => {
    expect(json.find((c) => c.name === 'ban').default_member_permissions).toBe('4');
    expect(json.find((c) => c.name === 'silenciar').default_member_permissions).toBe(String(1n << 40n));
    expect(json.find((c) => c.name === 'balance').default_member_permissions).toBeUndefined();
  });
});
