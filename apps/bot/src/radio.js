// Reproducción de radio en canales de voz con @discordjs/voice + FFmpeg.

import { spawn } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import {
  NoSubscriberBehavior, StreamType, VoiceConnectionStatus,
  createAudioPlayer, createAudioResource, entersState, joinVoiceChannel,
} from '@discordjs/voice';
import { PermissionFlagsBits } from 'discord.js';
import ffmpegPath from 'ffmpeg-static';
import { UserError, isPrivateAddress } from '@dc-chatbot/core';

/** La validación del núcleo revisa el texto del enlace; aquí se comprueba la IP real tras el DNS. */
async function assertPublicHost(url) {
  const { hostname } = new URL(url);
  let addresses;
  try {
    addresses = await lookup(hostname.replace(/^\[|\]$/g, ''), { all: true });
  } catch {
    throw new UserError(`No pude resolver ${hostname}. Revisa el enlace.`);
  }
  if (addresses.some((a) => isPrivateAddress(a.address))) throw new UserError('Ese enlace apunta a una red privada y no está permitido.');
}

export class RadioManager {
  constructor(logger) {
    this.logger = logger;
    this.sessions = new Map();
  }

  async play(guild, member, station) {
    const voice = member.voice?.channel;
    if (!voice) throw new UserError('Entra primero en un canal de voz y vuelve a usar el comando.');
    const perms = voice.permissionsFor(guild.members.me);
    if (!perms?.has([PermissionFlagsBits.Connect, PermissionFlagsBits.Speak])) {
      throw new UserError(`No tengo permiso para conectar y hablar en ${voice.name}.`);
    }
    await assertPublicHost(station.url);

    let session = this.sessions.get(guild.id);
    if (session && session.channelId !== voice.id) {
      this.stop(guild.id);
      session = null;
    }
    if (!session) {
      const connection = joinVoiceChannel({ channelId: voice.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true });
      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      } catch {
        connection.destroy();
        throw new UserError('No pude conectarme al canal de voz. Inténtalo de nuevo.');
      }
      const player = createAudioPlayer({ behaviors: { noSubscriber: NoSubscriberBehavior.Play } });
      player.on('error', (err) => this.logger.error('[radio]', err.message));
      connection.subscribe(player);
      connection.on(VoiceConnectionStatus.Disconnected, () => this.stop(guild.id));
      session = { connection, player, channelId: voice.id };
      this.sessions.set(guild.id, session);
    }

    session.ffmpeg?.kill('SIGKILL');
    // -protocol_whitelist impide que una lista de reproducción redirija a file:// u otros protocolos locales.
    session.ffmpeg = spawn(ffmpegPath ?? 'ffmpeg', [
      '-protocol_whitelist', 'http,https,tcp,tls',
      '-reconnect', '1', '-reconnect_streamed', '1', '-reconnect_delay_max', '5',
      '-i', station.url,
      '-analyzeduration', '0', '-loglevel', 'error',
      '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1',
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    session.ffmpeg.on('error', (err) => this.logger.error('[radio] FFmpeg no disponible:', err.message));
    session.player.play(createAudioResource(session.ffmpeg.stdout, { inputType: StreamType.Raw }));
    session.station = station;
  }

  stop(guildId) {
    const session = this.sessions.get(guildId);
    if (!session) return false;
    this.sessions.delete(guildId);
    session.ffmpeg?.kill('SIGKILL');
    session.player.stop(true);
    if (session.connection.state.status !== VoiceConnectionStatus.Destroyed) session.connection.destroy();
    return true;
  }

  nowPlaying(guildId) {
    return this.sessions.get(guildId)?.station ?? null;
  }

  stopAll() {
    for (const guildId of [...this.sessions.keys()]) this.stop(guildId);
  }
}
