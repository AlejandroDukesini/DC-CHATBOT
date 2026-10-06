import { UserError } from '../errors.js';
import { COLORS, embed, formatDuration, formatMoney, mention, reply } from '../format.js';
import * as eco from '../economy.js';
import { STOCKS, TRADE_FEE, formatChange, quote, sparkline } from '../market.js';

const money = (data, n) => formatMoney(n, data.config.currency);
const account = (ctx, data, member = ctx.author) => eco.getAccount(data.economy, member.id, ctx.now());

const TICKER_CHOICES = STOCKS.map((s) => s.ticker.toLowerCase());

export default [
  {
    name: 'balance',
    aliases: ['bal', 'saldo'],
    category: 'economia',
    description: 'Muestra la cartera, el banco y el patrimonio de un miembro.',
    options: [{ name: 'usuario', type: 'user', description: 'Miembro a consultar (por defecto, tú)' }],
    examples: ['balance', 'balance @Marta'],
    data: 'write',
    run(ctx, args, data) {
      const member = args.usuario ?? ctx.author;
      const acc = account(ctx, data, member);
      const stocks = eco.portfolioValue(acc, ctx.now());
      return reply({
        title: `💰 Finanzas de ${member.displayName}`,
        color: COLORS.economy,
        fields: [
          { name: 'Cartera', value: money(data, acc.wallet), inline: true },
          { name: 'Banco', value: money(data, acc.bank), inline: true },
          { name: 'Acciones', value: money(data, stocks), inline: true },
          { name: 'Patrimonio total', value: `**${money(data, acc.wallet + acc.bank + stocks)}**` },
        ],
        footer: acc.streak ? `Racha diaria: ${acc.streak} día(s)` : 'Usa diario y trabajar para ganar monedas',
      });
    },
  },
  {
    name: 'diario',
    aliases: ['daily'],
    category: 'economia',
    description: 'Cobra tu recompensa diaria. Si cobras días seguidos, la racha aumenta el premio.',
    examples: ['diario'],
    data: 'write',
    run(ctx, args, data) {
      const { amount, streak } = eco.claimDaily(account(ctx, data), ctx.now(), data.config.dailyAmount);
      return reply({
        title: '🎁 Recompensa diaria',
        description: `Has cobrado **${money(data, amount)}**.\nRacha actual: **${streak}** día(s) (máx. 7, +25 por día).`,
        color: COLORS.success,
      });
    },
  },
  {
    name: 'trabajar',
    aliases: ['work'],
    category: 'economia',
    description: 'Trabaja una vez por hora para ganar monedas.',
    examples: ['trabajar'],
    data: 'write',
    run(ctx, args, data) {
      const r = eco.work(account(ctx, data), ctx.now(), ctx.random);
      return reply({
        title: '🛠️ Jornada completada',
        description: `Hoy ${r.job} y ganaste **${money(data, r.amount)}**.`,
        color: COLORS.success,
        footer: r.multiplier > 1 ? `Bonificación activa: ×${r.multiplier.toFixed(2)}` : 'Compra un portátil en la tienda para ganar más',
      });
    },
  },
  {
    name: 'depositar',
    aliases: ['dep', 'deposit'],
    category: 'economia',
    description: 'Guarda monedas en el banco (las apuestas solo usan la cartera).',
    options: [{ name: 'cantidad', type: 'string', description: 'Número o "todo"', required: true }],
    examples: ['depositar 500', 'depositar todo'],
    data: 'write',
    run(ctx, args, data) {
      const amount = eco.deposit(account(ctx, data), args.cantidad);
      return reply({ title: '🏦 Depósito realizado', description: `Guardaste **${money(data, amount)}** en el banco.`, color: COLORS.economy });
    },
  },
  {
    name: 'retirar',
    aliases: ['withdraw', 'with'],
    category: 'economia',
    description: 'Saca monedas del banco a tu cartera.',
    options: [{ name: 'cantidad', type: 'string', description: 'Número o "todo"', required: true }],
    examples: ['retirar 200'],
    data: 'write',
    run(ctx, args, data) {
      const amount = eco.withdraw(account(ctx, data), args.cantidad);
      return reply({ title: '🏦 Retiro realizado', description: `Retiraste **${money(data, amount)}**.`, color: COLORS.economy });
    },
  },
  {
    name: 'pagar',
    aliases: ['pay'],
    category: 'economia',
    description: 'Transfiere monedas de tu cartera a otro miembro.',
    options: [
      { name: 'usuario', type: 'user', description: 'Quién recibe el pago', required: true },
      { name: 'cantidad', type: 'integer', description: 'Monedas a enviar', required: true, min: 1 },
    ],
    examples: ['pagar @Marta 150'],
    data: 'write',
    run(ctx, args, data) {
      if (args.usuario.id === ctx.author.id) throw new UserError('No puedes pagarte a ti mism@.');
      if (args.usuario.isBot) throw new UserError('Los bots no necesitan dinero.');
      eco.transfer(account(ctx, data), account(ctx, data, args.usuario), args.cantidad);
      return reply({
        title: '💸 Pago enviado',
        description: `${mention(ctx.author)} pagó **${money(data, args.cantidad)}** a ${mention(args.usuario)}.`,
        color: COLORS.success,
      });
    },
  },
  {
    name: 'tienda',
    aliases: ['shop'],
    category: 'economia',
    description: 'Lista los artículos que puedes comprar y sus efectos.',
    examples: ['tienda'],
    data: 'read',
    run(ctx, args, data) {
      return reply({
        title: '🛒 Tienda',
        color: COLORS.economy,
        fields: eco.SHOP_ITEMS.map((i) => ({ name: `${i.name} · ${money(data, i.price)}`, value: `${i.description}\n\`comprar ${i.id}\`` })),
      });
    },
  },
  {
    name: 'comprar',
    aliases: ['buy'],
    category: 'economia',
    description: 'Compra un artículo de la tienda.',
    options: [{ name: 'articulo', type: 'string', description: 'Id del artículo', required: true, choices: eco.SHOP_ITEMS.map((i) => i.id) }],
    examples: ['comprar portatil'],
    data: 'write',
    run(ctx, args, data) {
      const item = eco.buyItem(account(ctx, data), args.articulo, ctx.now());
      return reply({ title: '🛍️ Compra realizada', description: `Compraste **${item.name}** por ${money(data, item.price)}.\n${item.description}`, color: COLORS.success });
    },
  },
  {
    name: 'inventario',
    aliases: ['inv'],
    category: 'economia',
    description: 'Muestra tus artículos y bonificaciones activas.',
    examples: ['inventario'],
    data: 'write',
    run(ctx, args, data) {
      const acc = account(ctx, data);
      const items = eco.SHOP_ITEMS.filter((i) => acc.inventory[i.id]).map((i) => `${i.name} — ${i.description}`);
      if (acc.boostUntil > ctx.now()) items.push(`☕ Café activo (${formatDuration(acc.boostUntil - ctx.now())} restantes)`);
      return reply({ title: '🎒 Inventario', description: items.join('\n') || 'Vacío. Visita la `tienda`.', color: COLORS.economy });
    },
  },
  {
    name: 'ranking',
    aliases: ['top', 'leaderboard'],
    category: 'economia',
    description: 'Los 10 miembros con mayor patrimonio (cartera + banco + acciones).',
    examples: ['ranking'],
    data: 'read',
    run(ctx, args, data) {
      const rows = eco.leaderboard(data.economy, ctx.now());
      const medals = ['🥇', '🥈', '🥉'];
      return reply({
        title: '🏆 Ranking de patrimonio',
        color: COLORS.economy,
        description: rows.length
          ? rows.map((r, i) => `${medals[i] ?? `**${i + 1}.**`} <@${r.userId}> — ${money(data, r.total)}${r.trophy ? ' 🏆' : ''}`).join('\n')
          : 'Nadie tiene cuenta todavía. Empieza con `diario`.',
      });
    },
  },
  {
    name: 'apostar',
    aliases: ['coinflip', 'cf'],
    category: 'economia',
    description: 'Lanza una moneda: si aciertas, duplicas la apuesta.',
    options: [
      { name: 'cantidad', type: 'string', description: 'Número o "todo"', required: true },
      { name: 'lado', type: 'string', description: 'cara o cruz', required: true, choices: ['cara', 'cruz'] },
    ],
    examples: ['apostar 100 cara'],
    data: 'write',
    cooldownMs: 3000,
    run(ctx, args, data) {
      const r = eco.coinflip(account(ctx, data), args.cantidad, args.lado, ctx.random);
      return reply({
        title: r.won ? '🪙 ¡Ganaste!' : '🪙 Perdiste',
        description: `Salió **${r.result}**. ${r.won ? `Ganas ${money(data, r.amount)}.` : `Pierdes ${money(data, r.amount)}.`}`,
        color: r.won ? COLORS.success : COLORS.danger,
      });
    },
  },
  {
    name: 'mercado',
    aliases: ['market', 'bolsa'],
    category: 'economia',
    description: 'Cotizaciones del mercado ficticio. Los precios cambian cada 10 minutos.',
    examples: ['mercado'],
    run(ctx) {
      const quotes = STOCKS.map((s) => quote(s, ctx.now()));
      return reply({
        title: '📈 Mercado de valores',
        color: COLORS.economy,
        description: 'Compra con `invertir <ticker> <acciones>` y vende con `vender <ticker> <acciones|todo>`.',
        fields: quotes.map((q) => ({
          name: `${q.ticker} · ${q.name}`,
          value: `**${q.price.toFixed(2)}** ${formatChange(q.change)}\n\`${sparkline(q.history)}\` 24 h: ${formatChange(q.change24h)}`,
          inline: true,
        })),
        footer: `Próxima cotización en ${formatDuration(quotes[0].nextUpdateIn)} · comisión ${TRADE_FEE * 100} %`,
      });
    },
  },
  {
    name: 'invertir',
    aliases: ['comprar-accion'],
    category: 'economia',
    description: 'Compra acciones al precio actual (comisión del 1 % salvo con licencia).',
    options: [
      { name: 'ticker', type: 'string', description: 'Símbolo de la acción', required: true, choices: TICKER_CHOICES },
      { name: 'acciones', type: 'integer', description: 'Número de acciones', required: true, min: 1, max: 100000 },
    ],
    examples: ['invertir nexo 3'],
    data: 'write',
    run(ctx, args, data) {
      const r = eco.buyStock(account(ctx, data), args.ticker, args.acciones, ctx.now());
      return reply({
        title: '📥 Compra de acciones',
        description: `Compraste **${r.shares} ${r.stock.ticker}** a ${r.price.toFixed(2)} por un total de ${money(data, r.cost)}.`,
        color: COLORS.success,
      });
    },
  },
  {
    name: 'vender',
    aliases: ['vender-accion', 'sell'],
    category: 'economia',
    description: 'Vende acciones al precio actual.',
    options: [
      { name: 'ticker', type: 'string', description: 'Símbolo de la acción', required: true, choices: TICKER_CHOICES },
      { name: 'acciones', type: 'string', description: 'Número o "todo"', required: true },
    ],
    examples: ['vender nexo todo'],
    data: 'write',
    run(ctx, args, data) {
      const r = eco.sellStock(account(ctx, data), args.ticker, args.acciones, ctx.now());
      const sign = r.profit >= 0 ? '+' : '−';
      return reply({
        title: '📤 Venta de acciones',
        description: `Vendiste **${r.shares} ${r.stock.ticker}** a ${r.price.toFixed(2)} y recibiste ${money(data, r.revenue)}.\nResultado: **${sign}${money(data, Math.abs(r.profit))}**`,
        color: r.profit >= 0 ? COLORS.success : COLORS.danger,
      });
    },
  },
  {
    name: 'portafolio',
    aliases: ['portfolio', 'cartera'],
    category: 'economia',
    description: 'Tus acciones, su valor actual y la ganancia o pérdida acumulada.',
    examples: ['portafolio'],
    data: 'write',
    run(ctx, args, data) {
      const acc = account(ctx, data);
      const fields = Object.entries(acc.portfolio).map(([ticker, pos]) => {
        const q = quote(STOCKS.find((s) => s.ticker === ticker), ctx.now());
        const value = q.price * pos.shares;
        const pnl = value - pos.invested;
        return {
          name: `${ticker} × ${pos.shares}`,
          value: `Valor: ${money(data, value)}\nP/G: ${pnl >= 0 ? '▲' : '▼'} ${money(data, Math.abs(pnl))}`,
          inline: true,
        };
      });
      return {
        embeds: [embed({
          title: `📊 Portafolio de ${ctx.author.displayName}`,
          color: COLORS.economy,
          description: fields.length ? undefined : 'No tienes acciones. Mira el `mercado` y usa `invertir`.',
          fields,
        })],
      };
    },
  },
];
