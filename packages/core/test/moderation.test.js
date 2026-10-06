import { describe, expect, it } from 'vitest';
import { normalizeGuildData, runCommand } from '../src/index.js';
import { createContext, member, text } from './helpers.js';

const MOD_PERMS = ['BanMembers', 'KickMembers', 'ModerateMembers', 'ManageMessages'];
const owner = member('owner', { name: 'Dueña', position: 9, owner: true });
const mod = member('leo', { name: 'Leo', position: 5, perms: MOD_PERMS });
const otherMod = member('ivy', { name: 'Ivy', position: 5, perms: MOD_PERMS });
const user = member('sam', { name: 'Sam', position: 1 });
const troll = member('troll', { name: 'Troll', position: 1 });

function setup(author, extra = {}) {
  const env = createContext({ author, members: [owner, mod, otherMod, user, troll], ...extra });
  const run = async (cmd) => {
    env.ctx.cooldowns.clear();
    return (await runCommand(cmd, env.ctx)).reply;
  };
  return { ...env, run, data: () => normalizeGuildData(env.getStored()) };
}

describe('autorización', () => {
  it('un miembro sin permisos no puede banear', async () => {
    const { run, calls } = setup(user);
    expect(text(await run('&ban @troll spam'))).toContain('Banear miembros');
    expect(calls).toHaveLength(0);
  });

  it('nadie puede sancionar a alguien de rol igual o superior', async () => {
    const { run, calls } = setup(mod);
    expect(text(await run('&kick @ivy'))).toContain('igual o superior');
    expect(text(await run('&ban @owner'))).toContain('dueño');
    expect(text(await run('&ban @leo'))).toContain('ti mism@');
    expect(calls).toHaveLength(0);
  });

  it('el bot no puede actuar sobre roles por encima del suyo', async () => {
    const { run } = setup(owner, { bot: member('bot', { position: 3, bot: true }) });
    expect(text(await run('&ban @leo'))).toContain('Mi rol está por debajo');
  });

  it('el dueño puede moderar a cualquiera por debajo del bot', async () => {
    const { run, calls } = setup(owner);
    await run('&kick @leo');
    expect(calls[0][0]).toBe('kick');
  });
});

describe('acciones', () => {
  it('ban ejecuta la acción, registra el caso y lo publica en el canal de logs', async () => {
    const { ctx, run, calls, data } = setup(mod);
    await ctx.store.write({ config: { logChannel: 'c-logs' } });
    const reply = await run('&ban @troll spam reiterado');
    expect(calls.map((c) => c[0])).toEqual(['ban', 'sendToChannel']);
    expect(calls[0][2]).toBe('spam reiterado');
    expect(calls[1][1]).toBe('c-logs');
    expect(data().moderation.cases[0]).toMatchObject({ id: 1, type: 'ban', targetId: 'troll', reason: 'spam reiterado' });
    expect(text(reply)).toContain('Caso #1');
  });

  it('silenciar valida la duración', async () => {
    const { run, calls } = setup(mod);
    expect(text(await run('&silenciar @troll diez'))).toContain('Duración no válida');
    expect(text(await run('&silenciar @troll 30d'))).toContain('28 días');
    await run('&silenciar @troll 10m flood');
    expect(calls[0]).toEqual(['timeout', expect.objectContaining({ id: 'troll' }), 600_000, 'flood']);
  });

  it('al alcanzar el límite de advertencias silencia automáticamente y las reinicia', async () => {
    const { run, calls, data } = setup(mod);
    await run('&advertir @troll uno');
    await run('&advertir @troll dos');
    expect(calls.filter((c) => c[0] === 'timeout')).toHaveLength(0);
    const reply = await run('&advertir @troll tres');
    expect(calls.filter((c) => c[0] === 'timeout')).toHaveLength(1);
    expect(text(reply)).toContain('silencio automático');
    expect(text(await run('&advertencias @troll'))).toContain('Sin advertencias activas');
    expect(data().moderation.cases.map((c) => c.type)).toEqual(['warn', 'warn', 'warn', 'timeout']);
  });

  it('unban informa si el usuario no está baneado', async () => {
    const { run } = setup(mod);
    expect(text(await run('&unban Nadie'))).toContain('no está en la lista');
    expect(text(await run('&unban Troll'))).toContain('Desbaneo');
  });

  it('purgar responde de forma efímera', async () => {
    const { run } = setup(mod);
    const reply = await run('&purgar 5');
    expect(reply.ephemeral).toBe(true);
    expect(text(reply)).toContain('5 mensaje');
  });
});
