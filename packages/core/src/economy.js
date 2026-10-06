// Reglas del juego de economía. Funciones puras sobre `data.economy`;
// quién persiste los cambios (archivo JSON o localStorage) lo decide el adaptador.

import { UserError } from './errors.js';
import { formatDuration } from './format.js';
import { STOCKS, TRADE_FEE, findStock, priceAt } from './market.js';

export const DAILY_COOLDOWN = 24 * 60 * 60 * 1000;
export const STREAK_WINDOW = 48 * 60 * 60 * 1000;
export const WORK_COOLDOWN = 60 * 60 * 1000;
export const STARTING_WALLET = 100;

export const SHOP_ITEMS = Object.freeze([
  { id: 'cafe', name: '☕ Café doble', price: 60, description: 'Recompensa de `trabajar` +10 % durante la próxima hora.', consumable: true },
  { id: 'portatil', name: '💻 Portátil', price: 1500, description: 'Recompensa de `trabajar` +25 % permanente.' },
  { id: 'licencia', name: '📜 Licencia de trader', price: 900, description: 'Sin comisión al comprar o vender acciones.' },
  { id: 'trofeo', name: '🏆 Trofeo dorado', price: 5000, description: 'Puro prestigio. Aparece junto a tu nombre en el ranking.' },
]);

const JOBS = [
  'arreglaste un bug en producción',
  'diseñaste un logo para una startup',
  'moderaste un servidor de 10.000 miembros',
  'escribiste documentación que alguien leyó',
  'repartiste pizzas a un hackathon',
  'optimizaste una consulta SQL lenta',
  'diste una clase de JavaScript',
];

export function getAccount(economy, userId, now) {
  if (!economy.users[userId]) {
    economy.users[userId] = {
      wallet: STARTING_WALLET,
      bank: 0,
      lastDaily: 0,
      streak: 0,
      lastWork: 0,
      boostUntil: 0,
      inventory: {},
      portfolio: {},
      createdAt: now,
    };
  }
  const acc = economy.users[userId];
  acc.inventory ??= {};
  acc.portfolio ??= {};
  return acc;
}

/** "all"/"todo" → todo lo disponible; números enteros positivos en cualquier otro caso. */
export function parseAmount(input, available) {
  const raw = String(input ?? '').trim().toLowerCase();
  if (['all', 'todo', 'max'].includes(raw)) {
    if (available <= 0) throw new UserError('No tienes saldo suficiente.');
    return Math.floor(available);
  }
  const n = Number(raw.replace(/[._,]/g, ''));
  if (!Number.isInteger(n) || n <= 0) throw new UserError('La cantidad debe ser un número entero positivo o `todo`.');
  if (n > available) throw new UserError(`No tienes suficiente. Disponible: ${Math.floor(available)}.`);
  return n;
}

export function claimDaily(acc, now, baseAmount) {
  const elapsed = now - acc.lastDaily;
  if (elapsed < DAILY_COOLDOWN) {
    throw new UserError(`Ya cobraste tu recompensa diaria. Vuelve en ${formatDuration(DAILY_COOLDOWN - elapsed)}.`, { title: 'Paciencia' });
  }
  acc.streak = elapsed <= STREAK_WINDOW ? Math.min(acc.streak + 1, 7) : 1;
  const amount = baseAmount + (acc.streak - 1) * 25;
  acc.wallet += amount;
  acc.lastDaily = now;
  return { amount, streak: acc.streak };
}

export function work(acc, now, random) {
  const elapsed = now - acc.lastWork;
  if (elapsed < WORK_COOLDOWN) {
    throw new UserError(`Estás agotad@. Puedes volver a trabajar en ${formatDuration(WORK_COOLDOWN - elapsed)}.`, { title: 'Descansa un poco' });
  }
  let amount = 40 + Math.floor(random() * 121);
  let multiplier = 1;
  if (acc.inventory.portatil) multiplier += 0.25;
  if (acc.boostUntil > now) multiplier += 0.1;
  amount = Math.round(amount * multiplier);
  acc.wallet += amount;
  acc.lastWork = now;
  return { amount, job: JOBS[Math.floor(random() * JOBS.length)], multiplier };
}

export function deposit(acc, input) {
  const amount = parseAmount(input, acc.wallet);
  acc.wallet -= amount;
  acc.bank += amount;
  return amount;
}

export function withdraw(acc, input) {
  const amount = parseAmount(input, acc.bank);
  acc.bank -= amount;
  acc.wallet += amount;
  return amount;
}

export function transfer(from, to, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new UserError('La cantidad debe ser un entero positivo.');
  if (amount > from.wallet) throw new UserError(`No tienes suficiente en la cartera (${from.wallet}).`);
  from.wallet -= amount;
  to.wallet += amount;
}

export function buyItem(acc, itemId, now) {
  const item = SHOP_ITEMS.find((i) => i.id === String(itemId ?? '').toLowerCase());
  if (!item) throw new UserError(`Ese artículo no existe. Artículos: ${SHOP_ITEMS.map((i) => `\`${i.id}\``).join(', ')}.`);
  if (!item.consumable && acc.inventory[item.id]) throw new UserError(`Ya tienes ${item.name}.`);
  if (acc.wallet < item.price) throw new UserError(`${item.name} cuesta ${item.price} y tienes ${acc.wallet} en la cartera.`);
  acc.wallet -= item.price;
  if (item.consumable) acc.boostUntil = Math.max(acc.boostUntil, now) + WORK_COOLDOWN;
  else acc.inventory[item.id] = 1;
  return item;
}

export function coinflip(acc, input, side, random) {
  const amount = parseAmount(input, acc.wallet);
  const result = random() < 0.5 ? 'cara' : 'cruz';
  const won = result === side;
  acc.wallet += won ? amount : -amount;
  return { amount, result, won };
}

const feeFor = (acc) => (acc.inventory.licencia ? 0 : TRADE_FEE);

export function buyStock(acc, ticker, shares, now) {
  const stock = findStock(ticker);
  if (!stock) throw new UserError(`Ticker desconocido. Disponibles: ${STOCKS.map((s) => s.ticker).join(', ')}.`);
  if (!Number.isInteger(shares) || shares <= 0) throw new UserError('Indica un número entero de acciones.');
  const price = priceAt(stock, now);
  const cost = Math.ceil(price * shares * (1 + feeFor(acc)));
  if (cost > acc.wallet) throw new UserError(`Necesitas ${cost} y tienes ${acc.wallet} en la cartera.`);
  acc.wallet -= cost;
  const pos = (acc.portfolio[stock.ticker] ??= { shares: 0, invested: 0 });
  pos.shares += shares;
  pos.invested += cost;
  return { stock, shares, price, cost };
}

export function sellStock(acc, ticker, input, now) {
  const stock = findStock(ticker);
  if (!stock) throw new UserError(`Ticker desconocido. Disponibles: ${STOCKS.map((s) => s.ticker).join(', ')}.`);
  const pos = acc.portfolio[stock.ticker];
  if (!pos?.shares) throw new UserError(`No tienes acciones de ${stock.ticker}.`);
  const shares = parseAmount(input, pos.shares);
  const price = priceAt(stock, now);
  const revenue = Math.floor(price * shares * (1 - feeFor(acc)));
  const costBasis = (pos.invested / pos.shares) * shares;
  pos.shares -= shares;
  pos.invested -= costBasis;
  if (pos.shares === 0) delete acc.portfolio[stock.ticker];
  acc.wallet += revenue;
  return { stock, shares, price, revenue, profit: revenue - costBasis };
}

export function portfolioValue(acc, now) {
  return Object.entries(acc.portfolio ?? {}).reduce((sum, [ticker, pos]) => {
    const stock = findStock(ticker);
    return stock ? sum + priceAt(stock, now) * pos.shares : sum;
  }, 0);
}

export const netWorth = (acc, now) => acc.wallet + acc.bank + portfolioValue(acc, now);

export function leaderboard(economy, now, limit = 10) {
  return Object.entries(economy.users)
    .map(([userId, acc]) => ({ userId, total: netWorth(acc, now), trophy: Boolean(acc.inventory?.trofeo) }))
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
}

