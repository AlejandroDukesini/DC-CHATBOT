// Renderiza en Node el banner que dibuja el núcleo (misma función que usa la demo web).

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { BANNER_SIZE, drawBanner } from '@dc-chatbot/core';

// Solo se descargan avatares del CDN de Discord.
const AVATAR_HOSTS = new Set(['cdn.discordapp.com', 'media.discordapp.net']);

async function loadAvatar(url) {
  try {
    if (!url || !AVATAR_HOSTS.has(new URL(url).hostname)) return null;
    return await loadImage(url);
  } catch {
    return null; // sin avatar se dibujan las iniciales
  }
}

export async function renderBanner(spec) {
  const canvas = createCanvas(BANNER_SIZE.width, BANNER_SIZE.height);
  drawBanner(canvas.getContext('2d'), spec, await loadAvatar(spec.avatarUrl));
  return canvas.encode('png');
}
