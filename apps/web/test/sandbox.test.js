import { describe, expect, it } from 'vitest';
import { STORAGE_KEY, createDemoStore } from '../src/demo/sandbox.js';

function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k), map };
}

function setup(options = {}) {
  let clock = 1_700_000_000_000;
  const storage = options.storage ?? memoryStorage();
  const store = createDemoStore({ storage, now: () => clock, ...options });
  const last = (channel = 'c-general') => store.getState().messages[channel].at(-1);
  const send = async (author, text, channel = 'c-general') => {
    clock += 10_000; // evita cooldowns entre comandos
    await store.send(author, channel, text);
    return last(channel);
  };
  return { store, storage, send, last, advance: (ms) => (clock += ms) };
}

const json = (v) => JSON.stringify(v);

describe('sandbox de la demo', () => {
  it('arranca con datos de demostración coherentes', () => {
    const { store } = setup();
    const s = store.getState();
    expect(s.members.map((m) => m.name)).toEqual(expect.arrayContaining(['Ana', 'Leo', 'Sam', 'Troll_404', 'DC Chatbot']));
    expect(s.guildData.config).toMatchObject({ welcomeChannel: 'c-bienvenida', logChannel: 'c-logs', autoRole: 'r-new' });
    expect(s.guildData.moderation.cases.filter((c) => c.targetId === 'u-troll')).toHaveLength(2);
    expect(s.guildData.economy.users['u-marta'].portfolio.NEXO.shares).toBe(12);
  });

  it('responde a un comando con el motor real y enlaza la respuesta al mensaje', async () => {
    const { send, store } = setup();
    const reply = await send('u-sam', '&ping');
    expect(reply.authorId).toBe('bot');
    expect(json(reply.embeds)).toContain('Pong');
    const question = store.getState().messages['c-general'].at(-2);
    expect(reply.replyTo).toBe(question.id);
  });

  it('un miembro sin permisos recibe un error visible solo para él', async () => {
    const { send, store } = setup();
    const reply = await send('u-sam', '&ban @Troll_404 spam');
    expect(reply.visibleTo).toBe('u-sam');
    expect(json(reply.embeds)).toContain('Banear miembros');
    expect(store.getState().members.some((m) => m.id === 'u-troll')).toBe(true);
  });

  it('el moderador banea: el miembro sale del servidor y el caso llega a #logs-moderacion', async () => {
    const { send, store, last } = setup();
    await send('u-leo', '&ban @Troll_404 spam reiterado');
    const s = store.getState();
    expect(s.members.some((m) => m.id === 'u-troll')).toBe(false);
    expect(s.bans).toEqual([expect.objectContaining({ id: 'u-troll', reason: 'spam reiterado' })]);
    expect(json(last('c-logs').embeds)).toContain('Caso #3');
    await send('u-leo', '&unban Troll_404');
    expect(store.getState().bans).toHaveLength(0);
  });

  it('la tercera advertencia silencia al usuario, que ya no puede escribir', async () => {
    const { send } = setup();
    const reply = await send('u-leo', '&advertir @Troll_404 flood');
    expect(reply.content).toContain('silencio automático');
    const blocked = await send('u-troll', 'hola');
    expect(blocked).toMatchObject({ authorId: 'system', visibleTo: 'u-troll' });
  });

  it('simular un nuevo miembro publica el banner y asigna el rol automático', async () => {
    const { store, last } = setup();
    const done = await store.simulateJoin();
    expect(done).toEqual(['welcome', 'autoRole']);
    const welcome = last('c-bienvenida');
    expect(welcome.banner.username).toBe('Nova');
    expect(welcome.content).toContain('<@u-new-1>');
    expect(store.getState().members.find((m) => m.id === 'u-new-1').roles).toContain('r-new');
  });

  it('purgar borra los mensajes anteriores al comando', async () => {
    const { send, store } = setup();
    await send('u-sam', 'uno');
    await send('u-sam', 'dos');
    const before = store.getState().messages['c-general'].length;
    const reply = await send('u-leo', '&purgar 2');
    expect(json(reply.embeds)).toContain('2 mensaje');
    expect(store.getState().messages['c-general']).toHaveLength(before - 2 + 1 + 1);
  });

  it('la radio solo acepta https en el navegador', async () => {
    const { send, store } = setup();
    expect(json((await send('u-sam', '&radio http://radio.example.com/live')).embeds)).toContain('https://');
    await send('u-sam', '&radio chillhop');
    expect(store.getState().radio).toMatchObject({ id: 'chillhop' });
    await send('u-sam', '&detener');
    expect(store.getState().radio).toBeNull();
  });

  it('usa el investigador inyectado y muestra sus fuentes', async () => {
    const research = async (q) => ({
      query: q, language: 'es', answer: 'Texto.', highlights: [{ text: 'Un agujero negro es una región del espacio.', source: 0 }],
      sources: [{ title: 'Agujero negro', url: 'https://es.wikipedia.org/wiki/Agujero_negro', type: 'Wikipedia (es)', verification: 'Contrastado con Wikidata Q589' }],
      references: [], steps: ['paso'], confidence: 0.9, confidenceLabel: 'alta',
    });
    const { send } = setup({ research });
    const reply = await send('u-sam', '&investigar agujero negro');
    expect(json(reply.embeds)).toContain('Contrastado con Wikidata Q589');
  });

  it('los comandos desconocidos dan una pista privada', async () => {
    const { send } = setup();
    expect(await send('u-sam', '&volar')).toMatchObject({ authorId: 'system', visibleTo: 'u-sam' });
  });

  it('persiste en el almacenamiento y el reinicio restaura los datos iniciales', async () => {
    const storage = memoryStorage();
    const first = setup({ storage });
    await first.send('u-leo', '&kick @Bytes');
    expect(storage.map.has(STORAGE_KEY)).toBe(true);

    const second = setup({ storage });
    expect(second.store.getState().members.some((m) => m.id === 'u-bytes')).toBe(false);
    second.store.reset();
    expect(second.store.getState().members.some((m) => m.id === 'u-bytes')).toBe(true);
  });

  it('ignora datos guardados corruptos', () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, '{no es json');
    const { store } = setup({ storage });
    expect(store.getState().members.length).toBeGreaterThan(0);
  });
});
