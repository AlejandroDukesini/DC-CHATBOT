// Dibujo del banner de bienvenida con la API estándar de Canvas 2D.
// El mismo código se ejecuta en el navegador (<canvas>) y en el bot (@napi-rs/canvas).

export const BANNER_SIZE = Object.freeze({ width: 1024, height: 360 });
export const BANNER_THEMES = Object.freeze(['aurora', 'noche', 'solido']);

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';

export function bannerSpec({ member, guild, config, title = '¡BIENVENID@!' }) {
  return {
    title,
    username: member.displayName ?? member.name,
    subtitle: `${guild.name} · miembro #${guild.memberCount ?? '?'}`,
    avatarUrl: member.avatarUrl ?? null,
    accent: config.bannerColor,
    theme: config.bannerTheme,
  };
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '');
  const n = m ? parseInt(m[1], 16) : 0x5865f2;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgba = ([r, g, b], a) => `rgba(${r}, ${g}, ${b}, ${a})`;

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(ctx, text, maxWidth, size, weight) {
  let s = size;
  ctx.font = `${weight} ${s}px ${FONT}`;
  while (s > 18 && ctx.measureText(text).width > maxWidth) {
    s -= 2;
    ctx.font = `${weight} ${s}px ${FONT}`;
  }
}

const initials = (name) =>
  String(name).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';

/**
 * @param ctx  contexto 2D (navegador o @napi-rs/canvas)
 * @param spec resultado de bannerSpec()
 * @param avatar imagen ya cargada (opcional); sin ella se dibujan las iniciales
 */
export function drawBanner(ctx, spec, avatar = null) {
  const { width: W, height: H } = BANNER_SIZE;
  const accent = hexToRgb(spec.accent);

  // Fondo
  if (spec.theme === 'solido') {
    ctx.fillStyle = rgba(accent, 1);
    ctx.fillRect(0, 0, W, H);
  } else {
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, spec.theme === 'noche' ? '#0b0d12' : '#111427');
    bg.addColorStop(1, spec.theme === 'noche' ? '#1a1d26' : rgba(accent, 0.9));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    if (spec.theme === 'aurora') {
      ctx.fillStyle = rgba(accent, 0.25);
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.1, 220, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Tarjeta
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  roundedRect(ctx, 32, 32, W - 64, H - 64, 24);
  ctx.fill();

  // Avatar
  const cx = 180;
  const cy = H / 2;
  const r = 100;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (avatar) {
    ctx.drawImage(avatar, cx - r, cy - r, r * 2, r * 2);
  } else {
    ctx.fillStyle = rgba(accent, 1);
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 72px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(spec.username), cx, cy + 4);
  }
  ctx.restore();

  // Textos
  const tx = 330;
  const maxW = W - tx - 72;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = `600 30px ${FONT}`;
  ctx.fillText(spec.title, tx, 140);
  ctx.fillStyle = '#ffffff';
  fitText(ctx, spec.username, maxW, 64, 'bold');
  ctx.fillText(spec.username, tx, 215);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  fitText(ctx, spec.subtitle, maxW, 26, '500');
  ctx.fillText(spec.subtitle, tx, 265);
}
