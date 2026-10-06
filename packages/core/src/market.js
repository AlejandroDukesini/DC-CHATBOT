// Mercado de acciones ficticio para el juego de finanzas.
// El precio es una función determinista del tiempo: el bot y la demo web
// muestran exactamente las mismas cotizaciones sin compartir estado ni base de datos.

import { hashString } from './format.js';

export const TICK_MS = 10 * 60 * 1000; // una cotización nueva cada 10 minutos
const TICKS_PER_DAY = (24 * 60 * 60 * 1000) / TICK_MS;

export const STOCKS = Object.freeze([
  { ticker: 'NEXO', name: 'Nexo Labs', sector: 'Software', base: 120, volatility: 0.05 },
  { ticker: 'SOLR', name: 'Solaris Energía', sector: 'Energía', base: 48, volatility: 0.08 },
  { ticker: 'BYTE', name: 'ByteBank', sector: 'Finanzas', base: 310, volatility: 0.035 },
  { ticker: 'MOON', name: 'MoonCoin', sector: 'Cripto', base: 9, volatility: 0.16 },
]);

export const TRADE_FEE = 0.01;

export function findStock(ticker) {
  const t = String(ticker ?? '').toUpperCase();
  return STOCKS.find((s) => s.ticker === t) ?? null;
}

// Ruido pseudoaleatorio en [-1, 1] estable para (ticker, tick).
function noise(ticker, tick) {
  return (hashString(`${ticker}:${tick}`) / 0xffffffff) * 2 - 1;
}

export function priceAtTick(stock, tick) {
  const seed = hashString(stock.ticker) % 1000;
  const trend = 1 + 0.22 * Math.sin(tick / 41 + seed) + 0.1 * Math.sin(tick / 13 + seed * 2);
  const jitter = 1 + stock.volatility * noise(stock.ticker, tick);
  return Math.max(0.5, Math.round(stock.base * trend * jitter * 100) / 100);
}

export const tickAt = (now) => Math.floor(now / TICK_MS);
export const priceAt = (stock, now) => priceAtTick(stock, tickAt(now));

export function quote(stock, now) {
  const tick = tickAt(now);
  const price = priceAtTick(stock, tick);
  const prev = priceAtTick(stock, tick - 1);
  const dayAgo = priceAtTick(stock, tick - TICKS_PER_DAY);
  const history = Array.from({ length: 12 }, (_, i) => priceAtTick(stock, tick - 11 + i));
  return {
    ...stock,
    price,
    change: (price - prev) / prev,
    change24h: (price - dayAgo) / dayAgo,
    history,
    nextUpdateIn: TICK_MS - (now % TICK_MS),
  };
}

const BARS = '▁▂▃▄▅▆▇█';
export function sparkline(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((v) => BARS[Math.round(((v - min) / span) * (BARS.length - 1))]).join('');
}

export function formatChange(ratio) {
  const pct = (ratio * 100).toFixed(2);
  return ratio >= 0 ? `▲ +${pct}%` : `▼ ${pct}%`;
}
