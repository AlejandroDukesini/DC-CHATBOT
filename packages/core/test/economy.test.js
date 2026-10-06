import { describe, expect, it } from 'vitest';
import { DAILY_COOLDOWN, STOCKS, WORK_COOLDOWN, normalizeGuildData, priceAt, quote, runCommand, sparkline } from '../src/index.js';
import { createContext, member, text } from './helpers.js';

const sam = member('sam', { name: 'Sam' });
const marta = member('marta', { name: 'Marta' });

const richAccount = (wallet) => ({ wallet, bank: 0, inventory: {}, portfolio: {}, lastDaily: 0, lastWork: 0, streak: 0, boostUntil: 0 });

function setup() {
  const env = createContext({ author: sam, members: [marta] });
  const data = () => normalizeGuildData(env.getStored());
  const run = async (cmd) => (await runCommand(cmd, env.ctx)).reply;
  const tick = (ms) => {
    env.ctx.clock += ms;
    env.ctx.cooldowns.clear();
  };
  return { ...env, data, run, tick };
}

describe('economía', () => {
  it('crea la cuenta con saldo inicial', async () => {
    const { run, data } = setup();
    expect(text(await run('&balance'))).toContain('Finanzas de Sam');
    expect(data().economy.users.sam.wallet).toBe(100);
  });

  it('diario: respeta el cooldown y aumenta la racha', async () => {
    const { run, data, tick } = setup();
    await run('&diario');
    expect(data().economy.users.sam.wallet).toBe(300);
    tick(1000);
    expect(text(await run('&diario'))).toContain('Vuelve en');
    tick(DAILY_COOLDOWN);
    await run('&diario');
    expect(data().economy.users.sam).toMatchObject({ streak: 2, wallet: 300 + 225 });
  });

  it('la racha se reinicia si pasan más de 48 h', async () => {
    const { run, data, tick } = setup();
    await run('&diario');
    tick(3 * DAILY_COOLDOWN);
    await run('&diario');
    expect(data().economy.users.sam.streak).toBe(1);
  });

  it('trabajar: paga entre 40 y 160 y tiene cooldown de una hora', async () => {
    const { run, data, tick } = setup();
    await run('&trabajar');
    const earned = data().economy.users.sam.wallet - 100;
    expect(earned).toBeGreaterThanOrEqual(40);
    expect(earned).toBeLessThanOrEqual(160);
    tick(WORK_COOLDOWN - 60_000);
    expect(text(await run('&trabajar'))).toContain('agotad@');
  });

  it('banco: depositar y retirar con "todo"', async () => {
    const { run, data, tick } = setup();
    await run('&depositar todo');
    expect(data().economy.users.sam).toMatchObject({ wallet: 0, bank: 100 });
    tick(2000);
    await run('&retirar 40');
    expect(data().economy.users.sam).toMatchObject({ wallet: 40, bank: 60 });
  });

  it('pagar: transfiere y rechaza importes imposibles o a uno mismo', async () => {
    const { run, data, tick } = setup();
    await run('&pagar @marta 30');
    expect(data().economy.users.sam.wallet).toBe(70);
    expect(data().economy.users.marta.wallet).toBe(130);
    tick(2000);
    expect(text(await run('&pagar @marta 5000'))).toContain('No tienes suficiente');
    tick(2000);
    expect(text(await run('&pagar @sam 5'))).toContain('a ti mism@');
  });

  it('tienda: el portátil no se puede comprar dos veces', async () => {
    const { ctx, run, data, tick } = setup();
    await ctx.store.write({ economy: { users: { sam: richAccount(4000) } } });
    await run('&comprar portatil');
    expect(data().economy.users.sam.inventory.portatil).toBe(1);
    tick(2000);
    expect(text(await run('&comprar portatil'))).toContain('Ya tienes');
  });

  it('apostar usa el generador aleatorio inyectado', async () => {
    const { ctx, run, data } = setup();
    ctx.random = () => 0.1; // cara
    await run('&apostar 50 cara');
    expect(data().economy.users.sam.wallet).toBe(150);
  });

  it('acciones: comprar, valorar y vender con comisión', async () => {
    const { ctx, run, data, tick } = setup();
    await ctx.store.write({ economy: { users: { sam: richAccount(10_000) } } });
    const nexo = STOCKS.find((s) => s.ticker === 'NEXO');
    const price = priceAt(nexo, ctx.now());
    await run('&invertir nexo 10');
    const after = data().economy.users.sam;
    expect(after.portfolio.NEXO.shares).toBe(10);
    expect(after.wallet).toBe(10_000 - Math.ceil(price * 10 * 1.01));
    tick(2000);
    await run('&vender nexo todo');
    expect(data().economy.users.sam.portfolio.NEXO).toBeUndefined();
    expect(data().economy.users.sam.wallet).toBe(after.wallet + Math.floor(price * 10 * 0.99));
  });
});

describe('mercado', () => {
  it('los precios son deterministas y cambian por tramos de 10 minutos', () => {
    const s = STOCKS[0];
    const start = 1_700_000_000_000 - (1_700_000_000_000 % 600_000);
    expect(priceAt(s, start)).toBe(priceAt(s, start + 599_999));
    expect(quote(s, start).history).toHaveLength(12);
  });

  it('los precios se mantienen positivos durante un año simulado', () => {
    for (const s of STOCKS) {
      for (let i = 0; i < 52_560; i += 97) expect(priceAt(s, i * 600_000)).toBeGreaterThan(0);
    }
  });

  it('sparkline dibuja una barra por valor', () => {
    expect(sparkline([1, 2, 3, 4])).toBe('▁▃▆█');
  });
});
